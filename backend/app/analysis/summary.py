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
    if not llm_configured():
        return (
            "LLM not configured — set GEMINI_API_KEY in .env to generate an architecture summary. "
            f"Analyzed {file_count} source files. Core files: {', '.join(important[:5]) or 'n/a'}."
        )

    manifest_context = manifest.to_prompt_context() if manifest else ""

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
        return f"Summary generation failed ({exc}). Core files: {', '.join(important[:5]) or 'n/a'}."
