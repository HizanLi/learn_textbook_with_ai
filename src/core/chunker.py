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

        self.base_data_dir: Optional[Path] = None
        self.init_error: Optional[str] = None

        data_dir = os.getenv("DATA_DIR")
        if not data_dir:
            self.init_error = f"DATA_DIR is not set in {env_file}"
        else:
            data_dir = data_dir.strip().strip('"').strip("'")
            self.base_data_dir = Path(data_dir)

        self.sub_dir_patterns = ["hybrid_auto", "hybrid_ocr", "hybrid_txt"]

    #Step 1: 按标题分块 (#)
    def split_by_headers(self, markdown_file: PathLike, output_file: str = "chunker_step_1.json") -> Tuple[bool, Optional[str]]:
        """
        Split markdown file by single-level headers since file only contains # headers.
        
        Args:
            markdown_file: Path to the markdown file to split
            output_file: Name of the output JSON file (default: "chunker_step_1.json")
            
        Returns:
            Tuple of (success: bool, error_message: Optional[str])
        """
        try:
            markdown_path = Path(markdown_file)
            if not markdown_path.exists():
                return False, f"Markdown file not found: {markdown_path}"
            
            # Read markdown content
            with markdown_path.open("r", encoding="utf-8") as f:
                content = f.read()
            
            # Only split on single # headers since that's all the file contains
            headers_to_split_on = [
                ("#", "Header 1"),
            ]
            
            # Initialize MarkdownHeaderTextSplitter
            markdown_splitter = MarkdownHeaderTextSplitter(
                headers_to_split_on=headers_to_split_on,
                strip_headers=False  # Keep headers in the content
            )
            
            # Split the markdown by headers
            md_header_splits = markdown_splitter.split_text(content)
            
            chunks = []
            
            if not md_header_splits:
                # No splits found, save entire content as one chunk
                chunks.append({
                    "content": content,
                    "Header": ""
                })
            else:
                # Convert to the desired format
                for split in md_header_splits:
                    # Extract the header from metadata
                    header = split.metadata.get("Header 1", "")
                    
                    chunks.append({
                        "content": split.page_content.strip(),
                        "Header": header
                    })
            
            # Save to output file in the same directory as the markdown file
            output_path = markdown_path.parent / output_file
            success, error = save_chunks_to_json(chunks, output_path)
            
            if success:
                logger.info(f"Successfully saved {len(chunks)} chunks to {output_path}")
                return True, None
            else:
                return False, error
                
        except Exception as e:
            logger.exception(f"Error splitting markdown by headers: {e}")
            return False, str(e)

    def split_large_chunks(self, chunks: List[Dict], chunk_size: int = 1500, overlap: int = 150) -> List[Dict]:
        """
        Further split large chunks using RecursiveCharacterTextSplitter with markdown-aware separators.
        
        Args:
            chunks: List of chunks from header-based splitting
            chunk_size: Maximum size of each chunk in characters (default: 1500)
            overlap: Number of overlapping characters between chunks (default: 150)
            
        Returns:
            List of refined chunks
        """
        refined_chunks = []
        # Separators prioritize markdown structures and code blocks
        recursive_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=overlap,
            separators=[
                "\n```\n",      # Code block boundaries
                "\n\n",         # Paragraph breaks
                "\n",           # Line breaks
                "。",           # Chinese period
                "，",           # Chinese comma
                " ",            # Spaces
                ""              # Character level
            ],
            is_separator_regex=False
        )
        
        for chunk in chunks:
            content = chunk.get("content", "")
            header = chunk.get("Header", "")
            
            # If chunk is small enough, keep it as is
            if len(content) <= chunk_size:
                refined_chunks.append(chunk)
            else:
                # Split large chunks recursively
                try:
                    sub_splits = recursive_splitter.split_text(content)
                    for sub_content in sub_splits:
                        if sub_content.strip():  # Only add non-empty chunks
                            refined_chunks.append({
                                "content": sub_content.strip(),
                                "Header": header
                            })
                except Exception as e:
                    logger.warning(f"Failed to split large chunk, keeping as is: {e}")
                    refined_chunks.append(chunk)
        
        return refined_chunks

    def process_markdown(self, markdown_file: PathLike, output_file: str = "chunker_step_1.json") -> Tuple[bool, Optional[str]]:
        """
        Main control method: Split content by # headers only using manual splitting.
        
        Args:
            markdown_file: Path to the original markdown file
            output_file: Name of the output JSON file (default: "chunker_step_1.json")
            
        Returns:
            Tuple of (success: bool, error_message: Optional[str])
        """
        try:
            markdown_path = Path(markdown_file)
            if not markdown_path.exists():
                return False, f"Markdown file not found: {markdown_path}"
            
            # Read markdown content
            with markdown_path.open("r", encoding="utf-8") as f:
                content = f.read()
            
            # Split by # headers using regex - split on lines that start with #
            lines = content.split('\n')
            chunks = []
            current_header = ""
            current_content = []
            
            for line in lines:
                # Check if line is a header (starts with #)
                if line.strip().startswith('#'):
                    # Save previous chunk if it has content
                    if current_header or current_content:
                        chunk_text = '\n'.join(current_content).strip()
                        if chunk_text:
                            chunks.append({
                                "content": chunk_text,
                                "Header": current_header
                            })
                    
                    # Extract header text (remove # symbols)
                    current_header = line.strip().lstrip('#').strip()
                    current_content = [line]  # Include the header line in content
                else:
                    current_content.append(line)
            
            # Don't forget the last chunk
            if current_header or current_content:
                chunk_text = '\n'.join(current_content).strip()
                if chunk_text:
                    chunks.append({
                        "content": chunk_text,
                        "Header": current_header
                    })
            
            logger.info(f"Successfully split into {len(chunks)} chunks by # headers")
            
            # Save to output file
            output_path = markdown_path.parent / output_file
            success, error = save_chunks_to_json(chunks, output_path)
            
            if success:
                logger.info(f"Successfully saved {len(chunks)} chunks to {output_path}")
                return True, None
            else:
                return False, error
            
        except Exception as e:
            logger.exception(f"Error processing markdown: {e}")
            return False, str(e)


if __name__ == "__main__":
    chunker = MarkdownChunker()
    
    # Example: Process a markdown file (replace hashes, then split by headers)
    markdown_file = r"data\hizan\output\pyhton_short-1772218124093\hybrid_auto\pyhton_short-1772218124093.md"
    success, error = chunker.process_markdown(markdown_file)
    
    if success:
        print(f"Successfully split markdown file into chunks")
    else:
        print(f"Error: {error}")