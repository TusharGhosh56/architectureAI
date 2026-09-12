import os
import tempfile
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parents[2]


def _default_data_dir() -> Path:
    # On Vercel or AWS Lambda serverless runtimes, only /tmp is writable
    if os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
        return Path(tempfile.gettempdir()) / "architectai_data"
    return ROOT_DIR / "data"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ROOT_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    groq_api_key: str = ""
    groq_model: str = "qwen/qwen3.8-27b"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"
    use_ollama: bool = False
    ollama_model: str = "llama3.1"
    ollama_base_url: str = "http://localhost:11434"

    # Keep runtime data in data/ locally, /tmp in serverless environments
    data_dir: Path = _default_data_dir()
    uploads_dir: Path = _default_data_dir() / "uploads"
    chroma_dir: Path = _default_data_dir() / "chunks"

    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "*",
    ]


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    try:
        settings.data_dir.mkdir(parents=True, exist_ok=True)
        settings.uploads_dir.mkdir(parents=True, exist_ok=True)
        settings.chroma_dir.mkdir(parents=True, exist_ok=True)
    except OSError:
        # Fallback to tempdir if workspace root is read-only
        tmp_base = Path(tempfile.gettempdir()) / "architectai_data"
        settings.data_dir = tmp_base
        settings.uploads_dir = tmp_base / "uploads"
        settings.chroma_dir = tmp_base / "chunks"
        settings.data_dir.mkdir(parents=True, exist_ok=True)
        settings.uploads_dir.mkdir(parents=True, exist_ok=True)
        settings.chroma_dir.mkdir(parents=True, exist_ok=True)
    return settings
