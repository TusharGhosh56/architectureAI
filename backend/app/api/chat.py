from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api", tags=["chat"])


class ChatRequest(BaseModel):
    message: str
    project_id: str = Field(default="default")


@router.post("/chat")
async def chat(body: ChatRequest) -> dict:
    """Stub — Day 3 wires the LangGraph tool-calling agent here."""
    return {
        "status": "not_implemented",
        "message": "Chat agent comes in Day 3.",
        "echo": body.message,
        "project_id": body.project_id,
    }
