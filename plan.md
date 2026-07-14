# ArchitectAI — Build Plan

## 0. What this project actually is

A learning project. The goal is to personally understand — and be able to build again from
scratch, and explain in an interview — four things:

1. AST-based static analysis → dependency graphs
2. RAG (chunking, embeddings, vector search) over a codebase
3. Multi-agent orchestration with LangGraph (shared state, conditional routing)
4. Agentic tool-calling (an LLM deciding which tool to call based on a chat message)

Everything else in this doc exists only in service of those four things. Do not add
infrastructure, polish, or features that don't teach one of them. If you (the coding agent)
find yourself building something not justified by the list above, stop and ask.

**Non-goals:** no auth, no multi-user, no paid APIs, no deployment, no Celery/Redis/Postgres,
no production security hardening, no support for languages beyond Python (+ minimal JS/TS
import extraction — see Day scope below).

**Cost constraint: $0.** Every model call must run on a free tier or fully local model.

---

## 1. Tech stack (all free)

| Layer | Choice | Why |
|---|---|---|
| Language | Python 3.12+ | AST module builtin |
| Backend API | FastAPI | needed to serve the React frontend + stream chat |
| Storage | SQLite (or plain JSON files on disk) | single user, no need for Postgres |
| Graph | NetworkX | standard, simple API |
| Python parsing | builtin `ast` module | zero setup |
| JS/TS parsing (minimal) | `tree-sitter` + `tree-sitter-javascript`/`tree-sitter-typescript` | only for import extraction, not full chunking |
| Embeddings | `sentence-transformers` (`all-MiniLM-L6-v2`) | local, free, fast enough |
| Vector DB | ChromaDB, embedded/local mode (`PersistentClient`) | no server to run |
| LLM | Groq free tier (e.g. `llama-3.1-8b-instant`) as primary, Ollama local model as offline fallback | free, fast, supports function/tool calling |
| Orchestration | LangGraph | the whole point of the project |
| Frontend | React (minimal, 2 pages) | requested explicitly — keep it small |

No OpenAI, no Qdrant, no cloud vector DB, no paid tier of anything.

---

## 2. Product scope — 2 pages only

**Page 1 — Landing / Upload**
- Single dropzone/button: upload a `.zip` of a project.
- On upload: backend extracts it, kicks off the analysis pipeline synchronously (no job
  queue — just show a loading state in the UI while the request is in flight).
- When analysis finishes, show a "Go to chat" button that navigates to Page 2.
- Also show, inline on this page once done: the generated dependency diagram (Mermaid,
  rendered) and a short architecture summary. This is the "wow, it worked" moment before
  they even open chat.

**Page 2 — Chat**
- A normal chat UI (message list + input box).
- The LLM has access to tools (see §6). User can ask things like:
  - "What does this project do?"
  - "Generate a graph for the auth module"
  - "What files depend on database.py?"
  - "Are there any circular dependencies?"
- Responses stream back; if a tool call produces a diagram, render it as Mermaid inline in
  the chat, not just as text.

That's it. No dashboard, no project list, no accounts. One project per run of the app is fine.

---

## 3. High-level architecture

```
React (2 pages)
   |
   |  REST + one chat endpoint (SSE or simple polling, no need for websockets)
   v
FastAPI backend
   |
   |-- /upload        -> extract zip, run pipeline synchronously, return summary + diagram
   |-- /chat           -> LangGraph tool-calling agent loop
   |
   v
Analysis Pipeline (see §4)          Chat Agent (see §6)
   |                                     |
   v                                     v
NetworkX graph                    Tools: query_graph, search_codebase,
ChromaDB (chunks + embeddings)          generate_diagram, get_file_summary
SQLite/JSON (project metadata)
```

No task queue. No websockets needed — SSE streaming or even simple non-streamed
request/response is fine for a learning project; don't over-engineer transport.

---

## 4. Static analysis pipeline (Day 1 concept)

Steps, run synchronously on upload:

1. **Extract zip** to a temp working directory. Basic sanity check only (reject if it
   contains path traversal entries like `../`) — don't build a full security review, just
   don't be trivially exploitable on your own machine.
