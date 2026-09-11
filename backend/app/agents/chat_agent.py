"""Native tool-calling chat agent for ArchitectAI.

Uses Groq tool calling with zero langchain dependencies.
"""

from __future__ import annotations

import json
from typing import Any

from app.agents.tools import AGENT_TOOLS_SPEC, execute_tool, get_project_data
from app.config import get_settings
from app.llm.client import get_groq_client, llm_configured

BASE_SYSTEM_PROMPT = (
    "You are ArchitectAI, an expert software architecture pairing assistant. "
    "You help developers understand a codebase that has already been analyzed. "
    "You have access to tools that query the real dependency graph, retrieve code chunks, "
    "and generate Mermaid diagrams. "
    "When explaining a codebase, identify its true primary purpose, key frameworks, core components, "
    "and architectural patterns. Never guess or hallucinate dependencies or file contents. "
    "Keep answers crisp, concrete, well-structured, and helpful."
)


def _build_system_prompt(project_data: dict[str, Any] | None = None) -> str:
    """Build rich architectural system prompt including pre-analyzed codebase context."""
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
        lines.append(f"Core/Central Files (by graph centrality): {', '.join(important[:10])}")
    summary = project_data.get("architecture_summary")
    if summary:
        lines.append(f"Pre-analyzed Architecture Summary:\n{summary}")

    return "\n".join(lines)


def _build_gemini_tools_decl() -> list[dict[str, Any]]:
    """Convert OpenAI/Groq tools spec to Gemini function_declarations format."""
    declarations: list[dict[str, Any]] = []
    for tool in AGENT_TOOLS_SPEC:
        fn = tool.get("function", {})
        declarations.append({
            "name": fn.get("name"),
            "description": fn.get("description", ""),
            "parameters": fn.get("parameters", {"type": "object", "properties": {}}),
        })
    return [{"function_declarations": declarations}]


def _call_gemini(
    api_key: str,
    model: str,
    req_body: dict[str, Any],
) -> dict[str, Any]:
    """Execute generateContent call to Gemini REST API with fallback."""
    import httpx

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    with httpx.Client(timeout=60.0) as http_client:
        resp = http_client.post(
            url,
            params={"key": api_key},
            json=req_body,
            headers={"Content-Type": "application/json"},
        )
        if resp.status_code != 200 and model != "gemini-2.5-flash":
            url_fallback = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
            resp = http_client.post(
                url_fallback,
                params={"key": api_key},
                json=req_body,
                headers={"Content-Type": "application/json"},
            )
        resp.raise_for_status()
        return resp.json()


