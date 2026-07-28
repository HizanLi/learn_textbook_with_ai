import os
import json
import re
import traceback
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from typing import Optional
from microservices.chunker import MarkdownChunker, save_chunks_to_json
from microservices.vectorization import VectorStorageManager
from microservices.mineru_client import MinerUClient
from llm.analyze_textbook import TextbookAnalyzer
from llm.llm_client import ModelProvider
from scripts.merge_toc_content import map_chunks_to_toc
import uvicorn
from dotenv import load_dotenv

app = FastAPI(
    title="Textbook AI Learner API",
    description="管理PDF处理、文本分块和向量化的统一后端",
    version="1.0.0"
)

# --- 定义请求体和响应模型 ---
class MinerUProcessRequest(BaseModel):
    username: str
    file_name: str
    description: str = "PDF file name to process"

class MinerUPrepareRequest(BaseModel):
    username: str
    file_name: str
    description: str = "Count PDF pages and prepare split files after upload"

class ChunkerProcessRequest(BaseModel):
    username: str
    file_name: str
    output_filename: str = "chunker_step_1.json"
    description: str = "Markdown file name to chunk"

class VectorizationStoreRequest(BaseModel):
    username: str
    json_path: str
    collection_name: str = "default_collection"
    description: str = "Path to chunks JSON for vectorization"

class SearchRequest(BaseModel):
    username: str
    collection_name: str
    query: str
    n_results: int = 3

class TextbookAnalysisRequest(BaseModel):
    username: str
    project_name: str
    description: str = "Analyze textbook content and generate learning material"

class SectionAnalysisRetryRequest(BaseModel):
    username: str
    project_name: str
    chapter_number: Optional[int] = None
    section_id: str
    sub_section_id: Optional[str] = None
    description: str = "Regenerate key topic analysis for one section or subsection"

class ParseTocRequest(BaseModel):
    username: str
    project_name: Optional[str] = None
    filename: Optional[str] = None
    toc_string: str
    save_to_disk: bool = True
    description: str = "Parse table-of-contents text into structured JSON"
# --- 初始化组件 ---
chunker = MarkdownChunker()
vector_manager = None
mineru_client = MinerUClient()
analysis_progress = {}
analysis_progress_lock = Lock()
mineru_jobs = {}
mineru_jobs_lock = Lock()


def _mineru_job_snapshot(username: Optional[str] = None):
    with mineru_jobs_lock:
        jobs = list(mineru_jobs.values())
    if username:
        jobs = [job for job in jobs if job.get("username") == username]
    return jobs


@app.get("/api/llm/providers")
async def get_llm_providers():
    """Return the model providers supported by the core LLM client."""
    labels = {
        ModelProvider.OPENAI: "OpenAI",
        ModelProvider.DEEPSEEK: "DeepSeek",
        ModelProvider.GOOGLE: "Google Gemini",
    }
    default_models = {
        ModelProvider.OPENAI: "gpt-4o",
        ModelProvider.DEEPSEEK: "deepseek-chat",
        ModelProvider.GOOGLE: "gemini-3-flash-preview",
    }
    return {
        "providers": [
            {
                "id": provider.value,
                "label": labels[provider],
                "defaultModel": default_models[provider],
            }
            for provider in ModelProvider
        ]
    }


def _analysis_progress_key(username: str, project_name: str) -> str:
    return f"{username}:{project_name}"


def _set_analysis_progress(username: str, project_name: str, **updates):
    key = _analysis_progress_key(username, project_name)
    with analysis_progress_lock:
        current = analysis_progress.get(key, {})
        current.update(updates)
        current["updated_at"] = datetime.now(timezone.utc).isoformat()
        analysis_progress[key] = current
        return current.copy()


def _data_dir_path() -> Path:
    data_dir = os.getenv("DATA_DIR")
    if not data_dir:
        raise HTTPException(status_code=500, detail="DATA_DIR is not configured")
    return Path(data_dir)