2. **Walk the file tree**, classify files by extension (`.py`, `.js`, `.ts`, `.tsx`).
3. **Parse each file**:
   - Python: use `ast.parse()`, walk the tree, extract:
     - `import X` / `from X import Y` statements → dependency edges
     - top-level function and class definitions → chunk boundaries (used later in §5)
   - JS/TS (minimal): use tree-sitter, extract only `import ... from '...'` /
     `require(...)` statements → dependency edges. Do NOT attempt function/class-level
     chunking for JS/TS — Python-only for RAG granularity. This keeps the multi-language
     work scoped to "prove I can parse a different grammar and resolve its import syntax,"
     not "build a second full pipeline."
4. **Build a dependency graph** with NetworkX:
   - Nodes = files (or modules)
   - Edges = import relationships
   - Compute in-degree centrality to find "core" files (most depended-upon)
   - Detect cycles (`nx.simple_cycles`) → flag circular dependencies
5. **Generate a Mermaid diagram programmatically from the graph** — string-template it
   directly from NetworkX nodes/edges. Do NOT ask the LLM to freehand a diagram; it will
   hallucinate edges that don't exist. The LLM's job later is to *annotate/explain* the
   diagram, not invent it.
6. Persist: file list, graph (e.g. as edge list), important files, diagram string — to
   SQLite/JSON so the chat agent can query them later without re-parsing.

Implementation note for the coding agent: put this in `backend/app/analysis/` with clear
single-responsibility files:
- `parser_python.py`
- `parser_js.py`
- `graph_builder.py`
- `diagram_generator.py`

Do not put all of this logic in one `analysis.py` file.

---

## 5. RAG pipeline (Day 2 concept)

Only for Python files (see §4 step 3).

1. **Chunk** each Python file by function/class boundary (from the AST, not by splitting on
   line count or blank lines). One chunk = one function or one class, with its docstring
   and a small amount of surrounding context (e.g. its containing class name, its imports).
2. **Embed** each chunk locally with `sentence-transformers` (`all-MiniLM-L6-v2`).
3. **Store** chunks + embeddings + metadata (`file`, `function_name`, `line_range`) in
   ChromaDB, `PersistentClient` pointed at a local directory — no server process.
4. **Retriever**: a function `search_codebase(query: str, k: int = 5) -> list[Chunk]` that
   embeds the query and does a similarity search against Chroma. This becomes a **tool**
   the chat agent can call (§6) — don't build a separate retrieval-only code path.

Test this in isolation before wiring it into agents: manually query "what handles
authentication?" and confirm it returns the right function.

---

## 6. Chat agent — tool-calling (the main "agentic" concept)

This is the centerpiece for interview talking points, so build it deliberately.

The chat endpoint is **not** a fixed LangGraph pipeline like the upload analysis — it's a
loop where the LLM decides, per user message, whether to respond directly or call a tool.
Groq's API (OpenAI-compatible) supports function calling — use that, not a hand-rolled
regex/keyword router.

**Tools to expose:**

```python
tools = [
    {
        "name": "search_codebase",
        "description": "Semantic search over the codebase for relevant functions/classes",
        "parameters": {"query": "string", "k": "integer"},
    },
    {
        "name": "generate_diagram",
        "description": "Generate a Mermaid dependency diagram, optionally scoped to a subset of files/modules",
        "parameters": {"scope": "string (optional, e.g. 'auth' or 'all')"},
    },
    {
        "name": "get_file_dependencies",
        "description": "List what a given file imports and what imports it",
        "parameters": {"file_path": "string"},
    },
    {
        "name": "get_important_files",
        "description": "Return the most central/depended-upon files in the project",
        "parameters": {},
    },
    {
        "name": "generate_inferred_diagram",
        "description": "Generate an AI-inferred use case diagram or layered architecture diagram (see §6.1) — distinct from generate_diagram, which is extracted from real import data",
        "parameters": {"diagram_type": "string", "scope": "string (optional)"},
    },
]
```

