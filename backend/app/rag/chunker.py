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


def chunk_project(root: Path, py_results: list[PythonParseResult] | None = None) -> list[CodeChunk]:
    from app.analysis.ignore import MAX_SOURCE_FILES, path_is_ignored

    chunks: list[CodeChunk] = []
    if py_results is None:
        from app.analysis.ignore import iter_files_with_suffixes

        paths = iter_files_with_suffixes(root, {".py"})
    else:
        paths = []
        for r in py_results:
            path = root / r.file_path
            if path.is_file() and not path_is_ignored(path):
                paths.append(path)

    for path in paths[:MAX_SOURCE_FILES]:
        rel = path.relative_to(root).as_posix()
        chunks.extend(chunk_python_file(path, rel))
        # Keep embedding tractable for learning/demo zips
        if len(chunks) >= 800:
            break
    return chunks
