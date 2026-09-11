import sys
from pathlib import Path

# Add backend directory to Python path
ROOT_DIR = Path(__file__).resolve().parent.parent
backend_dir = ROOT_DIR / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.main import app  # noqa: E402

# Vercel serverless function entrypoint
__all__ = ["app"]