**Loop:**
1. User sends a message.
2. Send it to the LLM with the tool definitions + conversation history + a short system
   prompt describing the project (e.g. "You are an assistant helping a user understand a
   codebase that has already been statically analyzed. Use tools to answer accurately;
   don't guess at file contents.").
3. If the LLM responds with a tool call: execute it against the already-built graph/Chroma
   store (no re-parsing), feed the result back to the LLM as a tool result, let it produce
   a final natural-language answer.
4. If the LLM responds directly: stream that back.
5. If the tool result includes a Mermaid string (from `generate_diagram`), the frontend
   renders it as a diagram block in the chat, not as raw text.

This is where you get to explain in an interview: "the RAG agents in the upload pipeline
are a fixed sequence I designed; the chat agent is genuinely agentic — the model decides
which tool to call based on user intent."

Use **LangGraph** here too if you want one consistent framework (a graph with a single
looping "agent" node that conditionally routes to a "tool executor" node and back) — this
also gives you the conditional-edge / cyclic-graph LangGraph concept for the interview,
which a purely linear pipeline wouldn't.

### 6.1 Fifth tool — inferred diagrams (use case / high-level architecture)

This is a **different category of output** from `generate_diagram` (§6) and must be kept
clearly distinct, both in code and in the UI.

- `generate_diagram` (§4/§6) = **extracted**. Built directly from NetworkX edges. Cannot
  hallucinate. Answers "what literally imports what."
- This new tool = **inferred**. The LLM has to interpret intent from code (route handlers,
  function/class names, docstrings) that isn't structurally present as a graph edge.
  It *can* be wrong, so it must be labeled as AI-inferred wherever it's shown — never
  presented with the same confidence as the extracted diagram.

**Tool definition:**

```python
{
    "name": "generate_inferred_diagram",
    "description": (
        "Generate a UML-style diagram (use case diagram or high-level layered "
        "architecture diagram) inferred from code semantics — actors, routes, and "
        "responsibilities. This is an AI interpretation, not a literal extraction; "
        "may be incomplete or imprecise, unlike generate_diagram."
    ),
    "parameters": {
        "diagram_type": "string ('use_case' | 'architecture_layers')",
        "scope": "string (optional, e.g. 'auth' or 'all')",
    },
}
```

**How it works:**
1. Pull the important files (from `get_important_files`) plus relevant RAG chunks scoped to
   the request (route handlers and their docstrings for `use_case`; module-level structure
   for `architecture_layers`).
2. Prompt the LLM specifically for the target diagram type:
   - `use_case`: ask it to identify actors (e.g. User, Admin, external service) and their
     intents (e.g. "Login", "Place Order") from route/handler names and docstrings, and
     emit Mermaid `usecaseDiagram` syntax.
   - `architecture_layers`: ask it to group files into logical layers (e.g.
     Frontend / API / Service / Database) rather than listing every file, and emit Mermaid
     `flowchart` syntax at that layer of abstraction.
3. Return the Mermaid string tagged with `"inferred": true` in the tool result, so the
   frontend can render it with a visibly different badge/label (e.g. "AI-inferred — verify
   against source") from the extracted dependency diagram.
4. Do not cache or persist this as ground truth the way the extracted diagram is persisted
   in §4 — regenerate per request, since it's an interpretation, not a fact.

**Why this matters for your assignment/interview use case:** this is the feature most people
will actually reach for — "generate a UML use case diagram for my assignment" — so it's
worth prioritizing once the four §6 tools work, even ahead of frontend polish. Just don't
let it replace or get confused with the extracted diagram; keep both available and clearly
labeled.

---

## 7. Shared state models

Keep two separate typed states — don't force the upload pipeline and the chat agent to
share one blob, they do different things.

```python
# analysis pipeline state
class AnalysisState(TypedDict):
    project_path: str
    files: list[str]
    dep_graph: nx.DiGraph
    important_files: list[str]
    circular_deps: list[list[str]]
    diagram_mermaid: str
    architecture_summary: str

# chat agent state
class ChatState(TypedDict):
    messages: list[dict]          # conversation history, OpenAI-style
    project_id: str
    pending_tool_call: dict | None
    tool_result: dict | None
```

---

## 8. Backend project structure

```
backend/
  app/
    api/
      upload.py         # POST /upload
      chat.py            # POST /chat (or SSE stream)
    analysis/
      parser_python.py
      parser_js.py
      graph_builder.py
      diagram_generator.py
      pipeline.py         # orchestrates steps 1-6 from §4, synchronous
    rag/
      chunker.py
      embedder.py
      vector_store.py     # Chroma wrapper
    agents/
      chat_agent.py        # LangGraph graph: agent node <-> tool executor node
      tools.py              # the 4 tool functions from §6
    models/
      state.py              # AnalysisState, ChatState
    db/
      store.py               # SQLite/JSON persistence for project metadata
    main.py                    # FastAPI app, mounts routers
  requirements.txt
```

```
frontend/
  src/
    pages/
      UploadPage.tsx
      ChatPage.tsx
    components/
      MermaidDiagram.tsx     # renders mermaid strings; accepts an `inferred: boolean` prop
                              # to show an "AI-inferred" badge vs the extracted dep diagram
      ChatMessage.tsx
    App.tsx                   # router: "/" -> UploadPage, "/chat" -> ChatPage
```

Keep the frontend genuinely minimal — no state management library, no design system, just
`useState`/`fetch`/`react-router-dom`. This is not the part being learned.

---

## 9. Day-by-day build order

**Day 1 — Static analysis, zero AI calls**
- Zip upload + extraction (FastAPI endpoint)
- Python AST parser → imports + function/class boundaries
- Minimal JS/TS import parser (tree-sitter)
- NetworkX dependency graph + centrality + cycle detection
- Programmatic Mermaid diagram generator
- Wire to a bare `/upload` endpoint that returns the diagram + basic stats as JSON
- Confirm: point at a real multi-file Python project, get a correct diagram back, no LLM
  involved yet.

**Day 2 — RAG**
- AST-based chunker for Python (function/class level)
- Local embeddings with sentence-transformers
- ChromaDB local store
- `search_codebase()` retriever function, tested standalone with manual queries
- One LLM call added to `/upload`: feed important files + a few retrieved chunks to Groq,
  get back a short architecture summary, store it alongside the diagram

**Day 3 — Chat agent (tool-calling) + LangGraph**
- Define the 5 tools (§6, §6.1), wire each to the already-built graph/Chroma from Day 1-2
- Build the LangGraph chat graph: agent node ↔ tool executor node, conditional edge on
  "did the LLM request a tool call"
- `/chat` endpoint, simple non-streamed responses are fine to start
- Test manually: ask "generate a graph for X", "what depends on Y", "generate a use case
  diagram for the auth module" — confirm the right tool fires, extracted vs inferred
  diagrams are visibly labeled differently, and answers are grounded in real data

**Day 4 (buffer / stretch, from the multi-language + chat additions)**
- React frontend: UploadPage (upload button, loading state, diagram + summary display,
  "Go to chat" button) and ChatPage (message list, input, Mermaid rendering inline)
- Polish the JS/TS import resolution edge cases (relative paths, index files) if time allows
- If ahead of schedule: add SSE streaming to `/chat` instead of full-response-at-once

Total: ~4 days given the two additions (multi-language + chat UI) kept from the original
3-day scope. If running behind, cut JS/TS support first — it's the lowest-leverage item for
the interview story compared to the tool-calling chat agent.

---

## 10. Setup / environment notes for the coding agent

- Get a free Groq API key (groq.com) and put it in `.env` as `GROQ_API_KEY`. Never hardcode
  it. Add `.env` to `.gitignore`.
- `pip install -r requirements.txt` should include: `fastapi`, `uvicorn`, `networkx`,
  `sentence-transformers`, `chromadb`, `langgraph`, `langchain-groq` (or raw `groq` SDK),
  `tree-sitter`, `tree-sitter-languages`, `python-multipart` (for file upload).
- Frontend: `npm create vite@latest frontend -- --template react-ts`, add `react-router-dom`
  and `mermaid`.
- Run backend on `localhost:8000`, frontend dev server proxies `/api/*` to it — standard
  Vite proxy config, don't build a separate API gateway.
- No Docker needed for this scope. If you want it later as a stretch goal, fine, but it's
  not part of the 4-day plan.

---

## 11. Definition of done

You should be able to:
1. Run the backend and frontend locally.
2. Upload a zip of a real multi-file Python (optionally + JS/TS) project.
3. See a correct dependency diagram and a coherent architecture summary appear on the
   upload page, generated with zero paid API calls.
4. Click through to chat, ask "generate a graph for the auth module" and "what depends on
   database.py", and get answers that are provably grounded (tool-called, not hallucinated)
   in the actual parsed project — visible via the tool call showing up in your own logs.
5. Ask "generate a use case diagram for this project" and get back a Mermaid UML diagram,
   clearly labeled as AI-inferred, distinct from the extracted dependency diagram.

If all five of those work, every concept in §0 has been exercised end-to-end, which is the
actual goal of this project.
