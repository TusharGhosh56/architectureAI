# ArchitectAI

AI-powered codebase analyzer — upload a repo zip, get a real dependency graph, and chat with a tool-calling agent. Built with FastAPI, LangGraph, ChromaDB, and local embeddings on free/local models.

See [`plan.md`](./plan.md) for the full build plan.

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
uvicorn app.main:app --reload --port 8000
```

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
