"""LangGraph chat agent: agent ↔ tools, then a verify pass before the reply is returned.

Typical AI-app pattern for fewer nonsense answers:
  draft (tools + LLM) → self-check against tool evidence → corrected reply
"""

from __future__ import annotations

import json
import re
from typing import Any

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage
from langgraph.graph import MessagesState, StateGraph
from langgraph.prebuilt import ToolNode, tools_condition

from app.agents.tools import (
    architecture_from_imports,
    build_tools,
    collect_diagrams_from_tool_output,
    extract_mermaid_blocks,
    language_breakdown,
    looks_like_fake_layer_tower,
)
from app.db import store
from app.llm.client import complete, get_llm, llm_configured


SYSTEM_TEMPLATE = """You are ArchitectAI, an assistant that explains a codebase that has already been statically analyzed.

Project: {filename}
Files analyzed: {file_count}
Import edges: {edge_count}
Measured language mix (file-count % of analyzed sources — already sums to 100):
{language_mix}

Rules:
- You are a helpful AI agent. Always answer in natural language as that agent.
- Stay grounded in THIS uploaded project only. Do not invent a Frontend/UI/SPA
  if the file list / language mix shows backend-only (e.g. Python 100%, no .tsx/.jsx).
- Use tools to answer accurately. Do not invent file paths, dependencies, or percentages.
- Stack / language mix / percent questions → call get_project_stats (or use the measured mix above).
  Only name languages with files > 0 from that data. Never pad with 0%, N/A, or "not found".
- For dependency / import graphs → call generate_diagram.
- For UML use case diagrams → call generate_inferred_diagram with diagram_type="use_case".
- For layered / high-level architecture → call generate_inferred_diagram with diagram_type="architecture_layers"
  (auto-built from folders + import edges in THIS zip — describe only what the tool returns;
   do not invent Frontend or a linear stack that the diagram does not show).
- Never answer a use-case request with generate_diagram.
- After a tool returns a diagram, write a short plain-language explanation for a non-technical product user.
  Do NOT mention Mermaid, SVG, tools, function names, prompts, or implementation details.
  Do NOT paste diagram source code into your reply — the UI draws the diagram separately.
  Do NOT claim the project has a Frontend unless the tool/layers include it.
- Prefer short, concrete answers grounded in tool results.
- CRITICAL: If the user asks to generate, show, draw, or make a diagram
  (architecture, layers, use case, dependency/import graph), you MUST call the matching
  diagram tool. Never describe a diagram in words without calling the tool —
  the UI only displays visuals from tool Mermaid results.
"""

VERIFY_SYSTEM = """You are a careful reviewer for ArchitectAI.
You receive the user question, a draft answer, and FACTS from tools / measured stats.
Return ONLY the final user-facing answer (no JSON, no critique essay).

Fix the draft when needed:
- Numbers/percentages must match FACTS. Language shares must come from language_breakdown and sum ~100.
- Only mention languages that appear with files > 0. Remove 0%, "N/A", "not found", and "not applicable" rows.
- If FACTS show no Frontend / no JS/TS, remove any invented frontend/UI claims.
- Drop invented categories that are not programming languages in the file stats (e.g. "Git: 90%").
- Do not contradict tool evidence. If facts are missing, say what is known from the draft without inventing.
- Keep a natural product tone. Do NOT mention tools, Mermaid, SVG, verification, or that you revised anything.
- If the draft is already correct, return it almost unchanged (light polish OK).
"""


def _history_to_messages(history: list[dict[str, str]] | None) -> list[BaseMessage]:
    messages: list[BaseMessage] = []
    for item in history or []:
        role = (item.get("role") or "").lower()
        content = item.get("content") or ""
        if not content:
            continue
        if role == "assistant":
            messages.append(AIMessage(content=content))
        else:
            messages.append(HumanMessage(content=content))
    return messages


def _message_text(content: Any) -> str:
    if isinstance(content, list):
        return "".join(
            block if isinstance(block, str) else str(block.get("text", ""))
            for block in content
        ).strip()
    return str(content or "").strip()


def _is_stack_percent_question(message: str) -> bool:
    text = (message or "").lower()
    asks_stack = bool(re.search(r"\b(tech\s*stack|language|languages|stack)\b", text))
    asks_share = bool(
        re.search(r"\b(percent|percentage|%|share|mix|how much|proportion)\b", text)
    )
    return asks_stack or (asks_share and "python" in text) or (
        asks_stack and asks_share
    ) or bool(re.search(r"tech\s*stack.*percent|percent.*stack|out of 100", text))


