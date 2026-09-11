"""JSON persistence for analyzed projects."""

from __future__ import annotations

import json
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.config import get_settings


def _projects_dir() -> Path:
    settings = get_settings()
    try:
        path = settings.data_dir / "projects"
        path.mkdir(parents=True, exist_ok=True)
        return path
    except OSError:
        path = Path(tempfile.gettempdir()) / "architectai_data" / "projects"
        path.mkdir(parents=True, exist_ok=True)
        return path


def project_path(project_id: str) -> Path:
    return _projects_dir() / f"{project_id}.json"


def save_project(project_id: str, payload: dict[str, Any]) -> Path:
    data = {
        **payload,
        "project_id": project_id,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    path = project_path(project_id)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    return path


def load_project(project_id: str) -> dict[str, Any] | None:
    path = project_path(project_id)
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def latest_project_id() -> str | None:
    try:
        files = sorted(
            _projects_dir().glob("*.json"),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
        if not files:
            return None
        return files[0].stem
    except Exception:
        return None
