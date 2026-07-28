# 📚 AI 教材学习工作台 (Learn Textbook With AI)

基于大语言模型的智能教材学习系统。用户可以上传 PDF 教材，自动完成从 PDF 解析、结构化转换到 AI 辅助学习的全流程。

[英文文档](README.en.md)

---

## 🎯 概述

本项目是一个集 PDF 解析、内容结构化、AI 辅助学习于一体的综合平台。它利用 **MinerU** 将 PDF 教材转换为结构化 Markdown，通过 **LangChain** 进行文本分块，使用 **ChromaDB** 进行向量化存储与检索，最后借助 **LLM（OpenAI / DeepSeek / Google Gemini）** 生成章节知识要点、详细讲解和章节测验。

该系统采用前后端分离架构，提供中英文双语界面。

---

## ✨ 核心功能

| 功能 | 说明 |
|---|---|
| **PDF 上传与管理** | 支持 PDF 文件上传，自动读取页数，大型 PDF 自动拆分处理 |
| **MinerU 转换** | 调用 MinerU Docker 容器将 PDF 转换为结构化 Markdown |
| **Markdown 分块** | 基于标题层级对 Markdown 内容进行智能分块 |
| **向量化存储** | 使用 ChromaDB + Sentence-Transformers 实现语义向量化存储 |
| **目录解析** | 利用 LLM 解析教材目录，生成结构化目录 JSON |
| **章节分析** | AI 自动为每个章节/小节生成核心概念、基本规则、常见误区和示例 |
| **AI 讲解** | 基于原文生成章节内容的详细讲解（Markdown 格式） |
| **章节测验** | 基于原文生成选择题和简答题，支持交互式答题与答案核对 |
| **PDF 阅读器** | 集成 PDF 预览，支持章节跳转、页码记忆和偏移量设置 |
| **中英文双语** | 系统界面支持中英文实时切换 |
| **多模型支持** | 支持 OpenAI（GPT）、DeepSeek、Google Gemini 三种 LLM 提供商 |

---

## 🏗️ 系统架构

```text
Browser (React) ←→ Node.js Backend (Express) ←→ Python Core (FastAPI) ←→ MinerU (Docker)
                           ↕
                    ChromaDB (向量数据库)
                           ↕
                  LLM (OpenAI / DeepSeek / Gemini)
```

### 项目文件结构

```text
.
├── data/                       # 用户运行时数据（输入、输出、向量库、状态）
│   └── <username>/
│       ├── input/              # 上传的 PDF 及分片
│       ├── output/             # 转换后的 Markdown 和分析结果
│       ├── chroma_db/          # ChromaDB 向量数据库
│       ├── user_status.json    # 项目列表与处理状态
│       └── project_preferences.json  # PDF 阅读偏好
├── docker/                     # MinerU Docker 配置
├── docs/                       # 模型参考文件
│   ├── openai_models.json
│   ├── deepseek_models.json
│   └── gemini_models.json
├── examples/                   # LLM 客户端使用示例
├── notebooks/                  # 实验性 Jupyter Notebook
└── src/
    ├── backend/                # Node.js Express 后端（协调层）
    │   ├── routes/             # API 路由
    │   │   ├── auth.js         # 登录
    │   │   ├── upload.js       # 上传
    │   │   ├── process.js      # 项目处理
    │   │   ├── projects.js     # 项目管理、Markdown、PDF、处理步骤
    │   │   ├── llm.js          # LLM 生成（讲解、测验）
    │   │   └── explain.js      # 讲解（旧版）
    │   ├── services/
    │   │   ├── storage.js      # 数据存储操作
    │   │   ├── processor.js    # 与 Python Core 通信
    │   │   └── mock.js         # 模拟数据（开发用）
    │   └── server.js           # 入口
    ├── core/                   # Python FastAPI 后端（处理层）
    │   ├── main.py             # FastAPI 入口，定义所有处理端点
    │   ├── microservices/
    │   │   ├── mineru_client.py  # MinerU Docker 客户端
    │   │   ├── chunker.py        # Markdown 分块（LangChain）
    │   │   └── vectorization.py  # ChromaDB 向量化存储与检索
    │   ├── llm/
    │   │   ├── llm_client.py     # OpenAI / DeepSeek / Gemini 统一接口
    │   │   ├── prompts.py        # Prompt 模板定义
    │   │   └── analyze_textbook.py  # 教材分析引擎
    │   └── scripts/
    │       ├── generate_overview.py
    │       └── merge_toc_content.py
    └── frontend/               # React + Vite 前端
        ├── src/
        │   ├── main.jsx
        │   ├── App.jsx
        │   ├── i18n.js         # 中英文国际化翻译
        │   ├── context/
        │   │   └── UserContext.jsx  # 用户上下文（语言、健康检查）
        │   ├── pages/
        │   │   ├── Auth.jsx         # 登录页面
        │   │   ├── Dashboard.jsx    # 工作台（上传、项目列表）
        │   │   ├── Study.jsx        # 教材学习页面
        │   │   ├── Explain.jsx      # 详细讲解页面
        │   │   └── SectionLab.jsx   # 小节实验室（测验/讲解）
        │   ├── components/
        │   │   ├── UploadZone.jsx         # 拖拽上传组件
        │   │   ├── ProjectList.jsx        # 项目列表面板
        │   │   ├── TextbookContentViewer.jsx  # 核心阅读器组件
        │   │   ├── KeypointsSidebar.jsx   # 知识要点侧边栏
        │   │   ├── MarkdownRenderer.jsx   # Markdown 渲染
        │   │   └── MarkdownPreview.jsx    # Markdown 预览
        │   └── services/
        │       └── api.js       # 所有前端 API 调用封装
        └── vite.config.js
```