def _format_stack_reply(stats: dict[str, Any]) -> str:
    rows = [r for r in (stats.get("by_language") or []) if int(r.get("files") or 0) > 0]
    if not rows:
        return "No recognizable source-language files were found in the analysis."
    total = stats.get("analyzed_source_files") or sum(int(r["files"]) for r in rows)
    lines = [
        "Based on analyzed source files in this project "
        f"({total} files), the language mix is:"
    ]
    for r in rows:
        lines.append(f"- {r['language']}: {r['percent']}% ({r['files']} files)")
    lines.append("")
    lines.append(
        "Shares are by file count among recognized source extensions, and add up to 100%."
    )
    return "\n".join(lines)


def _verify_reply(
    question: str,
    draft: str,
    tool_snippets: list[str],
    stats: dict[str, Any],
) -> str:
    """Second LLM pass: keep the agent voice, but pin hard facts (esp. stack %)."""
    if _is_stack_percent_question(question):
        rows = [r for r in (stats.get("by_language") or []) if int(r.get("files") or 0) > 0]
        allowed = "\n".join(
            f"- {r['language']}: {r['percent']}% ({r['files']} files)" for r in rows
        ) or "(no source languages found)"
        total = stats.get("analyzed_source_files") or 0
        user = (
            f"User question:\n{question}\n\n"
            f"Draft answer (may be wrong — fix it):\n{draft}\n\n"
            f"ALLOWED language shares (file-count basis, {total} analyzed files):\n{allowed}\n\n"
            "Rewrite as a natural assistant reply.\n"
            "Rules: use ONLY the languages listed above; do not invent other stacks; "
            "do not say 0%, N/A, or not applicable; do not mention tools or verification."
        )
        try:
            return complete(VERIFY_SYSTEM, user).strip() or _format_stack_reply(stats)
        except Exception:
            return _format_stack_reply(stats)

    facts = {
        "language_breakdown": stats,
        "tool_results_excerpt": tool_snippets[:6],
    }
    user = (
        f"User question:\n{question}\n\n"
        f"Draft answer:\n{draft}\n\n"
        f"FACTS (JSON):\n{json.dumps(facts, indent=2)[:6000]}\n\n"
        "Return the final answer only."
    )
    try:
        fixed = complete(VERIFY_SYSTEM, user).strip()
        return fixed or draft
    except Exception:
        return draft


def _detect_diagram_intent(message: str) -> str | None:
    """Return 'use_case' | 'dependency' | 'architecture_layers' when a diagram is requested."""
    text = (message or "").lower()
    if re.search(r"\buse[\s\-]?case\b", text):
        return "use_case"
    if re.search(r"\b(dependenc|import\s+graph|module\s+graph|coupling)\b", text):
        return "dependency"
    if re.search(r"\b(architecture|layer(ed|s)?)\b", text) and re.search(
        r"\b(diagram|visual|draw|show|generat|map|picture|chart)\b",
        text,
    ):
        return "architecture_layers"
    if re.search(r"\barchitecture\s+diagram\b|\blayer(ed)?\s+diagram\b", text):
        return "architecture_layers"
    return None


def _ensure_diagram(
    project_id: str,
    intent: str,
    tools: list,
    diagrams: list[dict[str, Any]],
    unique_tools: list[str],
) -> list[dict[str, Any]]:
    """Ensure architecture/use-case/dependency requests end up with a real diagram."""
    # Architecture: always replace tower / LLM junk with import-coupled layers
    if intent == "architecture_layers":
        project = store.load_project(project_id) or {}
        mermaid, layers, couplings = architecture_from_imports(
            project.get("files") or [],
            project.get("edges") or [],
        )
        if "generate_inferred_diagram" not in unique_tools:
            unique_tools.append("generate_inferred_diagram")
        return [
            {
                "tool": "generate_inferred_diagram",
                "mermaid": mermaid,
                "inferred": False,
                "type": "architecture_layers",
                "layers": layers,
                "couplings": couplings[:20],
                "note": "Architecture from folders + import edges.",
            }
        ]

    # Drop fake towers if somehow present
    diagrams = [d for d in diagrams if not looks_like_fake_layer_tower(str(d.get("mermaid") or ""))]

    if diagrams:
        return diagrams

    by_name = {t.name: t for t in tools}
    try:
        if intent == "dependency":
            tool = by_name.get("generate_diagram")
            raw = tool.invoke({"scope": "all"}) if tool else ""
            name = "generate_diagram"
        else:
            tool = by_name.get("generate_inferred_diagram")
            raw = (
                tool.invoke({"diagram_type": intent, "scope": "all"}) if tool else ""
            )
            name = "generate_inferred_diagram"
    except Exception:
        return diagrams

    added = collect_diagrams_from_tool_output(name, str(raw))
    if added and name not in unique_tools:
        unique_tools.append(name)
    diagrams.extend(added)
    return diagrams


