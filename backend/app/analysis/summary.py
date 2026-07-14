"""Architecture summary via Groq (or Ollama) using important files + RAG hits."""

from __future__ import annotations

from app.llm.client import complete, llm_configured
from app.rag.vector_store import search_codebase


SYSTEM = (
    "You are a software architect. Summarize the uploaded codebase in 4-8 short sentences. "
    "Be concrete: mention main modules, layering, and likely purpose. "
    "ONLY discuss files and modules listed in the user message. "
    "Never invent or mention other repositories, cloned projects, or paths not listed. "
    "No markdown headings."
)


def generate_architecture_summary(
    project_id: str,
    important: list[str],
    file_count: int,
    circular_deps: list[list[str]],
) -> str:
    if not llm_configured():
        return (
            "LLM not configured — set GROQ_API_KEY in .env to generate an architecture summary. "
            f"Analyzed {file_count} source files. Core files: {', '.join(important[:5]) or 'n/a'}."
        )

    rag_bits: list[str] = []
    try:
        hits = search_codebase(project_id, "application entrypoint main architecture", k=4)
        for h in hits:
            meta = h.get("metadata") or {}
            snippet = (h.get("text") or "")[:500]
            rag_bits.append(
                f"- {meta.get('file')}::{meta.get('name')}\n{snippet}"
            )
    except Exception:
        pass

    user = (
        f"Source files analyzed: {file_count}\n"
        f"Most central / depended-upon files:\n"
        + "\n".join(f"- {f}" for f in important[:12])
        + "\n\nCircular dependencies: "
        + (str(circular_deps[:5]) if circular_deps else "none detected")
        + "\n\nRelevant code excerpts:\n"
        + ("\n\n".join(rag_bits) if rag_bits else "(none)")
    )
    try:
        return complete(SYSTEM, user)
    except Exception as exc:
        return f"Summary generation failed ({exc}). Core files: {', '.join(important[:5]) or 'n/a'}."
