"""
学习内容生成模块，封装与 LLM 的交互以生成解释、示例、题库和教程
"""
from typing import Optional, List, Dict, Any

from .llm_client import LLMClient
from . import prompts


class LearningContentGenerator:
    """学习内容生成器 - 基于 LLM 生成教程、例题、Quiz"""

    def __init__(self, llm_client: LLMClient):
        self.llm = llm_client

    def generate_explanation(
        self, knowledge_point: str, difficulty_level: str = "intermediate"
    ) -> str:
        """
        生成知识点的详细解释

        Args:
            knowledge_point: 知识点内容
            difficulty_level: 难度级别 (beginner/intermediate/advanced)

        Returns:
            生成的解释文本
        """
        system_prompt = f"{prompts.EXPLANATION_SYSTEM_PROMPT}以{difficulty_level}难度级别为目标用户讲解知识点。"
        prompt = prompts.EXPLANATION_USER_PROMPT_TEMPLATE.format(knowledge_point=knowledge_point)

        return self.llm.generate_text(prompt, system_prompt=system_prompt)

    def generate_examples(
        self, knowledge_point: str, num_examples: int = 3
    ) -> List[str]:
        """
        生成知识点的应用示例

        Args:
            knowledge_point: 知识点内容
            num_examples: 生成示例的数量

        Returns:
            示例列表
        """
        system_prompt = prompts.EXAMPLES_SYSTEM_PROMPT
        prompt = prompts.EXAMPLES_USER_PROMPT_TEMPLATE.format(
            num_examples=num_examples, knowledge_point=knowledge_point
        )

        schema = {
            "type": "object",
            "properties": {
                "examples": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string"},
                            "description": {"type": "string"},
                            "code_or_steps": {"type": "string"},
                        },
                    },
                }
            },
        }

        result = self.llm.generate_json(prompt, schema=schema)
        return [ex["code_or_steps"] for ex in result.get("examples", [])]

    def generate_quiz(
        self,
        knowledge_point: str,
        num_questions: int = 5,
        question_type: str = "multiple_choice",
    ) -> List[Dict[str, Any]]:
        """
        生成知识点的测试题库

        Args:
            knowledge_point: 知识点内容
            num_questions: 生成题目数量
            question_type: 题目类型 (multiple_choice/short_answer/true_false)

        Returns:
            题目列表
        """
        system_prompt = prompts.QUIZ_SYSTEM_PROMPT

        prompt = prompts.QUIZ_PROMPT_TEMPLATE.get(question_type, "").format(
            num_questions=num_questions, knowledge_point=knowledge_point
        )

        result = self.llm.generate_json(prompt)
        return result.get("questions", [])

    def generate_tutorial(
        self, topic: str, subtopics: List[str]
    ) -> Dict[str, Any]:
        """
        为某个主题生成完整的教程结构

        Args:
            topic: 教学主题
            subtopics: 子主题列表

        Returns:
            包含结构化教程信息的字典
        """
        system_prompt = prompts.TUTORIAL_SYSTEM_PROMPT

        subtopics_str = "\n".join([f"- {st}" for st in subtopics])
        prompt = prompts.TUTORIAL_USER_PROMPT_TEMPLATE.format(
            topic=topic, subtopics_str=subtopics_str
        )

        result = self.llm.generate_json(prompt)
        return result
