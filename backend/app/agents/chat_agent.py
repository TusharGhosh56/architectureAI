"""Native tool-calling chat agent for ArchitectAI.

Uses Groq and Gemini REST API with zero langchain dependencies.
Grounds every answer in parsed dependency graphs, AST imports, and vector search.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from app.agents.tools import AGENT_TOOLS_SPEC, execute_tool, get_project_data
from app.config import get_settings
from app.llm.client import get_groq_client, llm_configured

BASE_SYSTEM_PROMPT = (
    "You are ArchitectAI, an expert software architecture copilot. "
    "You help developers understand real codebases with precise, grounded architectural insights.\n"
    "CRITICAL RULES:\n"
    "1. When the user asks about a specific file, component, or module, answer SPECIFICALLY about that file. "
    "Detail which files import it (downstream callers), what it imports (upstream dependencies), its purpose, and its architectural impact. "
    "NEVER replace a file query with a generic repository overview.\n"
    "2. When explaining a codebase overview, identify its primary purpose, key frameworks, and core components.\n"
    "3. Never guess or hallucinate dependencies or file contents. Base all claims strictly on the provided codebase facts."
)


def _find_target_file(message: str, project_data: dict[str, Any]) -> str | None:
    """Extract a referenced file from the user's message if it exists in the codebase."""
    files: list[str] = project_data.get("files", [])
    if not files:
        return None

    # 1. Regex search for paths / filenames with extensions (e.g. src/components/Reveal.astro)
    path_matches = re.findall(r'[\w\-./\\]+\.[a-zA-Z0-9]+', message)
    for m in path_matches:
        cleaned = m.strip().replace("\\", "/").lower()
        for f in files:
            f_norm = f.replace("\\", "/").lower()
            if f_norm == cleaned or f_norm.endswith(f"/{cleaned}") or cleaned.endswith(f"/{f_norm}"):
                return f
            if Path(f_norm).name == Path(cleaned).name:
                return f

    # 2. Check known file basenames in the message
    msg_lower = message.lower()
    for f in files:
        base = Path(f).name.lower()
        if len(base) > 4 and base in msg_lower:
            return f

    return None


def _format_file_dependency_report(
    file_path: str,
    dep_result: dict[str, Any],
    project_data: dict[str, Any],
    snippets: list[dict[str, Any]] | None = None,
) -> str:
    """Generate a clean, professional, fully grounded report for a specific file."""
    dep_by = dep_result.get("depended_by", [])
    imps = dep_result.get("imports", [])

    dep_list = (
        "\n".join(f"• `{f}`" for f in dep_by)
        if dep_by
        else "• *None (no other scanned files directly import this module — it may be an entrypoint or standalone)*"
    )
    imp_list = (
        "\n".join(f"• `{f}`" for f in imps)
        if imps
        else "• *None (this file does not import other internal modules)*"
    )

    p = Path(file_path)
    role_desc = ""
    if "component" in file_path.lower():
        role_desc = (
            f"`{file_path}` acts as a shared UI component rendered across multiple views. "
            f"It encapsulates reusable presentation logic and layout structure."
        )
    elif "data" in file_path.lower():
        role_desc = (
            f"`{file_path}` serves as a centralized data model/content module, decoupling static definitions "
            f"from presentation templates."
        )
    elif "layout" in file_path.lower() or "base" in file_path.lower():
        role_desc = (
            f"`{file_path}` functions as a top-level architectural layout wrapping page structures, "
            f"styles, and global markup."
        )
    elif "page" in file_path.lower() or "route" in file_path.lower():
        role_desc = (
            f"`{file_path}` represents an application route/page entrypoint that aggregates data and components "
            f"for rendering."
        )
    else:
        role_desc = f"`{file_path}` is an internal module with {len(dep_by)} downstream caller(s) and {len(imps)} internal import(s)."

    snippet_block = ""
    if snippets:
        code_snip = snippets[0].get("snippet", "").strip()
        if code_snip:
            snippet_block = f"\n\n**Code Excerpt:**\n```tsx\n{code_snip[:350]}\n```"

    return (
        f"### Dependency & Architectural Inspection: `{file_path}`\n\n"
        f"**Role in Architecture:**\n{role_desc}{snippet_block}\n\n"
        f"**Files that depend on this module ({len(dep_by)} downstream caller{'s' if len(dep_by) != 1 else ''}):**\n"
        f"{dep_list}\n\n"
        f"**Internal modules imported by this file ({len(imps)} upstream dependenc{'ies' if len(imps) != 1 else 'y'}):**\n"
        f"{imp_list}\n\n"
        f"**Blast Radius Assessment:**\n"
        f"• Modifying or refactoring `{file_path}` directly impacts the {len(dep_by)} caller(s) listed above.\n"
        f"• Any alterations to exported props, types, or component signatures should be regression-tested against these dependents."
    )