def _run_gemini_agent(
    message: str,
    project_id: str,
    fallback_analysis: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Multi-turn tool-calling loop using Google Gemini REST API."""
    settings = get_settings()
    api_key = settings.gemini_api_key.strip()
    model = settings.gemini_model or "gemini-2.5-flash"
    if "gemini" not in model.lower():
        model = "gemini-2.5-flash"

    project_data = get_project_data(project_id, fallback_analysis)
    system_prompt = _build_system_prompt(project_data)
    tools_payload = _build_gemini_tools_decl()

    contents: list[dict[str, Any]] = [
        {
            "role": "user",
            "parts": [{"text": message}],
        }
    ]

    generated_mermaid: str | None = None
    is_inferred: bool = False
    final_text: str = ""

    # Allow up to 2 rounds of tool execution
    for _ in range(2):
        req_body = {
            "contents": contents,
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "tools": tools_payload,
            "generationConfig": {"temperature": 0.2},
        }

        data = _call_gemini(api_key, model, req_body)
        candidates = data.get("candidates") or []
        if not candidates:
            break

        candidate_content = candidates[0].get("content", {})
        parts = candidate_content.get("parts", [])

        # Check for functionCall parts
        function_calls = [p["functionCall"] for p in parts if "functionCall" in p]
        texts = [p.get("text", "") for p in parts if "text" in p]

        if not function_calls:
            # Model gave a direct text response
            final_text = "".join(texts).strip()
            break

        # Model requested tool call(s) - add model turn to contents
        contents.append({
            "role": "model",
            "parts": parts,
        })

        # Execute each function call and gather responses
        resp_parts: list[dict[str, Any]] = []
        for fc in function_calls:
            fn_name = fc.get("name")
            fn_args = fc.get("args") or {}

            tool_result = execute_tool(
                name=fn_name,
                args=fn_args,
                project_id=project_id,
                fallback_analysis=fallback_analysis,
            )

            if "mermaid" in tool_result:
                generated_mermaid = tool_result["mermaid"]
                is_inferred = bool(tool_result.get("inferred", False))

            resp_parts.append({
                "functionResponse": {
                    "name": fn_name,
                    "response": tool_result,
                }
            })

        contents.append({
            "role": "user",
            "parts": resp_parts,
        })

    # If tool calls were executed but no final text was emitted,
    # prompt Gemini to synthesize a complete architectural answer WITHOUT tools
    if not final_text:
        try:
            synthesis_contents = list(contents)
            synthesis_contents.append({
                "role": "user",
                "parts": [{
                    "text": (
                        f"Based on the tool results above and the codebase structure, "
                        f"provide a clear, comprehensive, and well-structured answer explaining the architecture "
                        f"and answering the user's question: '{message}'."
                    )
                }],
            })
            synth_body = {
                "contents": synthesis_contents,
                "systemInstruction": {"parts": [{"text": system_prompt}]},
                "generationConfig": {"temperature": 0.3},
            }
            synth_data = _call_gemini(api_key, model, synth_body)
            candidates = synth_data.get("candidates") or []
            if candidates:
                synth_parts = candidates[0].get("content", {}).get("parts", [])
                synth_texts = [p.get("text", "") for p in synth_parts if "text" in p]
                final_text = "".join(synth_texts).strip()
        except Exception:
            pass

    # High-quality fallback if model synthesis was somehow empty
    if not final_text:
        summary = project_data.get("architecture_summary")
        if summary:
            final_text = (
                f"{summary}\n\n"
                f"**Key Project Metrics:**\n"
                f"• Analyzed {project_data.get('file_count', 0)} files with {project_data.get('edge_count', 0)} dependencies.\n"
                f"• Core files: {', '.join(project_data.get('important_files', [])[:8])}"
            )
        else:
            final_text = "Analysis complete. The codebase was queried and the results have been processed."

    return {
        "message": final_text,
        "mermaid": generated_mermaid,
        "inferred": is_inferred,
    }


def run_chat_agent(
    message: str,
    project_id: str,
    fallback_analysis: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Executes the agentic tool-calling loop:
    1. Prefer Google Gemini if GEMINI_API_KEY is present.
    2. Fall back to Groq tool calling.
    3. Return final grounded response, attaching any generated Mermaid diagram.
    """
    settings = get_settings()
    project_data = get_project_data(project_id, fallback_analysis)

    if not llm_configured():
        # Helpful offline response when no LLM key is configured
        q = message.lower()
        if "what" in q or "summary" in q or "project" in q or "overview" in q:
            summary = project_data.get("architecture_summary")
            if summary:
                return {
                    "message": summary,
                    "mermaid": None,
                    "inferred": False,
                }
        if "diagram" in q or "graph" in q:
            tool_res = execute_tool("generate_diagram", {"scope": "all"}, project_id, fallback_analysis)
            return {
                "message": "Here is the extracted dependency diagram from your codebase.",
                "mermaid": tool_res.get("mermaid"),
                "inferred": False,
            }
        if "important" in q or "core" in q:
            tool_res = execute_tool("get_important_files", {}, project_id, fallback_analysis)
            files = tool_res.get("important_files", [])
            return {
                "message": f"Core files identified by in-degree centrality:\n"
                + "\n".join(f"• {f}" for f in files[:10]),
            }
        return {
            "message": "No LLM API key configured. Set GEMINI_API_KEY in .env to enable full AI chat.",
        }

    # 1. Prefer Gemini if key is present
    if settings.gemini_api_key:
        try:
            return _run_gemini_agent(message, project_id, fallback_analysis)
        except Exception as exc:
            # If Gemini fails and Groq is not available, return the error
            if not settings.groq_api_key:
                return {"message": f"Gemini agent call failed: {exc}", "mermaid": None, "inferred": False}

    # 2. Fall back to Groq
    system_prompt = _build_system_prompt(project_data)
    client = get_groq_client()
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": message},
    ]

    try:
        response = client.chat.completions.create(
            model=settings.groq_model,
            messages=messages,
            tools=AGENT_TOOLS_SPEC,
            tool_choice="auto",
            temperature=0.2,
        )
    except Exception as exc:
        return {
            "message": f"LLM call failed: {exc}",
        }

    choice = response.choices[0]
    assistant_msg = choice.message
    tool_calls = assistant_msg.tool_calls

    generated_mermaid: str | None = None
    is_inferred: bool = False

    if not tool_calls:
        return {
            "message": assistant_msg.content or "No response received.",
            "mermaid": None,
            "inferred": False,
        }

    # Append assistant's message with tool call requests
    messages.append(assistant_msg)

    # Execute each tool call
    for tool_call in tool_calls:
        fn_name = tool_call.function.name
        try:
            fn_args = json.loads(tool_call.function.arguments or "{}")
        except Exception:
            fn_args = {}

        tool_result = execute_tool(
            name=fn_name,
            args=fn_args,
            project_id=project_id,
            fallback_analysis=fallback_analysis,
        )

        if "mermaid" in tool_result:
            generated_mermaid = tool_result["mermaid"]
            is_inferred = bool(tool_result.get("inferred", False))

        messages.append(
            {
                "role": "tool",
                "tool_call_id": tool_call.id,
                "name": fn_name,
                "content": json.dumps(tool_result),
            }
        )

    # Second turn: Model generates natural language explanation using tool results
    try:
        follow_up = client.chat.completions.create(
            model=settings.groq_model,
            messages=messages,
            temperature=0.2,
        )
        final_content = follow_up.choices[0].message.content or "Analysis complete."
    except Exception as exc:
        final_content = f"Tool executed successfully, but summary failed: {exc}"

    return {
        "message": final_content,
        "mermaid": generated_mermaid,
        "inferred": is_inferred,
    }
