import os
import json

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
from microservices.chunker import MarkdownChunker
from microservices.vectorization import VectorStorageManager
from microservices.mineru_client import MinerUClient
from llm.analyze_textbook import TextbookAnalyzer
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
    description: str = "需要处理的PDF文件名"

class ChunkerProcessRequest(BaseModel):
    username: str
    file_name: str
    output_filename: str = "chunker_step_1.json"
    description: str = "需要分块的Markdown文件名"

class VectorizationStoreRequest(BaseModel):
    username: str
    json_path: str
    collection_name: str = "default_collection"
    description: str = "需要向量化的chunks.json文件路径"

class SearchRequest(BaseModel):
    username: str
    collection_name: str
    query: str
    n_results: int = 3

class TextbookAnalysisRequest(BaseModel):
    username: str
    project_name: str
    description: str = "分析教科书内容并生成学习材料"

class ParseTocRequest(BaseModel):
    username: str
    project_name: str
    toc_string: str
    save_to_disk: bool = True
    description: str = "使用LLM解析目录文本并生成结构化TOC"

# --- 初始化组件 ---
chunker = MarkdownChunker()
vector_manager = None
mineru_client = MinerUClient()

# ============================================================================
# 1. MinerU PDF 处理端点
# ============================================================================

@app.post("/api/mineru/process")
async def process_pdf(request: MinerUProcessRequest):
    """
    调用 MinerU 处理 PDF 文件并转换为 Markdown
    - 输入：用户名 + PDF 文件名
    - 输出：Markdown 文件路径和状态
    """
    try:
        result = mineru_client.process_file(
            username=request.username,
            file_name=request.file_name
        )
        if result["success"]:
            return {
                "success": True,
                "status_code": result["status_code"],
                "message": result["message"],
                "data": result["data"]
            }
        else:
            raise HTTPException(status_code=result["status_code"], detail=result["message"])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理PDF出错: {str(e)}")

# ============================================================================
# 2. 文本分块端点
# ============================================================================

@app.post("/api/chunker/process")
async def process_chunking(request: ChunkerProcessRequest):
    """
    对 Markdown 文件进行智能分块
    - 按标题分块：保留标题增强语义
    - 递归分块：处理超长内容
    - 输出：chunks.json 文件及统计信息
    """
    try:
        data_dir = os.getenv("DATA_DIR")
        if not data_dir:
            raise HTTPException(status_code=500, detail="DATA_DIR 环境变量未配置")

        project_name = os.path.splitext(request.file_name)[0]
        markdown_path = os.path.join(
            data_dir,
            request.username,
            "output",
            project_name,
            "hybrid_auto",
            request.file_name,
        )

        success, error = chunker.process_markdown(
            markdown_file=markdown_path,
            output_file=request.output_filename,
        )

        if not success:
            if error and "not found" in error.lower():
                raise HTTPException(status_code=404, detail=error)
            raise HTTPException(status_code=500, detail=error or "分块处理失败")

        output_path = os.path.join(
            data_dir,
            request.username,
            "output",
            project_name,
            "hybrid_auto",
            request.output_filename,
        )

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
            "message": "Markdown 分块成功",
            "data": {
                "markdown_path": markdown_path,
                "output_path": output_path,
                "chunks_count": chunks_count,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"分块出错: {str(e)}")

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
            raise HTTPException(status_code=500, detail="DATA_DIR 环境变量未配置")
        
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
            raise HTTPException(status_code=500, detail="DATA_DIR 环境变量未配置")
        
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
            raise HTTPException(status_code=500, detail="DATA_DIR 环境变量未配置")
        
        # 构建文件路径
        project_dir = os.path.join(data_dir, request.username, "output", request.project_name, "hybrid_auto")
        textbook_with_content_path = os.path.join(project_dir, "textbook_with_content.json")
        
        if not os.path.exists(textbook_with_content_path):
            raise HTTPException(
                status_code=404, 
                detail=f"textbook_with_content.json not found at {textbook_with_content_path}"
            )
        
        # 初始化分析器
        analyzer = TextbookAnalyzer()
        
        # 运行分析
        result = analyzer.generate_chapter_analysis(textbook_with_content_path)
        
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
        raise HTTPException(status_code=500, detail=f"分析出错: {str(e)}")


@app.post("/api/analyze/parse-toc")
async def parse_table_of_content(request: ParseTocRequest):
    """
    使用 LLM 解析目录文本并返回结构化 TOC JSON。
    当 save_to_disk=True 时，将结果保存到项目目录中的 textbook_toc.json。
    """
    try:
        data_dir = os.getenv("DATA_DIR")
        if not data_dir:
            raise HTTPException(status_code=500, detail="DATA_DIR 环境变量未配置")

        project_dir = os.path.join(
            data_dir,
            request.username,
            "output",
            request.project_name,
            "hybrid_auto",
        )

        if not os.path.exists(project_dir):
            raise HTTPException(
                status_code=404,
                detail=f"项目目录不存在: {project_dir}",
            )

        # parse_table_of_content uses chunker_path's parent as the save directory.
        chunker_path = os.path.join(project_dir, "chunker_step_1.json")
        analyzer = TextbookAnalyzer(chunker_path=chunker_path)

        toc_json = analyzer.parse_table_of_content(
            toc_string=request.toc_string,
            save_to_disk=request.save_to_disk,
        )

        if not toc_json:
            raise HTTPException(status_code=500, detail="目录解析失败，请检查 toc_string 内容")

        output_path = os.path.join(project_dir, "textbook_toc.json") if request.save_to_disk else None

        return {
            "success": True,
            "message": "目录解析完成",
            "data": {
                "project_name": request.project_name,
                "save_to_disk": request.save_to_disk,
                "output_path": output_path,
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
    健康检查端点：主要检查 MinerU Docker 容器状态
    """
    mineru_health = mineru_client.check_health()
    
    return {
        "status": "healthy" if mineru_health["status"] == "ready" else "unhealthy",
        "timestamp": os.getenv("CURRENT_DATE", "2026-03-22"),
        "services": {
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