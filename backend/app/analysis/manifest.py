"""Project manifest and metadata extractor.

Extracts ground-truth project identity from package.json, README.md,
configuration files, and primary page entrypoints.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class ProjectManifest:
    name: str = ""
    description: str = ""
    framework: str = "unknown"
    dependencies: list[str] = field(default_factory=list)
    entrypoints: list[str] = field(default_factory=list)
    readme_summary: str = ""
    page_titles: list[str] = field(default_factory=list)

    def to_prompt_context(self) -> str:
        parts: list[str] = []
        if self.name:
            parts.append(f"Declared Project Name: {self.name}")
        if self.framework and self.framework != "unknown":
            parts.append(f"Primary Framework/Stack: {self.framework}")
        if self.description:
            parts.append(f"Package Description: {self.description}")
        if self.readme_summary:
            parts.append(f"README Excerpt:\n{self.readme_summary}")
        if self.entrypoints:
            parts.append(f"Key Routes / Pages: {', '.join(self.entrypoints[:8])}")
        if self.page_titles:
            parts.append(f"Page Titles / Headings: {', '.join(self.page_titles[:6])}")
        if self.dependencies:
            parts.append(f"Core Dependencies: {', '.join(self.dependencies[:12])}")
        return "\n".join(parts)


def _clean_markdown(text: str) -> str:
    # Remove HTML tags, image badges, and links markdown
    cleaned = re.sub(r"!\[.*?\]\(.*?\)", "", text)
    cleaned = re.sub(r"\[(.*?)\]\(.*?\)", r"\1", cleaned)
    cleaned = re.sub(r"<[^>]+>", "", cleaned)
    cleaned = re.sub(r"\n\s*\n+", "\n\n", cleaned).strip()
    return cleaned[:1200]


def extract_manifest(root: Path) -> ProjectManifest:
    manifest = ProjectManifest()

    # 1. Inspect package.json
    for pkg_path in [root / "package.json", *root.glob("*/package.json")]:
        if pkg_path.is_file():
            try:
                data = json.loads(pkg_path.read_text(encoding="utf-8", errors="replace"))
                manifest.name = data.get("name", manifest.name)
                manifest.description = data.get("description", manifest.description)
                deps = list(data.get("dependencies", {}).keys())
                dev_deps = list(data.get("devDependencies", {}).keys())
                all_deps = deps + dev_deps
                manifest.dependencies = deps if deps else dev_deps

                if "astro" in all_deps:
                    manifest.framework = "Astro"
                elif "next" in all_deps:
                    manifest.framework = "Next.js"
                elif "nuxt" in all_deps:
                    manifest.framework = "Nuxt"
                elif "svelte" in all_deps or "@sveltejs/kit" in all_deps:
                    manifest.framework = "Svelte"
                elif "vue" in all_deps:
                    manifest.framework = "Vue"
                elif "react" in all_deps or "react-dom" in all_deps:
                    manifest.framework = "React"
                break
            except Exception:
                pass

    # 2. Inspect Python requirements / pyproject
    if not manifest.framework or manifest.framework == "unknown":
        pyproject = root / "pyproject.toml"
        if pyproject.is_file():
            content = pyproject.read_text(encoding="utf-8", errors="replace")
            if "fastapi" in content.lower():
                manifest.framework = "FastAPI (Python)"
            elif "django" in content.lower():
                manifest.framework = "Django (Python)"
            elif "flask" in content.lower():
                manifest.framework = "Flask (Python)"

    # 3. Inspect README.md
    for name in ["README.md", "readme.md", "README.txt", "README"]:
        readme_path = root / name
        if readme_path.is_file():
            try:
                content = readme_path.read_text(encoding="utf-8", errors="replace")
                manifest.readme_summary = _clean_markdown(content)
                break
            except Exception:
                pass

    # 4. Find page entrypoints, layouts & headings
    page_files: list[Path] = []
    for pattern in ["pages/**/*", "src/pages/**/*", "app/**/*", "src/app/**/*", "src/layouts/**/*", "layouts/**/*"]:
        for p in root.glob(pattern):
            if p.is_file() and p.suffix.lower() in {".astro", ".tsx", ".jsx", ".vue", ".html", ".svelte"}:
                page_files.append(p)

    # Also check hero / header components for main titles
    for pattern in ["src/components/Hero*/**/*", "src/components/Header*/**/*"]:
        for p in root.glob(pattern):
            if p.is_file() and p.suffix.lower() in {".astro", ".tsx", ".jsx", ".vue", ".html"}:
                page_files.append(p)

    entrypoints: list[str] = []
    titles: list[str] = []

    for pf in page_files[:15]:
        try:
            rel = pf.relative_to(root).as_posix()
            if "pages/" in rel or "app/" in rel:
                entrypoints.append(rel)
            text = pf.read_text(encoding="utf-8", errors="replace")
            # Look for <title>...</title>
            m_title = re.search(r"<title[^>]*>(.*?)</title>", text, re.IGNORECASE | re.DOTALL)
            if m_title:
                t_str = m_title.group(1).strip()
                if t_str and t_str not in titles:
                    titles.append(t_str)
            # Look for default title prop like title = '...'
            m_title_prop = re.search(r"title\s*=\s*['\"]([^'\"]{8,})['\"]", text)
            if m_title_prop:
                t_str = m_title_prop.group(1).strip()
                if t_str and t_str not in titles:
                    titles.append(t_str)
            # Look for description = '...'
            m_desc_prop = re.search(r"description\s*=\s*['\"]([^'\"]{15,})['\"]", text)
            if m_desc_prop and not manifest.description:
                manifest.description = m_desc_prop.group(1).strip()
            # Look for <h1>...</h1> or h1 headings
            m_h1 = re.search(r"<h1[^>]*>(.*?)</h1>", text, re.IGNORECASE | re.DOTALL)
            if m_h1:
                cleaned_h1 = re.sub(r"<[^>]+>", "", m_h1.group(1)).strip()
                cleaned_h1 = re.sub(r"\s+", " ", cleaned_h1)
                if cleaned_h1 and cleaned_h1 not in titles:
                    titles.append(cleaned_h1)
        except Exception:
            pass

    manifest.entrypoints = entrypoints
    manifest.page_titles = titles
    return manifest
