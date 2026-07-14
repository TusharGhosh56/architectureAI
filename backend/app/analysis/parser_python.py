"""Python AST import + definition extraction."""

from __future__ import annotations

import ast
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class Definition:
    name: str
    kind: str  # "function" | "class"
    lineno: int
    end_lineno: int
    docstring: str | None = None
    parent_class: str | None = None


@dataclass
class PythonParseResult:
    file_path: str
    imports: list[str] = field(default_factory=list)  # module names as written
    definitions: list[Definition] = field(default_factory=list)
    module_docstring: str | None = None


def _module_from_import(node: ast.Import | ast.ImportFrom) -> list[str]:
    modules: list[str] = []
    if isinstance(node, ast.Import):
        for alias in node.names:
            modules.append(alias.name)
    elif isinstance(node, ast.ImportFrom):
        if node.module:
            # Relative: level > 0 → prefix with dots for later resolution
            if node.level and node.level > 0:
                modules.append(("." * node.level) + node.module)
            else:
                modules.append(node.module)
        elif node.level and node.level > 0:
            # from . import foo
            modules.append("." * node.level)
    return modules


def parse_python_file(path: Path, rel_path: str) -> PythonParseResult:
    source = path.read_text(encoding="utf-8", errors="replace")
    result = PythonParseResult(file_path=rel_path)
    try:
        tree = ast.parse(source, filename=rel_path)
    except SyntaxError:
        return result

    result.module_docstring = ast.get_docstring(tree)

    for node in tree.body:
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            result.imports.extend(_module_from_import(node))
        elif isinstance(node, ast.FunctionDef) or isinstance(node, ast.AsyncFunctionDef):
            result.definitions.append(
                Definition(
                    name=node.name,
                    kind="function",
                    lineno=node.lineno,
                    end_lineno=getattr(node, "end_lineno", node.lineno) or node.lineno,
                    docstring=ast.get_docstring(node),
                )
            )
        elif isinstance(node, ast.ClassDef):
            end = getattr(node, "end_lineno", node.lineno) or node.lineno
            result.definitions.append(
                Definition(
                    name=node.name,
                    kind="class",
                    lineno=node.lineno,
                    end_lineno=end,
                    docstring=ast.get_docstring(node),
                )
            )
            for child in node.body:
                if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    result.definitions.append(
                        Definition(
                            name=child.name,
                            kind="function",
                            lineno=child.lineno,
                            end_lineno=getattr(child, "end_lineno", child.lineno)
                            or child.lineno,
                            docstring=ast.get_docstring(child),
                            parent_class=node.name,
                        )
                    )
    return result


def parse_python_tree(root: Path) -> list[PythonParseResult]:
    from app.analysis.ignore import iter_files_with_suffixes

    results: list[PythonParseResult] = []
    for path in iter_files_with_suffixes(root, {".py"}):
        rel = path.relative_to(root).as_posix()
        results.append(parse_python_file(path, rel))
    return results