def _project_name_from_file(file_name: str) -> str:
    return Path(file_name).stem


def _project_output_dir(data_dir: Path, username: str, project_name: str) -> Path:
    return data_dir / username / "output" / project_name / "hybrid_auto"


def _part_number_from_dir(part_dir: Path) -> Optional[int]:
    match = re.search(r"part_(\d+)$", part_dir.name)
    return int(match.group(1)) if match else None


def _find_part_markdown(part_dir: Path, part_pdf_stem: Optional[str] = None) -> Optional[Path]:
    candidates = []
    if part_pdf_stem:
        candidates.extend([
            part_dir / f"{part_pdf_stem}.md",
            part_dir / "mineru_output" / f"{part_pdf_stem}.md",
        ])

    candidates.extend(sorted(part_dir.glob("*.md")))
    mineru_output_dir = part_dir / "mineru_output"
    if mineru_output_dir.exists():
        candidates.extend(sorted(mineru_output_dir.rglob("*.md")))

    for candidate in candidates:
        if candidate.exists() and candidate.is_file() and candidate.stat().st_size > 0:
            return candidate
    return None


def _split_roots(data_dir: Path, username: str, file_name: str):
    safe_name = Path(file_name).name
    project_name = Path(file_name).stem
    pdf_name = f"{Path(file_name).stem}.pdf"
    # Current upload layout keeps split PDFs under input/<project_name>/.
    yield data_dir / username / "input" / project_name
    # Backward-compatible fallbacks for older extension-named split roots.
    yield data_dir / username / "input" / safe_name
    if pdf_name != safe_name:
        yield data_dir / username / "input" / pdf_name
    # Legacy/alternate split roots beside input/.
    yield data_dir / username / project_name
    yield data_dir / username / safe_name
    if pdf_name != safe_name:
        yield data_dir / username / pdf_name


def _output_split_roots(data_dir: Path, username: str, file_name: str):
    safe_name = Path(file_name).name
    project_name = Path(file_name).stem
    pdf_name = f"{Path(file_name).stem}.pdf"
    yield data_dir / username / "output" / project_name
    yield data_dir / username / "output" / safe_name
    if pdf_name != safe_name:
        yield data_dir / username / "output" / pdf_name


