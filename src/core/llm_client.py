"""
LLM Client 模块 - 封装 GPT、Deepseek、Gemini 的统一接口
支持文本生成、教程生成、题目生成等功能
"""

import os
from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any
from enum import Enum
from dotenv import load_dotenv
import json

load_dotenv()


class ModelProvider(Enum):
    """支持的模型提供商"""
    OPENAI = "openai"  # GPT-3.5, GPT-4
    DEEPSEEK = "deepseek"  # Deepseek
    GOOGLE = "google"  # Gemini


class LLMClient(ABC):
    """LLM 客户端抽象基类"""

    def __init__(self, api_key: str, model_name: str, temperature: float = 0.7):
        self.api_key = api_key
        self.model_name = model_name
        self.temperature = temperature

    @abstractmethod
    def generate_text(
        self,
        prompt: str,
        max_tokens: Optional[int] = None,
        system_prompt: Optional[str] = None,
    ) -> str:
        """生成文本内容"""
        pass

    @abstractmethod
    def generate_json(
        self,
        prompt: str,
        schema: Optional[Dict[str, Any]] = None,
        max_tokens: Optional[int] = None,
        system_prompt: Optional[str] = None,
    ) -> Dict[str, Any]:
        """生成符合 JSON Schema 的结构化数据"""
        pass


