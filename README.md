# learn_textbook_with_ai

基于大语言模型的教科书学习工作台。当前项目已经实现了一个可运行的三层结构：

- `src/frontend`: React + Vite 学习界面
- `src/backend`: Node/Express 协调层
- `src/core`: FastAPI + Python 内容处理服务

用户上传 PDF 后，系统会围绕 `data/<user>/...` 目录组织输入文件、处理中间产物、项目状态和生成结果。

## Current Status

当前可用能力：

- 用户登录后上传 PDF 教材；上传完成后立即按 `MINERU_PDF_PART_PAGES` 检查页数并准备大型 PDF 的分段文件
- 在 Dashboard 中查看项目列表并进入学习页
- 通过 Node 后端读取 `data/<user>/input` 和 `data/<user>/output`
- 在学习页查看处理进度、原始 PDF 和结构化教材内容
- 调用 Python core 完成以下步骤：
  - Step 1: PDF -> Markdown（MinerU）；超过 `MINERU_PDF_PART_PAGES` 的 PDF 会分段处理后合并
  - Step 2: Markdown -> `chunker_step_1.json`，并支持手动提交目录文本生成 `textbook_toc.json`
  - Step 3: 章节/小节学习内容分析，生成 `textbook_with_content.json`
- 基于 OpenAI / DeepSeek / Gemini 生成：
  - Detailed Explanation
  - Quiz for Section

当前仍然偏开发态的部分：

- `docker-compose.yaml` 主要提供 MinerU 容器环境，尚不是完整的一键开发编排
- 测试体系还不完整
- 一些上传后的 `latest.md` / `latest_keypoints.json` 仍然是轻量级应用状态文件，不是最终学习内容主产物

## Project Layout

```text
.
├── data/                  # 所有用户输入、输出和运行时状态
├── docker/                # MinerU 相关 Docker 文件
├── docs/                  # 模型或参考配置
├── examples/              # 示例脚本
├── notebooks/             # 实验性 notebook
└── src/
    ├── backend/           # Node/Express API 层
    ├── core/              # FastAPI + PDF/Chunk/LLM 处理
    └── frontend/          # React + Vite 前端
```

## Data Layout

所有用户运行时数据统一放在 `data/<user>/...` 下：

```text
data/<user>/
├── input/                 # 用户上传的原始 PDF 与其分段文件
├── output/                # MinerU、chunker、analysis 产物
├── chroma_db/             # 向量库
├── user_status.json       # 项目列表与当前项目
├── latest.md              # 上传后的轻量级 Markdown 占位内容
├── latest_upload.json     # 最近一次上传信息
└── latest_keypoints.json  # summarize 路由生成的轻量级结果
```

一个典型项目输出目录类似：

```text
data/<user>/output/<project>/hybrid_auto/
├── <project>.md
├── chunker_step_1.json
├── textbook_toc.json
└── textbook_with_content.json
```

每个上传文件有独立目录，以避免原始文件与分段目录发生命名冲突：

```text
data/<user>/input/<filename>/
├── <filename>             # 原始上传的 PDF
├── manifest.json          # 仅大型 PDF：分段页码和输出位置
├── part_001/
│   ├── <stem>_part_001.pdf
│   └── mineru_output/
└── part_002/
    └── ...
```

对应项目的 `user_status.json` 会保存 `parts.part_numberN`，值为 `uploaded` 或 `converted`。最终合并后的
Markdown 仍然写入 `output/<project>/hybrid_auto/<project>.md`，因此后续 Step 2 和 Step 3 无需更改。
旧的扁平结构 `input/<filename>` 会在下一次 PDF preparation 时自动迁移到这个目录结构。

## Services And Ports

默认开发端口：

- Frontend: `http://localhost:3000`
- Node backend: `http://localhost:4000`
- Python core: `http://127.0.0.1:8080`
- MinerU API: `http://127.0.0.1:8000`

请求流向：

```text
Browser (3000)
  -> Node backend (4000)
     -> Python core (8080)
        -> MinerU / vectorization / textbook analysis
```

## Setup

1. 安装 Python 依赖

```bash
pip install -r requirements.txt
```

2. 安装前后端依赖

```bash
cd src/backend
npm install

cd ../frontend
npm install
```

3. 准备环境变量

复制 `.env.example` 为 `.env`，至少确认这些变量：

```bash
DATA_DIR=./data
VITE_API_BASE=http://localhost:4000
BACKEND_PORT=4000
CORE_API=http://127.0.0.1:8080
PYTHON_API_BASE=http://127.0.0.1:8080
PYTHON_PORT=8080
MINERU_API_URL=http://127.0.0.1:8000/file_parse
MINERU_PDF_PART_PAGES=120
```

如果要启用真实 LLM 生成功能，还需要配置：

```bash
OPENAI_API_KEY=...
DEEPSEEK_API_KEY=...
GEMINI_API_KEY=...
```

## Run

分别启动三个服务：

1. Python core

```bash
python src/core/main.py
```

2. Node backend

```bash
cd src/backend
npm run dev
```

3. Frontend

```bash
cd src/frontend
npm run dev
```

启动后访问 `http://localhost:3000`。

## Main API Surface

Node backend 暴露的主要接口：

- `/api/login`
- `/api/upload`
- `/api/user-status`
- `/api/select-project`
- `/api/project-pdf`
- `/api/project-markdown`
- `/api/project-processing-steps`
- `/api/project-processing-progress`
- `/api/trigger-processing-step`
- `/api/parse-project-toc`
- `/api/llm/detailed-explanation`
- `/api/llm/quiz-for-section`

Python core 暴露的主要接口：

- `/api/mineru/process`
- `/api/chunker/process`
- `/api/vectorization/store`
- `/api/vectorization/search`
- `/api/analyze/textbook`
- `/api/analyze/progress`
- `/api/analyze/parse-toc`
- `/health`

## Notes

- 当前前端默认端口是 `3000`，不是 `5173`
- 当前 Python 入口是 `src/core/main.py`
- 当前项目主存储目录是 `data/`，不是 `users/`
- `docs/`、`examples/`、`notebooks/` 仍然保留为研发辅助材料
