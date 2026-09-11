from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.agents.chat_agent import run_chat_agent

router = APIRouter(prefix="/api", tags=["chat"])


class ChatRequest(BaseModel):
    message: str
    project_id: str = Field(default="default")
    analysis: dict[str, Any] | None = None


@router.post("/chat")
async def chat(body: ChatRequest) -> dict:
    """Agentic chat endpoint with tool-calling support."""
    result = run_chat_agent(
        message=body.message,
        project_id=body.project_id,
        fallback_analysis=body.analysis,
    )
    return {
        "status": "ok",
        "message": result.get("message", ""),
        "mermaid": result.get("mermaid"),
        "inferred": result.get("inferred", False),
        "project_id": body.project_id,
    }
