# ArchitectAI

AI-powered codebase analyzer — upload a repo zip, get a real dependency graph, and chat with a tool-calling agent. Built with FastAPI, LangGraph, ChromaDB, and local embeddings on free/local models.

See [`plan.md`](./plan.md) for the full build plan.

## What's implemented

- **LLM**: Groq via `langchain-groq` (`app/llm/client.py`), optional Ollama flag
- **Upload pipeline**: zip extract → Python/JS parsers → NetworkX graph → Mermaid → Chroma RAG index → Groq architecture summary
- **API**: `POST /api/upload`, `GET /api/health` (chat agent still stub until Day 3)

## Prerequisites

- Python 3.12+
- Node.js 18+
- Free [Groq API key](https://console.groq.com)

## One-time setup

```powershell
# From architectureAI/

# 1. Env file (already created — paste your key)
#    Copy-Item .env.example .env   # if needed
#    Edit .env and set GROQ_API_KEY=...

# 2. Backend venv + deps
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt

# 3. Frontend deps
cd frontend
npm install
cd ..
```

## Run locally

**Terminal 1 — backend**

```powershell
.\.venv\Scripts\Activate.ps1
cd backend
uvicorn app.main:app --reload --reload-dir app --port 8000
```

> Important: zip source code only — leave out `.venv`, `node_modules`, and huge nested clones. Analysis skips those automatically, but a giant zip is still slow to upload.

**Terminal 2 — frontend**

```powershell
cd frontend
npm run dev
```

- App: http://localhost:5173  
- API health: http://localhost:8000/api/health  
- Vite proxies `/api/*` → `http://127.0.0.1:8000`

## Layout

```
backend/app/     FastAPI, analysis, RAG, agents
frontend/src/    React (Upload + Chat pages)
.env             GROQ_API_KEY (gitignored)
```
