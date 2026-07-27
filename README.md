# 📚 Learn Textbook With AI

An AI-assisted textbook learning platform. Users can upload PDF textbooks, convert them to structured Markdown via **MinerU**, build searchable vector databases, generate chapter learning content, and create detailed explanations or quizzes using **LLMs**.

[中文文档](README.zh.md)

---

## 🎯 Overview

This project is a full-stack, AI-powered textbook learning workspace. It integrates **MinerU** for PDF-to-Markdown conversion, **LangChain** for smart text chunking, **ChromaDB** for vector storage & semantic search, and **LLMs (OpenAI / DeepSeek / Google Gemini)** for generating section key points, detailed explanations, and quizzes.

The system features a decoupled architecture with a React frontend, Node.js backend, and Python processing core. The UI supports both **English and Chinese** languages.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| **PDF Upload & Management** | Upload PDF textbooks, auto-count pages, auto-split large PDFs |
| **MinerU Conversion** | Convert PDFs to structured Markdown via MinerU Docker container |
| **Markdown Chunking** | Smart content splitting based on header hierarchy |
| **Vector Storage** | ChromaDB + Sentence-Transformers for semantic vectorization |
| **TOC Parsing** | LLM-powered table-of-contents extraction into structured JSON |
| **Section Analysis** | AI generates core concepts, fundamental rules, pitfalls, and examples |
| **AI Explanations** | Markdown-formatted detailed explanations grounded in source text |
| **Section Quizzes** | Multiple-choice and short-answer quizzes with answer checking |
| **PDF Viewer** | Inline PDF reader with chapter navigation, page memory, and offset calibration |
| **Bilingual UI** | Real-time switching between English and Chinese |
| **Multi-LLM Support** | OpenAI (GPT), DeepSeek, and Google Gemini |

---

## 🏗️ Architecture

```text
Browser (React) ←→ Node.js Backend (Express) ←→ Python Core (FastAPI) ←→ MinerU (Docker)
                           ↕
                    ChromaDB (Vector DB)
                           ↕
                  LLM (OpenAI / DeepSeek / Gemini)
```

### Project Structure

```text
.
├── data/                       # User-scoped runtime data (input, output, vector DB, states)
│   └── <username>/
│       ├── input/              # Uploaded PDFs and split parts
│       ├── output/             # Converted Markdown and analysis results
│       ├── chroma_db/          # ChromaDB vector database
│       ├── user_status.json    # Project list, status, metadata, part status
│       └── project_preferences.json  # PDF reading preferences
├── docker/                     # MinerU Docker configuration
├── docs/                       # Model reference files
├── examples/                   # LLM client usage examples
├── notebooks/                  # Experimental Jupyter notebooks
└── src/
    ├── backend/                # Node.js Express backend (orchestration layer)
    │   ├── routes/
    │   │   ├── auth.js         # User login
    │   │   ├── upload.js       # File upload with auto-PDF preparation
    │   │   ├── process.js      # Project processing orchestration
    │   │   ├── projects.js     # Project management, Markdown, PDF, processing steps
    │   │   ├── llm.js          # LLM generation (explanations, quizzes)
    │   │   └── explain.js      # Legacy explanation endpoint
    │   ├── services/
    │   │   ├── storage.js      # Filesystem storage operations
    │   │   ├── processor.js    # Communication with Python Core
    │   │   └── mock.js         # Mock data for development
    │   └── server.js           # Entry point
    ├── core/                   # Python FastAPI backend (processing layer)
    │   ├── main.py             # FastAPI app, all processing endpoints
    │   ├── microservices/
    │   │   ├── mineru_client.py  # MinerU Docker client
    │   │   ├── chunker.py        # Markdown chunking via LangChain
    │   │   └── vectorization.py  # ChromaDB vector storage & search
    │   ├── llm/
    │   │   ├── llm_client.py     # Unified OpenAI / DeepSeek / Gemini interface
    │   │   ├── prompts.py        # Prompt template definitions
    │   │   └── analyze_textbook.py  # Textbook analysis engine
    │   └── scripts/
    │       ├── generate_overview.py
    │       └── merge_toc_content.py
    └── frontend/               # React + Vite web application
        ├── src/
        │   ├── main.jsx
        │   ├── App.jsx
        │   ├── i18n.js         # English & Chinese translations
        │   ├── context/
        │   │   └── UserContext.jsx  # User context (language, health checks)
        │   ├── pages/
        │   │   ├── Auth.jsx         # Login page
        │   │   ├── Dashboard.jsx    # Dashboard (upload, project list)
        │   │   ├── Study.jsx        # Textbook study page
        │   │   ├── Explain.jsx      # Detailed explanation page
        │   │   └── SectionLab.jsx   # Section lab (quiz/explanation)
        │   ├── components/
        │   │   ├── UploadZone.jsx         # Drag-and-drop upload
        │   │   ├── ProjectList.jsx        # Project list panel
        │   │   ├── TextbookContentViewer.jsx  # Core viewer component
        │   │   ├── KeypointsSidebar.jsx   # Key points sidebar
        │   │   ├── MarkdownRenderer.jsx   # Markdown renderer
        │   │   └── MarkdownPreview.jsx    # Markdown preview
        │   └── services/
        │       └── api.js       # All frontend API calls
        └── vite.config.js
```

