"""Chat agent tools for codebase analysis, graph querying, and diagram generation."""

from __future__ import annotations

import json
from typing import Any

import networkx as nx

from app.analysis.diagram_generator import generate_mermaid
from app.db import store
from app.llm.client import complete, llm_configured
from app.rag.vector_store import search_codebase

AGENT_TOOLS_SPEC = [
    {
        "type": "function",
        "function": {
            "name": "search_codebase",
            "description": "Search codebase for relevant functions, classes, and implementations.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Keywords or concept to search for (e.g. 'authentication', 'database connection').",
                    },
                    "k": {
                        "type": "integer",
                        "description": "Number of snippets to return (default 4).",
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_diagram",
            "description": "Generate a Mermaid dependency graph from extracted import edges, optionally scoped to a module.",
            "parameters": {
                "type": "object",
                "properties": {
                    "scope": {
                        "type": "string",
                        "description": "Optional file/module name or substring to focus on (e.g. 'auth', 'api', or 'all').",
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_file_dependencies",
            "description": "List what a given file imports (outgoing) and what files import it (incoming).",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "Relative file path (e.g. 'app/main.py').",
                    },
                },
                "required": ["file_path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_important_files",
            "description": "Return the most central, depended-upon files in the project.",
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_inferred_diagram",
            "description": "Generate an AI-inferred UML diagram (use case diagram or high-level architecture layers diagram) based on code semantics.",
            "parameters": {
                "type": "object",
                "properties": {
                    "diagram_type": {
                        "type": "string",
                        "enum": ["use_case", "architecture_layers"],
                        "description": "Type of diagram: 'use_case' (actors & intents) or 'architecture_layers' (architectural tiers).",
                    },
                    "scope": {
                        "type": "string",
                        "description": "Optional feature or module scope (e.g. 'auth', 'orders', 'all').",
                    },
                },
                "required": ["diagram_type"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_project_overview",
            "description": "Get high-level architecture overview, purpose, file count, and technology stack of the project.",
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },
]


def get_project_data(project_id: str, fallback_analysis: dict[str, Any] | None = None) -> dict[str, Any]:
    data = store.load_project(project_id)
    if data:
        return data
    if fallback_analysis:
        return fallback_analysis
    latest_id = store.latest_project_id()
    if latest_id:
        latest = store.load_project(latest_id)
        if latest:
            return latest
    return {}


_get_project_data = get_project_data


def _build_graph(project_data: dict[str, Any]) -> nx.DiGraph:
    graph = nx.DiGraph()
    for f in project_data.get("files", []):
        graph.add_node(f)
    for edge in project_data.get("edges", []):
        graph.add_edge(edge["from"], edge["to"], import_name=edge.get("import", ""))
    return graph


def execute_tool(
    name: str,
    args: dict[str, Any],
    project_id: str,
    fallback_analysis: dict[str, Any] | None = None,
) -> dict[str, Any]:
    project_data = _get_project_data(project_id, fallback_analysis)

    if name == "search_codebase":
        query = args.get("query", "")
        k = int(args.get("k", 4))
        hits = search_codebase(project_id, query, k=k)
        results = [
            {
                "file": h.get("metadata", {}).get("file", ""),
                "name": h.get("metadata", {}).get("name", ""),
                "kind": h.get("metadata", {}).get("kind", ""),
                "start_line": h.get("metadata", {}).get("start_line"),
                "snippet": (h.get("text") or "")[:400],
            }
            for h in hits
        ]
        return {"hits": results, "count": len(results)}

    if name == "generate_diagram":
        scope = args.get("scope", "all")
        graph = _build_graph(project_data)
        mermaid = generate_mermaid(graph, scope=scope)
        return {
            "mermaid": mermaid,
            "inferred": False,
            "scope": scope,
            "node_count": graph.number_of_nodes(),
            "edge_count": graph.number_of_edges(),
        }

    if name == "get_file_dependencies":
        target = args.get("file_path", "").strip().replace("\\", "/")
        graph = _build_graph(project_data)
        nodes = list(graph.nodes())

        # Exact or partial match
        matched = [n for n in nodes if n == target or n.endswith(f"/{target}")]
        node = matched[0] if matched else target

        if node in graph:
            imports = list(graph.successors(node))
            depended_by = list(graph.predecessors(node))
            return {
                "file": node,
                "imports": imports,
                "depended_by": depended_by,
                "found": True,
            }
        return {
            "file": target,
            "error": f"File '{target}' not found in dependency graph.",
            "known_files": nodes[:10],
            "found": False,
        }

    if name == "get_project_overview":
        return {
            "summary": project_data.get("architecture_summary", ""),
            "file_count": project_data.get("file_count", 0),
            "edge_count": project_data.get("edge_count", 0),
            "important_files": project_data.get("important_files", [])[:8],
            "languages": project_data.get("languages", {}),
        }

    if name == "get_important_files":
        important = project_data.get("important_files", [])
        return {
            "important_files": important,
            "total_files": project_data.get("file_count", 0),
            "architecture_summary": project_data.get("architecture_summary", ""),
        }

    if name == "generate_inferred_diagram":
        diagram_type = args.get("diagram_type", "architecture_layers")
        scope = args.get("scope", "all")

        important = project_data.get("important_files", [])[:8]
        summary = project_data.get("architecture_summary", "")

        rag_snippets: list[str] = []
        try:
            hits = search_codebase(project_id, f"{scope} routes handlers architecture", k=4)
            for h in hits:
                meta = h.get("metadata", {})
                snippet = (h.get("text") or "")[:350]
                rag_snippets.append(f"{meta.get('file')}::{meta.get('name')}:\n{snippet}")
        except Exception:
            pass

        if diagram_type == "use_case":
            prompt = (
                "You are a software architect. Generate a Mermaid diagram for the codebase use cases.\n"
                f"Project overview:\n{summary}\n\n"
                f"Key files:\n{', '.join(important)}\n\n"
                f"Relevant code snippets:\n{chr(10).join(rag_snippets)}\n\n"
                "Output ONLY valid Mermaid flowchart syntax illustrating User/Actor roles and their primary use case goals.\n"
                "Do NOT wrap in markdown fences or explain. Start directly with 'flowchart LR'."
            )
        else:
            prompt = (
                "You are a software architect. Generate a Mermaid diagram illustrating high-level layered architecture tiers "
                "(e.g. Presentation/UI, API/Routing, Domain/Service, Data/Storage).\n"
                f"Project overview:\n{summary}\n\n"
                f"Key files:\n{', '.join(important)}\n\n"
                f"Relevant code snippets:\n{chr(10).join(rag_snippets)}\n\n"
                "Output ONLY valid Mermaid flowchart syntax illustrating these logical layers and relationships.\n"
                "Do NOT wrap in markdown fences or explain. Start directly with 'flowchart TB'."
            )

        if not llm_configured():
            mermaid_fallback = (
                "flowchart TB\n"
                "  Client[Client / Frontend] --> API[API Endpoints]\n"
                "  API --> Services[Business Services]\n"
                "  Services --> Storage[(Database / Storage)]\n"
            )
            return {
                "mermaid": mermaid_fallback,
                "inferred": True,
                "diagram_type": diagram_type,
            }

        try:
            raw_mermaid = complete(
                "You are a Mermaid diagram generator. Output strictly Mermaid code without markdown codeblocks or commentary.",
                prompt,
            )
            cleaned = raw_mermaid.strip().strip("`").replace("mermaid\n", "").strip()
            if not cleaned.startswith("flowchart") and not cleaned.startswith("graph"):
                cleaned = "flowchart TB\n" + cleaned
            return {
                "mermaid": cleaned,
                "inferred": True,
                "diagram_type": diagram_type,
            }
        except Exception as exc:
            return {
                "error": f"Failed to infer diagram: {exc}",
                "mermaid": "flowchart TB\n  app[Application] --> modules[Core Modules]",
                "inferred": True,
            }

    return {"error": f"Unknown tool '{name}'"}