---

## 🚀 快速开始

### 环境要求

- **操作系统**: macOS / Linux / Windows（需 Unix 兼容终端）
- **Python**: 3.10 或更高版本（推荐 Conda）
- **Node.js**: 18 或更高版本 + npm
- **Docker**: Docker Desktop（运行 MinerU 容器）
- **API Key**: OpenAI / DeepSeek / Google Gemini（任选其一或多个）

### 1. 克隆并配置 Python 环境

```bash
# 克隆项目
git clone <repository-url>
cd learn-textbook-with-ai

# 创建 Conda 环境
conda create -n learn_textbook_ai python=3.11 pip -y
conda activate learn_textbook_ai
pip install -r requirements.txt
```

### 2. 安装 JavaScript 依赖

```bash
# 安装后端依赖
cd src/backend
npm install

# 安装前端依赖
cd ../frontend
npm install

# 回到项目根目录
cd ../..
```

### 3. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，根据实际环境修改以下关键配置：

```dotenv
DATA_DIR=./data
VITE_API_BASE=http://localhost:4000
BACKEND_PORT=4000
CORE_API=http://127.0.0.1:8080
PYTHON_API_BASE=http://127.0.0.1:8080
PYTHON_PORT=8080
MINERU_API_URL=http://127.0.0.1:8000/file_parse
MINERU_PDF_PART_PAGES=100

# 配置至少一个 LLM 提供商
OPENAI_API_KEY=sk-...
DEEPSEEK_API_KEY=sk-...
GEMINI_API_KEY=...
```

### 4. 启动 MinerU（Docker）

确保本地已有 `mineru:latest` Docker 镜像（详见 [MinerUDockerSetup.md](MinerUDockerSetup.md)）。

```bash
docker compose up -d mineru-api
# 验证 MinerU 是否就绪
curl http://127.0.0.1:8000/docs
```

### 5. 启动所有服务

需要**三个终端窗口**，均从项目根目录执行：

**终端 1 — Python Core 服务**（端口 8080）

```bash
conda activate learn_textbook_ai
python src/core/main.py
```

**终端 2 — Node.js 后端**（端口 4000）

```bash
cd src/backend
npm run dev
```

**终端 3 — 前端开发服务器**（端口 3000）

```bash
cd src/frontend
npm run dev
```

打开浏览器访问 **http://localhost:3000**。

---

## 🔄 处理流程

1. **登录** — 输入用户名，系统创建 `data/<username>/` 目录
2. **上传 PDF** — 上传教材 PDF，Node 后端保存文件
3. **页面准备** — Python Core 读取 PDF 页数，超过阈值自动拆分
4. **Step 1: PDF → Markdown** — MinerU 将 PDF 转换为结构化 Markdown，大型 PDF 分片转换后自动合并
5. **Step 2: Markdown → JSON** — 粘贴目录文本，LLM 解析为结构化 JSON，Markdown 分块生成 chunker_step_1.json
6. **Step 3: 生成内容摘要** — LLM 逐章节分析，生成核心概念、基本规则、常见误区、示例和一句话总结
7. **学习探索** — 浏览章节内容、查看 AI 分析、请求详细讲解、生成章节测验、阅读原始 PDF

### 各步骤详细说明

| 步骤 | 说明 | 关键文件 |
|---|---|---|
| Step 1 | 调用 MinerU Docker 容器解析 PDF 为 Markdown | `hybrid_auto/<project>.md` |
| Step 2a | 基于标题层级对 Markdown 进行分块 | `hybrid_auto/chunker_step_1.json` |
| Step 2b | LLM 解析目录文本为结构化 JSON | `hybrid_auto/textbook_toc.json` |
| Step 2c | 合并分块数据与目录结构 | `hybrid_auto/textbook_with_content.json` |
| Step 3 | LLM 分析每节内容，生成知识要点 | 写入 `textbook_with_content.json` |

