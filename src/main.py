from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
from core.chunker import MarkdownChunker
from core.vectorization import VectorStorageManager
from core.mineru_client import MinerUClient
import uvicorn

app = FastAPI(
    title="Textbook AI Learner API",
    description="管理PDF处理、文本分块和向量化的统一后端",
    version="1.0.0"
)

# --- 定义请求体和响应模型 ---
class MinerUProcessRequest(BaseModel):
    file_name: str
    input_dir: Optional[str] = None
    output_dir: Optional[str] = None
    description: str = "需要处理的PDF文件名"

class ChunkerProcessRequest(BaseModel):
    file_name: str
    output_filename: str = "chunks.json"
    description: str = "需要分块的Markdown文件名"

class VectorizationStoreRequest(BaseModel):
    json_path: str
    collection_name: str = "default_collection"
    description: str = "需要向量化的chunks.json文件路径"

class SearchRequest(BaseModel):
    collection_name: str
    query: str
    n_results: int = 3

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
    - 输入：PDF 文件名，可选的input_dir和output_dir
    - 输出：Markdown 文件路径和状态
    """
    try:
        result = mineru_client.process_file(
            file_name=request.file_name,
            input_dir=request.input_dir,
            output_dir=request.output_dir
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
        result = chunker.get_chunks(
            file_name=request.file_name,
            save=True,
            output_filename=request.output_filename
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
    vector_manager = VectorStorageManager(request.collection_name)
    try:
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
        # 根据 collection_name 加载 VectorStorageManager
        vm = VectorStorageManager(request.collection_name)
        
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
# 5. 健康检查和状态端点
# ============================================================================

@app.get("/health")
async def health_check():
    """
    健康检查端点
    """
    return {
        "status": "healthy",
        "services": {
            "mineru": "ready" if mineru_client.container_id else "unavailable",
            "chunker": "ready",
            "vectorization": "ready"
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
                "output_dir": str(chunker.base_output_dir) if chunker.base_output_dir else None,
                "error": chunker.init_error
            },
            "vectorization": {
                "status": "ready",
                "db_path": "./chroma_db/{collection_name}",
                "note": "每个 collection 有独立的数据库文件夹"
            }
        }
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)