class OpenAIClient(LLMClient):
    """OpenAI GPT 客户端"""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: str = "gpt-4o",
        temperature: float = 0.7,
    ):
        api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OpenAI API key not found")
        super().__init__(api_key, model_name, temperature)

        try:
            import openai
            self.client = openai.OpenAI(api_key=self.api_key)
        except ImportError:
            raise ImportError("Please install openai: pip install openai")

    def generate_text(
        self,
        prompt: str,
        max_tokens: Optional[int] = None,
        system_prompt: Optional[str] = None,
    ) -> str:
        """调用 OpenAI API 生成文本"""
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        response = self.client.chat.completions.create(
            model=self.model_name,
            messages=messages,
            temperature=self.temperature,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content

    def generate_json(
        self,
        prompt: str,
        schema: Optional[Dict[str, Any]] = None,
        max_tokens: Optional[int] = None,
        system_prompt: Optional[str] = None,
    ) -> Dict[str, Any]:
        """生成 JSON 格式的结构化数据"""
        if schema:
            json_schema_prompt = f"\n\n返回符合以下 JSON Schema 的数据：\n{json.dumps(schema, ensure_ascii=False, indent=2)}"
        else:
            json_schema_prompt = "\n\n请返回有效的 JSON 格式。"

        full_prompt = prompt + json_schema_prompt

        text_response = self.generate_text(
            full_prompt, max_tokens, system_prompt
        )

        try:
            # 尝试从响应中提取 JSON
            json_str = text_response
            if "```json" in text_response:
                json_str = text_response.split("```json")[1].split("```")[0]
            elif "```" in text_response:
                json_str = text_response.split("```")[1].split("```")[0]

            return json.loads(json_str.strip())
        except json.JSONDecodeError:
            raise ValueError(f"Failed to parse JSON response: {text_response}")


class DeepseekClient(LLMClient):
    """Deepseek 客户端"""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: str = "deepseek-chat",
        temperature: float = 0.7,
    ):
        api_key = api_key or os.getenv("DEEPSEEK_API_KEY")
        if not api_key:
            raise ValueError("Deepseek API key not found")
        super().__init__(api_key, model_name, temperature)

        try:
            from openai import OpenAI
            self.client = OpenAI(
                api_key=self.api_key,
                base_url="https://api.deepseek.com",
            )
        except ImportError:
            raise ImportError("Please install openai: pip install openai")

    def generate_text(
        self,
        prompt: str,
        max_tokens: Optional[int] = None,
        system_prompt: Optional[str] = None,
    ) -> str:
        """调用 Deepseek API 生成文本"""
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        response = self.client.chat.completions.create(
            model=self.model_name,
            messages=messages,
            temperature=self.temperature,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content

    def generate_json(
        self,
        prompt: str,
        schema: Optional[Dict[str, Any]] = None,
        max_tokens: Optional[int] = None,
        system_prompt: Optional[str] = None,
    ) -> Dict[str, Any]:
        """生成 JSON 格式的结构化数据"""
        if schema:
            json_schema_prompt = f"\n\n返回符合以下 JSON Schema 的数据：\n{json.dumps(schema, ensure_ascii=False, indent=2)}"
        else:
            json_schema_prompt = "\n\n请返回有效的 JSON 格式。"

        full_prompt = prompt + json_schema_prompt

        text_response = self.generate_text(
            full_prompt, max_tokens, system_prompt
        )

        try:
            json_str = text_response
            if "```json" in text_response:
                json_str = text_response.split("```json")[1].split("```")[0]
            elif "```" in text_response:
                json_str = text_response.split("```")[1].split("```")[0]

            return json.loads(json_str.strip())
        except json.JSONDecodeError:
            raise ValueError(f"Failed to parse JSON response: {text_response}")


class GeminiClient(LLMClient):
    """Google Gemini 客户端"""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: str = "gemini-flash-latest",
        temperature: float = 0.7,
    ):
        api_key = api_key or os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("Gemini API key not found")
        super().__init__(api_key, model_name, temperature)

        try:
            import google.generativeai as genai
            genai.configure(api_key=self.api_key)
            self.client = genai.GenerativeModel(model_name=self.model_name)
        except ImportError:
            raise ImportError(
                "Please install google-generativeai: pip install google-generativeai"
            )

    def generate_text(
        self,
        prompt: str,
        max_tokens: Optional[int] = None,
        system_prompt: Optional[str] = None,
    ) -> str:
        """调用 Gemini API 生成文本"""
        if system_prompt:
            full_prompt = f"{system_prompt}\n\n{prompt}"
        else:
            full_prompt = prompt

        generation_config = {
            "temperature": self.temperature,
        }
        if max_tokens:
            generation_config["max_output_tokens"] = max_tokens

        response = self.client.generate_content(
            full_prompt,
            generation_config=generation_config,
        )
        return response.text

    def generate_json(
        self,
        prompt: str,
        schema: Optional[Dict[str, Any]] = None,
        max_tokens: Optional[int] = None,
        system_prompt: Optional[str] = None,
    ) -> Dict[str, Any]:
        """生成 JSON 格式的结构化数据"""
        if schema:
            json_schema_prompt = f"\n\n返回符合以下 JSON Schema 的数据：\n{json.dumps(schema, ensure_ascii=False, indent=2)}"
        else:
            json_schema_prompt = "\n\n请返回有效的 JSON 格式。"

        full_prompt = prompt + json_schema_prompt

        text_response = self.generate_text(
            full_prompt, max_tokens, system_prompt
        )

        try:
            json_str = text_response
            if "```json" in text_response:
                json_str = text_response.split("```json")[1].split("```")[0]
            elif "```" in text_response:
                json_str = text_response.split("```")[1].split("```")[0]

            return json.loads(json_str.strip())
        except json.JSONDecodeError:
            raise ValueError(f"Failed to parse JSON response: {text_response}")


class LLMFactory:
    """LLM 客户端工厂类 - 用于创建相应的 LLM 客户端"""

    @staticmethod
    def create_client(
        provider: ModelProvider,
        api_key: Optional[str] = None,
        model_name: Optional[str] = None,
        temperature: float = 0.7,
    ) -> LLMClient:
        """
        创建对应的 LLM 客户端

        Args:
            provider: 模型提供商
            api_key: API 密钥，不提供则从环境变量读取
            model_name: 模型名称，不提供则使用默认值
            temperature: 生成的随机性，0-2

        Returns:
            LLMClient 实例
        """
        if provider == ModelProvider.OPENAI:
            return OpenAIClient(
                api_key=api_key,
                model_name=model_name or "gpt-4",
                temperature=temperature,
            )
        elif provider == ModelProvider.DEEPSEEK:
            return DeepseekClient(
                api_key=api_key,
                model_name=model_name or "deepseek-chat",
                temperature=temperature,
            )
        elif provider == ModelProvider.GOOGLE:
            return GeminiClient(
                api_key=api_key,
                model_name=model_name or "gemini-pro",
                temperature=temperature,
            )
        else:
            raise ValueError(f"Unsupported provider: {provider}")


