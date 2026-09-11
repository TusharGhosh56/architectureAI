import { useState, useRef, type DragEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { saveAnalysis, loadAnalysis, type AnalysisSession } from "../lib/session";

import repoIngestImg from "../assets/repo_ingest.jpg";
import userTopologyImg from "../assets/topology_graph.jpg";
import repoAuditImg from "../assets/integrity_audit.jpg";
import userStudioImg from "../assets/studio_assistant.jpg";

type TelemetryLog = {
  time: string;
  tag: string;
  message: string;
};

export default function FeatureShowcase() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<TelemetryLog[]>([]);
  const [activeRow, setActiveRow] = useState<number>(0); // Default first row expanded
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
    setActiveRow(0); // Ensure Ingestion row is expanded
    addLog("STAGING", `Archive selected: ${selected.name} (${(selected.size / 1024).toFixed(1)} KB)`);
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
    <section
      className={`feature-showcase-section ${isDragging ? "is-drag-active" : ""}`}
      id="workspace"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden File Input */}
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

      {/* Drag Over Active Laser Overlay */}
      {isDragging && (
        <div className="workspace-drag-overlay">
          <div className="workspace-drag-prompt">
            <span className="workspace-drag-icon">⚡</span>
            <span>Drop repository archive (.zip) to ingest</span>
          </div>
        </div>
      )}

      <div className="feature-showcase-container">
        {/* Eyebrow */}

        {/* 4 Interactive Expanding Process Rows */}
        <div className="feature-accordion-list" role="list">
          {/* ROW 1: INGESTION */}
          <div
            className={`feature-accordion-row ${activeRow === 0 ? "is-expanded" : ""}`}
            onMouseEnter={() => setActiveRow(0)}
            role="listitem"
          >
            <div className="feature-row-header" onClick={() => setActiveRow(0)}>
              <div className="feature-title-wrapper">
                <span className={`feature-row-title ${activeRow === 0 ? "text-accent-blue" : ""}`}>
                  INGESTION
                </span>
              </div>
              <div className="feature-row-meta">
                <span className={`feature-category-tag ${activeRow === 0 ? "tag-active" : ""}`}>
                  SAFE INGESTION
                </span>
              </div>
            </div>

            {/* Expanding Content Area */}
            <div className="feature-row-body">
              <div className="feature-body-inner">
                {/* Left Column: Revealed Copy & Live Actions */}
                <div className="feature-copy-column">
                  <h3 className="feature-expanded-heading">
                    Analyze any codebase.
                    <br />
                    <span style={{ color: "#cbd5e1" }}>Zero code execution.</span>
                  </h3>
                  <p className="feature-expanded-desc">
                    Drop any Python (3.10–3.12) or TypeScript repository archive. ArchitectAI evaluates syntax trees in-memory without running untrusted code, extracting import graphs and ranking blast-radius gravity in seconds.
                  </p>

                  {/* Staged File Action Bar */}
                  {file ? (
                    <div className="feature-staged-box">
                      <div className="feature-staged-meta">
                        <span className="feature-staged-tag">STAGED</span>
                        <span className="feature-staged-name">{file.name}</span>
                        <span className="feature-staged-size">({(file.size / 1024).toFixed(1)} KB)</span>
                      </div>
                      <div className="feature-staged-actions">
                        <button
                          type="button"
                          className="btn-secondary-glass"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={analyzing}
                        >
                          Change Archive
                        </button>
                        <button
                          type="button"
                          className="feature-upload-btn feature-analyze-btn"
                          onClick={handleAnalyze}
                          disabled={analyzing}
                        >
                          <span className="feature-upload-btn-content">
                            <span>{analyzing ? "Extracting AST..." : "Analyze Codebase"}</span>
                            <span className="feature-upload-arrow">→</span>
                          </span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="feature-action-group">
                      <button
                        type="button"
                        className="feature-upload-btn"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <span className="feature-upload-btn-content">
                          <svg className="feature-upload-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                          </svg>
                          <span>Select .zip Archive</span>
                          <span className="feature-upload-arrow">→</span>
                        </span>
                      </button>
                    </div>
                  )}

                  {error && (
                    <div className="feature-error-alert">
                      <strong>[PIPELINE ERROR]</strong> {error}
                    </div>
                  )}

                  {logs.length > 0 && (
                    <div className="telemetry-terminal feature-telemetry-inline">
                      <div className="telemetry-terminal-header">
                        <span>// PIPELINE TELEMETRY STREAM</span>
                        <span>PORT :8000</span>
                      </div>
                      {logs.map((l, i) => (
                        <div key={i} className="telemetry-log-row">
                          <span className="telemetry-line-time">{l.time}</span>
                          <span className="telemetry-line-tag">[{l.tag}]</span>
                          <span>{l.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right Column: Authentic macOS IDE Window Frame */}
                <div className="feature-visual-column">
                  <div className="feature-ide-frame">
                    <div className="feature-ide-content">
                      <img
                        src={repoIngestImg}
                        alt="Repository Ingestion IDE Window"
                        className="feature-ide-img"
                        loading="eager"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ROW 2: TOPOLOGY */}
          <div
            className={`feature-accordion-row ${activeRow === 1 ? "is-expanded" : ""}`}
            onMouseEnter={() => setActiveRow(1)}
            role="listitem"
          >
            <div className="feature-row-header" onClick={() => setActiveRow(1)}>
              <div className="feature-title-wrapper">
                <span className={`feature-row-title ${activeRow === 1 ? "text-accent-blue" : ""}`}>
                  TOPOLOGY
                </span>
              </div>
              <div className="feature-row-meta">
                <span className={`feature-category-tag ${activeRow === 1 ? "tag-active" : ""}`}>
                  IMPACT ANALYSIS
                </span>
              </div>
            </div>

            {/* Expanding Content Area */}
            <div className="feature-row-body">
              <div className="feature-body-inner">
                {/* Left Column: Revealed Copy & Metrics */}
                <div className="feature-copy-column">
                  <h3 className="feature-expanded-heading">
                    Quantify blast radius.
                    <br />
                    <span style={{ color: "#cbd5e1" }}>Before you refactor.</span>
                  </h3>
                  <p className="feature-expanded-desc">
                    Every module in your system exerts gravitational pull. By compiling import statements into a directed acyclic graph, ArchitectAI ranks centrality and exposes every downstream service that breaks if foundational logic changes.
                  </p>

                  <div className="feature-stat-row">
                    <div className="feature-stat-pill">
                      <span className="feature-stat-dot" />
                      <span>345 AST Nodes</span>
                    </div>
                    <div className="feature-stat-pill">
                      <span className="feature-stat-dot" />
                      <span>812 Directed Edges</span>
                    </div>
                    <div className="feature-stat-pill">
                      <span className="feature-stat-dot" />
                      <span>O(V+E) Propagation</span>
                    </div>
                  </div>

                  <div style={{ marginTop: "1.5rem" }}>
                    <a href="#graph" className="feature-inline-link">
                      <span>Explore Topological DAG View</span>
                      <span style={{ color: "var(--accent-teal)" }}>↓</span>
                    </a>
                  </div>
                </div>

                {/* Right Column: Authentic macOS IDE Window Frame */}
                <div className="feature-visual-column">
                  <div className="feature-ide-frame">
                    <div className="feature-ide-content">
                      <img
                        src={userTopologyImg}
                        alt="Topological Dependency Graph Window"
                        className="feature-ide-img"
                        loading="eager"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ROW 3: INTEGRITY */}
          <div
            className={`feature-accordion-row ${activeRow === 2 ? "is-expanded" : ""}`}
            onMouseEnter={() => setActiveRow(2)}
            role="listitem"
          >
            <div className="feature-row-header" onClick={() => setActiveRow(2)}>
              <div className="feature-title-wrapper">
                <span className={`feature-row-title ${activeRow === 2 ? "text-accent-blue" : ""}`}>
                  INTEGRITY
                </span>
              </div>
              <div className="feature-row-meta">
                <span className={`feature-category-tag ${activeRow === 2 ? "tag-active" : ""}`}>
                  CYCLE DETECTION
                </span>
              </div>
            </div>

            {/* Expanding Content Area */}
            <div className="feature-row-body">
              <div className="feature-body-inner">
                {/* Left Column: Revealed Copy & Metrics */}
                <div className="feature-copy-column">
                  <h3 className="feature-expanded-heading">
                    Expose circular traps.
                    <br />
                    <span style={{ color: "#cbd5e1" }}>Prevent runtime deadlocks.</span>
                  </h3>
                  <p className="feature-expanded-desc">
                    Hidden circular import chains (<code className="inline-code">A → B → C → A</code>) cause subtle runtime initialization failures and memory retention issues in production. ArchitectAI runs Tarjan's Strongly Connected Components algorithm to mathematically guarantee DAG purity.
                  </p>

                  <div className="feature-stat-row">
                    <div className="feature-stat-pill">
                      <span className="feature-stat-dot" />
                      <span>Tarjan SCC Engine</span>
                    </div>
                    <div className="feature-stat-pill">
                      <span className="feature-stat-dot" />
                      <span>0ms Cycle Detection</span>
                    </div>
                    <div className="feature-stat-pill">
                      <span className="feature-stat-dot" />
                      <span>94/100 Integrity Score</span>
                    </div>
                  </div>
                </div>

                {/* Right Column: Authentic macOS IDE Window Frame */}
                <div className="feature-visual-column">
                  <div className="feature-ide-frame">
                    <div className="feature-ide-content">
                      <img
                        src={repoAuditImg}
                        alt="Architecture Audit & Cycle Detection Window"
                        className="feature-ide-img"
                        loading="eager"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ROW 4: STUDIO */}
          <div
            className={`feature-accordion-row ${activeRow === 3 ? "is-expanded" : ""}`}
            onMouseEnter={() => setActiveRow(3)}
            role="listitem"
          >
            <div className="feature-row-header" onClick={() => setActiveRow(3)}>
              <div className="feature-title-wrapper">
                <span className={`feature-row-title ${activeRow === 3 ? "text-accent-blue" : ""}`}>
                  STUDIO
                </span>
              </div>
              <div className="feature-row-meta">
                <span className={`feature-category-tag ${activeRow === 3 ? "tag-active" : ""}`}>
                  AI CODE CHAT
                </span>
              </div>
            </div>

            {/* Expanding Content Area */}
            <div className="feature-row-body">
              <div className="feature-body-inner">
                {/* Left Column: Revealed Copy & Studio CTA */}
                <div className="feature-copy-column">
                  <h3 className="feature-expanded-heading">
                    Interrogate your system.
                    <br />
                    <span style={{ color: "#cbd5e1" }}>Zero hallucinations.</span>
                  </h3>
                  <p className="feature-expanded-desc">
                    Query your architecture through an autonomous reasoning agent backed by your compiled graph. Ask what breaks if a service changes, simulate architectural refactors, and inspect verified Mermaid diagrams with deterministic ground truth.
                  </p>

                  <div style={{ marginTop: "1.75rem" }}>
                    <Link to="/chat" className="feature-upload-btn feature-studio-btn">
                      <span className="feature-upload-btn-content">
                        <span>Launch Studio Canvas</span>
                        <span className="feature-upload-arrow">→</span>
                      </span>
                    </Link>
                  </div>
                </div>

                {/* Right Column: Authentic macOS IDE Window Frame */}
                <div className="feature-visual-column">
                  <div className="feature-ide-frame">
                    <div className="feature-ide-content">
                      <img
                        src={userStudioImg}
                        alt="Studio Canvas Reasoning Agent Window"
                        className="feature-ide-img"
                        loading="eager"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Active Session Bar if user already analyzed */}
        {activeSession && !analyzing && (
          <div className="workspace-active-session-bar">
            <div>
              <div className="active-session-label">
                ACTIVE SESSION: {activeSession.filename}
              </div>
              <div className="active-session-meta">
                {activeSession.file_count} nodes · {activeSession.edge_count} edges
              </div>
            </div>
            <Link to="/chat" className="active-session-link">
              Open Studio Canvas →
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