---

## 🚀 Quick Start

### Prerequisites

- **OS**: macOS / Linux / Windows (Unix-compatible shell)
- **Python**: 3.10+ (Conda recommended)
- **Node.js**: 18+ with npm
- **Docker**: Docker Desktop (for MinerU container)
- **API Keys**: At least one of OpenAI / DeepSeek / Google Gemini

### 1. Clone & Setup Python Environment

```bash
git clone <repository-url>
cd learn-textbook-with-ai

# Create Conda environment
conda create -n learn_textbook_ai python=3.11 pip -y
conda activate learn_textbook_ai
pip install -r requirements.txt
```

### 2. Install JavaScript Dependencies

```bash
# Install backend dependencies
cd src/backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Return to root
cd ../..
```

### 3. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```dotenv
DATA_DIR=./data
VITE_API_BASE=http://localhost:4000
BACKEND_PORT=4000
CORE_API=http://127.0.0.1:8080
PYTHON_API_BASE=http://127.0.0.1:8080
PYTHON_PORT=8080
MINERU_API_URL=http://127.0.0.1:8000/file_parse
MINERU_PDF_PART_PAGES=100

# Configure at least one LLM provider
OPENAI_API_KEY=sk-...
DEEPSEEK_API_KEY=sk-...
GEMINI_API_KEY=...
```

### 4. Start MinerU (Docker)

Make sure the `mineru:latest` image exists locally. See [MinerUDockerSetup.md](MinerUDockerSetup.md) for setup instructions.

```bash
docker compose up -d mineru-api
# Verify MinerU is ready
curl http://127.0.0.1:8000/docs
```

### 5. Start All Services

You need **three terminal windows**, all from the project root:

**Terminal 1 — Python Core** (port 8080)

```bash
conda activate learn_textbook_ai
python src/core/main.py
```

**Terminal 2 — Node Backend** (port 4000)

```bash
cd src/backend
npm run dev
```

**Terminal 3 — Frontend** (port 3000)

```bash
cd src/frontend
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## 🔄 Processing Workflow

1. **Login** — Enter a username; the system creates `data/<username>/`
2. **Upload PDF** — Upload a textbook PDF via drag-and-drop or file browser
3. **Page Preparation** — Python Core counts pages; splits large PDFs if needed
4. **Step 1: PDF → Markdown** — MinerU converts each part and merges results
5. **Step 2: Markdown → JSON** — Paste the table of contents; LLM parses it into structured JSON; Markdown gets chunked
6. **Step 3: Generate Summary** — LLM analyzes each section, generating key concepts, rules, pitfalls, examples, and a one-sentence summary
7. **Study & Explore** — Browse sections, view AI analysis, request detailed explanations, generate quizzes, read the original PDF

### Processing Steps Detail

| Step | Description | Key Output |
|---|---|---|
| Step 1 | MinerU PDF-to-Markdown conversion | `hybrid_auto/<project>.md` |
| Step 2a | Header-based Markdown chunking | `hybrid_auto/chunker_step_1.json` |
| Step 2b | LLM parses TOC text into JSON | `hybrid_auto/textbook_toc.json` |
| Step 2c | Merge chunks with TOC structure | `hybrid_auto/textbook_with_content.json` |
| Step 3 | LLM analyzes each section's content | Written to `textbook_with_content.json` |

