"""Verify nested data/repos clones are ignored."""

from __future__ import annotations

import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.analysis.ignore import analysis_roots, iter_files_with_suffixes, path_is_ignored  # noqa: E402
from app.analysis.pipeline import run_pipeline  # noqa: E402


def main() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        base = Path(tmp) / "proj"
        (base / "app").mkdir(parents=True)
        (base / "app" / "main.py").write_text("from app.db import x\n", encoding="utf-8")
        (base / "app" / "db.py").write_text("x = 1\n", encoding="utf-8")
        nested = base / "data" / "repos" / "TusharGhosh56" / "EcoFresh" / "src"
        nested.mkdir(parents=True)
        (nested / "App.tsx").write_text("export const App = () => null;\n", encoding="utf-8")
        fit = base / "data" / "repos" / "TusharGhosh56" / "Fit_Club" / "src"
        fit.mkdir(parents=True)
        (fit / "firebase.js").write_text("export default {};\n", encoding="utf-8")

        assert path_is_ignored("data/repos/TusharGhosh56/EcoFresh/src/App.tsx")
        assert not path_is_ignored("app/main.py")
        roots = analysis_roots(base)
        assert any(r.name == "app" for r in roots), roots

        files = iter_files_with_suffixes(base, {".py", ".ts", ".tsx", ".js"})
        rels = [p.relative_to(base).as_posix() for p in files]
        assert all("data/repos" not in r for r in rels), rels
        assert "app/main.py" in rels

        zip_path = Path(tmp) / "proj.zip"
        with zipfile.ZipFile(zip_path, "w") as zf:
            for p in base.rglob("*"):
                if p.is_file():
                    zf.write(p, p.relative_to(base).as_posix())

        result = run_pipeline(zip_path, "proj.zip")
        assert result["ignored_nested_repos"] is True, result
        assert all("data/repos" not in f for f in result["files"]), result["files"]
        assert all("EcoFresh" not in f and "Fit_Club" not in f for f in result["important_files"])
        assert "EcoFresh" not in result["diagram_mermaid"]
        assert "Fit_Club" not in result["diagram_mermaid"]
        print("OK", result["files"], result["important_files"])


if __name__ == "__main__":
    main()
