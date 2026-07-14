from fastapi import APIRouter, File, UploadFile

router = APIRouter(prefix="/api", tags=["upload"])


@router.post("/upload")
async def upload_project(file: UploadFile = File(...)) -> dict:
    """Stub — Day 1 wires zip extract + analysis pipeline here."""
    return {
        "status": "not_implemented",
        "message": "Upload pipeline comes in Day 1.",
        "filename": file.filename,
    }
