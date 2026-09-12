import { useState, useRef, type DragEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { saveAnalysis, loadAnalysis, type AnalysisSession } from "../lib/session";
import { apiUrl, API_BASE_URL } from "../lib/api";
import { optimizeZipArchive } from "../lib/zipOptimizer";

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
  const [completedSession, setCompletedSession] = useState<AnalysisSession | null>(null);
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

  function validateAndSetFile(selected: File | null, autoAnalyze = false) {
    setError(null);
    setCompletedSession(null);
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

    setTimeout(() => {
      document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);

    if (autoAnalyze) {
      setTimeout(() => {
        handleAnalyze(selected);
      }, 400);
    }
  }

  async function handleAnalyze(fileOverride?: unknown) {
    const activeFile = fileOverride instanceof File ? fileOverride : file;
    if (!activeFile) {
      setError("Select or drop a codebase archive first.");
      return;
    }
    setAnalyzing(true);
    setError(null);
    setLogs([]);

    addLog("INIT", `Starting AST extraction for ${activeFile.name}`);
    addLog("PARSER", "Filtering exclusions (node_modules, .venv, .git, vendor)...");

    try {
      let uploadFile = activeFile;
      if (activeFile.size > 2 * 1024 * 1024) {
        addLog(
          "PARSER",
          `Pre-filtering archive (${(activeFile.size / (1024 * 1024)).toFixed(1)} MB) to strip node_modules, .git, and binaries...`,
        );
        const opt = await optimizeZipArchive(activeFile);
        uploadFile = opt.file;
        addLog(
          "PARSER",
          `Optimized archive to ${(uploadFile.size / (1024 * 1024)).toFixed(2)} MB (${opt.filesKept} source files kept).`,
        );
      }

      const body = new FormData();
      body.append("file", uploadFile);

      const targetLabel = API_BASE_URL || (window.location.hostname === "localhost" ? ":8000" : window.location.origin);
      addLog("NETWORK", `Streaming archive to backend pipeline (${targetLabel})...`);
      const res = await fetch(apiUrl("/api/upload"), { method: "POST", body });

      let data: any;
      try {
        data = await res.json();
      } catch {
        throw new Error(
          res.ok
            ? "Extraction completed but server response was not JSON."
            : `Pipeline unreachable (HTTP ${res.status}). ${
                window.location.hostname !== "localhost" && !API_BASE_URL
                  ? "Vercel static hosting requires a live backend. Set VITE_API_URL in your Vercel Project Settings to your deployed backend."
                  : "Ensure backend server is running on :8000."
              }`,
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
        filename: data.filename || activeFile.name,
        file_count: data.file_count ?? 0,
        edge_count: data.edge_count ?? 0,
        important_files: data.important_files ?? [],
        circular_deps: data.circular_deps ?? [],
        diagram_mermaid: data.diagram_mermaid ?? "",
        architecture_summary: data.architecture_summary ?? "",
        chunk_count: data.chunk_count ?? 0,
      };

      saveAnalysis(session);
      setCompletedSession(session);
      addLog("SUCCESS", "Pipeline ready. Codebase grounded and indexed.");
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
        id="workspace-file-input"
        type="file"
        accept=".zip,application/zip"
        style={{ display: "none" }}
        onChange={(e) => {
          const isFromHero = e.target.dataset.source === "hero";
          e.target.dataset.source = "";
          validateAndSetFile(e.target.files?.[0] ?? null, isFromHero);
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

                  {/* Staged File Action Bar / Completion Bar */}
                  {completedSession ? (
                    <div className="feature-staged-box is-complete">
                      <div className="feature-staged-header">
                        <div className="feature-staged-file-info">
                          <div className="feature-staged-icon-wrap is-complete">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                          <div className="feature-staged-details">
                            <div className="feature-staged-title-row">
                              <span className="feature-staged-name">{completedSession.filename}</span>
                            </div>
                            <div className="feature-staged-status-line">
                              <span className="feature-staged-dot is-complete" />
                              <span>ANALYSIS COMPLETE</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="feature-staged-actions">
                        <button
                          type="button"
                          className="feature-btn-primary"
                          onClick={() => navigate("/chat")}
                        >
                          <span>Open Architecture Studio</span>
                          <span className="feature-btn-arrow">→</span>
                        </button>
                        <button
                          type="button"
                          className="feature-btn-secondary"
                          onClick={() => {
                            setFile(null);
                            setCompletedSession(null);
                            setLogs([]);
                            fileInputRef.current?.click();
                          }}
                        >
                          Upload Different Archive
                        </button>
                      </div>
                    </div>
                  ) : file ? (
                    <div className="feature-staged-box">
                      <div className="feature-staged-header">
                        <div className="feature-staged-file-info">
                          <div className="feature-staged-icon-wrap">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                              <line x1="12" y1="22.08" x2="12" y2="12" />
                            </svg>
                          </div>
                          <div className="feature-staged-details">
                            <div className="feature-staged-title-row">
                              <span className="feature-staged-name">{file.name}</span>
                              <span className="feature-staged-size-badge">
                                {file.size > 1024 * 1024
                                  ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
                                  : `${(file.size / 1024).toFixed(1)} KB`}
                              </span>
                            </div>
                            <div className="feature-staged-status-line">
                              <span className={`feature-staged-dot ${analyzing ? "is-analyzing" : ""}`} />
                              <span>{analyzing ? "EXTRACTING AST IN-MEMORY..." : "IN-MEMORY STAGE READY"}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="feature-staged-actions">
                        <button
                          type="button"
                          className="feature-btn-secondary"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={analyzing}
                        >
                          Change Archive
                        </button>
                        <button
                          type="button"
                          className={`feature-btn-primary ${analyzing ? "is-analyzing" : ""}`}
                          onClick={handleAnalyze}
                          disabled={analyzing}
                        >
                          {analyzing ? (
                            <>
                              <span className="feature-spinner" />
                              <span>Extracting AST...</span>
                            </>
                          ) : (
                            <>
                              <span>Analyze Codebase</span>
                              <span className="feature-btn-arrow">→</span>
                            </>
                          )}
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
                </div>

                {/* Right Column: Authentic macOS IDE Window Frame / Live Terminal Studio */}
                <div className="feature-visual-column">
                  {file || analyzing || logs.length > 0 || completedSession ? (
                    <div className="live-ide-window">
                      {/* Window Header */}
                      <div className="live-ide-header">
                        <div className="live-ide-traffic-lights">
                          <span className="live-ide-dot dot-red" />
                          <span className="live-ide-dot dot-yellow" />
                          <span className="live-ide-dot dot-green" />
                        </div>
                        <div className="live-ide-tab">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                          </svg>
                          <span>{file?.name || completedSession?.filename || "repository.zip"}</span>
                        </div>
                        <span className={`live-ide-status-badge ${completedSession ? "is-complete" : analyzing ? "is-analyzing" : "is-staged"}`}>
                          {completedSession ? "✓ READY" : analyzing ? "EXTRACTING" : "STAGED"}
                        </span>
                      </div>

                      {/* Progress Bar Track */}
                      <div className="live-ide-progress-wrap">
                        <div className="live-ide-progress-info">
                          <span className="live-ide-progress-label">
                            {completedSession
                              ? "AST Pipeline Complete • Grounded & Indexed"
                              : analyzing
                              ? "Compiling abstract syntax graph & import topology..."
                              : "Archive loaded in-memory • Ready to compile AST"}
                          </span>
                          <span className="live-ide-progress-pct">
                            {completedSession ? "100%" : analyzing ? "85%" : "0%"}
                          </span>
                        </div>
                        <div className="live-ide-progress-track">
                          <div
                            className={`live-ide-progress-fill ${analyzing ? "is-pulsing" : ""}`}
                            style={{ width: completedSession ? "100%" : analyzing ? "85%" : "15%" }}
                          />
                        </div>
                      </div>

                      {/* Terminal Stream */}
                      <div className="live-ide-terminal-body">
                        {logs.map((l, i) => (
                          <div key={i} className="live-log-row">
                            <span className="live-log-time">{l.time}</span>
                            <span className={`live-log-tag tag-${l.tag.toLowerCase()}`}>[{l.tag}]</span>
                            <span className="live-log-msg">{l.message}</span>
                          </div>
                        ))}
                        {analyzing && (
                          <div className="live-ide-cursor-row">
                            <span className="live-ide-cursor">▋</span>
                            <span>resolving file hierarchy & import edges...</span>
                          </div>
                        )}
                      </div>

                      {/* Completion Metrics & Action Card */}
                      {completedSession && (
                        <div className="live-ide-results-card">
                          <div className="live-ide-metrics-grid">
                            <div className="live-ide-metric">
                              <span className="live-ide-metric-num">{completedSession.file_count}</span>
                              <span className="live-ide-metric-label">Source Files</span>
                            </div>
                            <div className="live-ide-metric">
                              <span className="live-ide-metric-num">{completedSession.edge_count}</span>
                              <span className="live-ide-metric-label">Import Edges</span>
                            </div>
                            <div className="live-ide-metric">
                              <span className="live-ide-metric-num">{completedSession.circular_deps?.length || 0}</span>
                              <span className="live-ide-metric-label">Circular Traps</span>
                            </div>
                            <div className="live-ide-metric">
                              <span className="live-ide-metric-num">{completedSession.chunk_count}</span>
                              <span className="live-ide-metric-label">Vector Chunks</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
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
                  )}
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
                <span className="active-session-tag">
                  <span className="active-session-dot" />
                  Active Session
                </span>
                <span style={{ color: "#ffffff", fontWeight: 700 }}>
                  {activeSession.filename}
                </span>
              </div>
              <div className="active-session-meta">
                <span>{activeSession.file_count} nodes</span>
                <span style={{ color: "rgba(255, 255, 255, 0.2)" }}>·</span>
                <span>{activeSession.edge_count} edges</span>
                <span style={{ color: "rgba(255, 255, 255, 0.2)" }}>·</span>
                <span style={{ color: "var(--accent-teal)" }}>Ready in Memory</span>
              </div>
            </div>
            <Link to="/chat" className="active-session-link">
              <span>Open Studio Canvas</span>
              <span>→</span>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
