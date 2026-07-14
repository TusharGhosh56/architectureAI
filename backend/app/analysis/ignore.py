"""Shared ignore rules when walking uploaded projects."""

from __future__ import annotations

import os
from pathlib import Path

SKIP_DIR_NAMES = frozenset(
    {
        ".git",
        ".hg",
        ".svn",
        ".venv",
        "venv",
        "env",
        "node_modules",
        "__pycache__",
        ".mypy_cache",
        ".pytest_cache",
        ".ruff_cache",
        ".tox",
        ".eggs",
        "dist",
        "build",
        ".next",
        ".nuxt",
        "coverage",
        ".idea",
        ".vscode",
        "site-packages",
        "Pods",
        "vendor",
        "target",
        "__MACOSX",
    }
)

MAX_SOURCE_FILES = 400


def should_skip_dir(name: str) -> bool:
    return name in SKIP_DIR_NAMES or name.endswith(".egg-info")


def path_is_ignored(path: Path) -> bool:
    return any(should_skip_dir(part) for part in path.parts)


def iter_files_with_suffixes(root: Path, suffixes: set[str]) -> list[Path]:
    """Walk root skipping ignored dirs; collect files by suffix, capped."""
    found: list[Path] = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if not should_skip_dir(d)]
        for name in filenames:
            path = Path(dirpath) / name
            if path.suffix.lower() in suffixes:
                if name.endswith(".d.ts"):
                    continue
                found.append(path)
                if len(found) >= MAX_SOURCE_FILES:
                    return found
    return found
