"""
Prompt definitions for various LLM operations.
将所有静态和模板字符串集中管理，方便编辑和本地化。
"""

from typing import List


ASK_TABLE_CONTENT_PROMPT= f"""
Act as a precise data extraction script. Your task is to parse the Table of Contents provided below and convert it into a valid JSON object.

### JSON Template / Schema:
{{
  "book_title": "string",
  "chapters": [
    {{
      "chapter_number": integer,
      "chapter_title": "string",
      "start_page": integer,
      "sections": [
        {{
          "section_id": "string",
          "section_title": "string",
          "page": integer,
          "sub_sections": [
            {{
              "sub_section_id": "string",
              "sub_section_title": "string",
              "page": integer
            }}
          ]
        }}
      ]
    }}
  ]
}}

### Rules:
1. **Cleaning:** Remove all leader dots (e.g., '. . .') and trailing whitespace.
2. **Hierarchy:** Nest sub-sections (like 5.6.1) inside their parent sections. If no sub-sections exist, return an empty array [].
3. **Data Types:** Ensure 'page' and 'chapter_number' are integers.
4. **Output:** Return ONLY the raw JSON. Do not include markdown code blocks (```json) or any introductory text.

### Input Text:
[PASTE_YOUR_TOC_HERE]
"""


ANALYZE_SECTION_PROMPT = f"""
Act as a subject matter expert. Your task is to analyze the following educational content and extract the essential information for a student's study guide.

### Context:
Section Header: [PASTE_SECTION_HEADER_HERE]

### Input Content:
[PASTE_SECTION_CONTENT_HERE]

### Instructions:
Break down the text above into the following four categories:
1. **Key Concepts & Definitions:** Identify the primary terms, variables, or laws introduced.
2. **Core Principles & Rules:** List the fundamental logic, formulas, or "laws of the land" (e.g., Syntax rules in CS, Theorems in Math, or Laws in Physics).
3. **Common Pitfalls or Errors:** What are the typical mistakes, "illegal" operations, or common misconceptions mentioned?
4. **Practical Examples:** Briefly summarize any specific problems, code snippets, or use cases provided to illustrate the concepts.

### Output Requirements:
- Use concise, high-density bullet points.
- Maintain the technical rigor of the original text.
- Omit all introductory or concluding conversational filler.

### JSON Template / Schema:
{{
  "core_concepts": ["string"],
  "fundamental_rules": ["string"],
  "common_pitfalls": ["string"],
  "examples": ["string"],
  "one_sentence_summary": "string"
}}
"""


# explanation prompts
EXPLANATION_SYSTEM_PROMPT = (
    "你是一位经验丰富的教师。"  # 其余部分由难度参数拼接
    "要求：\n"
    "1. 用简洁、清晰的语言解释\n"
    "2. 包含至少一个现实生活中的例子\n"
    "3. 强调这个知识点的关键要点\n"
    "4. 如果适用，说明与其他相关概念的联系\n"
)

EXPLANATION_USER_PROMPT_TEMPLATE = "请详细解释下列知识点：\n{knowledge_point}"


# examples prompts
EXAMPLES_SYSTEM_PROMPT = (
    "你是一位资深的教学设计师。\n"
    "要求：\n"
    "1. 每个示例都应该从简单到复杂逐步递进\n"
    "2. 每个示例都要包含完整的步骤或代码\n"
    "3. 示例应该与现实场景相关联"
)

EXAMPLES_USER_PROMPT_TEMPLATE = (
    "为下列知识点生成 {num_examples} 个实用示例：\n\n"
    "知识点：{knowledge_point}\n\n"
    "请按照如下 JSON 格式返回：\n"
    "{\n"
    "    \"examples\": [\n"
    "        {{\"title\": \"示例1标题\", \"description\": \"详细描述\", \"code_or_steps\": \"代码或步骤\"}},\n"
    "        ...\n"
    "    ]\n"
    "}"
)


# quiz prompts
QUIZ_SYSTEM_PROMPT = (
    "你是一位出题专家。要求：\n"
    "1. 题目应该能够测试学生对知识的深理解，不只是记忆\n"
    "2. 难度应该循序渐进\n"
    "3. 选项应该具有迷惑性但答案清晰"
)

QUIZ_PROMPT_TEMPLATE = {
    "multiple_choice": (
        "为下列知识点生成 {num_questions} 道多选题。\n\n"
        "知识点：{knowledge_point}\n\n"
        "请按照如下 JSON 格式返回：\n"
        "{\n"
        "    \"questions\": [\n"
        "        {{\n"
        "            \"id\": 1,\n"
        "            \"question\": \"问题文本\",\n"
        "            \"options\": {{\"A\": \"选项A\", \"B\": \"选项B\", \"C\": \"选项C\", \"D\": \"选项D\"}},\n"
        "            \"correct_answer\": \"A\",\n"
        "            \"explanation\": \"答案解释\"\n"
        "        }},\n"
        "        ...\n"
        "    ]\n"
        "}"
    ),
    "short_answer": (
        "为下列知识点生成 {num_questions} 道简答题。\n\n"
        "知识点：{knowledge_point}\n\n"
        "请按照如下 JSON 格式返回：\n"
        "{\n"
        "    \"questions\": [\n"
        "        {{\n"
        "            \"id\": 1,\n"
        "            \"question\": \"问题文本\",\n"
        "            \"sample_answer\": \"参考答案\",\n"
        "            \"key_points\": [\"关键点1\", \"关键点2\"]\n"
        "        }},\n"
        "        ...\n"
        "    ]\n"
        "}"
    ),
    "true_false": (
        "为下列知识点生成 {num_questions} 道判断题。\n\n"
        "知识点：{knowledge_point}\n\n"
        "请按照如下 JSON 格式返回：\n"
        "{\n"
        "    \"questions\": [\n"
        "        {{\n"
        "            \"id\": 1,\n"
        "            \"statement\": \"陈述句\",\n"
        "            \"is_true\": true,\n"
        "            \"explanation\": \"解释\"\n"
        "        }},\n"
        "        ...\n"
        "    ]\n"
        "}"
    ),
}


# tutorial prompts
TUTORIAL_SYSTEM_PROMPT = (
    "你是一位教学设计专家。\n"
    "要求：\n"
    "1. 教程结构清晰，逻辑递进\n"
    "2. 每个部分都有明确的学习目标\n"
    "3. 包含实用的建议和常见错误提醒"
)

TUTORIAL_USER_PROMPT_TEMPLATE = (
    "为下列主题和子主题创建一个完整的教程大纲：\n\n"
    "主题：{topic}\n\n"
    "子主题：\n{subtopics_str}\n\n"
    "请按照如下 JSON 格式返回：\n"
    "{\n"
    "    \"title\": \"教程标题\",\n"
    "    \"learning_objectives\": [\"目标1\", \"目标2\"],\n"
    "    \"sections\": [\n"
    "        {{\n"
    "            \"name\": \"章节名称\",\n"
    "            \"duration_minutes\": 15,\n"
    "            \"content\": \"详细内容\",\n"
    "            \"key_takeaways\": [\"要点1\", \"要点2\"]\n"
    "        }},\n"
    "        ...\n"
    "    ],\n"
    "    \"common_mistakes\": [\"常见错误1\", \"常见错误2\"],\n"
    "    \"resources\": [\"资源1\", \"资源2\"]\n"
    "}"
)
