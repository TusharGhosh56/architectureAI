import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import ChatMessage from "../components/ChatMessage";
import MermaidDiagram from "../components/MermaidDiagram";
import { answerFromAnalysis, SUGGESTED_PROMPTS } from "../lib/chatLocal";
import { loadAnalysis, type AnalysisSession } from "../lib/session";
import { SAMPLE_PROJECTS } from "../lib/samples";

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  mermaid?: string;
  inferred?: boolean;
  time: string;
};

type CanvasTab = "graph" | "centrality" | "cycles";

export default function ChatPage() {
  const analysis = loadAnalysis();
  const [activeTab, setActiveTab] = useState<CanvasTab>("graph");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [activeDiagram, setActiveDiagram] = useState<string>(
    analysis?.diagram_mermaid || "",
  );
  const [activeDiagramInferred, setActiveDiagramInferred] = useState<boolean>(false);

  const dialogueRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep active diagram in sync if session loads
  useEffect(() => {
    if (analysis?.diagram_mermaid && !activeDiagram) {
      setActiveDiagram(analysis.diagram_mermaid);
    }
  }, [analysis]);

  // Auto-scroll dialogue on new messages
  useEffect(() => {
    if (dialogueRef.current) {
      dialogueRef.current.scrollTo({
        top: dialogueRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, busy]);

  if (!analysis) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg-canvas)" }}>
        <div className="technical-grid" />
        <Navbar />
        <div style={{ flex: 1, display: "grid", placeItems: "center", padding: "2rem" }}>
          <div className="bracket-box" style={{ maxWidth: 520, width: "100%", padding: "2.5rem 2rem", textAlign: "center" }}>
            <div className="mono-tag mono-tag-orange" style={{ marginBottom: "0.5rem" }}>
              // MEMORY EMPTY
            </div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, fontFamily: "var(--font-mono)", marginBottom: "0.5rem" }}>
              NO REPOSITORY LOADED IN STUDIO
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "13px", lineHeight: 1.6, marginBottom: "1.5rem" }}>
              The studio canvas requires an analyzed AST dependency topology. Select a custom archive
              or load a benchmark demo architecture.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
              <Link to="/" className="btn-industrial">
                GO TO WORKBENCH →
              </Link>
              <button
                type="button"
                className="btn-terminal"
                onClick={() => {
                  sessionStorage.setItem("architectai_analysis", JSON.stringify(SAMPLE_PROJECTS[0]));
                  window.location.reload();
                }}
              >
                LOAD DEMO: FASTAPI SERVICE
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const project = analysis;

  async function executeCommand(query: string) {
    const trimmed = query.trim();
    if (!trimmed || busy) return;

    const time = new Date().toTimeString().slice(0, 8);
    const userMsg: Msg = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      time,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setBusy(true);

    try {
      let data: any = null;
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            project_id: project.project_id,
            analysis: project,
          }),
        });
        if (res.ok) {
          data = await res.json();
        }
      } catch (err) {
        console.warn("Backend chat unreachable, using local AST fallback:", err);
      }

      const resTime = new Date().toTimeString().slice(0, 8);

      if (data && data.message) {
        if (data.mermaid) {
          setActiveDiagram(data.mermaid);
          setActiveDiagramInferred(Boolean(data.inferred));
          setActiveTab("graph");
        }
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: data.message,
            mermaid: data.mermaid,
            inferred: data.inferred,
            time: resTime,
          },
        ]);
        return;
      }

      // Offline / fallback if backend is offline
      const local = answerFromAnalysis(trimmed, project);
      if (local) {
        if (local.mermaid) {
          setActiveDiagram(local.mermaid);
          setActiveDiagramInferred(Boolean(local.inferred));
          setActiveTab("graph");
        }
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: local.content,
            mermaid: local.mermaid,
            inferred: local.inferred,
            time: resTime,
          },
        ]);
        return;
      }

      const content =
        data && typeof data.message === "string"
          ? data.message
          : data && data.echo
            ? `Received:\n${data.echo}`
            : "AST analysis completed.";

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content,
          time: resTime,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: err instanceof Error ? err.message : "Command execution error.",
          time: new Date().toTimeString().slice(0, 8),
        },
      ]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void executeCommand(input);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void executeCommand(input);
    }
  }

  return (
    <main style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--bg-canvas)", overflow: "hidden" }}>
      <Navbar />

      <div className="studio-layout">
        {/* =================================================================
            LEFT PANE: COMMAND TERMINAL & ARCHITECTURAL DIALOGUE
            ================================================================= */}
        <section className="studio-left-pane">
          <div className="studio-pane-header">
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ color: "var(--accent-orange)" }}>&gt;</span>
              <span style={{ color: "var(--text-white)", fontWeight: 600 }}>COMMAND_STREAM</span>
              <span>({messages.length} ENTRIES)</span>
            </div>

            {messages.length > 0 && (
              <button
                type="button"
                className="btn-icon-tiny"
                style={{ fontSize: "10px", padding: "1px 6px" }}
                onClick={() => setMessages([])}
                title="Clear dialogue history"
              >
                CLEAR
              </button>
            )}
          </div>

          <div className="dialogue-stream" ref={dialogueRef}>
            {messages.length === 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", padding: "0.5rem 0" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)" }}>
                  // REPOSITORY TOPOLOGY LOADED
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "13px", fontWeight: 700, color: "var(--text-white)" }}>
                  {project.filename}
                </div>

                <div
                  style={{
                    background: "var(--bg-surface-elevated)",
                    border: "1px solid var(--border-hairline)",
                    padding: "0.75rem",
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    color: "var(--text-secondary)",
                    lineHeight: 1.5,
                  }}
                >
                  <div>[METRICS] {project.file_count} FILES // {project.edge_count} DEPENDENCY EDGES</div>
                  <div>[CENTRALITY] {project.important_files.length} CORE MODULES DETECTED</div>
                  <div style={{ color: project.circular_deps?.length ? "var(--accent-orange)" : "var(--accent-green)" }}>
                    [CYCLE_AUDIT] {project.circular_deps?.length || 0} CIRCULAR DEPENDENCY TRAPS
                  </div>
                </div>

                {project.architecture_summary && (
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.6, borderLeft: "2px solid var(--border-medium)", paddingLeft: "0.6rem" }}>
                    {project.architecture_summary}
                  </div>
                )}
              </div>
            )}

            {messages.map((m) => (
              <ChatMessage
                key={m.id}
                role={m.role}
                content={m.content}
                time={m.time}
              />
            ))}

            {busy && (
              <div className="terminal-msg assistant">
                <div className="terminal-msg-header">
                  <span>[ARCHITECT // EXECUTING]</span>
                  <span style={{ color: "var(--accent-orange)" }}>QUERYING GRAPH TOOLS...</span>
                </div>
                <div className="terminal-msg-body" style={{ color: "var(--accent-orange)", fontFamily: "var(--font-mono)", fontSize: "11px" }}>
                  &gt; Traversing import edges and calculating AST dependencies...
                </div>
              </div>
            )}
          </div>

          {/* Quick Slash Commands Bar */}
          <div className="slash-actions-bar">
            {SUGGESTED_PROMPTS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="slash-tag-btn"
                onClick={() => void executeCommand(p.question)}
                disabled={busy}
              >
                /{p.id}
              </button>
            ))}
          </div>

          {/* Bottom Command Prompt */}
          <div className="studio-command-bar">
            <form onSubmit={handleSubmit}>
              <div className="command-input-wrap">
                <span className="command-prompt-symbol">&gt;</span>
                <input
                  ref={inputRef}
                  className="command-field"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter architecture query or slash command..."
                  disabled={busy}
                  autoFocus
                />
                <button
                  type="submit"
                  className="btn-terminal"
                  style={{ fontSize: "10px", padding: "0.25rem 0.65rem" }}
                  disabled={busy || !input.trim()}
                >
                  RUN ↵
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* =================================================================
            RIGHT PANE: LIVE VISUAL ARCHITECTURE CANVAS
            ================================================================= */}
        <section className="studio-right-pane">
          {/* Canvas Sub-Navigation Tabs */}
          <div
            style={{
              height: 42,
              borderBottom: "1px solid var(--border-hairline)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 1rem",
              background: "var(--bg-surface)",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", gap: "0.25rem" }}>
              <button
                type="button"
                className={`segment-btn ${activeTab === "graph" ? "active" : ""}`}
                onClick={() => setActiveTab("graph")}
              >
                01. DEPENDENCY GRAPH
              </button>
              <button
                type="button"
                className={`segment-btn ${activeTab === "centrality" ? "active" : ""}`}
                onClick={() => setActiveTab("centrality")}
              >
                02. CENTRALITY ({project.important_files.length})
              </button>
              <button
                type="button"
                className={`segment-btn ${activeTab === "cycles" ? "active" : ""}`}
                onClick={() => setActiveTab("cycles")}
              >
                03. CYCLES ({project.circular_deps?.length || 0})
              </button>
            </div>

            <div style={{ color: "var(--text-faint)" }}>
              {project.file_count} NODES / {project.edge_count} EDGES
            </div>
          </div>

          {/* TAB 1: Visual Mermaid Architecture Graph */}
          {activeTab === "graph" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "calc(100% - 42px)", overflow: "hidden" }}>
              {activeDiagram ? (
                <MermaidDiagram
                  chart={activeDiagram}
                  inferred={activeDiagramInferred}
                  onSelectNode={(node) => void executeCommand(`Explain dependencies of ${node}`)}
                />
              ) : (
                <div style={{ flex: 1, display: "grid", placeItems: "center", color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: "12px" }}>
                  <div>[NO GRAPH RENDERED YET // CLICK /graph OR ASK QUESTION]</div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Centrality Metrics Inspector */}
          {activeTab === "centrality" && (
            <div style={{ flex: 1, padding: "1.5rem", overflowY: "auto" }}>
              <div className="mono-tag mono-tag-orange" style={{ marginBottom: "0.5rem" }}>
                // TOPOLOGICAL IN-DEGREE CENTRALITY
              </div>
              <p style={{ color: "var(--text-secondary)", fontSize: "12px", marginBottom: "1.25rem" }}>
                Files ranked by the number of other modules importing them. Higher in-degree indicates
                critical foundation components where changes trigger maximum blast radius.
              </p>

              <table className="tech-table">
                <thead>
                  <tr>
                    <th style={{ width: "40px" }}>#</th>
                    <th>MODULE PATH</th>
                    <th style={{ width: "120px" }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {project.important_files.map((file, idx) => (
                    <tr key={file}>
                      <td style={{ color: "var(--accent-orange)", fontWeight: 700 }}>{idx + 1}</td>
                      <td style={{ color: "var(--text-white)" }}>{file}</td>
                      <td>
                        <button
                          type="button"
                          className="btn-terminal"
                          style={{ fontSize: "10px", padding: "2px 6px" }}
                          onClick={() => {
                            void executeCommand(`Explain the role and imports of ${file}`);
                          }}
                        >
                          INSPECT →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: Circular Dependency Audit */}
          {activeTab === "cycles" && (
            <div style={{ flex: 1, padding: "1.5rem", overflowY: "auto" }}>
              <div className="mono-tag" style={{ marginBottom: "0.5rem", color: project.circular_deps?.length ? "var(--accent-orange)" : "var(--accent-green)" }}>
                // RECURSIVE IMPORT CYCLE AUDITOR
              </div>
              <p style={{ color: "var(--text-secondary)", fontSize: "12px", marginBottom: "1.25rem" }}>
                Detects cycles where module A imports B which imports A (directly or transitively).
                Circular cycles create tight coupling, unpredictable initialization order, and testing headaches.
              </p>

              {project.circular_deps && project.circular_deps.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {project.circular_deps.map((cycle, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "1rem",
                        background: "var(--bg-surface-elevated)",
                        border: "1px solid rgba(255, 85, 0, 0.3)",
                      }}
                    >
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--accent-orange)", marginBottom: "0.5rem" }}>
                        [CYCLE_VIOLATION // #{i + 1}]
                      </div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-white)", lineHeight: 1.8 }}>
                        {cycle.map((node, nIdx) => (
                          <span key={nIdx}>
                            <span style={{ color: "#ffffff", fontWeight: 600 }}>{node}</span>
                            {nIdx < cycle.length - 1 && (
                              <span style={{ color: "var(--accent-orange)", margin: "0 0.5rem" }}>➔</span>
                            )}
                          </span>
                        ))}
                      </div>
                      <div style={{ marginTop: "0.75rem" }}>
                        <button
                          type="button"
                          className="btn-terminal-orange"
                          style={{ fontSize: "10px", padding: "0.25rem 0.55rem" }}
                          onClick={() => {
                            void executeCommand(`How do I refactor the circular dependency between ${cycle.slice(0, 2).join(" and ")}?`);
                          }}
                        >
                          HOW TO DECOUPLE THIS CYCLE →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    padding: "1.5rem",
                    border: "1px solid rgba(0, 229, 153, 0.3)",
                    background: "var(--accent-green-dim)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "12px",
                  }}
                >
                  <div style={{ color: "var(--accent-green)", fontWeight: 700, marginBottom: "0.25rem" }}>
                    [DAG_STATUS: 100% HEALTHY]
                  </div>
                  <div style={{ color: "var(--text-secondary)" }}>
                    Zero circular import dependency cycles detected in the abstract syntax tree.
                    The codebase forms a verified Directed Acyclic Graph.
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
