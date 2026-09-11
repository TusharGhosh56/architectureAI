"""Zero-dependency, high-performance in-memory + file-cached BM25 Code Store.

Replaces ChromaDB and onnxruntime with a pure-Python, zero-C-extension engine
optimized specifically for codebases, symbols, and docstrings.
"""

from __future__ import annotations

import json
import math
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from app.config import get_settings
from app.rag.chunker import CodeChunk
from app.rag.embedder import tokenize

# In-memory store cache across requests in the same process
_ACTIVE_STORES: dict[str, VectorStore] = {}


class VectorStore:
    def __init__(self, project_id: str) -> None:
        self.project_id = project_id
        self.chunks: list[dict[str, Any]] = []
        self.doc_term_freqs: list[Counter[str]] = []
        self.doc_lengths: list[int] = []
        self.doc_freqs: dict[str, int] = defaultdict(int)
        self.avg_doc_len: float = 0.0

        # Try to restore from disk cache if not in memory
        self._load_from_disk()

    @property
    def _storage_path(self) -> Path:
        settings = get_settings()
        chunks_dir = settings.data_dir / "chunks"
        chunks_dir.mkdir(parents=True, exist_ok=True)
        return chunks_dir / f"{self.project_id}.json"

    def reset(self) -> None:
        self.chunks = []
        self.doc_term_freqs = []
        self.doc_lengths = []
        self.doc_freqs = defaultdict(int)
        self.avg_doc_len = 0.0
        path = self._storage_path
        if path.exists():
            try:
                path.unlink()
            except OSError:
                pass

    def index_chunks(self, chunks: list[CodeChunk]) -> int:
        if not chunks:
            self.reset()
            return 0

        self.reset()
        for chunk in chunks:
            meta = {
                "file": chunk.file,
                "name": chunk.name,
                "kind": chunk.kind,
                "start_line": chunk.start_line,
                "end_line": chunk.end_line,
                "parent_class": chunk.parent_class or "",
            }
            # Field-weighted tokens for code relevance
            name_tokens = tokenize(chunk.name) * 4
            file_tokens = tokenize(chunk.file) * 2
            parent_tokens = tokenize(chunk.parent_class or "") * 2
            body_tokens = tokenize(chunk.text)

            combined_tokens = name_tokens + file_tokens + parent_tokens + body_tokens
            tf = Counter(combined_tokens)
            doc_len = len(combined_tokens)

            for term in set(tf.keys()):
                self.doc_freqs[term] += 1

            self.chunks.append(
                {
                    "id": chunk.chunk_id,
                    "text": chunk.text,
                    "metadata": meta,
                }
            )
            self.doc_term_freqs.append(tf)
            self.doc_lengths.append(doc_len)

        n = len(self.chunks)
        self.avg_doc_len = sum(self.doc_lengths) / max(1, n)

        self._save_to_disk()
        _ACTIVE_STORES[self.project_id] = self
        return n

    def search(self, query: str, k: int = 5) -> list[dict[str, Any]]:
        n = len(self.chunks)
        if n == 0:
            return []

        q_tokens = tokenize(query)
        if not q_tokens:
            return self.chunks[:k]

        q_terms = Counter(q_tokens)
        scores: list[float] = [0.0] * n

        k1 = 1.5
        b = 0.75

        for term, q_tf in q_terms.items():
            df = self.doc_freqs.get(term, 0)
            if df == 0:
                continue

            # Standard BM25 IDF with smoothing
            idf = math.log(1.0 + (n - df + 0.5) / (df + 0.5))

            for idx in range(n):
                doc_tf = self.doc_term_freqs[idx].get(term, 0)
                if doc_tf == 0:
                    continue

                doc_len = self.doc_lengths[idx]
                denom = doc_tf + k1 * (1.0 - b + b * (doc_len / max(1.0, self.avg_doc_len)))
                term_score = idf * (doc_tf * (k1 + 1.0)) / denom
                scores[idx] += term_score

                # Exact symbol match boost
                meta = self.chunks[idx]["metadata"]
                if term in meta.get("name", "").lower():
                    scores[idx] += 3.0
                if term in meta.get("file", "").lower():
                    scores[idx] += 1.5

        ranked_indices = sorted(
            [i for i in range(n) if scores[i] > 0],
            key=lambda i: scores[i],
            reverse=True,
        )

        # Fallback to first few if no token matches occurred
        if not ranked_indices:
            ranked_indices = list(range(min(k, n)))

        hits: list[dict[str, Any]] = []
        for idx in ranked_indices[:k]:
            hits.append(
                {
                    "id": self.chunks[idx]["id"],
                    "text": self.chunks[idx]["text"],
                    "metadata": self.chunks[idx]["metadata"],
                    "distance": round(1.0 / (1.0 + scores[idx]), 4) if scores[idx] > 0 else 1.0,
                    "score": round(scores[idx], 4),
                }
            )
        return hits

    def _save_to_disk(self) -> None:
        try:
            data = {
                "chunks": self.chunks,
                "avg_doc_len": self.avg_doc_len,
            }
            self._storage_path.write_text(json.dumps(data), encoding="utf-8")
        except OSError:
            pass

    def _load_from_disk(self) -> None:
        path = self._storage_path
        if not path.exists():
            return
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            raw_chunks = data.get("chunks", [])
            if not raw_chunks:
                return

            self.chunks = raw_chunks
            self.doc_term_freqs = []
            self.doc_lengths = []
            self.doc_freqs = defaultdict(int)

            for chunk in self.chunks:
                meta = chunk.get("metadata", {})
                name_tokens = tokenize(meta.get("name", "")) * 4
                file_tokens = tokenize(meta.get("file", "")) * 2
                parent_tokens = tokenize(meta.get("parent_class", "")) * 2
                body_tokens = tokenize(chunk.get("text", ""))

                combined_tokens = name_tokens + file_tokens + parent_tokens + body_tokens
                tf = Counter(combined_tokens)
                for term in set(tf.keys()):
                    self.doc_freqs[term] += 1

                self.doc_term_freqs.append(tf)
                self.doc_lengths.append(len(combined_tokens))

            self.avg_doc_len = data.get(
                "avg_doc_len",
                sum(self.doc_lengths) / max(1, len(self.chunks)),
            )
        except Exception:
            pass


def get_vector_store(project_id: str) -> VectorStore:
    if project_id not in _ACTIVE_STORES:
        _ACTIVE_STORES[project_id] = VectorStore(project_id)
    return _ACTIVE_STORES[project_id]


def search_codebase(project_id: str, query: str, k: int = 5) -> list[dict[str, Any]]:
    return get_vector_store(project_id).search(query, k=k)
