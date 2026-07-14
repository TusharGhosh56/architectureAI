"""Shared ignore rules when walking uploaded projects.

Only the uploaded project's own source should be analyzed — never nested
cloned repos (e.g. data/repos/<owner>/<repo>/) or dependency trees.
"""

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
        # nested clone dumps — not part of the app under analysis
        "cloned_repos",
        "repo_cache",
        "repositories",
    }
)

# (parent_dir, child_dir) pairs that always get skipped
SKIP_NESTED_PAIRS = frozenset(
    {
        ("data", "repos"),
        ("data", "clones"),
        ("data", "cache"),
        ("fixtures", "repos"),
        ("testdata", "repos"),
        ("test_data", "repos"),
        (".cache", "repos"),
    }
)

# Prefer these top-level folders when nested repo dumps are detected
PRIMARY_SOURCE_DIRS = (
    "app",
    "src",
    "backend",
    "frontend",
    "lib",
    "packages",
    "api",
    "server",
    "client",
    "core",
    "services",
)

MAX_SOURCE_FILES = 400


def _parts(path: Path | str) -> tuple[str, ...]:
    text = str(path).replace("\\", "/")
    return tuple(p for p in text.split("/") if p and p != ".")


def should_skip_dir(name: str) -> bool:
    return name in SKIP_DIR_NAMES or name.endswith(".egg-info")


def path_is_ignored(path: Path | str) -> bool:
    parts = _parts(path)
    if any(should_skip_dir(part) for part in parts):
        return True
    lowered = tuple(p.lower() for p in parts)
    for i in range(len(lowered) - 1):
        if (lowered[i], lowered[i + 1]) in SKIP_NESTED_PAIRS:
            return True
        # any .../data/repos/...
        if lowered[i] == "data" and lowered[i + 1] == "repos":
            return True
    # bare "repos" under data already covered; also skip github-like nests
    if "repos" in lowered:
        idx = lowered.index("repos")
        if idx > 0 and lowered[idx - 1] in {"data", "fixtures", "testdata", "test_data", ".cache"}:
            return True
    return False


def has_nested_repo_dump(root: Path) -> bool:
    for pair in SKIP_NESTED_PAIRS:
        if (root / pair[0] / pair[1]).is_dir():
            return True
    return (root / "data" / "repos").is_dir()


def analysis_roots(project_root: Path) -> list[Path]:
    """
    When the zip contains cloned repos under data/repos, only walk the
    project's own source trees (app/, src/, …) plus top-level source files.
    """
    if not has_nested_repo_dump(project_root):
        return [project_root]

    roots = [project_root / name for name in PRIMARY_SOURCE_DIRS if (project_root / name).is_dir()]
    return roots if roots else [project_root]


def iter_files_with_suffixes(root: Path, suffixes: set[str]) -> list[Path]:
    """Walk analysis roots only; skip nested clones and junk dirs."""
    found: list[Path] = []
    seen: set[Path] = set()

    roots = analysis_roots(root)
    for walk_root in roots:
        for dirpath, dirnames, filenames in os.walk(walk_root):
            rel_dir = Path(dirpath).relative_to(root) if dirpath != str(root) else Path(".")
            # prune junk + nested repo trees before descending
            kept: list[str] = []
            for d in dirnames:
                child_rel = rel_dir / d if str(rel_dir) != "." else Path(d)
                if should_skip_dir(d) or path_is_ignored(child_rel):
                    continue
                kept.append(d)
            dirnames[:] = kept

            if path_is_ignored(rel_dir) and str(rel_dir) != ".":
                dirnames[:] = []
                continue

            for name in filenames:
                path = Path(dirpath) / name
                if path in seen:
                    continue
                try:
                    rel = path.relative_to(root)
                except ValueError:
                    continue
                if path_is_ignored(rel):
                    continue
                if path.suffix.lower() not in suffixes:
                    continue
                if name.endswith(".d.ts"):
                    continue
                seen.add(path)
                found.append(path)
                if len(found) >= MAX_SOURCE_FILES:
                    return found

    # Top-level source files next to app/ (e.g. main.py) when using primary roots
    if roots != [root]:
        for path in root.iterdir():
            if not path.is_file() or path in seen:
                continue
            if path.suffix.lower() in suffixes and not path_is_ignored(path.name):
                found.append(path)
                if len(found) >= MAX_SOURCE_FILES:
                    break

    return found
