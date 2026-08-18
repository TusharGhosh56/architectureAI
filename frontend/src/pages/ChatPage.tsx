import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Cpu,
  Send,
  Sparkles,
  Layers,
  Network,
  ShieldCheck,
  Compass,
  Workflow,
  AlertTriangle,
  ArrowLeft,
  FileCode,
  Trash2,
  Download,
  Copy,
  Check,
} from "lucide-react";
import MermaidDiagram from "../components/MermaidDiagram";
import type { DiagramModel } from "../components/MermaidDiagram";
import { SUGGESTED_PROMPTS } from "../lib/chatLocal";
import { loadAnalysis, clearAnalysis, saveAnalysis } from "../lib/session";
import { DEMO_PROJECT, DEMO_SAMPLE_REPLIES } from "../lib/demoProject";

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  diagram?: DiagramModel;
  timestamp: string;
};

type ChatApiResponse = {
  status?: string;
  reply?: string;
  detail?: string;
  tools_used?: string[];
  diagrams?: DiagramModel[];
};

export default function ChatPage() {
  const navigate = useNavigate();
  const analysis = loadAnalysis();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  if (!analysis) {
    return (
      <main className="studio-page">
        <div style={{ maxWidth: 540, margin: "auto", textAlign: "center", padding: "2rem" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--cyan-glow)", color: "var(--cyan-400)", display: "grid", placeItems: "center", margin: "0 auto 1.5rem" }}>
            <Cpu size={32} />
          </div>
          <h1 style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>No Active Codebase Session</h1>
          <p style={{ color: "var(--text-secondary)", marginBottom: "2rem", lineHeight: 1.6 }}>
            Upload a project zip or launch our sample microservices repository to explore the AI Architecture Studio.
          </p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
            <Link className="btn btn-secondary" to="/">
              <ArrowLeft size={16} />
              <span>Back to Home</span>
            </Link>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                saveAnalysis({ ...DEMO_PROJECT, is_demo: true });
                navigate(0);
              }}
            >
              <Sparkles size={16} />
              <span>Explore Demo Repo</span>
            </button>
          </div>
        </div>
      </main>
    );
  }

  const project = analysis;

  const handleCopyMessage = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportChat = () => {
    const text = messages
      .map((m) => `[${m.role.toUpperCase()}] (${m.timestamp})\n${m.content}\n${m.diagram ? `\n[DIAGRAM: ${m.diagram.type || "Mermaid"}]\n\`\`\`mermaid\n${m.diagram.mermaid}\n\`\`\`\n` : ""}\n---`)
      .join("\n\n");
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `architectai-session-${project.filename}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const ask = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || busy) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const userMsg: Msg = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      timestamp: timeStr,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setBusy(true);

    // If demo project or offline mock fallback is requested
    const lower = trimmed.toLowerCase();
    const demoMatch =
      lower.includes("overview") || lower.includes("what does this project do")
        ? DEMO_SAMPLE_REPLIES.overview
        : lower.includes("graph") || lower.includes("dependency")
        ? DEMO_SAMPLE_REPLIES.graph
        : lower.includes("layer") || lower.includes("architecture layer")
        ? DEMO_SAMPLE_REPLIES.layers
        : lower.includes("use case") || lower.includes("uml")
        ? DEMO_SAMPLE_REPLIES.usecase
        : lower.includes("core") || lower.includes("important")
        ? DEMO_SAMPLE_REPLIES.core
        : lower.includes("circular") || lower.includes("cycle")
        ? DEMO_SAMPLE_REPLIES.cycles
        : null;

    try {
      let replyContent = "";
      let replyDiagrams: DiagramModel[] = [];

      // Try actual backend API
      try {
        const history = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            project_id: project.project_id,
            history,
          }),
        });

        if (res.ok) {
          const data = (await res.json()) as ChatApiResponse;
          replyContent = (data.reply || "").trim() || "No reply.";
          replyDiagrams = (data.diagrams ?? []).filter((d) => Boolean(d?.mermaid?.trim()));
        } else if (project.is_demo && demoMatch) {
          replyContent = demoMatch.reply;
          if (demoMatch.diagram) replyDiagrams = [demoMatch.diagram];
        } else {
          const errData = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
          throw new Error(typeof errData.detail === "string" ? errData.detail : `Chat failed (HTTP ${res.status})`);
        }
      } catch (backendErr) {
        // If backend unreachable and demo mode or sample questions
        if (demoMatch) {
          replyContent = demoMatch.reply;
          if (demoMatch.diagram) replyDiagrams = [demoMatch.diagram];
        } else {
          throw backendErr;
        }
      }

      const primary = replyDiagrams[0];
      const next: Msg[] = [
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: replyContent,
          diagram: primary,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ];

      for (const d of replyDiagrams.slice(1)) {
        next.push({
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Here is an additional architectural perspective diagram:",
          diagram: d,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        });
      }

      setMessages((prev) => [...prev, ...next]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: err instanceof Error ? err.message : "Chat request failed. Is the backend server running on :8000?",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void ask(input);
  };

  const getPromptIcon = (iconName: string) => {
    switch (iconName) {
      case "Compass": return <Compass size={15} color="var(--cyan-400)" />;
      case "Network": return <Network size={15} color="var(--indigo-400)" />;
      case "Layers": return <Layers size={15} color="var(--cyan-400)" />;
      case "Workflow": return <Workflow size={15} color="var(--violet-400)" />;
      case "Cpu": return <Cpu size={15} color="var(--emerald-400)" />;
      case "AlertTriangle": return <AlertTriangle size={15} color="var(--amber-400)" />;
      default: return <Sparkles size={15} />;
    }
  };

  return (
    <div className="studio-page">
      {/* Studio Top Navigation Bar */}
      <header className="studio-topbar">
        <div className="studio-breadcrumb">
          <Link to="/" className="btn btn-ghost btn-sm" title="Back to landing page">
            <ArrowLeft size={16} />
          </Link>
          <div className="brand-logo" style={{ fontSize: "1.1rem" }}>
            <div className="brand-icon-box" style={{ width: 26, height: 26 }}>
              <Cpu size={14} />
            </div>
            <span>
              Architect<span className="gradient-text">AI</span>
            </span>
          </div>

          <span style={{ color: "var(--border-glass)", margin: "0 0.25rem" }}>/</span>

          <div className="studio-project-badge">
            <FileCode size={14} color="var(--cyan-400)" />
            <span>{project.filename}</span>
            {project.is_demo && (
              <span className="pill-badge" style={{ fontSize: "0.68rem", padding: "0.1rem 0.4rem" }}>
                Demo Repo
              </span>
            )}
          </div>
        </div>

        <div className="studio-metrics-row">
          <span><strong>{project.file_count}</strong> files</span>
          <span>•</span>
          <span><strong>{project.edge_count}</strong> AST edges</span>
          <span>•</span>
          <span style={{ color: "var(--emerald-400)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <span className="pulse-dot" /> RAG Indexed
          </span>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleExportChat}
            disabled={messages.length === 0}
            title="Export session transcript"
          >
            <Download size={14} />
            <span>Export</span>
          </button>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              clearAnalysis();
              navigate("/");
            }}
            title="Upload different codebase"
          >
            <Trash2 size={14} />
            <span>New Session</span>
          </button>
        </div>
      </header>

      {/* Main Studio Body Grid */}
      <div className="studio-body-layout">
        {/* Left Inspector Sidebar */}
        <aside className="studio-sidebar">
          {/* Architecture Summary */}
          <div className="sidebar-card">
            <div className="sidebar-card-title">
              <Compass size={14} color="var(--cyan-400)" />
              <span>Architecture Summary</span>
            </div>
            <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
              {project.architecture_summary || "AST analysis complete. Codebase mapped with static dependency extraction."}
            </p>
          </div>

          {/* Core Files */}
          <div className="sidebar-card">
            <div className="sidebar-card-title">
              <Cpu size={14} color="var(--emerald-400)" />
              <span>Core Central Hubs</span>
            </div>
            <div className="core-files-list">
              {(project.important_files && project.important_files.length > 0
                ? project.important_files
                : ["main.py", "app.ts", "router.ts"]
              ).map((f) => (
                <button
                  key={f}
                  type="button"
                  className="core-file-item"
                  onClick={() => void ask(`Explain the role, exports, and dependencies of ${f}`)}
                  title={`Query role of ${f}`}
                >
                  <FileCode size={13} color="var(--cyan-400)" style={{ flexShrink: 0 }} />
                  <span>{f}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Circular Dependencies Status */}
          <div className="sidebar-card">
            <div className="sidebar-card-title">
              <ShieldCheck size={14} color="var(--indigo-400)" />
              <span>Cycle Sentinel</span>
            </div>
            {project.circular_deps && project.circular_deps.length > 0 ? (
              <div style={{ fontSize: "0.8rem", color: "var(--amber-400)" }}>
                ⚠️ Found {project.circular_deps.length} cyclic import paths.
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", color: "var(--emerald-400)" }}>
                <Check size={14} />
                <span>0 Circular dependencies detected</span>
              </div>
            )}
          </div>

          {/* Prompt Library */}
          <div className="sidebar-card">
            <div className="sidebar-card-title">
              <Sparkles size={14} color="var(--violet-400)" />
              <span>Quick Prompt Library</span>
            </div>
            <div className="prompt-lib-list">
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="prompt-lib-btn"
                  onClick={() => void ask(p.question)}
                  disabled={busy}
                >
                  {getPromptIcon(p.icon)}
                  <div>
                    <div style={{ fontSize: "0.82rem", fontWeight: 600 }}>{p.label}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Stage / Chat Feed */}
        <main className="studio-main-stage">
          <div className="chat-feed-scroll" ref={listRef}>
            <div className="chat-inner-wrap">
              {messages.length === 0 && (
                <div className="chat-welcome-banner">
                  <span className="pill-badge" style={{ marginBottom: "1rem" }}>
                    <Sparkles size={13} />
                    <span>Neural Architectural Intelligence</span>
                  </span>
                  <h2 style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>
                    What would you like to explore in <span className="gradient-text">{project.filename}</span>?
                  </h2>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", maxWidth: "560px", margin: "0 auto" }}>
                    Our AI assistant has indexed your codebase AST and function chunks into local RAG vector memory.
                    Click a prompt below or type any architectural question.
                  </p>

                  <div className="welcome-chip-grid">
                    {SUGGESTED_PROMPTS.map((p) => (
                      <div
                        key={p.id}
                        className="welcome-chip-card"
                        onClick={() => void ask(p.question)}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
                          {getPromptIcon(p.icon)}
                          <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-primary)" }}>{p.label}</span>
                        </div>
                        <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: 0, lineHeight: 1.4 }}>
                          {p.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Message List */}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`msg-row ${m.role === "user" ? "msg-row-user" : "msg-row-assistant"}`}
                >
                  <div className={`msg-avatar ${m.role === "user" ? "msg-avatar-user" : "msg-avatar-ai"}`}>
                    {m.role === "user" ? "You" : <Cpu size={18} />}
                  </div>

                  <div className={`msg-content-bubble ${m.role === "user" ? "msg-content-user" : "msg-content-assistant"}`}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem", fontSize: "0.75rem", color: m.role === "user" ? "rgba(255,255,255,0.7)" : "var(--text-muted)" }}>
                      <span style={{ fontWeight: 700, letterSpacing: "0.03em" }}>
                        {m.role === "user" ? "DEVELOPER" : "ARCHITECT AI"}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span>{m.timestamp}</span>
                        {m.role === "assistant" && (
                          <button
                            type="button"
                            className="diagram-tool-btn"
                            style={{ width: 22, height: 22 }}
                            onClick={() => handleCopyMessage(m.id, m.content)}
                            title="Copy reply"
                          >
                            {copiedId === m.id ? <Check size={12} color="var(--emerald-400)" /> : <Copy size={12} />}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="msg-prose">{m.content}</div>

                    {m.diagram && (
                      <MermaidDiagram chart={m.diagram.mermaid} model={m.diagram} />
                    )}
                  </div>
                </div>
              ))}

              {/* Thinking Indicator */}
              {busy && (
                <div className="msg-row msg-row-assistant">
                  <div className="msg-avatar msg-avatar-ai">
                    <Cpu size={18} className="animate-spin" />
                  </div>
                  <div className="msg-content-bubble msg-content-assistant">
                    <div className="thinking-bubble">
                      <Sparkles size={16} color="var(--cyan-400)" />
                      <span>Traversing AST graph nodes & retrieving code chunks…</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Floating Prompt Composer Dock */}
          <div className="studio-composer-dock">
            <div className="composer-container">
              {messages.length > 0 && (
                <div className="composer-quick-chips">
                  {SUGGESTED_PROMPTS.slice(0, 4).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="pill-badge"
                      style={{ cursor: "pointer", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-glass)", color: "var(--text-secondary)" }}
                      onClick={() => void ask(p.question)}
                      disabled={busy}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}

              <form onSubmit={onSubmit} className="composer-input-box">
                <input
                  type="text"
                  className="composer-text-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about dependencies, layers, use cases, or core files… (e.g. 'Show the dependency graph')"
                  disabled={busy}
                />
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={busy || !input.trim()}
                  title="Send message (Enter)"
                >
                  <Send size={14} />
                  <span>Send</span>
                </button>
              </form>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
