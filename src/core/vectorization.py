import json
import os
import logging
from pathlib import Path
from typing import List, Dict
import chromadb
from chromadb.utils import embedding_functions
from tqdm import tqdm

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class VectorStorageManager:
    def __init__(self, collection_name: str, db_path: str = "./chroma_db"):
        """
        初始化向量数据库管理
        :param collection_name: 向量集合名称
        :param db_path: 本地数据库存储路径前缀
        """
        self.collection_name = collection_name
        # 为每个 collection 创建单独的 db 文件夹
        self.db_path = f"{db_path}/{collection_name}"
        
        # 1. 初始化 ChromaDB 持久化客户端
        self.client = chromadb.PersistentClient(path=self.db_path)
        
        # 2. 定义 Embedding 函数 (使用本地 Sentence-Transformers 模型)
        # all-MiniLM-L6-v2 是一个轻量且高效的通用模型，适合处理中英双语或专业书籍
        self.embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name="all-MiniLM-L6-v2"
        )
        
        # 3. 创建或获取集合
        self.collection = self.client.get_or_create_collection(
            name=collection_name,
            embedding_function=self.embedding_fn
        )

    def load_chunks(self, json_path: str) -> List[Dict]:
        """读取 chunks.json 文件"""
        if not os.path.exists(json_path):
            raise FileNotFoundError(f"找不到分块文件: {json_path}")
        with open(json_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def process_and_store(self, chunks: List[Dict]):
        """
        执行标题注入并入库，修复元数据中空列表导致的错误
        如果集合已有数据，则跳过向量化（幂等性）
        """
        # 检查集合是否已有数据
        collection_count = self.collection.count()
        if collection_count > 0:
            logger.info(f"⏭️  集合 '{self.collection_name}' 已存在 {collection_count} 个分块，跳过向量化。")
            return
        
        documents = []
        metadatas = []
        ids = []

        logger.info(f"开始处理 {len(chunks)} 个分块并注入上下文...")

        for i, chunk in enumerate(tqdm(chunks)):
            content = chunk["content"]
            meta = chunk["metadata"].copy() # 复制一份，避免直接修改原始数据
            
            # --- 修复逻辑：处理空列表 ---
            # ChromaDB 元数据不支持空列表。我们将列表转为逗号分隔的字符串。
            if "referenced_images" in meta:
                if isinstance(meta["referenced_images"], list):
                    # 如果列表不为空，用逗号拼接；如果为空，设为空字符串
                    meta["referenced_images"] = ", ".join(meta["referenced_images"])
            
            # --- 标题路径注入 ---
            headers = [meta.get("header_1", ""), meta.get("header_2", ""), meta.get("header_3", "")]
            header_path = " > ".join([h for h in headers if h]).strip()
            
            enriched_text = f"Section: {header_path}\nContent: {content}"
            
            documents.append(enriched_text)
            metadatas.append(meta)
            ids.append(f"chunk_{i}")

        # 分批写入数据库
        batch_size = 100
        for j in range(0, len(documents), batch_size):
            self.collection.add(
                documents=documents[j : j + batch_size],
                metadatas=metadatas[j : j + batch_size],
                ids=ids[j : j + batch_size]
            )

        logger.info(f"✅ 成功向量化 {len(documents)} 个分块并保存。")

    def search(self, query_text: str, n_results: int = 3):
        """执行语义搜索并按内容质量排序"""
        # 获取更多结果用于重排序
        fetch_count = min(max(n_results * 3, 10), 50)  # 获取n_results的3倍或最多50个
        results = self.collection.query(
            query_texts=[query_text],
            n_results=fetch_count
        )
        
        # 如果没有结果，直接返回
        if not results.get('documents') or len(results['documents']) == 0:
            return results
        
        # 重排序：按distance升序，但优先考虑内容长度
        documents = results['documents'][0]
        metadatas = results['metadatas'][0]
        distances = results.get('distances', [[]])[0]
        
        # 创建排序元组列表
        items = list(zip(documents, metadatas, distances))
        
        # 排序策略：先按内容长度（降序），再按distance（升序）
        # 这样会优先返回内容更丰富的结果
        items.sort(key=lambda x: (
            -len(x[0]),  # 内容长度降序（负号使其降序）
            x[2]          # distance升序
        ))
        
        # 只保留前n_results个结果
        items = items[:n_results]
        
        # 重新拆分回原格式
        sorted_docs, sorted_metas, sorted_dists = zip(*items) if items else ([], [], [])
        
        return {
            'documents': [list(sorted_docs)],
            'metadatas': [list(sorted_metas)],
            'distances': [list(sorted_dists)]
        }
    
    def collection_exists(self) -> bool:
        """检查集合是否存在且有数据"""
        try:
            count = self.collection.count()
            return count > 0
        except Exception:
            return False

# # --- 运行主流程 ---
# if __name__ == "__main__":
#     # 1. 实例化管理器
#     manager = VectorStorageManager()
    
#     try:
#         # 2. 加载之前生成的 chunks.json
#         # 确保该文件在脚本同级目录下，或提供完整路径
#         json_file_path = r"D:\mineru_test\output\pyhton_short\hybrid_auto\chunks.json" 
#         data = manager.load_chunks(json_file_path)
        
#         # 3. 执行向量化和存储
#         manager.process_and_store(data)
        
#         # 4. 验证测试
#         print("\n" + "="*50)
#         print("🔍 检索功能演示：")
        
#         # 测试：针对书中具体概念提问
#         test_queries = [
#             "What is Conditional execution",
#             "What are reserved words in Python?",
#             "What are the rules and restrictions for naming variables in Python?",
#             "How do you define a Boolean expression?",
#         ]
        
#         for q in test_queries:
#             print(f"\n用户提问: {q}")
#             results = manager.search(q, n_results=1)
            
#             if results['documents']:
#                 matched_doc = results['documents'][0][0]
#                 matched_meta = results['metadatas'][0][0]
#                 print(f"匹配章节: {matched_meta.get('header_1')} -> {matched_meta.get('header_2')}")
#                 print(f"找到内容: {matched_doc}")
#                 print()
#                 print()
        
#         print("\n" + "="*50)
        
#     except Exception as e:
#         logger.error(f"程序运行出错: {e}")