def run_chat(
    project_id: str,
    message: str,
    history: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    if not llm_configured():
        raise RuntimeError("LLM not configured — set GROQ_API_KEY in .env")

    project = store.load_project(project_id)
    if not project:
        raise ValueError(
            f"No analysis found for project_id={project_id}. Upload and analyze a zip first."
        )

    stats = language_breakdown(project.get("files") or [])
    mix_lines = [
        f"- {r['language']}: {r['percent']}% ({r['files']} files)"
        for r in (stats.get("by_language") or [])
        if int(r.get("files") or 0) > 0
    ] or ["- (none)"]

    tools = build_tools(project_id)
    llm = get_llm().bind_tools(tools)
    tool_node = ToolNode(tools)

    system = SYSTEM_TEMPLATE.format(
        filename=project.get("filename") or project_id,
        file_count=project.get("file_count") or 0,
        edge_count=project.get("edge_count") or 0,
        language_mix="\n".join(mix_lines),
    )

    def agent_node(state: MessagesState) -> dict:
        response = llm.invoke(state["messages"])
        return {"messages": [response]}

    graph = StateGraph(MessagesState)
    graph.add_node("agent", agent_node)
    graph.add_node("tools", tool_node)
    graph.set_entry_point("agent")
    graph.add_conditional_edges("agent", tools_condition)
    graph.add_edge("tools", "agent")
    app = graph.compile()

    seed: list[BaseMessage] = [
        SystemMessage(content=system),
        *_history_to_messages(history),
        HumanMessage(content=message),
    ]

    result = app.invoke({"messages": seed}, config={"recursion_limit": 12})
    messages: list[BaseMessage] = result["messages"]

    tools_used: list[str] = []
    diagrams: list[dict[str, Any]] = []
    tool_snippets: list[str] = []
    for msg in messages:
        if isinstance(msg, AIMessage) and getattr(msg, "tool_calls", None):
            for tc in msg.tool_calls:
                name = tc.get("name") if isinstance(tc, dict) else getattr(tc, "name", None)
                if name:
                    tools_used.append(str(name))
        if isinstance(msg, ToolMessage):
            name = getattr(msg, "name", None) or "tool"
            tools_used.append(str(name))
            content = str(msg.content)
            tool_snippets.append(f"{name}: {content[:1200]}")
            diagrams.extend(collect_diagrams_from_tool_output(str(name), content))

    seen: set[str] = set()
    unique_tools: list[str] = []
    for t in tools_used:
        if t not in seen:
            seen.add(t)
            unique_tools.append(t)

    reply = ""
    for msg in reversed(messages):
        if isinstance(msg, AIMessage) and not getattr(msg, "tool_calls", None):
            reply = _message_text(msg.content)
            if reply:
                break

    if reply:
        for block in extract_mermaid_blocks(reply):
            if not any(d.get("mermaid") == block for d in diagrams):
                diagrams.append(
                    {
                        "tool": "assistant_reply",
                        "mermaid": block,
                        "inferred": True,
                        "type": "from_reply",
                        "note": "Diagram from assistant reply.",
                    }
                )
            reply = re_sub_mermaid_fences(reply)

    if not reply:
        reply = "I looked at the project but could not form a final answer. Try rephrasing."
    else:
        reply = _verify_reply(message, reply, tool_snippets, stats)

    # Always attach/fix diagrams for clear diagram intents
    intent = _detect_diagram_intent(message)
    if intent:
        diagrams = _ensure_diagram(project_id, intent, tools, diagrams, unique_tools)
        if diagrams and not reply.strip():
            reply = "Here's the diagram for this project."
        # Fix agent prose that still describes a fake waterfall stack
        if intent == "architecture_layers" and diagrams:
            coup = diagrams[0].get("couplings") or []
            if coup:
                top = ", ".join(
                    f"{c['from']} -> {c['to']} ({c['import_edges']})" for c in coup[:5]
                )
                reply = (
                    "Architecture for this upload, based on folders and real import links "
                    f"between them. Strongest couplings: {top}. "
                    "Arrow labels are import counts (A -> B means A imports from B)."
                )

    return {
        "reply": reply,
        "diagrams": diagrams,
        "tools_used": unique_tools,
        "project_id": project_id,
    }


def re_sub_mermaid_fences(text: str) -> str:
    cleaned = re.sub(
        r"```(?:mermaid)?\s*[\s\S]*?```",
        "[diagram rendered below]",
        text,
        flags=re.IGNORECASE,
    )
    return cleaned.strip()
