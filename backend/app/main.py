import mimetypes
from pathlib import Path

from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware

from app.api import chat, upload
from app.config import get_settings
from app.llm.client import llm_configured

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
        "llm_configured": llm_configured(),
        "gemini_configured": bool(settings.gemini_api_key),
        "gemini_model": settings.gemini_model,
        "groq_configured": bool(settings.groq_api_key),
        "use_ollama": settings.use_ollama,
        "groq_model": settings.groq_model,
    }


_cached_dist_dir: Path | None = None


def get_dist_dir() -> Path | None:
    global _cached_dist_dir
    if _cached_dist_dir and (_cached_dist_dir / "index.html").is_file():
        return _cached_dist_dir

    current_dir = Path(__file__).resolve().parent  # app/
    backend_dir = current_dir.parent               # backend/
    repo_root = backend_dir.parent                 # project root

    candidates = [
        repo_root / "frontend" / "dist",
        backend_dir / "dist",
        backend_dir / "frontend" / "dist",
        repo_root / "dist",
        Path.cwd() / "frontend" / "dist",
        Path.cwd() / "dist",
        Path("/vercel/path0/frontend/dist"),
        Path("/vercel/path0/backend/frontend/dist"),
        Path("/vercel/path0/backend/dist"),
    ]
    for c in candidates:
        if c.is_dir() and (c / "index.html").is_file():
            _cached_dist_dir = c
            return c
    return None


def _serve_static_file(file_path: Path) -> Response:
    if not file_path.is_file():
        return Response(status_code=404, content=b'{"detail":"Not Found"}', media_type="application/json")
    content_type, _ = mimetypes.guess_type(str(file_path))
    return Response(
        content=file_path.read_bytes(),
        media_type=content_type or "application/octet-stream",
    )


@app.get("/")
def serve_root() -> Response:
    d = get_dist_dir()
    if d and (d / "index.html").is_file():
        return _serve_static_file(d / "index.html")
    return Response(
        content=b'{"status":"ok","message":"ArchitectAI API is running."}',
        media_type="application/json",
    )


@app.get("/{full_path:path}")
def serve_spa(full_path: str) -> Response:
    if full_path.startswith("api/") or full_path == "api":
        return Response(status_code=404, content=b'{"detail":"Not Found"}', media_type="application/json")

    d = get_dist_dir()
    if d:
        target = d / full_path
        if target.is_file():
            return _serve_static_file(target)

        index_file = d / "index.html"
        if index_file.is_file():
            return _serve_static_file(index_file)

    return Response(status_code=404, content=b'{"detail":"Not Found"}', media_type="application/json")


