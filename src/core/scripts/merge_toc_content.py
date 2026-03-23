import json
import os
from pathlib import Path
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def map_chunks_to_toc(toc_path, chunks_path, output_path):
    """
    Maps content from chunker_step_1.json to the structure of textbook_toc.json.
    """
    try:
        # Load ToC
        with open(toc_path, 'r', encoding='utf-8') as f:
            toc_data = json.load(f)
        
        # Load Chunks
        with open(chunks_path, 'r', encoding='utf-8') as f:
            chunks_data = json.load(f)
            
        logger.info(f"Loaded {len(chunks_data)} chunks and ToC for '{toc_data.get('book_title', 'Unknown')}'")

        # Create a mapping of section/chapter titles to content
        # We use a case-insensitive match or substring match if needed, 
        # but let's start with exact matches on headers.
        content_map = {}
        for chunk in chunks_data:
            header = chunk.get("Header", "")
            content = chunk.get("content", "")
            if header:
                # Store content by header. If multiple chunks have the same header, append them.
                if header in content_map:
                    content_map[header] += "\n\n" + content
                else:
                    content_map[header] = content

        def clean_title(title):
            """Cleans title for better matching (lowercase, strip whitespace)"""
            return str(title).strip().lower()

        # Build a lookup for normalized headers
        normalized_content_map = {clean_title(k): v for k, v in content_map.items()}

        def find_content(title):
            """Tries to find content by title in the normalized map"""
            norm_title = clean_title(title)
            # Try exact match first
            if norm_title in normalized_content_map:
                return normalized_content_map[norm_title]
            
            # Try matching without number prefixes (e.g., "1.1 Creativity" -> "creativity")
            # This is a bit risky but common in textbook output
            parts = norm_title.split(' ', 1)
            if len(parts) > 1 and parts[0].replace('.', '').isdigit():
                sub_title = parts[1]
                if sub_title in normalized_content_map:
                    return normalized_content_map[sub_title]
            
            # Fallback: check if the title is contained in any header
            # (Expensive, but might find "1 Why should..." matching "1 Why should you learn to write programs? 1")
            for header, content in content_map.items():
                if norm_title in clean_title(header) or clean_title(header) in norm_title:
                    return content
                    
            return ""

        # Recursive function to inject content into ToC nodes
        def process_node(node):
            if isinstance(node, dict):
                # Calculate titles to check
                titles_to_check = []
                if "chapter_title" in node:
                    titles_to_check.append(node["chapter_title"])
                if "section_title" in node:
                    titles_to_check.append(node["section_title"])
                if "sub_section_title" in node:
                    titles_to_check.append(node["sub_section_title"])
                
                # Try to find content
                node_content = ""
                for title in titles_to_check:
                    found = find_content(title)
                    if found:
                        node_content = found
                        break
                
                node["content"] = node_content
                
                # Recurse into children
                for key in ["chapters", "sections", "sub_sections"]:
                    if key in node:
                        for child in node[key]:
                            process_node(child)

        # Start processing from root
        process_node(toc_data)
        
        # Save merged data
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(toc_data, f, ensure_ascii=False, indent=4)
            
        logger.info(f"Successfully saved merged ToC with content to {output_path}")
        return True

    except Exception as e:
        logger.error(f"Error mapping chunks: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    base_dir = Path(r"data\hizan\output\java_short\hybrid_auto")
    toc_file = base_dir / "textbook_toc.json"
    chunks_file = base_dir / "chunker_step_1.json"
    output_file = base_dir / "textbook_with_content.json"
    
    map_chunks_to_toc(toc_file, chunks_file, output_file)
