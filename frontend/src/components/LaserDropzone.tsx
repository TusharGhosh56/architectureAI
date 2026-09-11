import { useState, useRef, type DragEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { saveAnalysis, loadAnalysis, type AnalysisSession } from "../lib/session";
import { SAMPLE_PROJECTS } from "../lib/samples";

type TelemetryLog = {
  time: string;
  tag: string;
  message: string;
};

export default function LaserDropzone() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<TelemetryLog[]>([]);
  const activeSession = loadAnalysis();

  function addLog(tag: string, message: string) {
    const time = new Date().toTimeString().slice(0, 8);
    setLogs((prev) => [...prev, { time, tag, message }]);
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    if (!analyzing) setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (analyzing) return;
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      validateAndSetFile(files[0]);
    }
  }

  function validateAndSetFile(selected: File | null) {
    setError(null);
    if (!selected) {
      setFile(null);
      return;
    }
    if (!selected.name.toLowerCase().endsWith(".zip")) {
      setError("REJECTED: Archive must be a valid .zip format.");
      setFile(null);
      return;
    }
    setFile(selected);
    addLog("STAGING", `Archive selected: ${selected.name} (${(selected.size / 1024).toFixed(1)} KB)`);
  }

  function handleLoadSample(sample: AnalysisSession) {
    addLog("SAMPLE", `Loading sample codebase: ${sample.filename}`);
    saveAnalysis(sample);
    setTimeout(() => {
      navigate("/chat");
    }, 250);
  }

  async function handleAnalyze() {
    if (!file) {
      setError("Select or drop a codebase archive first.");
      return;
    }
    setAnalyzing(true);
    setError(null);
    setLogs([]);

    addLog("INIT", `Starting AST extraction for ${file.name}`);
    addLog("PARSER", "Filtering exclusions (node_modules, .venv, .git, vendor)...");

    try {
      const body = new FormData();
      body.append("file", file);

      addLog("NETWORK", "Streaming archive to backend pipeline on :8000...");
      const res = await fetch("/api/upload", { method: "POST", body });

      let data: any;
      try {
        data = await res.json();
      } catch {
        throw new Error(
          res.ok
            ? "Extraction completed but server response was not JSON."
            : `Pipeline unreachable (HTTP ${res.status}). Ensure backend is active on :8000`,
        );
      }

      if (!res.ok) {
        throw new Error(typeof data.detail === "string" ? data.detail : `Error HTTP ${res.status}`);
      }

      addLog("AST_GRAPH", `Resolved ${data.file_count || 0} source nodes and ${data.edge_count || 0} import edges.`);
      addLog("TOPOLOGY", `Detected ${(data.circular_deps || []).length} circular cycles.`);
      addLog("VECTORS", `Generated ${data.chunk_count || 0} function-level vector embeddings.`);

      const session: AnalysisSession = {
        project_id: data.project_id,
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
      addLog("SUCCESS", "Pipeline ready. Routing to Studio Canvas...");

      setTimeout(() => {
        navigate("/chat");
      }, 600);
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      addLog("ERROR", raw);
      setError(raw);
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <section className="split-feature-section" id="workspace">
      <div className="split-feature-container">
        {/* Left Column: Simple small content */}
        <div className="split-content-left">
          <div className="feature-eyebrow">// INGESTION WORKSPACE</div>
          <h2 className="split-heading">
            Analyze any codebase.
            <br />
            <span style={{ color: "#cbd5e1" }}>Zero code execution.</span>
          </h2>
          <p className="split-subheadline">
            Drop any Python (3.10–3.12) or TypeScript repository archive. ArchitectAI evaluates syntax trees in-memory without running untrusted code, extracting import graphs and ranking blast-radius gravity in seconds.
          </p>

          <div style={{ marginTop: "0.5rem" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)", marginBottom: "0.65rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Or explore a benchmark architecture:
            </div>
            <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
              {SAMPLE_PROJECTS.map((sample) => (
                <button
                  key={sample.project_id}
                  type="button"
                  className="sample-text-btn"
                  onClick={() => handleLoadSample(sample)}
                >
                  <span className="sample-btn-name">{sample.filename}</span>
                  <span className="sample-btn-meta">({sample.file_count} files)</span>
                  <span style={{ color: "var(--accent-teal)" }}>→</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Interactive macOS Window */}
        <div className="split-visual-right">
          <div className="feature-window-frame">
            <div className="repo-window-header">
              <div className="window-dots-cluster">
                <span className="window-dot" style={{ background: "#ff5f56" }} />
                <span className="window-dot" style={{ background: "#ffbd2e" }} />
                <span className="window-dot" style={{ background: "#27c93f" }} />
              </div>
              <div className="repo-url-bar">
                <span style={{ color: "#c9d1d9" }}>workspace / archive-dropstage</span>
                <span style={{ fontSize: "10px", padding: "0.1rem 0.4rem", borderRadius: "9999px", background: "rgba(255, 255, 255, 0.08)", color: "#8b949e" }}>
                  .ZIP
                </span>
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--accent-teal)" }}>
                IN-MEMORY AST
              </div>
            </div>

            <div
              className={`laser-dropstage ${isDragging ? "active" : ""}`}
              style={{ border: "none", borderRadius: 0, padding: "2.75rem 2rem" }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip,application/zip"
                style={{ display: "none" }}
                onChange={(e) => {
                  validateAndSetFile(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />

              <div className="dropstage-core">
                <div className="dropstage-prompt">
                  {analyzing
                    ? "Parsing Abstract Syntax Trees & Computing Centrality..."
                    : file
                      ? `Archive Ready: ${file.name}`
                      : "Drop your repository archive (.zip) here, or browse"}
                </div>

                <div className="dropstage-note">
                  Python 3.10–3.12 · TypeScript 5.x · Vendor folders (<code className="inline-code">node_modules</code>, <code className="inline-code">.venv</code>) excluded automatically.
                </div>

                {!analyzing && (
                  <div style={{ display: "flex", gap: "0.85rem", marginTop: "1rem", flexWrap: "wrap", justifyContent: "center", alignItems: "center" }}>
                    <button
                      type="button"
                      className="btn-secondary-glass"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {file ? "Change Archive" : "Select .zip Archive"}
                    </button>

                    {file && (
                      <button
                        type="button"
                        className="btn-border-beam-wrapper"
                        onClick={handleAnalyze}
                      >
                        <span className="btn-border-beam-core">
                          <span>Analyze Codebase</span>
                          <span style={{ color: "var(--accent-teal)", fontWeight: 700 }}>→</span>
                        </span>
                      </button>
                    )}
                  </div>
                )}

                {error && (
                  <div
                    style={{
                      color: "var(--accent-rose)",
                      fontFamily: "var(--font-mono)",
                      fontSize: "12px",
                      border: "1px solid rgba(244, 63, 94, 0.4)",
                      background: "var(--accent-rose-dim)",
                      padding: "0.65rem 1rem",
                      borderRadius: "8px",
                      width: "100%",
                      marginTop: "0.75rem",
                      textAlign: "left",
                    }}
                  >
                    <strong>[PIPELINE ERROR]</strong> {error}
                  </div>
                )}
              </div>
            </div>

            {logs.length > 0 && (
              <div className="telemetry-terminal" style={{ margin: "0", borderRadius: 0, borderLeft: "none", borderRight: "none", borderBottom: "none" }}>
                <div
                  style={{
                    color: "var(--text-faint)",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    paddingBottom: "0.4rem",
                    marginBottom: "0.4rem",
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span>// PIPELINE TELEMETRY STREAM</span>
                  <span>PORT :8000</span>
                </div>
                {logs.map((l, i) => (
                  <div key={i}>
                    <span className="telemetry-line-time">{l.time}</span>
                    <span className="telemetry-line-tag">[{l.tag}]</span>
                    <span>{l.message}</span>
                  </div>
                ))}
              </div>
            )}
            {activeSession && !analyzing && (
              <div
                style={{
                  padding: "0.85rem 1.25rem",
                  background: "rgba(45, 212, 191, 0.05)",
                  borderTop: "1px solid rgba(45, 212, 191, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "0.75rem",
                }}
              >
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "10.5px", color: "var(--accent-teal)", fontWeight: 700 }}>
                    ACTIVE SESSION: {activeSession.filename}
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-secondary)" }}>
                    {activeSession.file_count} nodes · {activeSession.edge_count} edges
                  </div>
                </div>
                <Link to="/chat" style={{ fontFamily: "var(--font-mono)", fontSize: "11.5px", color: "var(--accent-teal)", fontWeight: 600 }}>
                  Open Studio Canvas →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