### 用户数据目录结构

```text
data/<user>/
├── input/
│   └── <project-name>/
│       ├── <project>.pdf          # 原始上传 PDF
│       ├── manifest.json           # 大型 PDF 分片清单
│       ├── part_001/
│       │   └── <project>_part_001.pdf
│       └── ...
├── output/
│   └── <project-name>/
│       ├── part_001/               # 分片输出
│       └── hybrid_auto/            # 合并后的最终输出
│           ├── <project>.md
│           ├── chunker_step_1.json
│           ├── textbook_toc.json
│           └── textbook_with_content.json
├── chroma_db/                      # 用户级 ChromaDB 向量数据库
├── user_status.json                # 项目列表、状态、元数据
├── project_preferences.json        # PDF 阅读偏好
├── latest_upload.json              # 最近上传状态
└── latest.md                       # 轻量 Markdown 占位
```

---

## 📡 API 接口一览

### Node.js 后端接口（4000）

| 方法 | 路径 | 用途 |
|---|---|---|
| POST | `/api/login` | 用户登录 |
| GET | `/api/user-status` | 获取用户状态 |
| POST | `/api/upload` | 上传 PDF |
| POST | `/api/prepare-project-pdf` | 准备/拆分 PDF |
| POST | `/api/select-project` | 选择项目 |
| POST | `/api/project-remark` | 编辑项目备注 |
| GET | `/api/project-pdf` | 获取 PDF 文件 |
| GET/POST | `/api/project-pdf-preferences` | 读取/保存 PDF 阅读偏好 |
| GET | `/api/project-markdown` | 获取项目 Markdown |
| GET | `/api/project-processing-steps` | 查询处理步骤状态 |
| GET | `/api/project-processing-progress` | 查询分析进度 |
| POST | `/api/trigger-processing-step` | 触发处理步骤 |
| POST | `/api/parse-project-toc` | 解析目录 |
| GET | `/api/llm/providers` | 获取 LLM 提供商列表 |
| POST | `/api/llm/detailed-explanation` | 生成详细讲解 |
| POST | `/api/llm/quiz-for-section` | 生成章节测验 |
| GET | `/health` | 健康检查 |

### Python Core 接口（8080）

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/health` | 健康检查 |
| GET | `/api/status` | 系统状态 |
| POST | `/api/mineru/prepare` | PDF 准备（页数统计、分片） |
| POST | `/api/mineru/process` | PDF → Markdown 转换 |
| POST | `/api/chunker/process` | Markdown 分块 |
| POST | `/api/vectorization/store` | 向量化存储 |
| POST | `/api/vectorization/search` | 语义搜索 |
| POST | `/api/analyze/textbook` | 教材章节分析 |
| GET | `/api/analyze/progress` | 分析进度查询 |
| POST | `/api/analyze/parse-toc` | 目录解析 |

---

## 🧩 技术栈

| 层级 | 技术 |
|---|---|
| **前端** | React 18, React Router 6, Vite 5, Tailwind CSS 3, Lucide React |
| **后端 (Node)** | Express 4, Multer（文件上传） |
| **后端 (Python)** | FastAPI, Uvicorn |
| **PDF 解析** | MinerU（Docker）, PyPDF |
| **文本分块** | LangChain (MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter) |
| **向量数据库** | ChromaDB + all-MiniLM-L6-v2 |
| **LLM** | OpenAI GPT, DeepSeek, Google Gemini |
| **国际化** | 自带中英双语翻译系统（i18n.js） |

---

## 📝 开发说明

- **前端端口**: 项目配置为 `3000`（非 Vite 默认 `5173`）
- **PDF 分片阈值**: `MINERU_PDF_PART_PAGES` 控制拆分阈值，大型 PDF 建议 `100`~`120` 页
- **数据目录**: `data/` 包含用户文档和生成数据，若包含隐私内容请勿提交到版本控制
- **Docker GPU**: `docker-compose.yaml` 包含 NVIDIA GPU 配置，主要适用于 Linux 环境；macOS 上会忽略 GPU 配置
- **旧版兼容**: 系统兼容旧版扁平上传结构，执行准备操作时会自动迁移到新目录结构

### 基础验证

```bash
# 构建前端
cd src/frontend && npm run build

# 验证服务健康
curl http://127.0.0.1:8080/health
curl http://127.0.0.1:4000/health
```

---

## 📄 许可

本项目为开源项目，仅供学习和研究使用。
