import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import heroArt from "../assets/hero.png";
import { saveAnalysis, type AnalysisSession } from "../lib/session";

gsap.registerPlugin(useGSAP);

type Phase = "idle" | "ready" | "analyzing" | "done";

type UploadApiResult = AnalysisSession & {
  status: string;
  truncated?: boolean;
};

export default function LandingPage() {
  const rootRef = useRef<HTMLElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [doneMeta, setDoneMeta] = useState<{ name: string; files: number } | null>(null);

  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from(".brand", { y: 36, opacity: 0, duration: 0.75 })
        .from(".hero-copy", { y: 18, opacity: 0, duration: 0.55 }, "-=0.4")
        .from(".hero-points li", { y: 12, opacity: 0, stagger: 0.08, duration: 0.45 }, "-=0.3")
        .from(".hero-actions", { y: 12, opacity: 0, duration: 0.45 }, "-=0.25")
        .from(".hero-visual", { x: 24, opacity: 0, duration: 0.7 }, 0.15);
    },
    { scope: rootRef },
  );

  function onPickFile(selected: File | null) {
    setError(null);
    setDoneMeta(null);
    if (!selected) {
      setFile(null);
      setPhase("idle");
      return;
    }
    if (!selected.name.toLowerCase().endsWith(".zip")) {
      setError("Please choose a .zip of your project.");
      setFile(null);
      setPhase("idle");
      return;
    }
    setFile(selected);
    setPhase("ready");
  }

  async function onAnalyze() {
    if (!file) {
      setError("Upload a project zip first.");
      return;
    }
    setPhase("analyzing");
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body });
      let data: { detail?: unknown } & Partial<UploadApiResult>;
      try {
        data = await res.json();
      } catch {
        throw new Error(
          res.ok
            ? "Analyze finished but response was not JSON."
            : `Analyze failed (HTTP ${res.status}). Is the backend on :8000?`,
        );
      }
      if (!res.ok) {
        const detail = data.detail;
        throw new Error(
          typeof detail === "string"
            ? detail
            : `Analyze failed (HTTP ${res.status})`,
        );
      }

      const session: AnalysisSession = {
        project_id: data.project_id!,
        filename: data.filename || file.name,
        file_count: data.file_count ?? 0,
        edge_count: data.edge_count ?? 0,
        important_files: data.important_files ?? [],
        circular_deps: data.circular_deps ?? [],
        diagram_mermaid: data.diagram_mermaid ?? "",
        architecture_summary: data.architecture_summary ?? "",
        chunk_count: data.chunk_count ?? 0,
      };
      saveAnalysis(session);
      setDoneMeta({ name: session.filename, files: session.file_count });
      setPhase("done");
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      if (raw === "Failed to fetch" || /NetworkError|fetch/i.test(raw)) {
        setError(
          "Lost connection during analysis. Zip source only (no .venv/node_modules), then retry.",
        );
      } else {
        setError(raw);
      }
      setPhase(file ? "ready" : "idle");
    }
  }

  return (
    <main className="landing" ref={rootRef}>
      <section className="hero" aria-label="ArchitectAI hero">
        <div className="hero-grid" aria-hidden />
        <div className="hero-inner">
          <div className="hero-copy-block">
            <h1 className="brand">ArchitectAI</h1>
            <p className="hero-copy">
              Upload a project zip, extract a real dependency graph, then chat with an
              agent that answers from your code — not guesses.
            </p>
            <ul className="hero-points">
              <li>AST-based import mapping for Python and JS/TS</li>
              <li>Local embeddings + vector search over your functions</li>
              <li>Guided chat for graphs, core files, and architecture questions</li>
            </ul>
            <div className="hero-actions">
              <a className="btn btn-light" href="#workspace">
                Start with a zip
              </a>
            </div>
          </div>
          <div className="hero-visual" aria-hidden>
            <img src={heroArt} alt="" />
          </div>
        </div>
      </section>

      <section className="workflow" id="workspace">
        <h2>Upload, analyze, then chat</h2>
        <p className="workflow-lead">
          Results stay out of this page on purpose — once analysis finishes, continue in
          chat for diagrams, core files, and FAQs.
        </p>

        <div className="steps">
          <div className="step">
            <span className="step-num">1</span>
            <div>
              <h3>Upload</h3>
              <p>Attach a .zip of your project source (skip venv and node_modules).</p>
            </div>
          </div>
          <div className="step">
            <span className="step-num">2</span>
            <div>
              <h3>Analyze</h3>
              <p>We parse imports, build the graph, embed code, and draft a short summary.</p>
            </div>
          </div>
          <div className="step">
            <span className="step-num">3</span>
            <div>
              <h3>Chat</h3>
              <p>Ask guided questions — graphs and answers live there, not here.</p>
            </div>
          </div>
        </div>

        <div className="panel">
          <p className="panel-label">Workspace</p>

          <div className="file-row">
            <input
              ref={fileRef}
              id="zip"
              className="file-input"
              type="file"
              accept=".zip,application/zip"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => fileRef.current?.click()}
              disabled={phase === "analyzing"}
            >
              {file ? "Change zip" : "Upload zip"}
            </button>
            <span className="file-name">
              {file ? file.name : "No file chosen yet"}
            </span>
          </div>

          <div className="actions-row">
            <button
              type="button"
              className="btn btn-primary"
              onClick={onAnalyze}
              disabled={!file || phase === "analyzing"}
            >
              {phase === "analyzing" ? "Analyzing…" : phase === "done" ? "Re-analyze" : "Analyze"}
            </button>
            {phase === "ready" && (
              <span className="file-name">Ready — click Analyze to run the pipeline.</span>
            )}
          </div>

          {error && <p className="error-text">{error}</p>}

          {phase === "done" && doneMeta && (
            <div className="status-ok">
              <p>
                <strong>Analysis complete.</strong> Parsed {doneMeta.files} source files
                from {doneMeta.name}. Open chat to explore the graph and ask questions.
              </p>
              <Link className="btn btn-primary" to="/chat">
                Go to chat →
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
