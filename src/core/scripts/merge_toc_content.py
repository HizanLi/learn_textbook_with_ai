import json
import os
import re
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
            """Normalize headings while keeping meaningful words and section numbers."""
            cleaned = str(title or "").strip().lower()
            cleaned = re.sub(r"\\mathrm\{([^}]+)\}", r"\1", cleaned)
            cleaned = cleaned.replace("$", "")
            cleaned = re.sub(r"^#+\s*", "", cleaned)
            cleaned = re.sub(r"\s+", " ", cleaned)
            cleaned = re.sub(r"\.{2,}", " ", cleaned)
            cleaned = re.sub(r"[^\w.\s-]", "", cleaned)
            cleaned = re.sub(r"\s+", " ", cleaned).strip()
            return cleaned

        def number_prefix(title):
            match = re.match(r"^(\d+(?:\.\d+)*)\b", clean_title(title))
            return match.group(1) if match else None

        def strip_number_prefix(title):
            return re.sub(r"^\d+(?:\.\d+)*\s+", "", title).strip()

        def title_variants(title):
            normalized = clean_title(title)
            variants = [normalized]
            without_number = strip_number_prefix(normalized)
            if without_number and without_number not in variants:
                variants.append(without_number)

            for candidate in list(variants):
                if ":" in candidate:
                    before_colon, after_colon = [part.strip() for part in candidate.split(":", 1)]
                    if before_colon and before_colon not in variants:
                        variants.append(before_colon)
                    if after_colon and after_colon not in variants:
                        variants.append(after_colon)

            return variants

        def meaningful_tokens(title):
            stop_words = {"a", "an", "and", "or", "the", "of", "to", "in", "on", "for", "with"}
            return {
                token
                for token in re.findall(r"[a-z0-9]+", strip_number_prefix(clean_title(title)))
                if len(token) > 2 and token not in stop_words
            }

        def edit_distance(left, right):
            if left == right:
                return 0
            if not left:
                return len(right)
            if not right:
                return len(left)

            previous = list(range(len(right) + 1))
            for i, left_char in enumerate(left, start=1):
                current = [i]
                for j, right_char in enumerate(right, start=1):
                    cost = 0 if left_char == right_char else 1
                    current.append(min(
                        previous[j] + 1,
                        current[j - 1] + 1,
                        previous[j - 1] + cost,
                    ))
                previous = current
            return previous[-1]

        def tokens_match(left, right):
            if left == right:
                return True
            if min(len(left), len(right)) < 5:
                return False
            max_distance = 1 if max(len(left), len(right)) < 10 else 2
            return edit_distance(left, right) <= max_distance

        def fuzzy_overlap(left_tokens, right_tokens):
            matched_right = set()
            overlap = set()
            for left in left_tokens:
                for right in right_tokens:
                    if right in matched_right:
                        continue
                    if tokens_match(left, right):
                        matched_right.add(right)
                        overlap.add(left)
                        break
            return overlap

        # Build a lookup for normalized headers
        normalized_content_map = {}
        for header, content in content_map.items():
            for variant in title_variants(header):
                if variant and variant not in normalized_content_map:
                    normalized_content_map[variant] = content

        def find_content(title):
            """Tries to find content by title in the normalized map"""
            norm_title = clean_title(title)
            # Try exact match first
            if norm_title in normalized_content_map:
                return normalized_content_map[norm_title]
            
            # Try known-safe variants: without section numbers and colon halves.
            for variant in title_variants(norm_title):
                if variant in normalized_content_map:
                    return normalized_content_map[variant]

            requested_number = number_prefix(norm_title)
            if requested_number:
                for header, content in content_map.items():
                    if number_prefix(header) == requested_number:
                        return content
            
            # Fallback: require strong token overlap. Avoid matching tiny headers
            # such as "and" to titles like "Lists and ListModels".
            title_tokens = meaningful_tokens(norm_title)
            if len(title_tokens) < 2:
                return ""

            best_content = ""
            best_score = 0.0
            for header, content in content_map.items():
                header_tokens = meaningful_tokens(header)
                if len(header_tokens) < 2:
                    continue
                overlap = fuzzy_overlap(title_tokens, header_tokens)
                if overlap == title_tokens:
                    return content
                score = len(overlap) / max(len(title_tokens), len(header_tokens))
                if score > best_score and score >= 0.6:
                    best_score = score
                    best_content = content

            return best_content

        # Recursive function to inject content into ToC nodes
        def process_node(node):
            if isinstance(node, dict):
                # Calculate titles to check
                titles_to_check = []
                if "chapter_title" in node:
                    if "chapter_number" in node:
                        titles_to_check.append(f"{node['chapter_number']} {node['chapter_title']}")
                    titles_to_check.append(node["chapter_title"])
                if "section_title" in node:
                    if "section_id" in node:
                        titles_to_check.append(f"{node['section_id']} {node['section_title']}")
                    titles_to_check.append(node["section_title"])
                if "sub_section_title" in node:
                    if "sub_section_id" in node:
                        titles_to_check.append(f"{node['sub_section_id']} {node['sub_section_title']}")
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
