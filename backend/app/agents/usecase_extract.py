"""Ground use-case diagrams in real routes/handlers found in the uploaded project."""

from __future__ import annotations

import ast
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any


ROUTE_FILE_HINTS = (
    "/api/",
    "/routes/",
    "/routers/",
    "/views/",
    "/controllers/",
    "/endpoints/",
    "router.py",
    "routes.py",
    "urls.py",
)

SERVICE_FILE_HINTS = (
    "/services/",
    "/service/",
    "/usecases/",
    "/use_cases/",
    "/handlers/",
)

DECORATOR_PATH_RE = re.compile(
    r"""@(?:router|app|api|bp|blueprint)\.(get|post|put|patch|delete|head|options)\s*\(\s*['"]([^'"]*)['"]""",
    re.IGNORECASE,
)
SUMMARY_RE = re.compile(r"""summary\s*=\s*['"]([^'"]+)['"]""", re.IGNORECASE)
EXPRESS_RE = re.compile(
    r"""(?:router|app)\.(get|post|put|patch|delete)\s*\(\s*['`]([^'`]+)['`]""",
    re.IGNORECASE,
)


@dataclass
class RouteHint:
    method: str
    path: str
    summary: str | None
    function: str | None
    file: str


def _title_from_path(method: str, path: str, summary: str | None, function: str | None) -> str:
    if summary and summary.strip():
        return summary.strip()
    if function and function not in {"endpoint", "handler", "view"}:
        words = re.sub(r"[_\-]+", " ", function).strip()
        words = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", words)
        return words[:1].upper() + words[1:] if words else f"{method.upper()} {path}"
    clean = path.strip("/") or "root"
    return f"{method.upper()} /{clean}"


def _likely_route_files(files: list[str], scope: str = "all") -> list[str]:
    scope_l = (scope or "all").strip().lower()
    out: list[str] = []
    for f in files:
        fl = f.replace("\\", "/").lower()
        if scope_l not in {"", "all"} and scope_l not in fl:
            if not any(h in fl for h in ROUTE_FILE_HINTS):
                continue
        if any(h in fl for h in ROUTE_FILE_HINTS) or any(h in fl for h in SERVICE_FILE_HINTS):
            if fl.endswith((".py", ".ts", ".tsx", ".js", ".jsx")):
                out.append(f.replace("\\", "/"))
    out.sort(key=lambda p: (0 if "/api/" in p.lower() else 1, p))
    return out


def _extract_python_routes(source: str, file_path: str) -> list[RouteHint]:
    hints: list[RouteHint] = []
    prefix = ""
    pref = re.search(
        r"""APIRouter\s*\(\s*[^)]*prefix\s*=\s*['"]([^'"]+)['"]""",
        source,
        re.IGNORECASE | re.DOTALL,
    )
    if pref:
        prefix = pref.group(1).rstrip("/")

    for match in DECORATOR_PATH_RE.finditer(source):
        method, path = match.group(1), match.group(2)
        full_path = f"{prefix}{path}" if path.startswith("/") else f"{prefix}/{path}"
        window = source[match.start() : match.start() + 500]
        summary_m = SUMMARY_RE.search(window)
        after = source[match.end() : match.end() + 240]
        fn_m = re.search(r"\ndef\s+(\w+)\s*\(", after)
        hints.append(
            RouteHint(
                method=method.lower(),
                path=full_path or path,
                summary=summary_m.group(1) if summary_m else None,
                function=fn_m.group(1) if fn_m else None,
                file=file_path,
            )
        )

    # Service helpers only when file looks like a service module
    if any(h in file_path.replace("\\", "/").lower() for h in SERVICE_FILE_HINTS):
        try:
            tree = ast.parse(source)
            for node in tree.body:
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    if node.name.startswith("_"):
                        continue
                    doc = ast.get_docstring(node) or ""
                    hints.append(
                        RouteHint(
                            method="service",
                            path=node.name,
                            summary=(doc.splitlines()[0] if doc else None),
                            function=node.name,
                            file=file_path,
                        )
                    )
        except SyntaxError:
            pass
    return hints


