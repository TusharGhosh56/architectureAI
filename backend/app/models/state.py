from typing import NotRequired, TypedDict


class AnalysisState(TypedDict):
    project_path: str
    files: list[str]
    # NetworkX DiGraph is stored separately after analysis; keep serializable fields here.
    important_files: list[str]
    circular_deps: list[list[str]]
    diagram_mermaid: str
    architecture_summary: str


class ChatState(TypedDict):
    messages: list[dict]
    project_id: str
    pending_tool_call: NotRequired[dict | None]
    tool_result: NotRequired[dict | None]
