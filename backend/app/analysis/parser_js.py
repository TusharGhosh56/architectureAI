"""Minimal JS/TS import extraction via tree-sitter (+ regex fallback)."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

import tree_sitter_javascript as tsjs
import tree_sitter_typescript as tsts
from tree_sitter import Language, Parser, Query, QueryCursor

_JS_LANG = Language(tsjs.language())
_TS_LANG = Language(tsts.language_typescript())
_TSX_LANG = Language(tsts.language_tsx())

_IMPORT_FROM_RE = re.compile(
    r"""(?:import|export)\s+(?:type\s+)?(?:[\w*\s{},$]+?\s+from\s+)?['"]([^'"]+)['"]""",
    re.MULTILINE,
)
_REQUIRE_RE = re.compile(r"""require\s*\(\s*['"]([^'"]+)['"]\s*\)""")

_IMPORT_QUERY = """
(import_statement source: (string) @path)
(export_statement source: (string) @path)
(call_expression
  function: (identifier) @fn
  arguments: (arguments (string) @path))
"""


@dataclass
class JsParseResult:
    file_path: str
    imports: list[str] = field(default_factory=list)


def _language_for(path: Path) -> Language:
    suffix = path.suffix.lower()
    if suffix == ".tsx":
        return _TSX_LANG
    if suffix == ".ts":
        return _TS_LANG
    return _JS_LANG


def _strip_quotes(raw: str) -> str:
    return raw.strip().strip("'\"")


def parse_js_file(path: Path, rel_path: str) -> JsParseResult:
    source = path.read_text(encoding="utf-8", errors="replace")
    result = JsParseResult(file_path=rel_path)
    found: set[str] = set()
    source_bytes = source.encode("utf-8")

    try:
        lang = _language_for(path)
        parser = Parser(lang)
        tree = parser.parse(source_bytes)
        query = Query(lang, _IMPORT_QUERY)
        captures = QueryCursor(query).captures(tree.root_node)
        for node in captures.get("path", []):
            text = source_bytes[node.start_byte : node.end_byte].decode("utf-8", errors="replace")
            mod = _strip_quotes(text)
            if mod:
                found.add(mod)
    except Exception:
        pass

    for match in _IMPORT_FROM_RE.finditer(source):
        found.add(match.group(1))
    for match in _REQUIRE_RE.finditer(source):
        found.add(match.group(1))

    result.imports = sorted(found)
    return result


def parse_js_tree(root: Path) -> list[JsParseResult]:
    from app.analysis.ignore import iter_files_with_suffixes

    results: list[JsParseResult] = []
    for path in iter_files_with_suffixes(
        root, {".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"}
    ):
        rel = path.relative_to(root).as_posix()
        results.append(parse_js_file(path, rel))
    return results
