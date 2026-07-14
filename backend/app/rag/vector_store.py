"""ChromaDB PersistentClient wrapper for code chunks."""

from __future__ import annotations

from typing import Any

import chromadb
from chromadb.config import Settings as ChromaSettings

from app.config import get_settings
from app.rag.chunker import CodeChunk
from app.rag.embedder import embed_query, embed_texts


class VectorStore:
    def __init__(self, project_id: str) -> None:
        settings = get_settings()
        self.project_id = project_id
        self.client = chromadb.PersistentClient(
            path=str(settings.chroma_dir),
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        self.collection = self.client.get_or_create_collection(
            name=f"project_{project_id}",
            metadata={"hnsw:space": "cosine"},
        )

    def reset(self) -> None:
        name = self.collection.name
        self.client.delete_collection(name)
        self.collection = self.client.get_or_create_collection(
            name=name,
            metadata={"hnsw:space": "cosine"},
        )

    def index_chunks(self, chunks: list[CodeChunk]) -> int:
        if not chunks:
            return 0
        self.reset()
        ids = [c.chunk_id for c in chunks]
        documents = [c.text for c in chunks]
        embeddings = embed_texts(documents)
        metadatas: list[dict[str, Any]] = [
            {
                "file": c.file,
                "name": c.name,
                "kind": c.kind,
                "start_line": c.start_line,
                "end_line": c.end_line,
                "parent_class": c.parent_class or "",
            }
            for c in chunks
        ]
        # Chroma batch size friendly chunks
        batch = 64
        for i in range(0, len(ids), batch):
            self.collection.add(
                ids=ids[i : i + batch],
                documents=documents[i : i + batch],
                embeddings=embeddings[i : i + batch],
                metadatas=metadatas[i : i + batch],
            )
        return len(ids)

    def search(self, query: str, k: int = 5) -> list[dict[str, Any]]:
        if self.collection.count() == 0:
            return []
        q_emb = embed_query(query)
        result = self.collection.query(
            query_embeddings=[q_emb],
            n_results=min(k, max(1, self.collection.count())),
            include=["documents", "metadatas", "distances"],
        )
        hits: list[dict[str, Any]] = []
        docs = (result.get("documents") or [[]])[0]
        metas = (result.get("metadatas") or [[]])[0]
        dists = (result.get("distances") or [[]])[0]
        ids = (result.get("ids") or [[]])[0]
        for i, doc in enumerate(docs):
            hits.append(
                {
                    "id": ids[i] if i < len(ids) else "",
                    "text": doc,
                    "metadata": metas[i] if i < len(metas) else {},
                    "distance": dists[i] if i < len(dists) else None,
                }
            )
        return hits


def search_codebase(project_id: str, query: str, k: int = 5) -> list[dict[str, Any]]:
    return VectorStore(project_id).search(query, k=k)
