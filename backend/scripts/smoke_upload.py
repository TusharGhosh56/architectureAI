"""Build sample zip and run analysis pipeline once."""

from __future__ import annotations

import json
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from scripts.make_sample_zip import write_sample  # noqa: E402
from app.analysis.pipeline import run_pipeline  # noqa: E402


def main() -> None:
    staging = ROOT / "backend" / "data" / "_sample_src"
    zip_path = ROOT / "backend" / "data" / "sample_project.zip"
    if staging.exists():
        import shutil

        shutil.rmtree(staging)
    staging.mkdir(parents=True)
    write_sample(staging)

    with zipfile.ZipFile(zip_path, "w") as zf:
        for path in staging.rglob("*"):
            if path.is_file():
                zf.write(path, path.relative_to(staging).as_posix())

    print("Running pipeline on", zip_path)
    result = run_pipeline(zip_path, original_filename=zip_path.name)
    preview = {
        "project_id": result["project_id"],
        "file_count": result["file_count"],
        "edge_count": result["edge_count"],
        "important_files": result["important_files"],
        "circular_deps": result["circular_deps"],
        "chunk_count": result["chunk_count"],
        "embedding_error": result.get("embedding_error"),
        "architecture_summary": result["architecture_summary"][:400],
        "diagram_mermaid": result["diagram_mermaid"],
    }
    print(json.dumps(preview, indent=2))


if __name__ == "__main__":
    main()
