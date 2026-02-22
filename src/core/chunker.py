import os
import re
import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional, Union, Tuple
from dotenv import load_dotenv
from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter

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
            # optional: normalize quotes/spaces
            output_dir = output_dir.strip().strip('"').strip("'")
            self.base_output_dir = Path(output_dir)

        self.sub_dir_patterns = ["hybrid_auto", "hybrid_ocr", "hybrid_txt"]

        headers_to_split_on = [
            ("#", "Header_1"),
            ("##", "Header_2"),
            ("###", "Header_3"),
        ]
        self.md_splitter = MarkdownHeaderTextSplitter(
            headers_to_split_on=headers_to_split_on,
            strip_headers=False
        )

        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=800,
            chunk_overlap=100,
            separators=["\n\n", "\n", "。", "！", "？", " ", ""]
        )

    def _find_md_file(self, file_name: str) -> Optional[Path]:
        # If not configured, don't proceed
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
                    "success": False,
                    "status_code": 404,
                    "message": f"File not found under {self.base_output_dir}: {file_name}",
                    "data": None
                }

            try:
                content = target_path.read_text(encoding="utf-8")
            except Exception as e:
                logger.exception("Failed to read markdown file")
                return {
                    "success": False,
                    "status_code": 500,
                    "message": f"Failed to read file: {target_path}. Error: {e}",
                    "data": None
                }

            header_splits = self.md_splitter.split_text(content)
            chunk_list: List[Dict[str, Any]] = []
            img_pattern = r"!\[.*?\]\((images/.*?)\)"

            for doc in header_splits:
                sub_docs = self.text_splitter.split_documents([doc])
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
                            "has_image": len(images) > 0
                        }
                    })

            saved_json_path = None
            if save:
                saved_json_path = target_path.parent / output_filename
                ok, err = save_chunks_to_json(chunk_list, saved_json_path)
                if not ok:
                    return {
                        "success": False,
                        "status_code": 500,
                        "message": f"Chunking succeeded but saving JSON failed: {err}",
                        "data": {
                            "md_path": str(target_path),
                            "json_path": str(saved_json_path),
                            "chunks_count": len(chunk_list),
                        }
                    }

            return {
                "success": True,
                "status_code": 200,
                "message": "Success",
                "data": {
                    "md_path": str(target_path),
                    "json_path": str(saved_json_path) if saved_json_path else None,
                    "chunks_count": len(chunk_list),
                }
            }

        except Exception as e:
            logger.exception("Unexpected error in get_chunks")
            return {
                "success": False,
                "status_code": 500,
                "message": f"Unexpected error: {e}",
                "data": None
            }

if __name__ == "__main__":
    chunker = MarkdownChunker()

    target_file = "pyhton_short.md" 
    result = chunker.get_chunks(target_file)
    print(result)