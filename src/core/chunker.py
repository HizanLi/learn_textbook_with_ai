import os
import re
import json
import logging
from pathlib import Path
from dotenv import load_dotenv
from typing import List, Dict, Any
from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

load_dotenv()

class MarkdownChunker:
    def __init__(self):
        self.base_output_dir = Path(os.getenv("OUTPUT_DIR", "D:/mineru_test/output"))
        self.sub_dir_patterns = ["hybrid_auto", "hybrid_ocr", "hybrid_txt"]
        
        # 标题切分器：保留书中的逻辑结构
        headers_to_split_on = [
            ("#", "Header_1"),
            ("##", "Header_2"),
            ("###", "Header_3"),
        ]
        self.md_splitter = MarkdownHeaderTextSplitter(
            headers_to_split_on=headers_to_split_on, 
            strip_headers=False 
        )
        
        # 递归切分器：确保块大小适合向量化
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=800,
            chunk_overlap=100,
            separators=["\n\n", "\n", "。", "！", "？", " ", ""]
        )

    def _find_md_file(self, file_name: str) -> Path:
        file_stem = Path(file_name).stem
        for pattern in self.sub_dir_patterns:
            search_pattern = f"**/{pattern}/{file_stem}.md"
            matches = list(self.base_output_dir.glob(search_pattern))
            if matches:
                return matches[0]
        raise FileNotFoundError(f"未能在 {self.base_output_dir} 下找到匹配文件: {file_name}")

    def get_chunks(self, file_name: str) -> List[Dict[str, Any]]:
        target_path = self._find_md_file(file_name)
        with open(target_path, "r", encoding="utf-8") as f:
            content = f.read()

        header_splits = self.md_splitter.split_text(content)
        chunk_list = []

        for doc in header_splits:
            sub_docs = self.text_splitter.split_documents([doc])
            for sub_doc in sub_docs:
                # 提取图片引用
                img_pattern = r"!\[.*?\]\((images/.*?)\)"
                images = re.findall(img_pattern, sub_doc.page_content)
                
                # 构造序列化字典
                chunk_data = {
                    "content": sub_doc.page_content,
                    "metadata": {
                        "source": file_name,
                        "header_1": sub_doc.metadata.get("Header_1", ""),
                        "header_2": sub_doc.metadata.get("Header_2", ""),
                        "header_3": sub_doc.metadata.get("Header_3", ""),
                        "referenced_images": images,
                        "has_image": len(images) > 0
                    }
                }
                chunk_list.append(chunk_data)
        
        return chunk_list

def save_chunks_to_json(chunks: List[Dict], output_path: str):
    """将分块列表保存为 JSON 文件"""
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(chunks, f, ensure_ascii=False, indent=4)
    logger.info(f"💾 成功保存 {len(chunks)} 个分块到: {output_path}")

# --- 执行存储 ---
if __name__ == "__main__":
    chunker = MarkdownChunker()
    try:
        # 1. 获取切分后的数据
        target_file = "book.md" 
        all_chunks = chunker.get_chunks(target_file)
        
        # 2. 定义保存路径（建议保存在项目根目录或输出目录根部）
        json_output = "chunks.json" 
        
        # 3. 执行存储
        save_chunks_to_json(all_chunks, json_output)

    except Exception as e:
        logger.error(f"❌ 运行失败: {e}")