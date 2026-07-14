"""NetworkX dependency graph from parsed imports."""

from __future__ import annotations

from pathlib import Path

import networkx as nx

from app.analysis.parser_js import JsParseResult
from app.analysis.parser_python import PythonParseResult


def _python_module_to_candidates(module: str, from_file: str) -> list[str]:
    """Map an import string to possible project-relative file paths."""
    parts = from_file.split("/")
    parent_dirs = parts[:-1]

    if module.startswith("."):
        level = len(module) - len(module.lstrip("."))
        rest = module.lstrip(".")
        base = parent_dirs[: max(0, len(parent_dirs) - (level - 1))] if level else parent_dirs
        if rest:
            target = "/".join([*base, *rest.split(".")]) if base else rest.replace(".", "/")
        else:
            target = "/".join(base) if base else ""
        if not target:
            return []
        return [
            f"{target}.py",
            f"{target}/__init__.py",
        ]

    # Absolute-ish package import relative to project root
    dotted = module.replace(".", "/")
    return [
        f"{dotted}.py",
        f"{dotted}/__init__.py",
    ]


def _js_specifier_to_candidates(spec: str, from_file: str) -> list[str]:
    if not (spec.startswith(".") or spec.startswith("/")):
        return []  # package import — skip external

    from_dir = str(Path(from_file).parent).replace("\\", "/")
    if from_dir == ".":
        joined = spec
    else:
        joined = str((Path(from_dir) / spec)).replace("\\", "/")

    # Normalize .. segments
    resolved = Path(joined)
    parts: list[str] = []
    for part in resolved.parts:
        if part == "..":
            if parts:
                parts.pop()
        elif part != ".":
            parts.append(part)
    base = "/".join(parts)

    candidates = [
        base,
        f"{base}.js",
        f"{base}.jsx",
        f"{base}.ts",
        f"{base}.tsx",
        f"{base}.mjs",
        f"{base}.cjs",
        f"{base}/index.js",
        f"{base}/index.jsx",
        f"{base}/index.ts",
        f"{base}/index.tsx",
    ]
    return candidates


def build_dependency_graph(
    py_results: list[PythonParseResult],
    js_results: list[JsParseResult],
) -> nx.DiGraph:
    graph = nx.DiGraph()
    file_set: set[str] = set()

    for r in py_results:
        file_set.add(r.file_path)
        graph.add_node(r.file_path, lang="python")
    for r in js_results:
        file_set.add(r.file_path)
        graph.add_node(r.file_path, lang="javascript")

    for r in py_results:
        for mod in r.imports:
            for candidate in _python_module_to_candidates(mod, r.file_path):
                if candidate in file_set and candidate != r.file_path:
                    graph.add_edge(r.file_path, candidate, import_name=mod)
                    break

    for r in js_results:
        for spec in r.imports:
            for candidate in _js_specifier_to_candidates(spec, r.file_path):
                if candidate in file_set and candidate != r.file_path:
                    graph.add_edge(r.file_path, candidate, import_name=spec)
                    break

    return graph


def important_files(graph: nx.DiGraph, top_n: int = 10) -> list[str]:
    if graph.number_of_nodes() == 0:
        return []
    centrality = nx.in_degree_centrality(graph)
    ranked = sorted(centrality.items(), key=lambda x: x[1], reverse=True)
    return [name for name, score in ranked[:top_n] if score > 0 or graph.in_degree(name) > 0] or [
        n for n, _ in ranked[: min(top_n, len(ranked))]
    ]


def circular_dependencies(graph: nx.DiGraph, limit: int = 20) -> list[list[str]]:
    cycles: list[list[str]] = []
    try:
        for cycle in nx.simple_cycles(graph):
            cycles.append(cycle)
            if len(cycles) >= limit:
                break
    except Exception:
        pass
    return cycles


def edge_list(graph: nx.DiGraph) -> list[dict]:
    return [
        {"from": u, "to": v, "import": data.get("import_name", "")}
        for u, v, data in graph.edges(data=True)
    ]
