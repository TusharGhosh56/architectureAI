"""LLM client — Groq free tier primary, optional Ollama fallback."""

from __future__ import annotations

from functools import lru_cache

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage

from app.config import get_settings


@lru_cache
def get_llm() -> BaseChatModel:
    settings = get_settings()

    if settings.use_ollama:
        try:
            from langchain_ollama import ChatOllama
        except ImportError as exc:
            raise RuntimeError(
                "USE_OLLAMA=true but langchain-ollama is not installed. "
                "pip install langchain-ollama"
            ) from exc
        return ChatOllama(model=settings.ollama_model, temperature=0.2)

    if not settings.groq_api_key:
        raise RuntimeError(
            "GROQ_API_KEY is missing. Add it to .env or set USE_OLLAMA=true."
        )

    from langchain_groq import ChatGroq

    return ChatGroq(
        api_key=settings.groq_api_key,
        model=settings.groq_model,
        temperature=0.2,
    )


def llm_configured() -> bool:
    settings = get_settings()
    return bool(settings.groq_api_key) or settings.use_ollama


def complete(system: str, user: str) -> str:
    """Single-turn completion for pipeline summary calls."""
    llm = get_llm()
    response = llm.invoke(
        [SystemMessage(content=system), HumanMessage(content=user)]
    )
    content = response.content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict) and "text" in block:
                parts.append(str(block["text"]))
        return "".join(parts).strip()
    return str(content).strip()
