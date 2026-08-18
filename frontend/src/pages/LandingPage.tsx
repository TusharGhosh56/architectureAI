import { useRef, useState } from "react";
import type { DragEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import confetti from "canvas-confetti";
import {
  Upload,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  GitFork,
  Layers,
  ChevronDown,
  ChevronUp,
  FileArchive,
  Network,
  Cpu,
  CheckCircle2,
  AlertCircle,
  Code2,
} from "lucide-react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import MermaidDiagram from "../components/MermaidDiagram";
import heroArt from "../assets/hero_saas.jpg";
import astArt from "../assets/ast_engine.jpg";
import { saveAnalysis, type AnalysisSession } from "../lib/session";
import { DEMO_PROJECT } from "../lib/demoProject";

gsap.registerPlugin(useGSAP);

type Phase = "idle" | "ready" | "analyzing" | "done";

type UploadApiResult = AnalysisSession & {
  status: string;
  truncated?: boolean;
};

const SAMPLE_GALLERY_DIAGRAMS = {
  layers: {
    title: "Layered Tier Architecture",
    code: `flowchart TB
    subgraph Presentation ["Presentation & API Gateway"]
      Routes["FastAPI / Express Endpoints"]
      AuthMid["JWT Auth Interceptor"]
    end
    subgraph Application ["Domain & Service Layer"]
      OrderSaga["Order Orchestrator"]
      PaymentService["Payment Gateway Client"]
    end
    subgraph Infrastructure ["Data & Messaging Layer"]
      DB[("PostgreSQL")]
      Kafka["Kafka Message Bus"]
    end
    Presentation --> Application
    Application --> Infrastructure`,
  },
  flow: {
    title: "Request Execution Flow",
    code: `flowchart LR
    Client["Client Request"] --> Ingress["API Gateway"]
    Ingress --> Verify{"Verify Token"}
    Verify -- Valid --> Service["Core Microservice"]
    Verify -- Invalid --> Reject["401 Unauthorized"]
    Service --> Event["Publish Event"]
    Service --> Response["200 OK Response"]`,
  },
  usecase: {
    title: "UML Actor Interaction",
    code: `flowchart LR
    Dev["👨‍💻 Developer"]
    Arch["🏛️ Architect"]
    Dev --> Scan["Upload Codebase ZIP"]
    Dev --> Inspect["Inspect Dependency Graph"]
    Arch --> Query["Query Architecture RAG"]
    Arch --> Cycles["Audit Circular Imports"]`,
  },
};

const FAQ_ITEMS = [
  {
    q: "How does ArchitectAI extract dependencies without running my code?",
    a: "We perform static Abstract Syntax Tree (AST) parsing using Tree-Sitter for JavaScript/TypeScript and native Python AST. We resolve relative and package imports directly from syntax nodes with zero runtime execution.",
  },
  {
    q: "Is my source code uploaded or stored on public servers?",
    a: "Your zip archive is parsed entirely in your active session. Embeddings and graphs are processed in memory and local vector stores, guaranteeing maximum privacy for proprietary repos.",
  },
  {
    q: "What programming languages are currently supported?",
    a: "ArchitectAI natively parses Python (.py), JavaScript (.js, .jsx), TypeScript (.ts, .tsx), and modern ECMAScript module imports.",
  },
  {
    q: "What types of diagrams can the AI generate in the studio?",
    a: "You can ask for Component Dependency Graphs, Layered Architectures, UML Use Case diagrams, Data Flowcharts, Sequence interactions, and Module coupling maps.",
  },
  {
    q: "Can I test the platform without uploading a ZIP file?",
    a: "Yes! Click 'Try Live Demo' anywhere on the page to instantly explore a pre-computed microservices architecture in the AI Studio.",
  },
];

export default function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [pipelineStep, setPipelineStep] = useState(0);
  const [doneMeta, setDoneMeta] = useState<{ name: string; files: number; edges: number } | null>(null);
  const [activeGalleryTab, setActiveGalleryTab] = useState<keyof typeof SAMPLE_GALLERY_DIAGRAMS>("layers");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from(".hero-pill-row", { y: 20, opacity: 0, duration: 0.6 })
        .from(".hero-title", { y: 24, opacity: 0, duration: 0.65 }, "-=0.4")
        .from(".hero-subtitle", { y: 18, opacity: 0, duration: 0.6 }, "-=0.4")
        .from(".hero-actions-row", { y: 16, opacity: 0, duration: 0.5 }, "-=0.35")
        .from(".hero-visual-card", { scale: 0.94, opacity: 0, duration: 0.8 }, "-=0.5");
    },
    { scope: rootRef },
  );

  const handlePickFile = (selected: File | null) => {
    setError(null);
    setDoneMeta(null);
    if (!selected) {
      setFile(null);
      setPhase("idle");
      return;
    }
    if (!selected.name.toLowerCase().endsWith(".zip")) {
      setError("Please select a .zip archive of your project repository.");
      setFile(null);
      setPhase("idle");
      return;
    }
    setFile(selected);
    setPhase("ready");
  };

  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handlePickFile(e.dataTransfer.files[0]);
    }
  };

  const handleLaunchDemo = () => {
    saveAnalysis({ ...DEMO_PROJECT, is_demo: true });
    navigate("/chat");
  };

  const onAnalyze = async () => {
    if (!file) {
      setError("Please choose a project zip first.");
      return;
    }
    setPhase("analyzing");
    setError(null);
    setPipelineStep(1);

    // Simulate animated pipeline step transitions for high-end SaaS feel
    const timer1 = setTimeout(() => setPipelineStep(2), 700);
    const timer2 = setTimeout(() => setPipelineStep(3), 1400);
    const timer3 = setTimeout(() => setPipelineStep(4), 2200);

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
            ? "Analysis finished but backend response was not valid JSON."
            : `Analysis failed (HTTP ${res.status}). Is the backend server running?`,
        );
      }
      if (!res.ok) {
        const detail = data.detail;
        throw new Error(
          typeof detail === "string" ? detail : `Analysis failed (HTTP ${res.status})`,
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
      setDoneMeta({
        name: session.filename,
        files: session.file_count,
        edges: session.edge_count,
      });
      setPhase("done");

      // Trigger celebration confetti
      try {
        void confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#06b6d4", "#6366f1", "#10b981", "#38bdf8"],
        });
      } catch {
        // Safe fallback
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      if (raw === "Failed to fetch" || /NetworkError|fetch/i.test(raw)) {
        setError(
          "Could not reach backend API on :8000. You can try the 'Live Demo Sandbox' button to test all UI features instantly!",
        );
      } else {
        setError(raw);
      }
      setPhase(file ? "ready" : "idle");
    } finally {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    }
  };

  return (
    <div className="landing-page" ref={rootRef}>
      <Navbar />

      {/* Hero Section */}
      <section className="hero-section" aria-label="ArchitectAI Hero">
        <div className="hero-grid-ambient" aria-hidden="true" />
        <div className="hero-container">
          <div>
            <div className="hero-pill-row">
              <span className="pill-badge">
                <Sparkles size={13} />
                <span>Next-Gen AST Architecture Mapping & Neural RAG</span>
              </span>
            </div>

            <h1 className="hero-title">
              Understand Any Codebase in <span className="gradient-text">Seconds</span>, Not Weeks.
            </h1>

            <p className="hero-subtitle">
              Upload any Python, JS, or TypeScript repository. Instantly extract AST-verified dependency graphs,
              trace execution hierarchies, detect circular imports, and interrogate your architecture with vector-grounded AI.
            </p>

            <div className="hero-actions-row">
              <a href="#workspace" className="btn btn-primary btn-lg">
                <Layers size={18} />
                <span>Analyze Your Codebase</span>
                <ArrowRight size={16} />
              </a>

              <button
                type="button"
                onClick={handleLaunchDemo}
                className="btn btn-secondary btn-lg"
              >
                <Sparkles size={16} className="text-cyan-400" />
                <span>Explore Live Demo Repo</span>
              </button>
            </div>

            <ul className="hero-trust-list">
              <li className="hero-trust-item">
                <ShieldCheck size={16} />
                <span>0% Hallucinations (AST-Verified)</span>
              </li>
              <li className="hero-trust-item">
                <Zap size={16} />
                <span>Sub-Second Static Ingestion</span>
              </li>
              <li className="hero-trust-item">
                <GitFork size={16} />
                <span>Zero Telemetry / 100% In-Session</span>
              </li>
            </ul>
          </div>

          <div className="hero-visual-card">
            <img src={heroArt} alt="ArchitectAI 3D Isometric Software Mesh" className="hero-visual-img" />
            <div className="hero-overlay-hud">
              <div className="hud-stat-box">
                <span className="hud-stat-val">46</span>
                <span className="hud-stat-label">Modules Parsed</span>
              </div>
              <div className="hud-stat-box">
                <span className="hud-stat-val">138</span>
                <span className="hud-stat-label">Import Edges</span>
              </div>
              <div className="hud-stat-box">
                <span className="hud-stat-val" style={{ color: "var(--emerald-400)" }}>0 Cycles</span>
                <span className="hud-stat-label">Circular Hazards</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="stats-bar-section">
        <div className="stats-bar-grid">
          <div className="stat-item-card glass-card">
            <div className="stat-icon-wrap">
              <Cpu size={22} />
            </div>
            <div>
              <div className="stat-val">100% AST</div>
              <p className="stat-desc">Pure syntax tree parsing for JavaScript, TypeScript, and Python.</p>
            </div>
          </div>

          <div className="stat-item-card glass-card">
            <div className="stat-icon-wrap" style={{ color: "var(--indigo-400)", background: "rgba(99, 102, 241, 0.1)" }}>
              <Network size={22} />
            </div>
            <div>
              <div className="stat-val">&lt; 800ms</div>
              <p className="stat-desc">Rapid directed graph assembly and module centrality ranking.</p>
            </div>
          </div>

          <div className="stat-item-card glass-card">
            <div className="stat-icon-wrap" style={{ color: "var(--emerald-400)", background: "rgba(16, 185, 129, 0.1)" }}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <div className="stat-val">Local RAG</div>
              <p className="stat-desc">In-memory semantic vector store grounded in function chunks.</p>
            </div>
          </div>

          <div className="stat-item-card glass-card">
            <div className="stat-icon-wrap" style={{ color: "var(--violet-400)", background: "rgba(139, 92, 246, 0.1)" }}>
              <Layers size={22} />
            </div>
            <div>
              <div className="stat-val">Mermaid JS</div>
              <p className="stat-desc">Flowcharts, Layered architectures, UML Use Cases, and Sequence views.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Workspace / Dropzone Section */}
      <section className="workspace-section" id="workspace">
        <div className="section-header">
          <span className="pill-badge section-badge">
            <Upload size={12} />
            <span>Interactive Repository Ingestion</span>
          </span>
          <h2 className="section-title">Drop Your Codebase Archive</h2>
          <p className="section-desc">
            Upload a .zip of your project source code (skip <code>node_modules</code> and <code>.venv</code>).
            Our parser constructs the full dependency graph and pre-computes architecture summaries.
          </p>
        </div>

        <div className="workspace-panel glass-panel">
          <input
            ref={fileRef}
            id="zip"
            type="file"
            accept=".zip,application/zip"
            style={{ display: "none" }}
            onChange={(e) => handlePickFile(e.target.files?.[0] ?? null)}
          />

          {!file ? (
            <div
              className={`dropzone-box ${dragActive ? "dropzone-active" : ""}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              <div className="dropzone-icon-circle">
                <Upload size={28} />
              </div>
              <h3 className="dropzone-heading">Choose a repository ZIP or drag it here</h3>
              <p className="dropzone-sub">Supports .zip archives containing Python, JavaScript, or TypeScript</p>

              <div className="dropzone-rules">
                <span>📁 Max recommended: 50MB</span>
                <span>⚡ AST Static Parsing</span>
                <span>🔒 100% In-Session Safe</span>
              </div>
            </div>
          ) : (
            <div className="file-selected-card">
              <div className="file-meta-info">
                <div className="file-icon-box">
                  <FileArchive size={24} />
                </div>
                <div>
                  <div className="file-name-text">{file.name}</div>
                  <div className="file-size-text">{(file.size / (1024 * 1024)).toFixed(2)} MB • Ready for parsing</div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={phase === "analyzing"}
                >
                  Change File
                </button>
              </div>
            </div>
          )}

          {/* Action Row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", marginTop: "1.25rem" }}>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={onAnalyze}
                disabled={!file || phase === "analyzing"}
              >
                {phase === "analyzing" ? (
                  <>
                    <Cpu size={16} className="animate-spin" />
                    <span>Analyzing Codebase…</span>
                  </>
                ) : phase === "done" ? (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Re-Analyze Repo</span>
                  </>
                ) : (
                  <>
                    <Zap size={16} />
                    <span>Run Neural Analysis</span>
                  </>
                )}
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleLaunchDemo}
              >
                <Sparkles size={14} className="text-cyan-400" />
                <span>Or Try Sample Repo (No Zip)</span>
              </button>
            </div>

            {phase === "ready" && (
              <span style={{ fontSize: "0.85rem", color: "var(--cyan-400)" }}>
                ● File loaded. Click 'Run Neural Analysis' to compile AST graph.
              </span>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div style={{ marginTop: "1.25rem", padding: "1rem", background: "rgba(244, 63, 94, 0.1)", border: "1px solid rgba(244, 63, 94, 0.3)", borderRadius: "var(--radius-sm)", display: "flex", gap: "0.75rem", alignItems: "center", color: "var(--rose-400)" }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: "0.88rem" }}>{error}</span>
            </div>
          )}

          {/* Pipeline Simulation Progress */}
          {phase === "analyzing" && (
            <div className="pipeline-progress-container">
              <div className="pipeline-steps-grid">
                <div className={`pipeline-step-item ${pipelineStep >= 1 ? "active" : ""} ${pipelineStep > 1 ? "completed" : ""}`}>
                  <div className="pipeline-step-icon">{pipelineStep > 1 ? "✓" : "1"}</div>
                  <span>Unpack Archive</span>
                </div>
                <div className={`pipeline-step-item ${pipelineStep >= 2 ? "active" : ""} ${pipelineStep > 2 ? "completed" : ""}`}>
                  <div className="pipeline-step-icon">{pipelineStep > 2 ? "✓" : "2"}</div>
                  <span>Parse AST Trees</span>
                </div>
                <div className={`pipeline-step-item ${pipelineStep >= 3 ? "active" : ""} ${pipelineStep > 3 ? "completed" : ""}`}>
                  <div className="pipeline-step-icon">{pipelineStep > 3 ? "✓" : "3"}</div>
                  <span>Assemble Graph</span>
                </div>
                <div className={`pipeline-step-item ${pipelineStep >= 4 ? "active" : ""} ${pipelineStep > 4 ? "completed" : ""}`}>
                  <div className="pipeline-step-icon">{pipelineStep > 4 ? "✓" : "4"}</div>
                  <span>Vector Embedding</span>
                </div>
              </div>

              <div className="progress-track">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${(pipelineStep / 4) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Success Result Hero */}
          {phase === "done" && doneMeta && (
            <div className="analysis-success-box">
              <div className="analysis-success-header">
                <div>
                  <h4 style={{ fontSize: "1.15rem", display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--emerald-400)", marginBottom: "0.25rem" }}>
                    <CheckCircle2 size={20} />
                    <span>Analysis Complete & Architecture Mapped!</span>
                  </h4>
                  <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", margin: 0 }}>
                    Successfully extracted static dependency graph from <strong>{doneMeta.name}</strong>.
                  </p>
                </div>

                <Link to="/chat" className="btn btn-primary">
                  <span>Open AI Architecture Studio</span>
                  <ArrowRight size={15} />
                </Link>
              </div>

              <div className="analysis-stats-chips">
                <div className="stat-chip-box">
                  <div className="stat-chip-val">{doneMeta.files}</div>
                  <div className="stat-chip-label">Source Files</div>
                </div>
                <div className="stat-chip-box">
                  <div className="stat-chip-val">{doneMeta.edges}</div>
                  <div className="stat-chip-label">Import Links</div>
                </div>
                <div className="stat-chip-box">
                  <div className="stat-chip-val" style={{ color: "var(--emerald-400)" }}>Ready</div>
                  <div className="stat-chip-label">Vector RAG</div>
                </div>
                <div className="stat-chip-box">
                  <div className="stat-chip-val" style={{ color: "var(--cyan-400)" }}>Mermaid</div>
                  <div className="stat-chip-label">Diagrams</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Bento Grid Superpowers */}
      <section className="bento-section" id="superpowers">
        <div className="section-header">
          <span className="pill-badge section-badge">
            <Zap size={12} />
            <span>Core Capabilities</span>
          </span>
          <h2 className="section-title">Engineered for Complex Repositories</h2>
          <p className="section-desc">
            No regex guessing or fragile pattern matching. ArchitectAI evaluates real abstract syntax trees
            coupled with in-memory semantic retrieval.
          </p>
        </div>

        <div className="bento-grid">
          <div className="bento-card-large glass-card">
            <div>
              <span className="pill-badge">
                <Code2 size={12} />
                <span>Syntax Tree Parser</span>
              </span>
              <h3 className="bento-card-title">AST-Level Import & Dependency Extraction</h3>
              <p className="bento-card-desc">
                Parses JavaScript, TypeScript, and Python code directly into Abstract Syntax Trees. Resolves relative
                aliases, barrel re-exports, and ESM/CommonJS import statements without executing unsafe code.
              </p>
            </div>
            <div className="bento-visual-wrap">
              <img src={astArt} alt="AST Compiler Core" className="bento-img" />
            </div>
          </div>

          <div className="bento-card-medium glass-card">
            <div>
              <span className="pill-badge pill-badge-emerald">
                <ShieldCheck size={12} />
                <span>Zero Hallucinations</span>
              </span>
              <h3 className="bento-card-title">Vector RAG Grounded in Function Chunks</h3>
              <p className="bento-card-desc">
                Code is chunked with semantic AST boundaries and embedded into ChromaDB. Questions about logic,
                middlewares, and database models are answered from real code lines.
              </p>
            </div>

            <div style={{ padding: "1.25rem", background: "rgba(9, 13, 24, 0.7)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", marginTop: "1rem" }}>
              <div style={{ fontSize: "0.78rem", color: "var(--cyan-400)", fontFamily: "var(--font-mono)", marginBottom: "0.35rem" }}>
                // ChromaDB Search Query
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                rag.search("auth token validation middleware")
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
                ✓ Matched \`src/auth/token_verifier.ts\` (Score: 0.94)
              </div>
            </div>
          </div>

          <div className="bento-card-small glass-card">
            <span className="pill-badge pill-badge-violet">
              <Layers size={12} />
              <span>Diagram Studio</span>
            </span>
            <h3 className="bento-card-title">Automated Mermaid & UML Generation</h3>
            <p className="bento-card-desc">
              Transform abstract codebase structures into clear, exportable visual diagrams: Flowcharts,
              Layered Architectures, Sequence interactions, and UML Use Cases.
            </p>
          </div>

          <div className="bento-card-small glass-card">
            <span className="pill-badge" style={{ color: "var(--amber-400)", borderColor: "rgba(245, 158, 11, 0.3)", background: "rgba(245, 158, 11, 0.1)" }}>
              <Network size={12} />
              <span>Cycle Sentinel</span>
            </span>
            <h3 className="bento-card-title">Circular Dependency & Bottleneck Detector</h3>
            <p className="bento-card-desc">
              Tarjan's strongly connected components algorithm scans the directed graph to detect dangerous cyclic
              imports and highlight high in-degree bottleneck files.
            </p>
          </div>
        </div>
      </section>

      {/* Interactive Diagram Gallery */}
      <section className="gallery-section" id="diagrams">
        <div className="section-header">
          <span className="pill-badge section-badge">
            <Layers size={12} />
            <span>Visual Architectures</span>
          </span>
          <h2 className="section-title">Explore Supported Diagram Formats</h2>
          <p className="section-desc">
            All diagrams in ArchitectAI are fully interactive, rendered dynamically in SVG with zoom, fullscreen preview, and code export.
          </p>
        </div>

        <div className="gallery-tabs-row">
          <button
            type="button"
            className={`gallery-tab-btn ${activeGalleryTab === "layers" ? "active" : ""}`}
            onClick={() => setActiveGalleryTab("layers")}
          >
            Tiered Layers
          </button>
          <button
            type="button"
            className={`gallery-tab-btn ${activeGalleryTab === "flow" ? "active" : ""}`}
            onClick={() => setActiveGalleryTab("flow")}
          >
            Execution Flow
          </button>
          <button
            type="button"
            className={`gallery-tab-btn ${activeGalleryTab === "usecase" ? "active" : ""}`}
            onClick={() => setActiveGalleryTab("usecase")}
          >
            UML Interactions
          </button>
        </div>

        <div className="gallery-preview-card">
          <MermaidDiagram
            chart={SAMPLE_GALLERY_DIAGRAMS[activeGalleryTab].code}
            model={{ type: SAMPLE_GALLERY_DIAGRAMS[activeGalleryTab].title }}
          />
        </div>
      </section>

      {/* FAQ Section */}
      <section className="faq-section" id="faq">
        <div className="section-header">
          <span className="pill-badge section-badge">
            <AlertCircle size={12} />
            <span>Developer Questions</span>
          </span>
          <h2 className="section-title">Frequently Asked Questions</h2>
        </div>

        <div className="faq-grid">
          {FAQ_ITEMS.map((item, index) => {
            const isOpen = openFaq === index;
            return (
              <div key={item.q} className="faq-item">
                <button
                  type="button"
                  className="faq-question-btn"
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                >
                  <span>{item.q}</span>
                  {isOpen ? <ChevronUp size={18} color="var(--cyan-400)" /> : <ChevronDown size={18} />}
                </button>
                {isOpen && <div className="faq-answer-content">{item.a}</div>}
              </div>
            );
          })}
        </div>
      </section>

      <Footer />
    </div>
  );
}
