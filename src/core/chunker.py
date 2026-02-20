import re
from typing import List, Dict

class MarkdownChunker:
    def __init__(self, max_chunk_size: int = 2000):
        """
        :param max_chunk_size: 单个知识块的最大字符数，防止 LLM 处理不了太长的内容
        """
        self.max_chunk_size = max_chunk_size

    def split_by_headers(self, text: str) -> List[Dict]:
        """
        根据 Markdown 标题进行切片
        """
        # 正则表达式：匹配以 # 开头的标题行 (支持 1 到 4 级标题)
        header_pattern = re.compile(r'^(#{1,4})\s+(.*)$', re.MULTILINE)
        
        chunks = []
        last_pos = 0
        current_metadata = {"title": "前言/导论", "level": 0}

        # 找到所有标题的位置
        for match in header_pattern.finditer(text):
            # 提取上一个标题到当前标题之间的内容
            content = text[last_pos:match.start()].strip()
            
            if content:
                chunks.append({
                    "title": current_metadata["title"],
                    "level": current_metadata["level"],
                    "content": content
                })
            
            # 更新当前标题信息
            current_metadata = {
                "title": match.group(2).strip(),
                "level": len(match.group(1)) # # 的数量代表级别
            }
            last_pos = match.end()

        # 别忘了最后一段内容
        last_content = text[last_pos:].strip()
        if last_content:
            chunks.append({
                "title": current_metadata["title"],
                "level": current_metadata["level"],
                "content": last_content
            })
            
        return chunks

    def refine_chunks(self, chunks: List[Dict]) -> List[Dict]:
        """
        进一步优化：如果某个章节太长，进行二次切割；如果太短，可以考虑合并（可选）
        """
        refined = []
        for chunk in chunks:
            if len(chunk["content"]) > self.max_chunk_size:
                # 简单的按字数二次切分，真实场景建议按段落 \n\n 切分
                sub_contents = [chunk["content"][i:i+self.max_chunk_size] 
                                for i in range(0, len(chunk["content"]), self.max_chunk_size)]
                for i, sub in enumerate(sub_contents):
                    refined.append({
                        "title": f"{chunk['title']} (第{i+1}部分)",
                        "level": chunk["level"],
                        "content": sub
                    })
            else:
                refined.append(chunk)
        return refined

# 测试代码
if __name__ == "__main__":
    sample_md = """
        # 第一章 宏观经济学
        这是宏观经济学的介绍。
        ## 1.1 国内生产总值 (GDP)
        GDP 是衡量国家经济实力的重要指标。
        这里有很多关于 GDP 的公式：$GDP = C + I + G + (X - M)$。
        ## 1.2 通货膨胀
        通货膨胀是指物价水平的持续上升。
    """
    chunker = MarkdownChunker()
    all_chunks = chunker.split_by_headers(sample_md)
    
    for i, c in enumerate(all_chunks):
        print(f"块 {i} | 标题: {c['title']} | 字数: {len(c['content'])}")