def _process_split_markdown_batch(
    username: str,
    file_name: str,
    output_filename: str,
):
    data_dir = _data_dir_path()
    project_name = _project_name_from_file(file_name)
    output_dir = _project_output_dir(data_dir, username, project_name)
    output_dir.mkdir(parents=True, exist_ok=True)

    split_root = next((root for root in _split_roots(data_dir, username, file_name) if root.exists()), None)
    output_split_root = next(
        (root for root in _output_split_roots(data_dir, username, file_name) if root.exists()),
        None,
    )
    if not split_root:
        raise HTTPException(
            status_code=404,
            detail=f"Split PDF directory not found for {file_name}. Expected input/<filename>/part_*/.",
        )

    part_records = []
    manifest_path = split_root / "manifest.json"
    if manifest_path.exists():
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            for manifest_part in manifest.get("parts", []):
                pdf_path = Path(manifest_part.get("pdf_path", ""))
                if not pdf_path.exists():
                    continue
                markdown_path = Path(manifest_part["markdown_path"]) if manifest_part.get("markdown_path") else None
                output_part_dir = Path(manifest_part["output_part_dir"]) if manifest_part.get("output_part_dir") else None
                part_records.append({
                    "part_dir": pdf_path.parent,
                    "part_number": manifest_part.get("index") or _part_number_from_dir(pdf_path.parent),
                    "part_pdf": pdf_path,
                    "output_part_dir": output_part_dir,
                    "markdown_path": markdown_path,
                })
        except Exception as error:
            print(f"Unable to read split manifest {manifest_path}: {error}")

    if not part_records:
        part_dirs = sorted(
            [path for path in split_root.glob("part_*") if path.is_dir()],
            key=lambda path: _part_number_from_dir(path) or 0,
        )
        part_records = [
            {
                "part_dir": part_dir,
                "part_number": _part_number_from_dir(part_dir),
                "part_pdf": next(iter(sorted(part_dir.glob("*.pdf"))), None),
                "output_part_dir": output_split_root / part_dir.name if output_split_root else None,
                "markdown_path": None,
            }
            for part_dir in part_dirs
        ]

    if not part_records:
        raise HTTPException(status_code=404, detail=f"No split PDF part directories found in {split_root}")

    combined_chunks = []
    missing_parts = []
    processed_parts = []

    for record in sorted(part_records, key=lambda item: item["part_number"] or 0):
        part_dir = record["part_dir"]
        part_number = record["part_number"]
        part_pdf = record["part_pdf"]
        output_part_dir = record["output_part_dir"]
        manifest_markdown_path = record["markdown_path"]
        markdown_path = (
            manifest_markdown_path
            if manifest_markdown_path and manifest_markdown_path.exists() and manifest_markdown_path.stat().st_size > 0
            else None
        ) or (
            _find_part_markdown(output_part_dir, part_pdf.stem if part_pdf else None)
            if output_part_dir and output_part_dir.exists()
            else None
        ) or _find_part_markdown(part_dir, part_pdf.stem if part_pdf else None)
        if not markdown_path:
            missing_parts.append(part_dir.name)
            continue

        part_chunks = chunker.process_markdown_file_to_chunks(markdown_path)
        for chunk in part_chunks:
            enriched_chunk = dict(chunk)
            enriched_chunk["source_part"] = part_dir.name
            enriched_chunk["source_markdown"] = str(markdown_path)
            if part_number is not None:
                enriched_chunk["part_number"] = part_number
            combined_chunks.append(enriched_chunk)
        processed_parts.append({
            "part": part_dir.name,
            "markdown_path": str(markdown_path),
            "chunks_count": len(part_chunks),
        })

    if missing_parts:
        raise HTTPException(
            status_code=404,
            detail=(
                "Some split PDF parts have no Markdown yet. Run /api/mineru/process "
                f"for {file_name} first, or convert these parts: {', '.join(missing_parts)}"
            ),
        )

    output_path = output_dir / output_filename
    success, error = save_chunks_to_json(combined_chunks, output_path)
    if not success:
        raise HTTPException(status_code=500, detail=error or "Failed to save combined split chunks")

    return {
        "markdown_path": None,
        "output_path": str(output_path),
        "chunks_count": len(combined_chunks),
        "source": "split_parts",
        "split_root": str(split_root),
        "processed_parts": processed_parts,
    }

# ============================================================================
# 1. MinerU PDF 处理端点
# ============================================================================

@app.post("/api/mineru/prepare")
async def prepare_pdf(request: MinerUPrepareRequest):
    """Count pages and split a large PDF before MinerU conversion begins."""
    result = await run_in_threadpool(
        mineru_client.prepare_file,
        request.username,
        request.file_name,
    )
    if result["success"]:
        return result
    raise HTTPException(status_code=result["status_code"], detail=result["message"])

