"""Lightweight pure-Python text embedding & tokenization utilities.

Zero PyTorch, zero sentence-transformers, zero C-extensions.
"""

from __future__ import annotations

import math
import re
from collections import Counter
from typing import Sequence

# Regex for splitting camelCase, PascalCase, snake_case, and non-alphanumeric words
_TOKEN_RE = re.compile(r"[A-Z]?[a-z]+|[A-Z]+(?=[A-Z][a-z]|\b)|\d+|\w+")


def tokenize(text: str) -> list[str]:
    """Extract lowercase search tokens with snake_case and camelCase splitting."""
    if not text:
        return []
    tokens: list[str] = []
    for raw in _TOKEN_RE.findall(text):
        lowered = raw.lower()
        if len(lowered) > 1 or lowered.isalnum():
            tokens.append(lowered)
    return tokens


def term_frequencies(text: str) -> Counter[str]:
    """Calculate term frequencies for a given text."""
    return Counter(tokenize(text))


def cosine_similarity(vec1: dict[str, float], vec2: dict[str, float]) -> float:
    """Compute cosine similarity between two sparse vector dicts."""
    intersection = set(vec1.keys()) & set(vec2.keys())
    if not intersection:
        return 0.0

    dot = sum(vec1[k] * vec2[k] for k in intersection)
    norm1 = math.sqrt(sum(v * v for v in vec1.values()))
    norm2 = math.sqrt(sum(v * v for v in vec2.values()))

    if norm1 == 0.0 or norm2 == 0.0:
        return 0.0
    return dot / (norm1 * norm2)


def embed_texts(texts: Sequence[str]) -> list[list[float]]:
    """
    Lightweight placeholder for dense vector interface compatibility.
    Returns pseudo-dense normalized hash-projected vectors without PyTorch.
    """
    dimension = 64
    results: list[list[float]] = []
    for text in texts:
        tokens = tokenize(text)
        vec = [0.0] * dimension
        if not tokens:
            results.append(vec)
            continue
        for token in tokens:
            h = hash(token) % dimension
            vec[h] += 1.0
        norm = math.sqrt(sum(x * x for x in vec))
        if norm > 0:
            vec = [x / norm for x in vec]
        results.append(vec)
    return results


def embed_query(query: str) -> list[float]:
    """Dense vector interface compatibility for a single query."""
    return embed_texts([query])[0]
