import mimetypes
from pathlib import Path

from fastapi import FastAPI, Request, Response
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

@app.middleware("http")
async def vercel_rewrite_middleware(request: Request, call_next):
    raw_path = request.scope.get("path", "")
    if raw_path in ("/api/index.py", "/api/index", "/api", ""):
        target = (
            request.query_params.get("__path")
            or request.headers.get("x-matched-path")
            or request.headers.get("x-forwarded-uri")
            or request.headers.get("x-original-url")
        )
        if target:
            clean = target.split("?")[0]
            if clean and clean not in ("/api/index.py", "/api/index"):
                request.scope["path"] = clean

    return await call_next(request)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router)
app.include_router(chat.router)


@app.get("/api/health")
@app.get("/health")
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
        current_dir / "dist",
        backend_dir / "dist",
        backend_dir / "frontend" / "dist",
        repo_root / "frontend" / "dist",
        repo_root / "dist",
        Path.cwd() / "dist",
        Path.cwd() / "frontend" / "dist",
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
    
    suffix = file_path.suffix.lower()
    if suffix in (".js", ".mjs"):
        content_type = "application/javascript; charset=utf-8"
    elif suffix == ".css":
        content_type = "text/css; charset=utf-8"
    elif suffix == ".html":
        content_type = "text/html; charset=utf-8"
    elif suffix == ".svg":
        content_type = "image/svg+xml"
    elif suffix == ".png":
        content_type = "image/png"
    elif suffix == ".json":
        content_type = "application/json; charset=utf-8"
    else:
        guessed, _ = mimetypes.guess_type(str(file_path))
        content_type = guessed or "application/octet-stream"

    return Response(
        content=file_path.read_bytes(),
        media_type=content_type,
    )


@app.get("/assets/{file_path:path}")
def serve_assets(file_path: str) -> Response:
    d = get_dist_dir()
    if d:
        target = d / "assets" / file_path
        if target.is_file():
            return _serve_static_file(target)
    return Response(status_code=404, content=b'{"detail":"Asset Not Found"}', media_type="application/json")


@app.get("/favicon.svg")
def serve_favicon() -> Response:
    d = get_dist_dir()
    if d and (d / "favicon.svg").is_file():
        return _serve_static_file(d / "favicon.svg")
    return Response(status_code=404)


@app.get("/icons.svg")
def serve_icons() -> Response:
    d = get_dist_dir()
    if d and (d / "icons.svg").is_file():
        return _serve_static_file(d / "icons.svg")
    return Response(status_code=404)


@app.get("/")
@app.get("/api")
@app.get("/api/")
@app.get("/api/index.py")
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