@app.post("/api/mineru/process")
async def process_pdf(request: MinerUProcessRequest, background_tasks: BackgroundTasks):
    """
    调用 MinerU 处理 PDF 文件并转换为 Markdown
    - 输入：用户名 + PDF 文件名
    - 输出：Markdown 文件路径和状态
    """
    job_key = f"{request.username}:{request.file_name}"

    def run_mineru_job(username: str, file_name: str, key: str):
        try:
            mineru_client.process_file(username=username, file_name=file_name)
        except Exception:
            traceback.print_exc()
        finally:
            with mineru_jobs_lock:
                mineru_jobs.pop(key, None)

    with mineru_jobs_lock:
        existing_job = mineru_jobs.get(job_key)
        if existing_job:
            return {
                "success": True,
                "status_code": 202,
                "message": "PDF processing is already running",
                "data": existing_job,
            }
        mineru_jobs[job_key] = {
            "status": "processing",
            "username": request.username,
            "file_name": request.file_name,
            "project_name": Path(request.file_name).stem,
            "started_at": datetime.now(timezone.utc).isoformat(),
        }

    background_tasks.add_task(run_mineru_job, request.username, request.file_name, job_key)
    return {
        "success": True,
        "status_code": 202,
        "message": "PDF processing started",
        "data": {
            "status": "processing",
            "username": request.username,
            "file_name": request.file_name,
            "project_name": Path(request.file_name).stem,
        },
    }


@app.get("/api/mineru/jobs")
async def get_mineru_jobs(username: Optional[str] = None):
    """Return MinerU jobs currently active in this Python process."""
    jobs = _mineru_job_snapshot(username)
    return {
        "success": True,
        "status_code": 200,
        "data": {
            "jobs": jobs,
            "count": len(jobs),
        },
    }

# ============================================================================
# 2. 文本分块端点
# ============================================================================