def _extract_js_routes(source: str, file_path: str) -> list[RouteHint]:
    hints: list[RouteHint] = []
    for match in EXPRESS_RE.finditer(source):
        hints.append(
            RouteHint(
                method=match.group(1).lower(),
                path=match.group(2),
                summary=None,
                function=None,
                file=file_path,
            )
        )
    return hints


def collect_route_hints(
    project_root: str | Path,
    files: list[str],
    scope: str = "all",
    limit_files: int = 40,
) -> list[RouteHint]:
    root = Path(project_root)
    hints: list[RouteHint] = []
    for rel in _likely_route_files(files, scope)[:limit_files]:
        path = root / rel
        if not path.is_file():
            continue
        try:
            source = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        if path.suffix == ".py":
            hints.extend(_extract_python_routes(source, rel))
        else:
            hints.extend(_extract_js_routes(source, rel))
    return hints


def hints_to_use_case_seed(hints: list[RouteHint]) -> list[dict[str, Any]]:
    """Deduped seed use cases derived from routes/services."""
    seen: set[str] = set()
    seeds: list[dict[str, Any]] = []

    def key_for(title: str) -> str:
        tokens = re.sub(r"[^a-z0-9]+", " ", title.lower()).split()
        stop = {
            "a", "an", "the", "and", "to", "for", "of", "new", "currently",
            "authenticated", "receive", "jwt", "access", "token", "results",
            "with", "summary", "response", "data", "item", "by",
            "details", "current",
        }
        synonyms = {
            "repos": "repository",
            "repo": "repository",
            "repositories": "repository",
            "authenticate": "login",
            "authentication": "login",
            "signin": "login",
            "signup": "register",
            "reanalyze": "reanalyze",
            "reanalysis": "reanalyze",
            "stat": "statistics",
            "stats": "statistics",
            "metric": "analytics",
            "metrics": "analytics",
        }
        if "email" in tokens and any(
            t in tokens for t in ("stat", "stats", "statistics", "analytics", "metric", "metrics")
        ):
            return "analytics by email"
        if any(t in tokens for t in ("analytics", "metric", "metrics")):
            return "view analytics"
        if "status" in tokens:
            return "get status"
        core = []
        for t in tokens:
            if t in stop:
                continue
            core.append(synonyms.get(t, t))
        collapsed: list[str] = []
        for t in core:
            if not collapsed or collapsed[-1] != t:
                collapsed.append(t)
        return " ".join(collapsed[:3])

    http_hints = [h for h in hints if h.method in {"get", "post", "put", "patch", "delete"}]
    pool = http_hints if len(http_hints) >= 4 else hints

    ordered = sorted(
        pool,
        key=lambda h: (
            0 if h.method in {"get", "post", "put", "patch", "delete"} else 1,
            0 if h.summary else 1,
            h.file,
            h.path,
        ),
    )

    canonical_labels = {
        "analytics by email": "View stats by email",
        "view analytics": "View repository analytics",
        "login": "Login",
        "register": "Register a new user",
    }

    for h in ordered:
        title = _title_from_path(h.method, h.path, h.summary, h.function)
        if (h.function or "") == "me" or (h.path or "").rstrip("/").endswith("/me"):
            title = "View current profile"
        key = key_for(title)
        if not key or key in seen:
            continue
        seen.add(key)
        if key in canonical_labels:
            title = canonical_labels[key]
        actor = "User"
        blob = f"{h.path} {h.function or ''} {h.summary or ''}".lower()
        if any(k in blob for k in ("admin", "staff", "superuser")):
            actor = "Admin"
        seeds.append(
            {
                "use_case": title,
                "actor": actor,
                "source": f"{h.method.upper()} {h.path}" if h.method != "service" else h.function,
                "file": h.file,
            }
        )
    return seeds


def format_evidence_for_prompt(seeds: list[dict[str, Any]], max_items: int = 40) -> str:
    lines = []
    for s in seeds[:max_items]:
        lines.append(
            f"- {s['use_case']} (actor={s['actor']}, from={s.get('source')}, file={s.get('file')})"
        )
    return "\n".join(lines) if lines else "(no route/service hints found)"
