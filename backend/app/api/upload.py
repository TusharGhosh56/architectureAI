"""POST /api/upload — extract zip and run analysis pipeline synchronously."""

from __future__ import annotations

import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.analysis.extract import UnsafeZipError
from app.analysis.pipeline import run_pipeline

router = APIRouter(tags=["upload"])


@router.post("/api/upload")
@router.post("/upload")
async def upload_project(file: UploadFile = File(...)) -> dict:
    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Please upload a .zip file.")

    tmp_dir = Path(tempfile.mkdtemp(prefix="architectai_upload_"))
    zip_path = tmp_dir / file.filename
    try:
        with zip_path.open("wb") as out:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                out.write(chunk)

        result = run_pipeline(zip_path, original_filename=file.filename)
        return {
            "status": "ok",
            "project_id": result["project_id"],
            "filename": result["filename"],
            "file_count": result["file_count"],
            "python_file_count": result["python_file_count"],
            "js_file_count": result["js_file_count"],
            "edge_count": result["edge_count"],
            "important_files": result["important_files"],
            "circular_deps": result["circular_deps"],
            "diagram_mermaid": result["diagram_mermaid"],
            "architecture_summary": result["architecture_summary"],
            "chunk_count": result["chunk_count"],
            "truncated": result.get("truncated", False),
        }
    except UnsafeZipError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {exc}") from exc
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
