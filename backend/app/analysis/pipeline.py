"""Synchronous upload analysis pipeline."""

from __future__ import annotations

import shutil
import uuid
from pathlib import Path
from typing import Any

from app.analysis.diagram_generator import generate_mermaid
from app.analysis.extract import UnsafeZipError, extract_zip
from app.analysis.graph_builder import (
    build_dependency_graph,
    circular_dependencies,
    edge_list,
    important_files,
)
from app.analysis.ignore import MAX_SOURCE_FILES
from app.analysis.parser_js import parse_js_tree
from app.analysis.parser_python import parse_python_tree
from app.analysis.summary import generate_architecture_summary
from app.config import get_settings
from app.db import store
from app.rag.chunker import chunk_project
from app.rag.vector_store import VectorStore


def run_pipeline(zip_path: Path, original_filename: str | None = None) -> dict[str, Any]:
    settings = get_settings()
    project_id = uuid.uuid4().hex[:12]
    work_dir = settings.uploads_dir / project_id
    if work_dir.exists():
        shutil.rmtree(work_dir)
    work_dir.mkdir(parents=True, exist_ok=True)

    try:
        project_root = extract_zip(zip_path, work_dir / "src")
    except UnsafeZipError:
        shutil.rmtree(work_dir, ignore_errors=True)
        raise
    except Exception as exc:
        shutil.rmtree(work_dir, ignore_errors=True)
        raise ValueError(f"Failed to extract zip: {exc}") from exc

    py_results = parse_python_tree(project_root)
    js_results = parse_js_tree(project_root)
    files = sorted({*[r.file_path for r in py_results], *[r.file_path for r in js_results]})
    truncated = len(files) >= MAX_SOURCE_FILES

    graph = build_dependency_graph(py_results, js_results)
    important = important_files(graph)
    cycles = circular_dependencies(graph)
    diagram = generate_mermaid(graph)

    chunks = chunk_project(project_root, py_results)
    indexed = 0
    try:
        indexed = VectorStore(project_id).index_chunks(chunks)
    except Exception as exc:
        indexed = 0
        embedding_error = str(exc)
    else:
        embedding_error = None

    summary = generate_architecture_summary(
        project_id=project_id,
        important=important,
        file_count=len(files),
        circular_deps=cycles,
    )
    if truncated:
        summary = (
            f"(Note: analysis capped at {MAX_SOURCE_FILES} source files; "
            "exclude .venv/node_modules from the zip for better results.)\n\n"
            + summary
        )

    payload: dict[str, Any] = {
        "project_id": project_id,
        "filename": original_filename or zip_path.name,
        "project_root": str(project_root),
        "files": files,
        "file_count": len(files),
        "python_file_count": len(py_results),
        "js_file_count": len(js_results),
        "edge_count": graph.number_of_edges(),
        "edges": edge_list(graph),
        "important_files": important,
        "circular_deps": cycles,
        "diagram_mermaid": diagram,
        "architecture_summary": summary,
        "chunk_count": indexed,
        "embedding_error": embedding_error,
        "truncated": truncated,
    }
    store.save_project(project_id, payload)
    return payload
