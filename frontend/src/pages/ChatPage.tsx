import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import MermaidDiagram from "../components/MermaidDiagram";
import type { DiagramModel } from "../components/MermaidDiagram";
import { SUGGESTED_PROMPTS } from "../lib/chatLocal";
import { loadAnalysis } from "../lib/session";

gsap.registerPlugin(useGSAP);

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  diagram?: DiagramModel;
};

type ChatApiResponse = {
  status?: string;
  reply?: string;
  detail?: string;
  tools_used?: string[];
  diagrams?: DiagramModel[];
};

export default function ChatPage() {
  const analysis = loadAnalysis();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (!analysis) return;
      gsap.from(".suggest-block, .chip", {
        opacity: 0,
        y: 12,
        duration: 0.45,
        stagger: 0.05,
        ease: "power2.out",
      });
    },
    { scope: pageRef, dependencies: [Boolean(analysis)] },
  );

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  if (!analysis) {
    return (
      <main className="chat-page">
        <div className="empty-gate">
          <h1>Analyze a project first</h1>
          <p>
            Chat is locked until a zip has been uploaded and analyzed. That keeps answers
            grounded in your actual graph and embeddings.
          </p>
          <Link className="btn btn-primary" to="/">
            Back to ArchitectAI
          </Link>
        </div>
      </main>
    );
  }

  const project = analysis;

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || busy) return;

    const history = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const userMsg: Msg = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          project_id: project.project_id,
          history,
        }),
      });
      const data = (await res.json()) as ChatApiResponse;
      if (!res.ok) {
        throw new Error(
          typeof data.detail === "string" ? data.detail : `Chat failed (HTTP ${res.status})`,
        );
      }

      const diagrams = (data.diagrams ?? []).filter((d) => Boolean(d?.mermaid?.trim()));
      const primary = diagrams[0];
      const content = (data.reply || "").trim() || "No reply.";

      const next: Msg[] = [
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content,
          diagram: primary,
        },
      ];

      for (const d of diagrams.slice(1)) {
        next.push({
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Here's another related diagram.",
          diagram: d,
        });
      }

      setMessages((prev) => [...prev, ...next]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: err instanceof Error ? err.message : "Chat request failed.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void ask(input);
  }

  return (
    <main className="chat-page" ref={pageRef}>
      <header className="chat-top">
        <Link className="chat-brand" to="/">
          ArchitectAI
        </Link>
        <span className="chat-meta">
          {project.filename} · {project.file_count} files · {project.edge_count} edges
        </span>
      </header>

      <div className="chat-body" ref={listRef}>
        {messages.length === 0 && (
          <div className="suggest-block">
            <h2>Ask about this codebase</h2>
            <p>
              Ask about what the project does, dependencies, use cases, or architecture layers.
            </p>
            <div className="suggest-grid">
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="chip"
                  onClick={() => void ask(p.question)}
                  disabled={busy}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="messages">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`bubble ${m.role === "user" ? "bubble-user" : "bubble-assistant"}`}
            >
              <span className="bubble-role">
                {m.role === "user" ? "You" : "ArchitectAI"}
              </span>
              {m.content}
              {m.diagram && (
                <div className="diagram-wrap">
                  <MermaidDiagram chart={m.diagram.mermaid} model={m.diagram} />
                </div>
              )}
            </div>
          ))}
          {busy && (
            <div className="bubble bubble-assistant">
              <span className="bubble-role">ArchitectAI</span>
              Thinking…
            </div>
          )}
        </div>

        {messages.length > 0 && (
          <div className="suggest-grid" style={{ marginTop: "0.5rem" }}>
            {SUGGESTED_PROMPTS.slice(0, 4).map((p) => (
              <button
                key={p.id}
                type="button"
                className="chip"
                onClick={() => void ask(p.question)}
                disabled={busy}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <form className="chat-composer" onSubmit={onSubmit}>
        <div className="composer-inner">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask for deps, use cases, architecture…"
            disabled={busy}
            aria-label="Chat message"
          />
          <button className="btn btn-primary" type="submit" disabled={busy || !input.trim()}>
            Send
          </button>
        </div>
      </form>
    </main>
  );
}
