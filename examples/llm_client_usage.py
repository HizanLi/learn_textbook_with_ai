import os
from dotenv import load_dotenv
from openai import OpenAI
from google import genai

# 1. 加载 .env 文件中的变量
load_dotenv()

# 配置各平台 API Key
OPENAI_KEY = os.getenv("OPENAI_API_KEY")
GEMINI_KEY = os.getenv("GEMINI_API_KEY")
DEEPSEEK_KEY = os.getenv("DEEPSEEK_API_KEY")

def call_openai():
    print("\n--- 调用 OpenAI (GPT-5.2) ---")
    client = OpenAI(api_key=OPENAI_KEY)
    response = client.chat.completions.create(
        model="gpt-5.2",
        messages=[{"role": "user", "content": "用一句话解释什么是量子纠缠。"}]
    )
    print(f"GPT-5.2 回答: {response.choices[0].message.content}")

def call_gemini():
    # print("\n--- 调用 Google (Gemini 3.1 Pro) ---")
    # # 使用最新的 google-genai SDK
    client = genai.Client(api_key=GEMINI_KEY)
    # response = client.models.generate_content(
    #     model="gemini-3.1-pro-preview",
    #     contents="用一句话解释什么是量子纠缠。"
    # )
    # print(f"Gemini 3.1 回答: {response.text}")
    for m in client.models.list():
        for action in m.supported_actions:
            if action == "generateContent":
                print(m.name)

def call_deepseek():
    print("\n--- 调用 DeepSeek (V4 Reasoner) ---")
    # DeepSeek 使用 OpenAI 兼容接口，但需指定 base_url
    client = OpenAI(api_key=DEEPSEEK_KEY, base_url="https://api.deepseek.com")
    
    # Reasoner 模型会返回思维链
    response = client.chat.completions.create(
        model="deepseek-v4",
        messages=[{"role": "user", "content": "用一句话解释什么是量子纠缠。"}]
    )
    
    # 打印思维过程（如果 API 支持返回 reasoning_content）
    if hasattr(response.choices[0].message, 'reasoning_content'):
        print(f"思维链: {response.choices[0].message.reasoning_content[:50]}...")
        
    print(f"DeepSeek V4 回答: {response.choices[0].message.content}")

if __name__ == "__main__":
    try:
        # call_openai()
        call_gemini()
        # call_deepseek()
    except Exception as e:
        print(f"调用出错: {e}")
