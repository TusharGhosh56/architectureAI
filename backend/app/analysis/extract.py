"""Zip extraction with basic path-traversal rejection and junk-path skipping."""

from __future__ import annotations

import zipfile
from dataclasses import dataclass
from pathlib import Path

from app.analysis.ignore import path_is_ignored, should_skip_dir


class UnsafeZipError(ValueError):
    pass


@dataclass
class ExtractResult:
    root: Path
    extracted: int
    skipped: int
    skipped_nested_repos: int


def _is_unsafe_name(name: str) -> bool:
    normalized = name.replace("\\", "/")
    if normalized.startswith("/") or normalized.startswith("../") or "/../" in f"/{normalized}/":
        return True
    if len(normalized) >= 2 and normalized[1] == ":":
        return True
    return False


def _is_nested_repo_path(name: str) -> bool:
    norm = name.replace("\\", "/").lower()
    return "data/repos/" in norm or "/data/repos/" in f"/{norm}"


def _is_junk_member(name: str) -> bool:
    """Skip venvs, node_modules, AND nested cloned repos (data/repos/...)."""
    normalized = name.replace("\\", "/")
    if path_is_ignored(normalized):
        return True
    parts = [p for p in normalized.split("/") if p]
    return any(should_skip_dir(part) for part in parts)


def extract_zip(zip_path: Path, dest: Path) -> ExtractResult:
    dest.mkdir(parents=True, exist_ok=True)
    extracted = 0
    skipped = 0
    skipped_nested_repos = 0

    with zipfile.ZipFile(zip_path, "r") as zf:
        for info in zf.infolist():
            if _is_unsafe_name(info.filename):
                raise UnsafeZipError(f"Unsafe path in zip: {info.filename}")
            if _is_junk_member(info.filename):
                skipped += 1
                if _is_nested_repo_path(info.filename):
                    skipped_nested_repos += 1
                continue
            zf.extract(info, dest)
            extracted += 1

    if extracted == 0:
        raise ValueError(
            "Zip contained no usable project files "
            f"(skipped {skipped} junk paths like .venv/node_modules/data/repos)."
        )

    children = [p for p in dest.iterdir() if not p.name.startswith("__MACOSX")]
    root = children[0] if len(children) == 1 and children[0].is_dir() else dest
    return ExtractResult(
        root=root,
        extracted=extracted,
        skipped=skipped,
        skipped_nested_repos=skipped_nested_repos,
    )
