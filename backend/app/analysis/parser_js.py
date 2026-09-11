"""Robust, multi-framework JS/TS/Astro/Vue/Svelte import extraction."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

# Match comments so we can strip them before regex matching
_COMMENT_RE = re.compile(
    r"""//.*?$|/\*.*?\*/""",
    re.MULTILINE | re.DOTALL,
)

# 1. import ... from '...' or export ... from '...'
_IMPORT_EXPORT_FROM_RE = re.compile(
    r"""(?:^|\s|;)(?:import|export)\s+(?:type\s+)?(?:[\w*\s{},$]+?\s+from\s+)?['"]([^'"]+)['"]""",
    re.MULTILINE,
)

# 2. Side-effect import '...'
_SIDE_EFFECT_IMPORT_RE = re.compile(
    r"""(?:^|\s|;)import\s+['"]([^'"]+)['"]""",
    re.MULTILINE,
)

# 3. require('...')
_REQUIRE_RE = re.compile(
    r"""(?:^|\s|[(=,;:!&|?])require\s*\(\s*['"]([^'"]+)['"]\s*\)"""
)

# 4. dynamic import('...')
_DYNAMIC_IMPORT_RE = re.compile(
    r"""(?:^|\s|[(=,;:!&|?])import\s*\(\s*['"]([^'"]+)['"]\s*\)"""
)

# Astro frontmatter block --- ... --- (supports \r\n and \n)
_ASTRO_FRONTMATTER_RE = re.compile(r"^\s*---\r?\n(.*?)\r?\n---", re.DOTALL)

# HTML / Vue / Svelte <script> ... </script> block
_SCRIPT_TAG_RE = re.compile(r"<script[^>]*>(.*?)</script>", re.DOTALL | re.IGNORECASE)

RECOGNIZED_WEB_EXTENSIONS = {
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".mjs",
    ".cjs",
    ".astro",
    ".vue",
    ".svelte",
}


@dataclass
class JsParseResult:
    file_path: str
    imports: list[str] = field(default_factory=list)


def _strip_comments(code: str) -> str:
    """Remove line and block comments from code."""
    return _COMMENT_RE.sub("", code)


def parse_js_file(path: Path, rel_path: str) -> JsParseResult:
    source = path.read_text(encoding="utf-8", errors="replace")
    result = JsParseResult(file_path=rel_path)
    found: set[str] = set()

    blocks_to_scan: list[str] = []
    suffix = path.suffix.lower()

    if suffix == ".astro":
        # Extract frontmatter
        m_front = _ASTRO_FRONTMATTER_RE.search(source)
        if m_front:
            blocks_to_scan.append(m_front.group(1))
        # Extract <script> blocks
        for m_script in _SCRIPT_TAG_RE.finditer(source):
            blocks_to_scan.append(m_script.group(1))
        # If no frontmatter matched, scan full text as fallback
        if not blocks_to_scan:
            blocks_to_scan.append(source)
    elif suffix in {".vue", ".svelte", ".html"}:
        for m_script in _SCRIPT_TAG_RE.finditer(source):
            blocks_to_scan.append(m_script.group(1))
        if not blocks_to_scan:
            blocks_to_scan.append(source)
    else:
        blocks_to_scan.append(source)

    for block in blocks_to_scan:
        clean_code = _strip_comments(block)

        for match in _IMPORT_EXPORT_FROM_RE.finditer(clean_code):
            val = match.group(1).strip()
            if val:
                found.add(val)

        for match in _SIDE_EFFECT_IMPORT_RE.finditer(clean_code):
            val = match.group(1).strip()
            if val:
                found.add(val)

        for match in _REQUIRE_RE.finditer(clean_code):
            val = match.group(1).strip()
            if val:
                found.add(val)

        for match in _DYNAMIC_IMPORT_RE.finditer(clean_code):
            val = match.group(1).strip()
            if val:
                found.add(val)

    result.imports = sorted(found)
    return result


def parse_js_tree(root: Path) -> list[JsParseResult]:
    from app.analysis.ignore import iter_files_with_suffixes

    results: list[JsParseResult] = []
    for path in iter_files_with_suffixes(root, RECOGNIZED_WEB_EXTENSIONS):
        rel = path.relative_to(root).as_posix()
        results.append(parse_js_file(path, rel))
    return results
