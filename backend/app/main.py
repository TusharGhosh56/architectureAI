from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import chat, upload
from app.config import get_settings

settings = get_settings()

app = FastAPI(
    title="ArchitectAI",
    description="Codebase analyzer — static analysis, RAG, and tool-calling chat.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router)
app.include_router(chat.router)


@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "groq_configured": bool(settings.groq_api_key),
        "use_ollama": settings.use_ollama,
        "groq_model": settings.groq_model,
    }
