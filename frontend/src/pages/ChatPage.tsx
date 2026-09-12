import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import ChatMessage from "../components/ChatMessage";
import MermaidDiagram from "../components/MermaidDiagram";
import { answerFromAnalysis, SUGGESTED_PROMPTS } from "../lib/chatLocal";
import { loadAnalysis } from "../lib/session";
import { SAMPLE_PROJECTS } from "../lib/samples";
import { apiUrl } from "../lib/api";

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep active diagram in sync if session loads
  useEffect(() => {
    if (analysis?.diagram_mermaid && !activeDiagram) {
      setActiveDiagram(analysis.diagram_mermaid);
    }
  }, [analysis]);

  // Guaranteed auto-scroll to newest question/answer
  function scrollToBottom(smooth = true) {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
        block: "end",
      });
    } else if (dialogueRef.current) {
      dialogueRef.current.scrollTo({
        top: dialogueRef.current.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    }
  }

  useEffect(() => {
    scrollToBottom(false);
    const timer = setTimeout(() => {
      scrollToBottom(true);
    }, 50);
    return () => clearTimeout(timer);
  }, [messages, busy]);

  if (!analysis) {
    return (
      <main className="studio-empty-backdrop">
        <Navbar />
        <div style={{ flex: 1, display: "grid", placeItems: "center", padding: "2rem", zIndex: 1 }}>
          <div className="studio-empty-card">
            <div className="studio-empty-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
            </div>
            <h2 className="studio-empty-title">NO ARCHITECTURE TOPOLOGY LOADED</h2>
            <p className="studio-empty-desc">
              The studio canvas requires an analyzed AST dependency topology. Select your custom project archive
              on the workbench or load a pre-calculated benchmark architecture.
            </p>
            <div className="studio-empty-actions">
              <Link to="/" className="btn-cosmic" style={{ textDecoration: "none" }}>
                <span>RETURN TO WORKBENCH →</span>
              </Link>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  sessionStorage.setItem("architectai_analysis", JSON.stringify(SAMPLE_PROJECTS[0]));
                  window.location.reload();
                }}
              >
                LOAD BENCHMARK: FASTAPI
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
        const res = await fetch(apiUrl("/api/chat"), {
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
    <main className="studio-page-main">
      <Navbar />

      <div className="studio-layout">
        {/* =================================================================
            LEFT PANE: ARCHITECTURAL COPILOT & STREAM
            ================================================================= */}
        <section className="studio-left-pane">
          <div className="studio-pane-header">
            <div className="studio-grounding-pill">
              <span className="studio-pulse-dot" />
              <span>{project.filename || "Active Repository"}</span>
            </div>

            {messages.length > 0 && (
              <button
                type="button"
                className="studio-clear-btn"
                onClick={() => setMessages([])}
                title="Clear conversation history"
              >
                Clear Dialogue
              </button>
            )}
          </div>

          <div className="dialogue-stream" ref={dialogueRef}>
            {messages.length === 0 && (
              <div className="studio-overview-card">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", color: "var(--accent-teal)", textTransform: "uppercase" }}>
                    Codebase Analyzed
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    {project.circular_deps?.length ? "Loops Detected" : "Clean Hierarchy"}
                  </span>
                </div>
                <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-white)", marginBottom: "1rem" }}>
                  {project.filename}
                </div>

                {/* Metric Triad Cards */}
                <div className="studio-metric-triad">
                  <div className="studio-metric-cell">
                    <span className="studio-cell-value">{project.file_count}</span>
                    <span className="studio-cell-label">{project.edge_count} Imports</span>
                  </div>
                  <div className="studio-metric-cell">
                    <span className="studio-cell-value" style={{ color: "#a5b4fc" }}>
                      {project.important_files.length}
                    </span>
                    <span className="studio-cell-label">Core Files</span>
                  </div>
                  <div className="studio-metric-cell">
                    <span
                      className={`studio-cell-value ${
                        project.circular_deps?.length ? "is-warning" : "is-healthy"
                      }`}
                    >
                      {project.circular_deps?.length || 0}
                    </span>
                    <span className="studio-cell-label">
                      {project.circular_deps?.length ? "Loops Found" : "Zero Loops"}
                    </span>
                  </div>
                </div>

                {project.architecture_summary && (
                  <div className="studio-narrative-box">
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
              <div className="studio-thinking-bubble">
                <div className="studio-spinner" />
                <div className="studio-thinking-text">
                  Analyzing code relationships and preparing response...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} style={{ height: 1, flexShrink: 0 }} />
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
            <form onSubmit={handleSubmit} style={{ width: "100%" }}>
              <div className="command-input-wrap">
                <span className="command-prompt-symbol">&gt;</span>
                <input
                  ref={inputRef}
                  className="command-field"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about architecture, inspect files, or use /commands..."
                  disabled={busy}
                  autoFocus
                />
                <button
                  type="submit"
                  className="command-submit-btn"
                  disabled={busy || !input.trim()}
                  title="Submit query"
                >
                  Ask Agent ↵
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
          <div className="studio-subnav-bar">
            <div className="studio-tabs-group">
              <button
                type="button"
                className={`studio-tab-item ${activeTab === "graph" ? "active" : ""}`}
                onClick={() => setActiveTab("graph")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="studio-tab-icon">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                <span>Dependency Graph</span>
              </button>

              <button
                type="button"
                className={`studio-tab-item ${activeTab === "centrality" ? "active" : ""}`}
                onClick={() => setActiveTab("centrality")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="studio-tab-icon">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="22" y1="12" x2="18" y2="12" />
                  <line x1="6" y1="12" x2="2" y2="12" />
                  <line x1="12" y1="6" x2="12" y2="2" />
                  <line x1="12" y1="22" x2="12" y2="18" />
                </svg>
                <span>Core Files</span>
                <span className="studio-tab-count-pill">{project.important_files.length}</span>
              </button>

              <button
                type="button"
                className={`studio-tab-item ${activeTab === "cycles" ? "active" : ""}`}
                onClick={() => setActiveTab("cycles")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="studio-tab-icon">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
                <span>Circular Imports</span>
                <span
                  className={`studio-tab-count-pill ${
                    project.circular_deps?.length ? "pill-warning" : "pill-healthy"
                  }`}
                >
                  {project.circular_deps?.length ? `${project.circular_deps.length} Found` : "None"}
                </span>
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontFamily: "var(--font-mono)", fontSize: "11.5px" }}>
              <span style={{ color: "#64748b" }}>
                <strong style={{ color: "#cbd5e1", fontWeight: 600 }}>{project.file_count}</strong> Files
              </span>
              <span style={{ color: "rgba(255, 255, 255, 0.15)" }}>/</span>
              <span style={{ color: "#64748b" }}>
                <strong style={{ color: "#cbd5e1", fontWeight: 600 }}>{project.edge_count}</strong> Imports
              </span>
            </div>
          </div>

          {/* TAB 1: Visual Mermaid Architecture Graph */}
          {activeTab === "graph" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "calc(100% - 52px)", overflow: "hidden", position: "relative" }}>
              {activeDiagram ? (
                <MermaidDiagram
                  chart={activeDiagram}
                  inferred={activeDiagramInferred}
                  onSelectNode={(node) => void executeCommand(`Explain how ${node} is used and its dependencies`)}
                />
              ) : (
                <div className="studio-canvas-empty">
                  <div>No graph rendered yet. Enter a question or click /graph to visualize.</div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Core Files & Impact Inspector */}
          {activeTab === "centrality" && (
            <div className="blast-radius-pane">
              <div style={{ marginBottom: "1.5rem" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-white)", marginBottom: "0.4rem" }}>
                  Most Used Files &amp; Impact
                </h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "13px", lineHeight: 1.6 }}>
                  These are the files most heavily imported and shared across your project.
                  Changes made to these files will have the biggest impact on other parts of your codebase.
                </p>
              </div>

              <table className="blast-table">
                <thead>
                  <tr>
                    <th style={{ width: "60px" }}>Rank</th>
                    <th>File Path</th>
                    <th style={{ width: "240px" }}>Importance</th>
                    <th style={{ width: "130px", textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {project.important_files.map((file, idx) => (
                    <tr key={file}>
                      <td>
                        <span className="blast-rank-badge">#{idx + 1}</span>
                      </td>
                      <td>
                        <div style={{ color: "var(--text-white)", fontWeight: 500, fontFamily: "var(--font-mono)", fontSize: "12px" }}>
                          {file}
                        </div>
                        <div className="blast-gravity-bar">
                          <div
                            className="blast-gravity-fill"
                            style={{ width: `${Math.max(15, 100 - idx * 16)}%` }}
                          />
                        </div>
                      </td>
                      <td style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                        {idx === 0
                          ? "Most Imported File"
                          : idx < 3
                            ? "High Impact Shared File"
                            : "Frequently Used File"}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          className="blast-inspect-btn"
                          onClick={() => {
                            void executeCommand(`Explain how ${file} is used across the codebase and which files depend on it`);
                          }}
                        >
                          Inspect File →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: Circular Import Audit */}
          {activeTab === "cycles" && (
            <div className="cycles-audit-pane">
              <div style={{ marginBottom: "1.5rem" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-white)", marginBottom: "0.4rem" }}>
                  Circular Import Detection
                </h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "13px", lineHeight: 1.6 }}>
                  Checks for circular loops where files import each other (e.g. File A imports File B, and File B imports File A).
                  Circular imports can cause hard-to-trace bugs, crashes, and confusing load orders.
                </p>
              </div>

              {project.circular_deps && project.circular_deps.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {project.circular_deps.map((cycle, i) => (
                    <div key={i} className="cycle-violation-card">
                      <div className="cycle-violation-badge">
                        Circular Loop #{i + 1}
                      </div>
                      <div className="cycle-chain-flow">
                        {cycle.map((node, nIdx) => (
                          <span key={nIdx} style={{ display: "inline-flex", alignItems: "center" }}>
                            <span className="cycle-node-pill">{node}</span>
                            {nIdx < cycle.length - 1 && (
                              <span className="cycle-node-arrow">→</span>
                            )}
                          </span>
                        ))}
                      </div>
                      <div>
                        <button
                          type="button"
                          className="cycle-decouple-btn"
                          onClick={() => {
                            void executeCommand(`How do I refactor and fix the circular import between ${cycle.slice(0, 2).join(" and ")}?`);
                          }}
                        >
                          How to fix this circular dependency →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="cycles-healthy-card">
                  <div className="cycles-healthy-title">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    No Circular Imports Found
                  </div>
                  <div className="cycles-healthy-desc">
                    All {project.file_count} files import cleanly in one direction without any recursive loops.
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
