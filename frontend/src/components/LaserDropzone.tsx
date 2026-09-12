import { useState, useRef, type DragEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { saveAnalysis, loadAnalysis, type AnalysisSession } from "../lib/session";
import { SAMPLE_PROJECTS } from "../lib/samples";
import { apiUrl, API_BASE_URL } from "../lib/api";
import { optimizeZipArchive } from "../lib/zipOptimizer";

import ingestArchiveImg from "../assets/ingest_archive.jpg";
import benchmarkFastApiImg from "../assets/benchmark_fastapi.jpg";
import benchmarkReactImg from "../assets/benchmark_react.jpg";
import securityAstImg from "../assets/security_ast.jpg";

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
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
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
    addLog("SAMPLE", `Loading benchmark codebase: ${sample.filename}`);
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
      let uploadFile = file;
      if (file.size > 2 * 1024 * 1024) {
        addLog(
          "PARSER",
          `Pre-filtering archive (${(file.size / (1024 * 1024)).toFixed(1)} MB) to strip node_modules, .git, and binaries...`,
        );
        const opt = await optimizeZipArchive(file);
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

  const rows = [
    {
      id: "archive",
      title: "DROP ARCHIVE",
      category: "LOCAL .ZIP",
      image: ingestArchiveImg,
      alt: "Upload or drop repository zip archive",
      hint: "Click to select your codebase .zip archive",
      action: () => fileInputRef.current?.click(),
    },
    {
      id: "fastapi",
      title: "FASTAPI SERVICE",
      category: "BENCHMARK · 28 FILES",
      image: benchmarkFastApiImg,
      alt: "FastAPI agent microservice architecture topology",
      hint: "Click to load pre-compiled FastAPI agent service",
      action: () => handleLoadSample(SAMPLE_PROJECTS[0]),
    },
    {
      id: "react",
      title: "REACT DASHBOARD",
      category: "BENCHMARK · 36 FILES",
      image: benchmarkReactImg,
      alt: "React TypeScript frontend component hierarchy",
      hint: "Click to load modern React TypeScript dashboard",
      action: () => handleLoadSample(SAMPLE_PROJECTS[1]),
    },
    {
      id: "security",
      title: "ZERO EXECUTION",
      category: "IN-MEMORY AST",
      image: securityAstImg,
      alt: "In-memory AST static code analysis security",
      hint: "Safe static analysis with zero untrusted execution",
      action: () => {
        addLog("SECURITY", "Verified in-memory AST evaluation: Zero arbitrary code execution.");
      },
    },
  ];

  return (
    <section
      className={`workspace-showcase-section ${isDragging ? "is-drag-active" : ""}`}
      id="workspace"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden File Input for Native File Dialog */}
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

      {/* Drag Over Active Glow Overlay */}
      {isDragging && (
        <div className="workspace-drag-overlay">
          <div className="workspace-drag-prompt">
            <span className="workspace-drag-icon">⚡</span>
            <span>Drop repository archive (.zip) to ingest</span>
          </div>
        </div>
      )}

      <div className="workspace-showcase-container">
        {/* Eyebrow & Headline */}
        <div className="workspace-header-cluster">
          <h2 className="workspace-headline">
            Analyze any codebase.
            <br />
            <span style={{ color: "#cbd5e1" }}>Zero code execution.</span>
          </h2>
          <p className="workspace-subheadline">
            Drop any Python (3.10–3.12) or TypeScript repository archive. ArchitectAI evaluates syntax trees in-memory without running untrusted code, extracting import graphs and ranking blast-radius gravity in seconds.
          </p>
        </div>

        {/* Staged File Action Banner (Appears when a .zip is staged) */}
        {file && (
          <div className="staged-archive-banner">
            <div className="staged-archive-info">
              <span className="staged-archive-badge">STAGED</span>
              <div>
                <div className="staged-archive-filename">{file.name}</div>
                <div className="staged-archive-meta">
                  {(file.size / 1024).toFixed(1)} KB · Ready for AST Extraction
                </div>
              </div>
            </div>
            <div className="staged-archive-buttons">
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
                className="btn-border-beam-wrapper"
                onClick={handleAnalyze}
                disabled={analyzing}
              >
                <span className="btn-border-beam-core">
                  <span>{analyzing ? "Extracting AST..." : "Analyze Codebase"}</span>
                  <span style={{ color: "var(--accent-teal)", fontWeight: 700 }}>→</span>
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Error Notification */}
        {error && (
          <div className="workspace-pipeline-error">
            <strong>[PIPELINE ERROR]</strong> {error}
          </div>
        )}

        {/* 4 Interactive Process Rows with Hover Slant & Preview Card Reveal */}
        <div className="process-list-container" role="list">
          {rows.map((row) => {
            const isHovered = hoveredRow === row.id;

            return (
              <div
                key={row.id}
                role="listitem"
                className={`process-row ${isHovered ? "is-active" : ""}`}
                onMouseEnter={() => setHoveredRow(row.id)}
                onMouseLeave={() => setHoveredRow(null)}
                onClick={row.action}
                title={row.hint}
              >
                {/* Left Side: Heavy Typography Main Title */}
                <div className="process-title-wrapper">
                  <span className={`process-title ${isHovered ? "text-accent-blue" : ""}`}>
                    {row.title}
                  </span>
                </div>

                {/* Right Side: Hover-Revealed Thumbnail Card & Category Tag */}
                <div className="process-meta-wrapper">
                  {/* Floating Image Preview Card */}
                  <div
                    className={`process-image-card ${isHovered ? "card-visible" : "card-hidden"}`}
                    aria-hidden={!isHovered}
                  >
                    <img
                      src={row.image}
                      alt={row.alt}
                      className="process-card-thumbnail"
                      loading="eager"
                    />
                    <div className="process-card-overlay" />
                  </div>

                  {/* Category Tag on the Right */}
                  <span className={`process-category-tag ${isHovered ? "tag-dimmed" : ""}`}>
                    {row.category}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Telemetry Stream Terminal (Active during analysis or if logs exist) */}
        {logs.length > 0 && (
          <div className="telemetry-terminal workspace-telemetry-box">
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

        {/* Active Session Footer Bar */}
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

