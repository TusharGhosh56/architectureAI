"""POST /api/chat — LangGraph tool-calling agent over an analyzed project."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.agents.chat_agent import run_chat

router = APIRouter(prefix="/api", tags=["chat"])


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    project_id: str = Field(default="")
    history: list[ChatMessage] = Field(default_factory=list)


@router.post("/chat")
async def chat(body: ChatRequest) -> dict:
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="message is required")
    if not body.project_id.strip():
        raise HTTPException(
            status_code=400,
            detail="project_id is required — analyze a zip on the landing page first.",
        )

    try:
        result = run_chat(
            project_id=body.project_id.strip(),
            message=body.message.strip(),
            history=[m.model_dump() for m in body.history],
        )
        return {"status": "ok", **result}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Chat agent failed: {exc}") from exc
