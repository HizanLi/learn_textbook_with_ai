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
import openai
from openai import OpenAI
import google.generativeai as genai

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
        temperature: float = 0.7,
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

        self.client = openai.OpenAI(api_key=self.api_key)

    def generate_text(
        self,
        prompt: str,
        max_tokens: Optional[int] = None,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
    ) -> str:
        """调用 OpenAI API 生成文本"""
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        response = self.client.chat.completions.create(
            model=self.model_name,
            messages=messages,
            temperature=temperature,
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
            full_prompt, max_tokens, system_prompt, temperature=0.3
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
            
        self.client = OpenAI(
            api_key=self.api_key,
            base_url="https://api.deepseek.com",
        )

    def generate_text(
        self,
        prompt: str,
        max_tokens: Optional[int] = None,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
    ) -> str:
        """调用 Deepseek API 生成文本"""
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        response = self.client.chat.completions.create(
            model=self.model_name,
            messages=messages,
            temperature=temperature,
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
            full_prompt, max_tokens, system_prompt, temperature=0.3
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
        model_name: str = "gemini-3-flash-preview",
        temperature: float = 0.7,
    ):
        api_key = api_key or os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("Gemini API key not found")
        super().__init__(api_key, model_name, temperature)

        self.client = genai.Client(api_key=self.api_key)

    def generate_text(
        self,
        prompt: str,
        max_tokens: Optional[int] = None,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
    ) -> str:
        """调用 Gemini API 生成文本"""
        config = {
            "temperature": temperature,
        }
        if max_tokens:
            config["max_output_tokens"] = max_tokens

        try:
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config={
                    "system_instruction": system_prompt,
                    **config
                } if system_prompt else config
            )
            return response.text
        except Exception as e:
            raise ValueError(f"Gemini generation failed: {str(e)}")

    def generate_json(
        self,
        prompt: str,
        schema: Optional[Dict[str, Any]] = None,
        max_tokens: Optional[int] = None,
        system_prompt: Optional[str] = None,
    ) -> Dict[str, Any]:
        """生成 JSON 格式的结构化数据"""
        config = {
            "temperature": 0.3,
            "response_mime_type": "application/json",
        }
        if schema:
            config["response_schema"] = schema
        
        try:
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config={
                    "system_instruction": system_prompt,
                    **config
                } if system_prompt else config
            )
            return json.loads(response.text)
        except Exception as e:
            # Fallback to text parsing if structured generation fails
            text_response = self.generate_text(prompt, max_tokens, system_prompt)
            try:
                json_str = text_response
                if "```json" in text_response:
                    json_str = text_response.split("```json")[1].split("```")[0]
                return json.loads(json_str.strip())
            except:
                raise ValueError(f"Failed to parse JSON for Gemini: {str(e)}")


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
                model_name=model_name,
                temperature=temperature,
            )
        elif provider == ModelProvider.DEEPSEEK:
            return DeepseekClient(
                api_key=api_key,
                model_name=model_name,
                temperature=temperature,
            )
        elif provider == ModelProvider.GOOGLE:
            return GeminiClient(
                api_key=api_key,
                model_name=model_name,
                temperature=temperature,
            )
        else:
            raise ValueError(f"Unsupported provider: {provider}")