# ======================== 教学内容生成模块 ========================


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
        system_prompt = f"""你是一位经验丰富的教师。以{difficulty_level}难度级别为目标用户讲解知识点。
要求：
1. 用简洁、清晰的语言解释
2. 包含至少一个现实生活中的例子
3. 强调这个知识点的关键要点
4. 如果适用，说明与其他相关概念的联系
"""

        prompt = f"请详细解释下列知识点：\n{knowledge_point}"

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
        system_prompt = """你是一位资深的教学设计师。
要求：
1. 每个示例都应该从简单到复杂逐步递进
2. 每个示例都要包含完整的步骤或代码
3. 示例应该与现实场景相关联"""

        prompt = f"""为下列知识点生成 {num_examples} 个实用示例：

知识点：{knowledge_point}

请按照如下 JSON 格式返回：
{{
    "examples": [
        {{"title": "示例1标题", "description": "详细描述", "code_or_steps": "代码或步骤"}},
        ...
    ]
}}"""

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
        system_prompt = """你是一位出题专家。要求：
1. 题目应该能够测试学生对知识的深理解，不只是记忆
2. 难度应该循序渐进
3. 选项应该具有迷惑性但答案清晰"""

        if question_type == "multiple_choice":
            prompt = f"""为下列知识点生成 {num_questions} 道多选题。

知识点：{knowledge_point}

请按照如下 JSON 格式返回：
{{
    "questions": [
        {{
            "id": 1,
            "question": "问题文本",
            "options": {{"A": "选项A", "B": "选项B", "C": "选项C", "D": "选项D"}},
            "correct_answer": "A",
            "explanation": "答案解释"
        }},
        ...
    ]
}}"""
        elif question_type == "short_answer":
            prompt = f"""为下列知识点生成 {num_questions} 道简答题。

知识点：{knowledge_point}

请按照如下 JSON 格式返回：
{{
    "questions": [
        {{
            "id": 1,
            "question": "问题文本",
            "sample_answer": "参考答案",
            "key_points": ["关键点1", "关键点2"]
        }},
        ...
    ]
}}"""
        else:  # true_false
            prompt = f"""为下列知识点生成 {num_questions} 道判断题。

知识点：{knowledge_point}

请按照如下 JSON 格式返回：
{{
    "questions": [
        {{
            "id": 1,
            "statement": "陈述句",
            "is_true": true,
            "explanation": "解释"
        }},
        ...
    ]
}}"""

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
        system_prompt = """你是一位教学设计专家。
要求：
1. 教程结构清晰，逻辑递进
2. 每个部分都有明确的学习目标
3. 包含实用的建议和常见错误提醒"""

        subtopics_str = "\n".join([f"- {st}" for st in subtopics])

        prompt = f"""为下列主题和子主题创建一个完整的教程大纲：

主题：{topic}

子主题：
{subtopics_str}

请按照如下 JSON 格式返回：
{{
    "title": "教程标题",
    "learning_objectives": ["目标1", "目标2"],
    "sections": [
        {{
            "name": "章节名称",
            "duration_minutes": 15,
            "content": "详细内容",
            "key_takeaways": ["要点1", "要点2"]
        }},
        ...
    ],
    "common_mistakes": ["常见错误1", "常见错误2"],
    "resources": ["资源1", "资源2"]
}}"""

        result = self.llm.generate_json(prompt)
        return result
