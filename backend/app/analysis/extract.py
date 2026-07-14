"""Zip extraction with basic path-traversal rejection and junk-path skipping."""

from __future__ import annotations

import zipfile
from pathlib import Path

from app.analysis.ignore import should_skip_dir


class UnsafeZipError(ValueError):
    pass


def _is_unsafe_name(name: str) -> bool:
    normalized = name.replace("\\", "/")
    if normalized.startswith("/") or normalized.startswith("../") or "/../" in f"/{normalized}/":
        return True
    if len(normalized) >= 2 and normalized[1] == ":":
        return True
    return False


def _is_junk_member(name: str) -> bool:
    parts = name.replace("\\", "/").split("/")
    return any(should_skip_dir(part) for part in parts if part)


def extract_zip(zip_path: Path, dest: Path) -> Path:
    dest.mkdir(parents=True, exist_ok=True)
    extracted = 0
    skipped = 0

    with zipfile.ZipFile(zip_path, "r") as zf:
        for info in zf.infolist():
            if _is_unsafe_name(info.filename):
                raise UnsafeZipError(f"Unsafe path in zip: {info.filename}")
            if _is_junk_member(info.filename):
                skipped += 1
                continue
            zf.extract(info, dest)
            extracted += 1

    if extracted == 0:
        raise ValueError(
            "Zip contained no usable project files "
            f"(skipped {skipped} junk paths like .venv/node_modules)."
        )

    children = [p for p in dest.iterdir() if not p.name.startswith("__MACOSX")]
    if len(children) == 1 and children[0].is_dir():
        return children[0]
    return dest
