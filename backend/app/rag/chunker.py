"""AST-based function/class chunker for Python RAG."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from app.analysis.parser_python import PythonParseResult, parse_python_file


@dataclass
class CodeChunk:
    chunk_id: str
    file: str
    name: str
    kind: str
    start_line: int
    end_line: int
    text: str
    parent_class: str | None = None


def _imports_header(source_lines: list[str], max_lines: int = 40) -> str:
    header: list[str] = []
    for line in source_lines[:max_lines]:
        stripped = line.strip()
        if stripped.startswith("import ") or stripped.startswith("from "):
            header.append(line.rstrip())
        elif stripped and not stripped.startswith("#") and header:
            break
    return "\n".join(header)


def chunk_python_file(path: Path, rel_path: str) -> list[CodeChunk]:
    parsed = parse_python_file(path, rel_path)
    source = path.read_text(encoding="utf-8", errors="replace")
    lines = source.splitlines()
    imports = _imports_header(lines)
    chunks: list[CodeChunk] = []

    # Prefer top-level defs; nested methods already listed from parser
    for defn in parsed.definitions:
        body = "\n".join(lines[defn.lineno - 1 : defn.end_lineno])
        context_bits = [f"File: {rel_path}"]
        if defn.parent_class:
            context_bits.append(f"Class: {defn.parent_class}")
        if imports:
            context_bits.append(f"Imports:\n{imports}")
        if defn.docstring:
            context_bits.append(f"Docstring: {defn.docstring}")
        text = "\n\n".join(context_bits) + "\n\n" + body
        chunk_id = f"{rel_path}::{defn.parent_class + '.' if defn.parent_class else ''}{defn.name}:{defn.lineno}"
        chunks.append(
            CodeChunk(
                chunk_id=chunk_id,
                file=rel_path,
                name=defn.name,
                kind=defn.kind,
                start_line=defn.lineno,
                end_line=defn.end_lineno,
                text=text,
                parent_class=defn.parent_class,
            )
        )

    # Empty / script-like files: one file-level chunk
    if not chunks and source.strip():
        chunks.append(
            CodeChunk(
                chunk_id=f"{rel_path}::__module__:1",
                file=rel_path,
                name="__module__",
                kind="module",
                start_line=1,
                end_line=len(lines) or 1,
                text=f"File: {rel_path}\n\n{source[:4000]}",
            )
        )
    return chunks


def chunk_web_file(path: Path, rel_path: str) -> list[CodeChunk]:
    """Chunk a JS/TS/Astro/JSON file into meaningful semantic blocks."""
    source = path.read_text(encoding="utf-8", errors="replace")
    lines = source.splitlines()
    if not source.strip():
        return []

    chunks: list[CodeChunk] = []
    # If small file (< 80 lines or < 3000 chars), return single module chunk
    if len(lines) <= 80 or len(source) <= 3000:
        chunks.append(
            CodeChunk(
                chunk_id=f"{rel_path}::__module__:1",
                file=rel_path,
                name="__module__",
                kind="file",
                start_line=1,
                end_line=len(lines) or 1,
                text=f"File: {rel_path}\n\n{source[:3500]}",
            )
        )
        return chunks

    # For larger files, create windowed chunks of 60 lines with 15 lines overlap
    window_size = 60
    step = 45
    for i in range(0, len(lines), step):
        chunk_lines = lines[i : i + window_size]
        if not chunk_lines:
            break
        text = f"File: {rel_path} (lines {i + 1}-{min(i + window_size, len(lines))})\n\n" + "\n".join(chunk_lines)
        chunks.append(
            CodeChunk(
                chunk_id=f"{rel_path}::block_{i + 1}:{i + 1}",
                file=rel_path,
                name=f"block_{i + 1}",
                kind="block",
                start_line=i + 1,
                end_line=min(i + window_size, len(lines)),
                text=text[:3500],
            )
        )
        if len(chunks) >= 15:  # Cap chunks per large file
            break

    return chunks


def chunk_project(
    root: Path,
    py_results: list[PythonParseResult] | None = None,
    js_results: list[Any] | None = None,
) -> list[CodeChunk]:
    from app.analysis.ignore import MAX_SOURCE_FILES, path_is_ignored

    chunks: list[CodeChunk] = []

    # 1. Python chunks
    if py_results is not None:
        for r in py_results:
            path = root / r.file_path
            if path.is_file() and not path_is_ignored(path):
                chunks.extend(chunk_python_file(path, r.file_path))
                if len(chunks) >= 600:
                    break

    # 2. JS / TS / Astro chunks
    if js_results is not None and len(chunks) < 600:
        for r in js_results:
            path = root / r.file_path
            if path.is_file() and not path_is_ignored(path):
                chunks.extend(chunk_web_file(path, r.file_path))
                if len(chunks) >= 600:
                    break

    # 3. Fallback discovery if results were not passed
    if py_results is None and js_results is None:
        from app.analysis.ignore import iter_files_with_suffixes
        from app.analysis.parser_js import RECOGNIZED_WEB_EXTENSIONS

        for path in iter_files_with_suffixes(root, {".py"}):
            rel = path.relative_to(root).as_posix()
            chunks.extend(chunk_python_file(path, rel))
            if len(chunks) >= 600:
                break

        if len(chunks) < 600:
            for path in iter_files_with_suffixes(root, RECOGNIZED_WEB_EXTENSIONS):
                rel = path.relative_to(root).as_posix()
                chunks.extend(chunk_web_file(path, rel))
                if len(chunks) >= 600:
                    break

    return chunks
