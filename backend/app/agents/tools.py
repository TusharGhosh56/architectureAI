"""Chat agent tools backed by the persisted analysis for one project.

Diagram tools follow the usual AI-app pattern:
  model emits Mermaid text → API returns it → frontend renders SVG.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field

from app.analysis.diagram_generator import generate_mermaid
from app.analysis.graph_builder import graph_from_edges
from app.agents.usecase_extract import (
    collect_route_hints,
    format_evidence_for_prompt,
    hints_to_use_case_seed,
)
from app.db import store
from app.llm.client import complete
from app.rag.vector_store import search_codebase


class SearchArgs(BaseModel):
    query: str = Field(description="Natural-language search over functions/classes")
    k: int = Field(default=5, description="Number of chunks to return")


class DiagramArgs(BaseModel):
    scope: str = Field(
        default="all",
        description="Optional substring to scope files (e.g. 'auth') or 'all'",
    )


class FileDepsArgs(BaseModel):
    file_path: str = Field(description="Project-relative file path")


class EmptyArgs(BaseModel):
    pass


class InferredDiagramArgs(BaseModel):
    diagram_type: str = Field(
        description="Either 'use_case' or 'architecture_layers'"
    )
    scope: str = Field(
        default="all",
        description="Optional scope substring for files/chunks, or 'all'",
    )


def _load(project_id: str) -> dict[str, Any]:
    data = store.load_project(project_id)
    if not data:
        raise ValueError(f"Unknown project_id: {project_id}. Analyze a zip first.")
    return data


def _strip_mermaid_fences(text: str) -> str:
    """Pull Mermaid out of ```mermaid ... ``` if the model wrapped it."""
    text = (text or "").strip()
    fence = re.search(r"```(?:mermaid)?\s*([\s\S]*?)```", text, re.IGNORECASE)
    if fence:
        return fence.group(1).strip()
    start = re.search(
        r"^(?:flowchart|graph|usecasediagram|sequenceDiagram|classDiagram)\b",
        text,
        re.IGNORECASE | re.MULTILINE,
    )
    if start:
        return text[start.start() :].strip()
    return text


EXT_LANGUAGE = {
    ".py": "Python",
    ".pyi": "Python",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".mjs": "JavaScript",
    ".cjs": "JavaScript",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".vue": "Vue",
    ".html": "HTML",
    ".htm": "HTML",
    ".css": "CSS",
    ".scss": "CSS",
    ".sass": "CSS",
    ".less": "CSS",
    ".sql": "SQL",
    ".json": "JSON/config",
    ".yml": "YAML/config",
    ".yaml": "YAML/config",
    ".toml": "TOML/config",
    ".md": "Markdown",
    ".go": "Go",
    ".rs": "Rust",
    ".java": "Java",
    ".kt": "Kotlin",
    ".rb": "Ruby",
    ".php": "PHP",
    ".cs": "C#",
    ".cpp": "C++",
    ".c": "C",
    ".h": "C/C++ headers",
}


def language_breakdown(files: list[str]) -> dict[str, Any]:
    """Share of analyzed source files by language (sums to ~100%). Not LOC, not 'Git%'."""
    counts: dict[str, int] = {}
    for f in files:
        ext = Path(str(f).replace("\\", "/")).suffix.lower()
        lang = EXT_LANGUAGE.get(ext)
        if not lang:
            continue
        counts[lang] = counts.get(lang, 0) + 1
    total = sum(counts.values()) or 1
    by_language = [
        {
            "language": lang,
            "files": n,
            "percent": round(100.0 * n / total, 1),
        }
        for lang, n in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
    ]
    # Fix rounding so percents sum to 100.0 when possible
    if by_language:
        drift = round(100.0 - sum(x["percent"] for x in by_language), 1)
        by_language[0]["percent"] = round(by_language[0]["percent"] + drift, 1)
    return {
        "basis": "percent of analyzed source files by extension (not lines of code)",
        "analyzed_source_files": total,
        "by_language": by_language,
    }


def _idify(label: str, prefix: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9]+", "_", label).strip("_") or "x"
    if cleaned[0].isdigit():
        cleaned = f"n_{cleaned}"
    return f"{prefix}_{cleaned}"


def usecase_to_flowchart(text: str) -> str:
    """
    Mermaid 11 removed usecaseDiagram. Convert actor/use-case text into a
    flowchart LR (still the usual 'LLM wrote Mermaid, we render it' pipeline —
    this is just a renderer compatibility shim).
    """
    raw = _strip_mermaid_fences(text)
    actors: list[str] = []
    cases: list[str] = []
    links: list[tuple[str, str]] = []

    for line in raw.splitlines():
        trimmed = line.strip()
        if not trimmed or trimmed.lower().startswith("usecasediagram"):
            continue
        m = re.match(
            r'^actor\s+(?:["\']([^"\']+)["\']|(\w+))(?:\s+as\s+["\']?([^"\']+)["\']?)?$',
            trimmed,
            re.I,
        )
        if m:
            actors.append((m.group(3) or m.group(1) or m.group(2) or "").strip())
            continue
        m = re.match(
            r'^usecase\s+(\w+)\s+as\s+["\']?([^"\']+)["\']?$',
            trimmed,
            re.I,
        )
        if m:
            cases.append(m.group(2).strip())
            continue
        m = re.match(r"^usecase\s+(.+)$", trimmed, re.I)
        if m:
            cases.append(m.group(1).strip().strip("'\""))
            continue
        m = re.match(r"^\(([^)]+)\)$", trimmed)
        if m:
            cases.append(m.group(1).strip())
            continue
        m = re.match(
            r'^(?:\(([^)]+)\)|["\']([^"\']+)["\']|(\w+))\s*--+>\s*(?:\(([^)]+)\)|["\']([^"\']+)["\']|(\w+))$',
            trimmed,
        )
        if m:
            frm = (m.group(1) or m.group(2) or m.group(3) or "").strip()
            to = (m.group(4) or m.group(5) or m.group(6) or "").strip()
            if frm and to:
                links.append((frm, to))

    def uniq(items: list[str]) -> list[str]:
        out: list[str] = []
        for item in items:
            if item and item not in out:
                out.append(item)
        return out

    actors = uniq(actors) or ["User"]
    cases = uniq(cases) or uniq([t for _, t in links if t not in actors]) or ["Use Application"]

    lines = ["flowchart LR"]
    for a in actors:
        lines.append(f'  {_idify(a, "A")}["{a.replace(chr(34), chr(39))}"]')
    for c in cases:
        lines.append(f'  {_idify(c, "U")}["{c.replace(chr(34), chr(39))}"]')

    known = set(actors) | set(cases)
    linked_actors: set[str] = set()
    for frm, to in links:
        if frm not in known or to not in known:
            continue
        frm_id = _idify(frm, "A" if frm in actors else "U")
        to_id = _idify(to, "A" if to in actors else "U")
        lines.append(f"  {frm_id} --> {to_id}")
        if frm in actors:
            linked_actors.add(frm)

    for a in actors:
        if a not in linked_actors and cases:
            lines.append(f'  {_idify(a, "A")} --> {_idify(cases[0], "U")}')

    return "\n".join(lines)


def normalize_llm_mermaid(raw: str) -> str:
    """Strip fences, convert legacy usecaseDiagram, and fix common LLM Mermaid mistakes."""
    mermaid = _strip_mermaid_fences(raw)
    if mermaid.lstrip().lower().startswith("usecasediagram"):
        mermaid = usecase_to_flowchart(mermaid)
    return sanitize_mermaid_flowchart(mermaid)


def sanitize_mermaid_flowchart(text: str) -> str:
    """Repair frequent invalid edge/subgraph syntax models emit."""
    lines_out: list[str] = []
    for line in (text or "").splitlines():
        # Broken label arrows: A -->|label|> B  →  A -->|label| B
        line = re.sub(r"(-->|---|==>)\|([^|\n]+)\|>", r"\1|\2|", line)
        # A -->|label|>B (no space)
        line = re.sub(r"(-->|---|==>)\|([^|\n]+)\|>(\S)", r"\1|\2| \3", line)
        lines_out.append(line)
    text = "\n".join(lines_out)
    # Drop empty subgraph wrappers that only restate the node id (often invalid nesting)
    # Keep content simple when model goes overboard
    if text.count("subgraph") >= 4:
        # Flatten: keep header + node/edge lines, drop subgraph/end
        kept = []
        for line in text.splitlines():
            t = line.strip()
            if t.startswith("subgraph") or t == "end":
                continue
            kept.append(line)
        text = "\n".join(kept)
    return text.strip()


def _mermaid_looks_broken(text: str) -> bool:
    if not text or not re.match(r"^(?:flowchart|graph)\b", text.lstrip(), re.I):
        return True
    if "|>" in text:
        return True
    if text.count("subgraph") != text.count("\n  end") and text.count("subgraph") > 0:
        # rough mismatch check — also catch many subgraphs
        pass
    if text.count("subgraph") > 6:
        return True
    # Duplicate node declarations inside bad graphs often leave unclosed quotes
    if text.count('"') % 2 == 1:
        return True
    return False


def infer_architecture_layers(files: list[str]) -> list[dict[str, Any]]:
    """Detect architecture layers that actually exist in the uploaded file paths."""
    catalog: list[tuple[str, tuple[str, ...]]] = [
        ("Frontend", ("/frontend/", "/client/", "/web/", "/ui/", "/src/components/", ".tsx", ".jsx", ".vue")),
        ("API / Routes", ("/api/", "/routes/", "/routers/", "/controllers/", "/endpoints/")),
        ("Auth / Security", ("/auth/", "/security/", "/core/security")),
        ("Services", ("/services/", "/service/", "/handlers/", "/usecases/")),
        ("Jobs / Workers", ("/jobs/", "/worker/", "/workers/", "/tasks/", "/celery/")),
        ("Analytics", ("/analytics/",)),
        ("Git / Ingestion", ("/git/", "/cloner/", "/parser/")),
        ("Data / Models", ("/models/", "/schemas/", "/db/", "/repository/", "/repositories/", "/entities/", "/alembic/")),
        ("Cache", ("/cache/",)),
        ("Core", ("/core/", "/config")),
    ]
    buckets: dict[str, list[str]] = {name: [] for name, _ in catalog}
    for f in files:
        fl = str(f).replace("\\", "/").lower()
        placed = False
        for name, needles in catalog:
            if any(n in fl for n in needles):
                buckets[name].append(str(f).replace("\\", "/"))
                placed = True
                break
        if not placed:
            buckets.setdefault("Other", []).append(str(f).replace("\\", "/"))
    layers: list[dict[str, Any]] = []
    for name, _ in catalog:
        items = buckets.get(name) or []
        if items:
            layers.append({"name": name, "files": items[:12], "file_count": len(items)})
    other = buckets.get("Other") or []
    if other and not layers:
        layers.append({"name": "Application", "files": other[:12], "file_count": len(other)})
    return layers


def _layer_for_file(path: str) -> str | None:
    fl = str(path).replace("\\", "/").lower()
    catalog: list[tuple[str, tuple[str, ...]]] = [
        ("Frontend", ("/frontend/", "/client/", "/web/", "/ui/", "/src/components/", ".tsx", ".jsx", ".vue")),
        ("API / Routes", ("/api/", "/routes/", "/routers/", "/controllers/", "/endpoints/")),
        ("Auth / Security", ("/auth/", "/security/", "/core/security")),
        ("Services", ("/services/", "/service/", "/handlers/", "/usecases/")),
        ("Jobs / Workers", ("/jobs/", "/worker/", "/workers/", "/tasks/", "/celery/")),
        ("Analytics", ("/analytics/",)),
        ("Git / Ingestion", ("/git/", "/cloner/", "/parser/")),
        ("Data / Models", ("/models/", "/schemas/", "/db/", "/repository/", "/repositories/", "/entities/", "/alembic/")),
        ("Cache", ("/cache/",)),
        ("Core", ("/core/", "/config")),
    ]
    for name, needles in catalog:
        if any(n in fl for n in needles):
            return name
    return None


def architecture_from_imports(
    files: list[str],
    edges: list[Any],
) -> tuple[str, list[dict[str, Any]], list[dict[str, Any]]]:
    """
    Automated architecture diagram:
      files → layer buckets → aggregate real import edges between layers → Mermaid.
    Edges are real couplings only — never a fake L0→L1→L2… tower.
    """
    layers = infer_architecture_layers(files)
    file_to_layer = {str(f).replace("\\", "/"): _layer_for_file(f) for f in files}
    for e in edges or []:
        if isinstance(e, dict):
            pts = [e.get("from") or e.get("source"), e.get("to") or e.get("target")]
        elif isinstance(e, (list, tuple)) and len(e) >= 2:
            pts = [e[0], e[1]]
        else:
            continue
        for p in pts:
            if not p:
                continue
            key = str(p).replace("\\", "/")
            if key not in file_to_layer or not file_to_layer[key]:
                file_to_layer[key] = _layer_for_file(key)

    layer_names = {L["name"] for L in layers}
    couple: dict[tuple[str, str], int] = {}
    for e in edges or []:
        if isinstance(e, dict):
            u, v = e.get("from") or e.get("source"), e.get("to") or e.get("target")
        elif isinstance(e, (list, tuple)) and len(e) >= 2:
            u, v = e[0], e[1]
        else:
            continue
        if not u or not v:
            continue
        a = file_to_layer.get(str(u).replace("\\", "/")) or _layer_for_file(u)
        b = file_to_layer.get(str(v).replace("\\", "/")) or _layer_for_file(v)
        if not a or not b or a == b:
            continue
        if a not in layer_names or b not in layer_names:
            continue
        couple[(a, b)] = couple.get((a, b), 0) + 1

    active = {a for a, _ in couple} | {b for _, b in couple}
    show = [L for L in layers if L["name"] in active] or layers

    id_for = {L["name"]: f"L{i}" for i, L in enumerate(show)}
    # Left-right keeps Mermaid from looking like a fake waterfall stack
    lines = ["flowchart LR"]
    for L in show:
        nid = id_for[L["name"]]
        lines.append(f'  {nid}["{L["name"]} ({L["file_count"]} files)"]')

    link_rows: list[dict[str, Any]] = []
    ranked = sorted(couple.items(), key=lambda kv: -kv[1])
    drawn = 0
    for (a, b), weight in ranked:
        if a not in id_for or b not in id_for:
            continue
        lines.append(f"  {id_for[a]} -->|{weight}| {id_for[b]}")
        link_rows.append({"from": a, "to": b, "import_edges": weight})
        drawn += 1
        if drawn >= 18:
            break

    return "\n".join(lines), show, link_rows


def looks_like_fake_layer_tower(mermaid: str) -> bool:
    """Detect the old bad diagram: unlabeled L0→L1→L2… waterfall."""
    text = mermaid or ""
    if re.search(r"\|\d+\|", text) or "imports|" in text:
        return False
    consecutive = 0
    for i in range(0, 12):
        if re.search(rf"L{i}\s*-->\s*L{i + 1}\b", text):
            consecutive += 1
    return consecutive >= 3


def grounded_architecture_mermaid(files: list[str], edges: list[Any] | None = None) -> str:
    mermaid, _, _ = architecture_from_imports(files, edges or [])
    return mermaid


def _simple_architecture_mermaid(files: list[str]) -> str:
    return grounded_architecture_mermaid(files, [])


def extract_mermaid_blocks(text: str) -> list[str]:
    """Find ```mermaid fenced blocks in free-form assistant text (common AI-app pattern)."""
    blocks: list[str] = []
    for m in re.finditer(r"```(?:mermaid)?\s*([\s\S]*?)```", text or "", re.IGNORECASE):
        body = m.group(1).strip()
        if re.match(r"^(?:flowchart|graph|usecasediagram|sequenceDiagram|classDiagram)\b", body, re.I):
            blocks.append(normalize_llm_mermaid(body))
    return blocks


def build_tools(project_id: str) -> list[StructuredTool]:
    """Build LangChain tools closed over a specific analyzed project."""

    def search_codebase_tool(query: str, k: int = 5) -> str:
        hits = search_codebase(project_id, query, k=k)
        if not hits:
            return json.dumps({"hits": [], "note": "No indexed chunks for this project."})
        payload = []
        for h in hits:
            meta = h.get("metadata") or {}
            payload.append(
                {
                    "file": meta.get("file"),
                    "name": meta.get("name"),
                    "kind": meta.get("kind"),
                    "lines": f"{meta.get('start_line')}-{meta.get('end_line')}",
                    "excerpt": (h.get("text") or "")[:700],
                }
            )
        return json.dumps({"hits": payload}, indent=2)

    def generate_diagram_tool(scope: str = "all") -> str:
        # Extracted (not LLM) — still a normal AI-app tool: code analysis → Mermaid string
        data = _load(project_id)
        graph = graph_from_edges(data.get("edges") or [], data.get("files") or [])
        mermaid = generate_mermaid(graph, scope=scope or "all")
        return json.dumps(
            {
                "type": "dependency",
                "inferred": False,
                "scope": scope or "all",
                "mermaid": mermaid,
                "note": "Generated from project analysis.",
            }
        )

    def get_file_dependencies_tool(file_path: str) -> str:
        data = _load(project_id)
        graph = graph_from_edges(data.get("edges") or [], data.get("files") or [])
        target = file_path.replace("\\", "/")
        if target not in graph:
            matches = [n for n in graph.nodes if target.lower() in n.lower()]
            if len(matches) == 1:
                target = matches[0]
            elif matches:
                return json.dumps(
                    {"error": "Ambiguous file_path", "candidates": matches[:15]}
                )
            else:
                return json.dumps({"error": f"File not found: {file_path}"})
        return json.dumps(
            {
                "file": target,
                "imports": list(graph.successors(target)),
                "imported_by": list(graph.predecessors(target)),
            },
            indent=2,
        )

    def get_important_files_tool() -> str:
        data = _load(project_id)
        return json.dumps(
            {
                "important_files": data.get("important_files") or [],
                "circular_deps": data.get("circular_deps") or [],
                "file_count": data.get("file_count"),
                "edge_count": data.get("edge_count"),
                "language_breakdown": language_breakdown(data.get("files") or []),
            },
            indent=2,
        )

    def get_project_stats_tool() -> str:
        """File-count language mix and project totals — use for stack/% questions."""
        data = _load(project_id)
        return json.dumps(
            {
                "filename": data.get("filename"),
                "file_count": data.get("file_count"),
                "edge_count": data.get("edge_count"),
                "python_file_count": data.get("python_file_count"),
                "js_file_count": data.get("js_file_count"),
                "language_breakdown": language_breakdown(data.get("files") or []),
            },
            indent=2,
        )

    def generate_inferred_diagram_tool(diagram_type: str, scope: str = "all") -> str:
        """Classic path: gather context → LLM writes Mermaid → return string for the UI."""
        data = _load(project_id)
        dtype = (diagram_type or "").strip().lower().replace("-", "_").replace(" ", "_")
        if dtype in {"usecase", "use_case_diagram", "uml_use_case"}:
            dtype = "use_case"
        if dtype in {"architecture", "layers", "layered", "architecture_layer"}:
            dtype = "architecture_layers"
        if dtype not in {"use_case", "architecture_layers"}:
            return json.dumps(
                {
                    "error": "diagram_type must be 'use_case' or 'architecture_layers'",
                    "got": diagram_type,
                }
            )

        important = data.get("important_files") or []
        files = data.get("files") or []
        project_root = data.get("project_root") or ""

        # Architecture: automated from analysis (folders + real import couplings).
        # The chat agent still narrates; the diagram itself is computed, not free-handed.
        if dtype == "architecture_layers":
            edges = data.get("edges") or []
            mermaid, layers, couplings = architecture_from_imports(files, edges)
            return json.dumps(
                {
                    "type": dtype,
                    "inferred": False,
                    "scope": scope or "all",
                    "mermaid": mermaid,
                    "layers": layers,
                    "couplings": couplings[:20],
                    "note": "Architecture auto-built from folders + import edges in the upload.",
                }
            )

        seeds: list[dict[str, Any]] = []
        if project_root:
            hints = collect_route_hints(project_root, files, scope=scope or "all")
            seeds = hints_to_use_case_seed(hints)

        queries = [
            f"{scope} API routes endpoints handlers use cases",
            f"{scope} authentication repository analytics jobs",
        ]
        excerpts: list[str] = []
        seen: set[str] = set()
        for q in queries:
            for h in search_codebase(project_id, q, k=6):
                hid = str(h.get("id") or "")
                if hid in seen:
                    continue
                seen.add(hid)
                meta = h.get("metadata") or {}
                excerpts.append(
                    f"{meta.get('file')}::{meta.get('name')}\n{(h.get('text') or '')[:400]}"
                )
            if len(excerpts) >= 12:
                break

        system = (
            "You generate UML-style use case diagrams as Mermaid for a real codebase.\n"
            "Output ONLY Mermaid — no markdown fences, no prose.\n\n"
            "IMPORTANT: Mermaid 11 removed usecaseDiagram. Always emit a flowchart:\n"
            "flowchart LR\n"
            '  User["User"]\n'
            '  Login["Login"]\n'
            "  User --> Login\n\n"
            "Rules:\n"
            "- Start with the exact line: flowchart LR\n"
            '- Use rectangle nodes: Id["Label with spaces"]\n'
            "- Keep 8–14 distinct use cases grounded in the evidence\n"
            "- Prefer User as the main actor; avoid System/Worker unless clear\n"
            "- No near-duplicate stats nodes\n"
            "- Do NOT invent a browser Frontend UI if evidence is backend-only\n"
        )
        user = (
            f"Scope: {scope}\n\n"
            "Route/service evidence (prefer these capabilities):\n"
            + format_evidence_for_prompt(seeds, max_items=30)
            + "\n\nImportant files:\n"
            + "\n".join(f"- {f}" for f in important[:15])
            + "\n\nCode excerpts:\n"
            + ("\n\n".join(excerpts[:12]) if excerpts else "(none)")
            + "\n\nEmit ONLY Mermaid starting with: flowchart LR"
        )

        try:
            raw = complete(system, user)
            mermaid = normalize_llm_mermaid(raw)
            if not re.match(r"^(?:flowchart|graph)\b", mermaid.lstrip(), re.I):
                mermaid = 'flowchart LR\n  User["User"] --> App["Use application"]'
            mermaid = sanitize_mermaid_flowchart(mermaid)
        except Exception as exc:
            return json.dumps({"error": f"LLM diagram generation failed: {exc}"})

        return json.dumps(
            {
                "type": "use_case",
                "inferred": True,
                "scope": scope or "all",
                "mermaid": mermaid,
                "note": "Generated from project analysis.",
            }
        )

    return [
        StructuredTool.from_function(
            name="search_codebase",
            description=(
                "Semantic search over indexed code chunks (functions/classes). "
                "Use for 'how does X work', auth, endpoints, behavior questions."
            ),
            func=search_codebase_tool,
            args_schema=SearchArgs,
        ),
        StructuredTool.from_function(
            name="generate_diagram",
            description=(
                "Generate an EXTRACTED Mermaid dependency graph from real import edges. "
                "Use for dependency / import / module coupling questions. "
                "Do NOT use this for UML use case diagrams."
            ),
            func=generate_diagram_tool,
            args_schema=DiagramArgs,
        ),
        StructuredTool.from_function(
            name="get_file_dependencies",
            description="List what a file imports and what imports it.",
            func=get_file_dependencies_tool,
            args_schema=FileDepsArgs,
        ),
        StructuredTool.from_function(
            name="get_important_files",
            description=(
                "Return most central depended-upon files, circular dependencies, "
                "and language file-share stats."
            ),
            func=get_important_files_tool,
            args_schema=EmptyArgs,
        ),
        StructuredTool.from_function(
            name="get_project_stats",
            description=(
                "Return measured tech-stack shares by counted source files (percents sum to ~100). "
                "ALWAYS call this for questions about language mix, stack percentages, "
                "or 'how much Python vs JS'. Never invent percentages."
            ),
            func=get_project_stats_tool,
            args_schema=EmptyArgs,
        ),
        StructuredTool.from_function(
            name="generate_inferred_diagram",
            description=(
                "Generate a diagram for the uploaded project. "
                "diagram_type='use_case' (LLM Mermaid from routes) or "
                "diagram_type='architecture_layers' (layers from folders that exist — "
                "will NOT invent Frontend if the zip is backend-only). "
                "NOT for import dependency graphs."
            ),
            func=generate_inferred_diagram_tool,
            args_schema=InferredDiagramArgs,
        ),
    ]


def collect_diagrams_from_tool_output(tool_name: str, content: str) -> list[dict[str, Any]]:
    diagrams: list[dict[str, Any]] = []
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        return diagrams
    if isinstance(data, dict) and data.get("mermaid"):
        diagrams.append(
            {
                "tool": tool_name,
                "mermaid": normalize_llm_mermaid(str(data["mermaid"])),
                "inferred": bool(data.get("inferred")),
                "type": data.get("type"),
                "note": data.get("note"),
            }
        )
    return diagrams
