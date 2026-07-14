"""Programmatic Mermaid diagram from a NetworkX dependency graph."""

from __future__ import annotations

import re

import networkx as nx


def _safe_id(path: str) -> str:
    """Mermaid node id — alphanumeric/underscore only."""
    cleaned = re.sub(r"[^a-zA-Z0-9_]", "_", path)
    if cleaned and cleaned[0].isdigit():
        cleaned = f"n_{cleaned}"
    return cleaned or "empty"


def _label(path: str) -> str:
    # Prefer basename for readability; keep package hint
    return path.replace('"', "'")


def generate_mermaid(
    graph: nx.DiGraph,
    scope: str | None = None,
    max_nodes: int = 60,
) -> str:
    """
    Build a flowchart LR from real graph edges.
    Optional scope filters nodes whose path contains the substring (case-insensitive).
    """
    nodes = list(graph.nodes())
    if scope and scope.strip() and scope.strip().lower() != "all":
        needle = scope.strip().lower()
        scoped = {n for n in nodes if needle in n.lower()}
        # Include one-hop neighbors so the scoped subgraph has context
        neighbors: set[str] = set()
        for n in scoped:
            neighbors.update(graph.predecessors(n))
            neighbors.update(graph.successors(n))
        nodes = sorted(scoped | neighbors)

    if len(nodes) > max_nodes:
        # Prefer high in-degree nodes when truncating
        centrality = nx.in_degree_centrality(graph) if graph.number_of_nodes() else {}
        nodes = sorted(nodes, key=lambda n: centrality.get(n, 0), reverse=True)[:max_nodes]

    node_set = set(nodes)
    lines = ["flowchart LR"]

    for n in nodes:
        nid = _safe_id(n)
        lines.append(f'  {nid}["{_label(n)}"]')

    for u, v in graph.edges():
        if u in node_set and v in node_set:
            lines.append(f"  {_safe_id(u)} --> {_safe_id(v)}")

    if len(lines) == 1:
        lines.append('  empty["No internal dependencies found"]')

    return "\n".join(lines)