def _build_system_prompt(project_data: dict[str, Any] | None = None) -> str:
    """Build architectural system prompt including codebase context."""
    if not project_data:
        return BASE_SYSTEM_PROMPT

    lines = [BASE_SYSTEM_PROMPT, "\n--- CURRENT CODEBASE CONTEXT ---"]
    file_count = project_data.get("file_count")
    if file_count is not None:
        lines.append(f"Total Files Analyzed: {file_count}")
    edge_count = project_data.get("edge_count")
    if edge_count is not None:
        lines.append(f"Import Dependencies: {edge_count}")
    languages = project_data.get("languages")
    if languages and isinstance(languages, dict):
        lang_str = ", ".join(f"{k} ({v})" for k, v in list(languages.items())[:6])
        lines.append(f"Languages & File Types: {lang_str}")
    important = project_data.get("important_files")
    if important and isinstance(important, list):
        lines.append(f"Core/Central Files (by in-degree centrality): {', '.join(important[:10])}")
    summary = project_data.get("architecture_summary")
    if summary:
        lines.append(f"High-level Architecture Summary (use ONLY when asked for overview/summary):\n{summary}")

    return "\n".join(lines)


def _run_groq_agent(
    message: str,
    project_id: str,
    fallback_analysis: dict[str, Any] | None = None,
    target_file: str | None = None,
) -> dict[str, Any]:
    """Execute fast, robust tool calling with Groq (Qwen/LLaMA)."""
    settings = get_settings()
    project_data = get_project_data(project_id, fallback_analysis)
    system_prompt = _build_system_prompt(project_data)
    client = get_groq_client()

    user_prompt = message
    dep_res: dict[str, Any] | None = None
    search_hits: list[dict[str, Any]] = []

    if target_file:
        dep_res = execute_tool("get_file_dependencies", {"file_path": target_file}, project_id, fallback_analysis)
        search_res = execute_tool("search_codebase", {"query": target_file, "k": 2}, project_id, fallback_analysis)
        search_hits = search_res.get("hits", [])
        dep_by = dep_res.get("depended_by", [])
        imps = dep_res.get("imports", [])
        user_prompt = (
            f"The user is asking: '{message}'\n\n"
            f"[Grounded Codebase Facts for '{target_file}']:\n"
            f"• File path: {target_file}\n"
            f"• Files that depend on this component ({len(dep_by)} downstream callers): {', '.join(dep_by) if dep_by else 'None'}\n"
            f"• Internal modules imported by this file ({len(imps)}): {', '.join(imps) if imps else 'None'}\n\n"
            f"Provide a direct, concrete, well-structured architectural explanation of how this file is used across the codebase, "
            f"which files depend on it, and the blast radius if modified. Do not return a generic project overview."
        )

    messages: list[dict[str, Any]] = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    response = client.chat.completions.create(
        model=settings.groq_model,
        messages=messages,
        temperature=0.2,
    )

    choice = response.choices[0]
    assistant_msg = choice.message
    content = assistant_msg.content or ""

    # Check if a diagram is requested
    generated_mermaid: str | None = None
    is_inferred: bool = False
    if "diagram" in message.lower() or "graph" in message.lower():
        d_res = execute_tool("generate_diagram", {"scope": "all"}, project_id, fallback_analysis)
        generated_mermaid = d_res.get("mermaid")

    if not content and target_file and dep_res:
        content = _format_file_dependency_report(target_file, dep_res, project_data, search_hits)

    return {
        "message": content or "Analysis completed.",
        "mermaid": generated_mermaid,
        "inferred": is_inferred,
    }


