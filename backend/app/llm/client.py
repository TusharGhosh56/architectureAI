"""LLM client — Groq free tier primary, optional Ollama fallback.

Zero langchain dependencies for ultra-lightweight, fast execution on serverless.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any

from app.config import get_settings


@lru_cache
def get_groq_client() -> Any:
    settings = get_settings()
    if not settings.groq_api_key:
        raise RuntimeError(
            "GROQ_API_KEY is missing. Add it to .env or set USE_OLLAMA=true."
        )

    from groq import Groq

    return Groq(api_key=settings.groq_api_key)


def llm_configured() -> bool:
    settings = get_settings()
    return bool(settings.gemini_api_key) or bool(settings.groq_api_key) or settings.use_ollama


def complete_gemini(system: str, user: str, model: str | None = None) -> str:
    """Call Google Gemini generateContent REST API via httpx."""
    import httpx

    settings = get_settings()
    api_key = settings.gemini_api_key.strip()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is missing.")

    # Sanitize model name (e.g. gemini-2.0-flash or gemini-1.5-flash)
    raw_model = model or settings.gemini_model or "gemini-2.0-flash"
    if "gemini" not in raw_model.lower():
        raw_model = "gemini-2.0-flash"

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{raw_model}:generateContent"

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": user}],
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
        },
    }

    if system:
        payload["systemInstruction"] = {
            "parts": [{"text": system}]
        }

    with httpx.Client(timeout=60.0) as client:
        resp = client.post(
            url,
            params={"key": api_key},
            json=payload,
            headers={"Content-Type": "application/json"},
        )
        if resp.status_code != 200:
            for fallback in ["gemini-2.0-flash", "gemini-1.5-flash"]:
                if raw_model != fallback:
                    resp = client.post(
                        f"https://generativelanguage.googleapis.com/v1beta/models/{fallback}:generateContent",
                        params={"key": api_key},
                        json=payload,
                        headers={"Content-Type": "application/json"},
                    )
                    if resp.status_code == 200:
                        break
        resp.raise_for_status()
        data = resp.json()

    candidates = data.get("candidates") or []
    if not candidates:
        return ""
    parts = candidates[0].get("content", {}).get("parts", [])
    texts = [p.get("text", "") for p in parts if "text" in p]
    return "".join(texts).strip()


def complete(system: str, user: str) -> str:
    """Single-turn completion for pipeline summary calls."""
    settings = get_settings()

    # 1. Prefer Gemini if configured
    if settings.gemini_api_key:
        try:
            return complete_gemini(system, user)
        except Exception as exc:
            # If Gemini fails, fallback to Groq/Ollama if available
            if not (settings.groq_api_key or settings.use_ollama):
                raise

    # 2. Ollama
    if settings.use_ollama:
        import httpx

        resp = httpx.post(
            f"{settings.ollama_base_url}/api/chat",
            json={
                "model": settings.ollama_model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "stream": False,
                "options": {"temperature": 0.2},
            },
            timeout=60.0,
        )
        resp.raise_for_status()
        return resp.json()["message"]["content"].strip()

    # 3. Groq
    client = get_groq_client()
    response = client.chat.completions.create(
        model=settings.groq_model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.2,
    )
    return (response.choices[0].message.content or "").strip()