@app.post("/api/chunker/process")
async def process_chunking(request: ChunkerProcessRequest):
    """
    Chunk a project's Markdown.

    For normal PDFs, this chunks the merged Markdown at:
    data/<user>/output/<project>/hybrid_auto/<project>.md

    For long PDFs that were split into part PDFs, this endpoint falls back to
    batch chunking part Markdown files from:
    data/<user>/input/<filename>/part_*/
    data/<user>/<filename>/part_*/
    """
    try:
        data_dir = _data_dir_path()
        project_name = _project_name_from_file(request.file_name)
        project_output_dir = _project_output_dir(data_dir, request.username, project_name)
        markdown_path = project_output_dir / request.file_name

        if not markdown_path.exists():
            batch_result = _process_split_markdown_batch(
                username=request.username,
                file_name=request.file_name,
                output_filename=request.output_filename,
            )
            return {
                "success": True,
                "status_code": 200,
                "message": "Split Markdown batch chunking succeeded",
                "data": batch_result,
            }

        success, error = chunker.process_markdown(
            markdown_file=markdown_path,
            output_file=request.output_filename,
        )

        if not success:
            if error and "not found" in error.lower():
                raise HTTPException(status_code=404, detail=error)
            raise HTTPException(status_code=500, detail=error or "Chunking failed")

        output_path = project_output_dir / request.output_filename

        chunks_count = None
        try:
            with open(output_path, "r", encoding="utf-8") as f:
                chunks = json.load(f)
            chunks_count = len(chunks) if isinstance(chunks, list) else None
        except Exception:
            chunks_count = None

        return {
            "success": True,
            "status_code": 200,
            "message": "Markdown chunking succeeded",
            "data": {
                "markdown_path": str(markdown_path),
                "output_path": str(output_path),
                "chunks_count": chunks_count,
                "source": "merged_markdown",
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chunking error: {str(e)}")
# ============================================================================
# 3. 向量化和存储端点
# ============================================================================

@app.post("/api/vectorization/store")
async def vectorize_and_store(request: VectorizationStoreRequest):
    """
    加载 chunks.json 并进行向量化存储到 ChromaDB
    - 注入标题上下文
    - 修复元数据
    - 批量写入数据库
    - 如果集合已存在，则跳过向量化（幂等性）
    """
    try:
        # 构建用户特定的数据库路径
        data_dir = os.getenv("DATA_DIR")
        if not data_dir:
            raise HTTPException(status_code=500, detail="DATA_DIR is not configured")
        
        user_db_path = os.path.join(data_dir, request.username, "chroma_db")
        
        # 创建 VectorStorageManager 并指定用户特定的db路径
        vector_manager = VectorStorageManager(request.collection_name, db_path=user_db_path)
        
        # 加载分块数据
        chunks = vector_manager.load_chunks(request.json_path)
        
        # 执行向量化和存储（如果已存在则跳过）
        vector_manager.process_and_store(chunks)
        
        return {
            "success": True,
            "status_code": 200,
            "message": f"成功向量化 {len(chunks)} 个分块",
            "data": {
                "chunks_count": len(chunks),
                "collection_name": vector_manager.collection.name,
                "db_path": vector_manager.db_path
            }
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"向量化出错: {str(e)}")

# ============================================================================
# 4. 语义搜索端点
# ============================================================================

@app.post("/api/vectorization/search")
async def semantic_search(request: SearchRequest):
    """
    对已向量化的知识库进行语义搜索
    """
    try:
        # 构建用户特定的数据库路径
        data_dir = os.getenv("DATA_DIR")
        if not data_dir:
            raise HTTPException(status_code=500, detail="DATA_DIR is not configured")
        
        user_db_path = os.path.join(data_dir, request.username, "chroma_db")
        
        # 根据 collection_name 加载 VectorStorageManager
        vm = VectorStorageManager(request.collection_name, db_path=user_db_path)
        
        # 检查集合是否存在
        if not vm.collection_exists():
            raise HTTPException(
                status_code=404, 
                detail=f"集合 '{request.collection_name}' 不存在或为空。请先执行向量化操作。"
            )
        
        # 执行搜索
        results = vm.search(request.query, n_results=request.n_results)
        
        # 格式化响应
        formatted_results = []
        if results.get('documents') and len(results['documents']) > 0:
            for doc, meta, dist in zip(
                results['documents'][0], 
                results['metadatas'][0], 
                results.get('distances', [[]])[0]
            ):
                formatted_results.append({
                    "content": doc,
                    "metadata": {
                        "source": meta.get("source"),
                        "header_1": meta.get("header_1"),
                        "header_2": meta.get("header_2"),
                        "header_3": meta.get("header_3"),
                        "has_image": meta.get("has_image"),
                        "referenced_images": meta.get("referenced_images")
                    },
                    "distance": dist
                })
        
        return {
            "success": True,
            "collection_name": request.collection_name,
            "query": request.query,
            "results_count": len(formatted_results),
            "results": formatted_results
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"搜索出错: {str(e)}")


# ============================================================================
# 5. 教科书分析端点 - 生成学习内容和关键点
# ============================================================================

@app.post("/api/analyze/textbook")
async def analyze_textbook(request: TextbookAnalysisRequest):
    """
    分析教科书内容：加载分块数据和目录，生成每个章节/小节的关键点分析
    """
    try:
        data_dir = os.getenv("DATA_DIR")
        if not data_dir:
            raise HTTPException(status_code=500, detail="DATA_DIR is not configured")
        
        # 构建文件路径
        project_dir = os.path.join(data_dir, request.username, "output", request.project_name, "hybrid_auto")
        textbook_with_content_path = os.path.join(project_dir, "textbook_with_content.json")
        
        if not os.path.exists(textbook_with_content_path):
            raise HTTPException(
                status_code=404, 
                detail=f"textbook_with_content.json not found at {textbook_with_content_path}"
            )
        
        _set_analysis_progress(
            request.username,
            request.project_name,
            status="processing",
            current_chapter=0,
            total_chapters=0,
            chapter_title=None,
            item_title=None,
            error=None,
        )

        def report_chapter_progress(
            current_chapter: int,
            total_chapters: int,
            chapter_title: str,
            item_title: Optional[str] = None,
        ):
            _set_analysis_progress(
                request.username,
                request.project_name,
                status="processing",
                current_chapter=current_chapter,
                total_chapters=total_chapters,
                chapter_title=chapter_title,
                item_title=item_title,
                error=None,
            )

        # 初始化分析器
        analyzer = TextbookAnalyzer()

        # Run the blocking LLM/file workload in a thread so progress requests
        # can still be served while a textbook is being analyzed.
        result = await run_in_threadpool(
            analyzer.generate_chapter_analysis,
            textbook_with_content_path,
            report_chapter_progress,
        )
        _set_analysis_progress(
            request.username,
            request.project_name,
            status="completed",
        )
        
        return {
            "success": True,
            "message": f"分析完成：{request.project_name}",
            "data": {
                "project_name": request.project_name,
                "output_path": textbook_with_content_path,
                "chapters_processed": len(result.get('chapters', []))
            }
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        _set_analysis_progress(
            request.username,
            request.project_name,
            status="failed",
            error=str(e),
        )
        raise HTTPException(status_code=500, detail=f"分析出错: {str(e)}")


@app.get("/api/analyze/progress")
async def get_textbook_analysis_progress(username: str, project_name: str):
    """Return the current in-memory chapter-analysis progress for one project."""
    key = _analysis_progress_key(username, project_name)
    with analysis_progress_lock:
        progress = analysis_progress.get(key)

    return {
        "success": True,
        "data": progress or {
            "status": "idle",
            "current_chapter": 0,
            "total_chapters": 0,
            "chapter_title": None,
            "item_title": None,
            "error": None,
        },
    }


@app.post("/api/analyze/retry-section")
async def retry_section_analysis(request: SectionAnalysisRetryRequest):
    """
    Regenerate key_topics_analysis for one section or subsection in textbook_with_content.json.
    """
    try:
        data_dir = os.getenv("DATA_DIR")
        if not data_dir:
            raise HTTPException(status_code=500, detail="DATA_DIR is not configured")

        project_name = request.project_name.strip().replace(".pdf", "").replace(".md", "")
        project_dir = os.path.join(data_dir, request.username, "output", project_name, "hybrid_auto")
        textbook_with_content_path = os.path.join(project_dir, "textbook_with_content.json")

        if not os.path.exists(textbook_with_content_path):
            raise HTTPException(
                status_code=404,
                detail=f"textbook_with_content.json not found at {textbook_with_content_path}",
            )

        with open(textbook_with_content_path, "r", encoding="utf-8") as f:
            textbook_data = json.load(f)

        target_node = None
        target_chapter = None
        for chapter in textbook_data.get("chapters", []):
            if request.chapter_number is not None and chapter.get("chapter_number") != request.chapter_number:
                continue

            for section in chapter.get("sections", []):
                if str(section.get("section_id")) != str(request.section_id):
                    continue

                target_chapter = chapter
                if request.sub_section_id:
                    for subsection in section.get("sub_sections", []):
                        if str(subsection.get("sub_section_id")) == str(request.sub_section_id):
                            target_node = subsection
                            break
                else:
                    target_node = section
                break

            if target_node:
                break

        if not target_node:
            raise HTTPException(status_code=404, detail="Target section or subsection not found")

        title = (
            target_node.get("section_title")
            or target_node.get("sub_section_title")
            or "Untitled Section"
        )
        content = target_node.get("content", "")
        if not content:
            raise HTTPException(status_code=400, detail="Target section has no content to analyze")

        analyzer = TextbookAnalyzer()
        analysis = await run_in_threadpool(analyzer.extract_key_topics, title, content)
        target_node["key_topics_analysis"] = analysis

        with open(textbook_with_content_path, "w", encoding="utf-8") as f:
            json.dump(textbook_data, f, ensure_ascii=False, indent=4)

        return {
            "success": True,
            "message": "Section analysis regenerated",
            "data": {
                "project_name": project_name,
                "output_path": textbook_with_content_path,
                "chapter_number": target_chapter.get("chapter_number") if target_chapter else request.chapter_number,
                "section_id": request.section_id,
                "sub_section_id": request.sub_section_id,
                "section": target_node,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to regenerate section analysis: {str(e)}")


@app.post("/api/analyze/parse-toc")
async def parse_table_of_content(request: ParseTocRequest):
    """
    使用 LLM 解析目录文本并返回结构化 TOC JSON。
    当 save_to_disk=True 时，将结果保存到项目目录中的 textbook_toc.json。
    """
    try:
        data_dir = os.getenv("DATA_DIR")
        if not data_dir:
            raise HTTPException(status_code=500, detail="DATA_DIR is not configured")

        project_name = (request.filename or request.project_name or "").strip()
        if not project_name:
            raise HTTPException(status_code=400, detail="filename or project_name is required")

        project_dir = os.path.join(
            data_dir,
            request.username,
            "output",
            project_name,
            "hybrid_auto",
        )

        if not os.path.exists(project_dir):
            raise HTTPException(
                status_code=404,
                detail=f"项目目录不存在: {project_dir}",
            )

        chunker_path = os.path.join(project_dir, "chunker_step_1.json")
        toc_path = os.path.join(project_dir, "textbook_toc.json")
        textbook_with_content_path = os.path.join(project_dir, "textbook_with_content.json")

        analyzer = TextbookAnalyzer(chunker_path=chunker_path)

        toc_json = analyzer.parse_table_of_content(
            toc_string=request.toc_string,
            save_to_disk=request.save_to_disk,
        )

        if not toc_json:
            raise HTTPException(status_code=500, detail="目录解析失败，请检查 toc_string 内容")

        if request.save_to_disk:
            if not os.path.exists(chunker_path):
                raise HTTPException(status_code=404, detail=f"chunker_step_1.json not found at {chunker_path}")
            if not os.path.exists(toc_path):
                raise HTTPException(status_code=500, detail=f"textbook_toc.json was not saved at {toc_path}")

            merged_ok = map_chunks_to_toc(toc_path, chunker_path, textbook_with_content_path)
            if not merged_ok:
                raise HTTPException(status_code=500, detail="目录与分块内容合并失败")

        output_path = toc_path if request.save_to_disk else None

        return {
            "success": True,
            "message": "目录解析完成并已合并分块内容",
            "data": {
                "project_name": project_name,
                "filename": project_name,
                "save_to_disk": request.save_to_disk,
                "output_path": output_path,
                "textbook_with_content_path": textbook_with_content_path if request.save_to_disk else None,
                "toc": toc_json,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"目录解析出错: {str(e)}")

# ============================================================================
# 6. 健康检查和状态端点
# ============================================================================

@app.get("/health")
async def health_check():
    """
    健康检查端点：FastAPI 能响应即代表 Python core 可用。
    MinerU/Docker 是独立依赖，状态放在 services.mineru 中。
    """
    mineru_health = mineru_client.check_health()

    return {
        "status": "healthy",
        "timestamp": os.getenv("CURRENT_DATE", "2026-03-22"),
        "services": {
            "core": {
                "status": "healthy"
            },
            "mineru": mineru_health
        }
    }

@app.get("/api/status")
async def get_status():
    """
    获取系统状态和配置信息
    """
    return {
        "success": True,
        "services": {
            "mineru": {
                "status": "ready" if mineru_client.container_id else "unavailable",
                "container_id": mineru_client.container_id,
                "image": mineru_client.image_name
            },
            "chunker": {
                "status": "ready" if not chunker.init_error else "error",
                "data_dir": str(chunker.base_data_dir) if chunker.base_data_dir else None,
                "error": chunker.init_error
            },
            "vectorization": {
                "status": "ready",
                "db_path": "DATA_DIR/{username}/chroma_db/{collection_name}",
                "note": "每个用户和 collection 有独立的数据库文件夹"
            }
        }
    }

if __name__ == "__main__":
    load_dotenv()
    port = int(os.getenv("PYTHON_PORT", "8080"))
    uvicorn.run(app, host="127.0.0.1", port=port)