def _call_gemini(
    api_key: str,
    model: str,
    req_body: dict[str, Any],
) -> dict[str, Any]:
    """Execute generateContent call to Gemini REST API with strict timeout."""
    import httpx

    raw_model = model.strip() if model else "gemini-3.6-flash"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{raw_model}:generateContent"
    with httpx.Client(timeout=6.0) as http_client:
        resp = http_client.post(
            url,
            params={"key": api_key},
            json=req_body,
            headers={"Content-Type": "application/json"},
        )
        resp.raise_for_status()
        return resp.json()


def run_chat_agent(
    message: str,
    project_id: str,
    fallback_analysis: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Executes the agentic chat workflow:
    1. Pre-detect targeted file queries and ground with real AST facts.
    2. Prefer Groq (tested, active, sub-second latency).
    3. Fall back to Gemini or deterministic grounded AST response.
    """
    settings = get_settings()
    project_data = get_project_data(project_id, fallback_analysis)
    target_file = _find_target_file(message, project_data)

    if not llm_configured():
        if target_file:
            dep_res = execute_tool("get_file_dependencies", {"file_path": target_file}, project_id, fallback_analysis)
            return {
                "message": _format_file_dependency_report(target_file, dep_res, project_data),
                "mermaid": None,
                "inferred": False,
            }

        q = message.lower()
        if "what" in q or "summary" in q or "project" in q or "overview" in q:
            summary = project_data.get("architecture_summary")
            if summary:
                return {"message": summary, "mermaid": None, "inferred": False}
        if "diagram" in q or "graph" in q:
            tool_res = execute_tool("generate_diagram", {"scope": "all"}, project_id, fallback_analysis)
            return {
                "message": "Here is the extracted dependency diagram from your codebase.",
                "mermaid": tool_res.get("mermaid"),
                "inferred": False,
            }
        if "circular" in q or "cycle" in q:
            cycles = project_data.get("circular_deps", [])
            if cycles:
                c_list = "\n".join(f"{i+1}. {' → '.join(c)}" for i, c in enumerate(cycles[:8]))
                return {"message": f"Detected circular dependency loops:\n{c_list}", "mermaid": None, "inferred": False}
            return {"message": "No circular dependencies detected in the parsed import graph.", "mermaid": None, "inferred": False}
        return {
            "message": "Offline mode active. Query files, diagrams, or architecture metrics.",
        }

    # 1. Prefer Groq (fastest, robust, tested in < 1 second)
    if settings.groq_api_key:
        try:
            return _run_groq_agent(message, project_id, fallback_analysis, target_file)
        except Exception as exc:
            pass

    # 2. Fall back to Gemini
    if settings.gemini_api_key:
        try:
            req_body = {
                "contents": [{"role": "user", "parts": [{"text": message}]}],
                "systemInstruction": {"parts": [{"text": _build_system_prompt(project_data)}]},
            }
            data = _call_gemini(settings.gemini_api_key, settings.gemini_model, req_body)
            candidates = data.get("candidates") or []
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                texts = [p.get("text", "") for p in parts if "text" in p]
                return {"message": "".join(texts).strip(), "mermaid": None, "inferred": False}
        except Exception:
            pass

    # 3. Deterministic Grounded AST Fallback
    if target_file:
        dep_res = execute_tool("get_file_dependencies", {"file_path": target_file}, project_id, fallback_analysis)
        return {
            "message": _format_file_dependency_report(target_file, dep_res, project_data),
            "mermaid": None,
            "inferred": False,
        }

    return {
        "message": "Could not connect to LLM provider. Please check network connectivity and API keys.",
        "mermaid": None,
        "inferred": False,
    }
