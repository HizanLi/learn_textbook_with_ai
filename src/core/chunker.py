import os
import re
import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional, Union, Tuple
from dotenv import load_dotenv
from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
PathLike = Union[str, Path]

def save_chunks_to_json(chunks: List[Dict], output_path: PathLike) -> Tuple[bool, Optional[str]]:
    try:
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with output_path.open("w", encoding="utf-8") as f:
            json.dump(chunks, f, ensure_ascii=False, indent=4)
        return True, None
    except Exception as e:
        logger.exception("Failed to save chunks json")
        return False, str(e)


class MarkdownChunker:
    def __init__(self, env_file: str = ".env"):
        load_dotenv(dotenv_path=env_file, override=True)

        self.base_output_dir: Optional[Path] = None
        self.init_error: Optional[str] = None

        output_dir = os.getenv("OUTPUT_DIR")
        if not output_dir:
            self.init_error = f"OUTPUT_DIR is not set in {env_file}"
        else:
            output_dir = output_dir.strip().strip('"').strip("'")
            self.base_output_dir = Path(output_dir)

        self.sub_dir_patterns = ["hybrid_auto", "hybrid_ocr", "hybrid_txt"]

        # 1. 配置标题切分：保留标题在正文中以增强 Embedding 语义
        headers_to_split_on = [
            ("#", "Header_1"),
            ("##", "Header_2"),
            ("###", "Header_3"),
        ]
        self.md_splitter = MarkdownHeaderTextSplitter(
            headers_to_split_on=headers_to_split_on,
            strip_headers=False
        )

        # 2. 配置递归切分：用于处理标题下超长的文本内容
        # 设置为 1500 字符，包含前后重叠的 150 字符
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1500,
            chunk_overlap=150,
            separators=["\n\n", "\n", "。", "！", "？", " ", ""]
        )

    def _find_md_file(self, file_name: str) -> Optional[Path]:
        if self.base_output_dir is None:
            return None
        try:
            file_stem = Path(file_name).stem
            for pattern in self.sub_dir_patterns:
                search_pattern = f"**/{pattern}/{file_stem}.md"
                matches = list(self.base_output_dir.glob(search_pattern))
                if matches:
                    return matches[0]
            return None
        except Exception:
            logger.exception("Failed while searching markdown file")
            return None

    def get_chunks(self, file_name: str, save: bool = True, output_filename: str = "chunks.json") -> Dict[str, Any]:
        if self.init_error or self.base_output_dir is None:
            return {
                "success": False,
                "status_code": 500,
                "message": self.init_error or "OUTPUT_DIR not configured",
                "data": None
            }

        try:
            target_path = self._find_md_file(file_name)
            if target_path is None:
                return {
                    "success": False, "status_code": 404,
                    "message": f"File not found under {self.base_output_dir}: {file_name}",
                    "data": None
                }

            content = target_path.read_text(encoding="utf-8")

            # 第一步：按标题切分（语义大块）
            header_splits = self.md_splitter.split_text(content)
            
            chunk_list: List[Dict[str, Any]] = []
            img_pattern = r"!\[.*?\]\((images/.*?)\)"
            
            # 设置安全长度阈值（与 chunk_size 一致）
            MAX_SAFE_LEN = 1500

            for doc in header_splits:
                # 第二步：检查该标题块是否超长
                if len(doc.page_content) > MAX_SAFE_LEN:
                    # 超长则进行带重叠的递归切分
                    sub_docs = self.text_splitter.split_documents([doc])
                else:
                    # 长度合适则直接使用
                    sub_docs = [doc]

                for sub_doc in sub_docs:
                    images = re.findall(img_pattern, sub_doc.page_content)
                    chunk_list.append({
                        "content": sub_doc.page_content,
                        "metadata": {
                            "source": file_name,
                            "header_1": sub_doc.metadata.get("Header_1", ""),
                            "header_2": sub_doc.metadata.get("Header_2", ""),
                            "header_3": sub_doc.metadata.get("Header_3", ""),
                            "referenced_images": images,
                            "has_image": len(images) > 0,
                            "is_split": len(doc.page_content) > MAX_SAFE_LEN  # 标记是否经过二次切分
                        }
                    })

            saved_json_path = None
            if save:
                saved_json_path = target_path.parent / output_filename
                ok, err = save_chunks_to_json(chunk_list, saved_json_path)
                if not ok:
                    return {
                        "success": False, "status_code": 500,
                        "message": f"Chunking succeeded but saving JSON failed: {err}",
                        "data": {"md_path": str(target_path), "chunks_count": len(chunk_list)}
                    }

            # 统计数据
            if chunk_list:
                lengths = [len(c["content"]) for c in chunk_list]
                max_len = max(lengths)
                avg_len = sum(lengths) / len(lengths)
            else:
                max_len = 0
                avg_len = 0

            return {
                "success": True,
                "status_code": 200,
                "message": "Success",
                "data": {
                    "md_path": str(target_path),
                    "json_path": str(saved_json_path) if saved_json_path else None,
                    "chunks_count": len(chunk_list),
                    "max_chunk_length": max_len,
                    "avg_chunk_length": round(avg_len, 2)
                }
            }

        except Exception as e:
            logger.exception("Unexpected error in get_chunks")
            return {
                "success": False, "status_code": 500,
                "message": f"Unexpected error: {e}", "data": None
            }

if __name__ == "__main__":
    chunker = MarkdownChunker()
    target_file = "pyhton_short.md" 
    result = chunker.get_chunks(target_file)
    print(result)