### User Data Layout

```text
data/<user>/
├── input/
│   └── <project-name>/
│       ├── <project>.pdf          # Original uploaded PDF
│       ├── manifest.json           # Split-PDF manifest
│       ├── part_001/
│       │   └── <project>_part_001.pdf
│       └── ...
├── output/
│   └── <project-name>/
│       ├── part_001/               # Per-part output
│       └── hybrid_auto/            # Merged final output
│           ├── <project>.md
│           ├── chunker_step_1.json
│           ├── textbook_toc.json
│           └── textbook_with_content.json
├── chroma_db/                      # User-scoped ChromaDB
├── user_status.json                # Projects, status, metadata, part status
├── project_preferences.json        # PDF reading preferences
├── latest_upload.json              # Latest upload state
└── latest.md                       # Lightweight markdown placeholder
```

---

## 📡 API Reference

### Node.js Backend (port 4000)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/login` | User login |
| GET | `/api/user-status` | Get user status |
| POST | `/api/upload` | Upload PDF |
| POST | `/api/prepare-project-pdf` | Prepare/split PDF |
| POST | `/api/select-project` | Select project |
| POST | `/api/project-remark` | Edit project remark |
| GET | `/api/project-pdf` | Get PDF file |
| GET/POST | `/api/project-pdf-preferences` | Get/save PDF preferences |
| GET | `/api/project-markdown` | Get project Markdown |
| GET | `/api/project-processing-steps` | Query processing step status |
| GET | `/api/project-processing-progress` | Query analysis progress |
| POST | `/api/trigger-processing-step` | Trigger a processing step |
| POST | `/api/parse-project-toc` | Parse table of contents |
| GET | `/api/llm/providers` | List LLM providers |
| POST | `/api/llm/detailed-explanation` | Generate detailed explanation |
| POST | `/api/llm/quiz-for-section` | Generate section quiz |
| GET | `/health` | Health check |

### Python Core (port 8080)

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/api/status` | System status |
| GET | `/api/llm/providers` | List LLM providers |
| POST | `/api/mineru/prepare` | PDF page counting & splitting |
| POST | `/api/mineru/process` | PDF → Markdown conversion |
| POST | `/api/chunker/process` | Markdown chunking |
| POST | `/api/vectorization/store` | Vector storage |
| POST | `/api/vectorization/search` | Semantic search |
| POST | `/api/analyze/textbook` | Textbook chapter analysis |
| GET | `/api/analyze/progress` | Analysis progress |
| POST | `/api/analyze/parse-toc` | TOC parsing |

---

## 🧩 Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, React Router 6, Vite 5, Tailwind CSS 3, Lucide React, react-pdf |
| **Backend (Node)** | Express 4, Multer (file upload) |
| **Backend (Python)** | FastAPI, Uvicorn |
| **PDF Parsing** | MinerU (Docker), PyPDF |
| **Text Chunking** | LangChain (MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter) |
| **Vector DB** | ChromaDB + all-MiniLM-L6-v2 (Sentence-Transformers) |
| **LLM** | OpenAI GPT, DeepSeek, Google Gemini |
| **i18n** | Built-in English & Chinese translation system |

---

## 📝 Development Notes

- **Default ports**: Frontend on `3000`, Node backend on `4000`, Python core on `8080`, MinerU API on `8000`
- **Frontend port**: Uses port `3000` (not Vite's default `5173`)
- **PDF split threshold**: `MINERU_PDF_PART_PAGES` controls splitting; `100`–`120` is practical for large textbooks
- **Upload preparation** only counts pages and creates split PDFs — full MinerU conversion runs when processing
- **Docker GPU**: `docker-compose.yaml` includes NVIDIA GPU config for Linux; macOS ignores it automatically
- **Data directory**: `data/` contains user documents, generated output, vector data, and runtime state. Keep it out of version control when it contains private content
- **Legacy compatibility**: Supports legacy flat uploads; they are migrated to the per-project layout during preparation

### Basic Verification

```bash
# Build the frontend
cd src/frontend && npm run build

# Verify services
curl http://127.0.0.1:8080/health
curl http://127.0.0.1:4000/health
```

---

## 📄 License

This project is open-source and intended for educational and research purposes only.
