# learn_textbook_with_ai

> 📚 基于大型语言模型的教科书辅助学习工具

本项目旨在构建一个可以帮助用户学习教科书的智能系统，利用 GPT、Deepseek、Gemini 等大模型，实现从 PDF 教科书到互动教学内容的完整流程。

---

## 🚀 项目目标

1. **输入教科书**：用户上传一本 PDF 教科书。
2. **格式转换**：将 PDF 转换为 Markdown，并根据章节和字数将内容切割成较小片段。
3. **向量化处理**：针对每个片段进行向量化，以便后续检索和生成。
4. **知识点讲解**：为每个知识点生成详尽的解释、教程和例题。
5. **多媒体输出**：生成音频以及带有虚拟教师形象的视频讲解。
6. **评估与反馈**：在学习结束后生成小测验（quiz），评估用户掌握情况。

## 🔧 功能概述

- 📄 教科书 PDF 到 Markdown 的转换
- ✂️ 按章节/字数切割 Markdown
- ⚙️ 多模型支持（GPT, Deepseek, Gemini）
- 🧠 向量化与检索（基于 Chroma 或其他向量数据库）
- 📝 自动生成教程、例题、讲解内容
- 🎧 语音合成（音频）
- 🎥 虚拟教师视频生成
- ✅ 交互式 Quiz 和学习评估

## 🏗 架构结构

```
User Upload (PDF) 
      |
      v
Conversion -> Markdown -> Chunking -> Vectorization
      |
      +--> Knowledge Generation (GPT/Deepseek/Gemini)
               |               |
         Text Explanation   Examples/Quiz
               |
      Multimedia Generation (Audio/Video)
               |
           User Interaction
```

- **src/main.py**：入口脚本
- **src/backend/core**：核心逻辑，包括转换、向量化及生成功能
- **src/backend/frontend**：前端展示层
- **docker/**：Docker 配置文件
- **notebooks/**：用于实验和测试的笔记本

## 📁 目录说明

具体模块详见代码结构：

- `chunker.py`：负责文本切分
- `vectorization.py`：向量化和数据库交互
- `mineru_client.py`：与大模型交互的客户端逻辑

## 📝 使用说明

1. 克隆仓库并安装依赖：
   ```bash
   pip install -r requirements.txt
   ```
2. 启动服务（示例）：
   ```bash
   python src/main.py
   ```
3. 在浏览器中访问本地界面，上传 PDF 并开始学习。

## 🗂 开发计划（To‑Do List）

以下是项目的关键开发阶段，帮助 contributors 理解进度和任务：

- [*] **PDF 转 Markdown**：实现稳定的转换工具
- [*] **文本切分**：按章节与字数切分并保存元数据
- [*] **向量化**：选型并集成向量数据库（Chroma 等）
- [ ] **大模型接口**：封装 GPT/Deepseek/Gemini 调用逻辑
- [ ] **生成教程**：文本内容、例题与 Quiz 生成模块
- [ ] **音频合成**：集成 TTS 引擎输出讲解音频
- [ ] **视频教师**：实现虚拟教师角色的动画/视频生成
- [ ] **前端交互**：构建上传、浏览与测验界面
- [ ] **测试与评估**：编写单元测试和集成测试
- [ ] **文档与部署**：撰写完整文档并提供 Docker/云部署示例

> ✨ 本列表会随项目推进动态更新，欢迎提交 PR 添加或调整任务。

## 🤝 贡献

欢迎 issue、PR 或建议！请先阅读项目规范。

---

*Learn_textbook_with_ai* 让学习更智能、更具互动性。欢迎体验并改进！
