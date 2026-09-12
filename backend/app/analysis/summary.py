from __future__ import annotations

from typing import TYPE_CHECKING

from app.llm.client import complete, llm_configured
from app.rag.vector_store import search_codebase

if TYPE_CHECKING:
    from app.analysis.manifest import ProjectManifest


SYSTEM = (
    "You are a software architect. Summarize the uploaded codebase in 4-8 clear, cohesive sentences. "
    "Identify the true identity and primary purpose of the project based on the manifest, framework, and entrypoints. "
    "Do NOT confuse a sub-component, utility script, or animation module with the main application purpose. "
    "Mention key modules, layering, technology stack, and architectural characteristics. "
    "No markdown headings, no bullet lists — write fluent explanatory paragraphs."
)


def generate_architecture_summary(
    project_id: str,
    important: list[str],
    file_count: int,
    circular_deps: list[list[str]],
    manifest: ProjectManifest | None = None,
) -> str:
    manifest_context = manifest.to_prompt_context() if manifest else ""
    framework = manifest.framework if manifest and manifest.framework else "modular"
    pkg_name = manifest.name if manifest and manifest.name else ""

    def build_heuristic_summary(note: str = "") -> str:
        core_preview = ", ".join(important[:6]) if important else "distributed across source files"
        loop_status = (
            f"{len(circular_deps)} circular dependency cycle(s) detected"
            if circular_deps
            else "Clean dependency hierarchy with zero circular dependency loops"
        )
        base = (
            f"Codebase consists of {file_count} source files structured around a {framework} architecture"
            + (f" ({pkg_name})." if pkg_name else ".")
            + f" Top-ranked central components by dependency in-degree: {core_preview}. {loop_status}."
        )
        if note:
            return f"{base}\n\n(AI note: {note} — verify GROQ_API_KEY or GEMINI_API_KEY in backend environment variables for generative narrative summaries)."
        return base

    if not llm_configured():
        return build_heuristic_summary("LLM API key not configured")

    rag_bits: list[str] = []
    try:
        hits = search_codebase(project_id, "application entrypoint main architecture layout", k=4)
        for h in hits:
            meta = h.get("metadata") or {}
            snippet = (h.get("text") or "")[:500]
            rag_bits.append(
                f"- {meta.get('file')}::{meta.get('name')}\n{snippet}"
            )
    except Exception:
        pass

    prompt_parts = [
        f"Total source files analyzed: {file_count}",
    ]
    if manifest_context:
        prompt_parts.append(f"Ground Truth Project Identity:\n{manifest_context}")

    prompt_parts.append(
        "Key central/depended-upon files:\n"
        + "\n".join(f"- {f}" for f in important[:12])
    )

    prompt_parts.append(
        "Circular dependencies: "
        + (str(circular_deps[:5]) if circular_deps else "none detected")
    )

    if rag_bits:
        prompt_parts.append("Relevant code excerpts:\n" + "\n\n".join(rag_bits))

    user = "\n\n".join(prompt_parts)
    try:
        return complete(SYSTEM, user)
    except Exception as exc:
        err_msg = str(exc)
        if "401" in err_msg or "invalid_api_key" in err_msg.lower():
            note = "Configured API key is invalid or expired"
        elif "429" in err_msg or "rate" in err_msg.lower():
            note = "API rate limit reached"
        else:
            note = "LLM provider unreachable"
        return build_heuristic_summary(note)
