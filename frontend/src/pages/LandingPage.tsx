import Navbar from "../components/Navbar";
import ArchitectCanvas from "../components/ArchitectCanvas";
import LaserDropzone from "../components/LaserDropzone";
import HowItWorks from "../components/HowItWorks";
import TopographicBackground from "../components/TopographicBackground";
import LoopingWords from "../components/LoopingWords";
import repoGraphImg from "../assets/repo_graph.jpg";
import repoAuditImg from "../assets/repo_audit.jpg";
import { Link } from "react-router-dom";

export default function LandingPage() {
  return (
    <main className="site-cosmic-canvas">
      {/* Top Sticky Glass Navigation */}
      <Navbar />

      {/* Hero Section with Deep Purple Eclipse Horizon */}
      <div className="hero-viewport-wrapper">
        <section className="hero-split-container">
          {/* Left Column: Hero Content & Actions */}
          <div className="hero-content-left">
            <h1 className="hero-heading-left">
              Map the unmapped.
              <br />
              <span style={{ color: "#cbd5e1" }}>Decode</span>
              <LoopingWords
                words={[
                  "blast radius.",
                  "circular traps.",
                  "architecture.",
                  "dependencies.",
                  "deadlocks.",
                ]}
              />
            </h1>

            <p className="hero-subheadline-left">
              Upload any repository archive. ArchitectAI analyzes your Python and TypeScript Abstract Syntax Trees,
              ranks blast-radius gravity, flags circular dependency traps, and lets you interrogate your system with zero-hallucination code grounding.
            </p>

            <div className="hero-actions-left">
              <a href="#workspace" className="btn-border-beam-wrapper">
                <span className="btn-border-beam-core">
                  <span>Analyze Codebase (.zip)</span>
                  <span style={{ color: "var(--accent-teal)", fontWeight: 700 }}>→</span>
                </span>
              </a>
            </div>
          </div>

          {/* Right Column: Oversized Repository Window (Fills Hero Height & Bleeds Offscreen) */}
          <ArchitectCanvas />
        </section>
      </div>

      {/* Post-Hero Seamless Flowing Cosmic Curtain */}
      <div className="site-flowing-curtain">
        {/* Section 00: 4-Stage Architectural Compilation Engine (Tactile Pinned Pipeline) */}
        <HowItWorks />

        {/* Section 01: Tactile Ingestion Workspace (50/50 Split Layout) */}
        <LaserDropzone />

      {/* Section 02: Topological Gravity & Blast Radius (50/50 Split Layout) */}
      <section className="split-feature-section" id="graph">
        <div className="split-feature-container">
          {/* Left Column: Crisp Text & Centrality Metrics */}
          <div className="split-content-left">
            <div className="feature-eyebrow">// 01 · TOPOLOGICAL GRAVITY</div>
            <h2 className="split-heading">
              Quantify blast radius.
              <br />
              <span style={{ color: "#cbd5e1" }}>Before you refactor.</span>
            </h2>
            <p className="split-subheadline">
              Every module in your system exerts gravitational pull. By compiling import statements into a directed acyclic graph,
              ArchitectAI ranks centrality and exposes every downstream service that breaks if foundational logic changes.
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
          </div>

          {/* Right Column: High-Fidelity Topological DAG Window */}
          <div className="split-visual-right">
            <div className="feature-window-frame">
              <div className="repo-window-header">
                <div className="window-dots-cluster">
                  <span className="window-dot" style={{ background: "#ff5f56" }} />
                  <span className="window-dot" style={{ background: "#ffbd2e" }} />
                  <span className="window-dot" style={{ background: "#27c93f" }} />
                </div>
                <div className="repo-url-bar">
                  <span style={{ color: "#c9d1d9" }}>zenith-core / dependency-graph</span>
                  <span style={{ fontSize: "10px", padding: "0.1rem 0.4rem", borderRadius: "9999px", background: "rgba(255, 255, 255, 0.08)", color: "#8b949e" }}>
                    345 Nodes · 812 Edges
                  </span>
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--accent-teal)" }}>
                  FORCE DIRECTED DAG
                </div>
              </div>
              <div className="feature-image-wrapper">
                <img
                  src={repoGraphImg}
                  alt="ArchitectAI Topological Dependency Graph"
                  className="feature-image"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 03: DAG Integrity & Tarjan SCC Cycle Detection (50/50 Split Layout) */}
      <section className="split-feature-section" id="audit">
        <div className="split-feature-container">
          {/* Left Column: Tarjan Cycle Elimination Text */}
          <div className="split-content-left">
            <div className="feature-eyebrow">// 02 · DAG INTEGRITY</div>
            <h2 className="split-heading">
              Expose circular traps.
              <br />
              <span style={{ color: "#cbd5e1" }}>Prevent runtime deadlocks.</span>
            </h2>
            <p className="split-subheadline">
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

          {/* Right Column: High-Fidelity Architecture Audit Window */}
          <div className="split-visual-right">
            <div className="feature-window-frame">
              <div className="repo-window-header">
                <div className="window-dots-cluster">
                  <span className="window-dot" style={{ background: "#ff5f56" }} />
                  <span className="window-dot" style={{ background: "#ffbd2e" }} />
                  <span className="window-dot" style={{ background: "#27c93f" }} />
                </div>
                <div className="repo-url-bar">
                  <span style={{ color: "#c9d1d9" }}>zenith-core / architecture-audit</span>
                  <span style={{ fontSize: "10px", padding: "0.1rem 0.4rem", borderRadius: "9999px", background: "rgba(255, 255, 255, 0.08)", color: "var(--accent-teal)" }}>
                    94/100 Health
                  </span>
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--accent-teal)" }}>
                  TARJAN SCC
                </div>
              </div>
              <div className="feature-image-wrapper">
                <img
                  src={repoAuditImg}
                  alt="ArchitectAI Architecture Audit and Cycle Analysis"
                  className="feature-image"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 04: Studio Canvas Interrogation (50/50 Split Layout) */}
      <section className="split-feature-section" id="studio">
        <div className="split-feature-container">
          {/* Left Column: Codebase Interrogation Copy & CTA */}
          <div className="split-content-left">
            <div className="feature-eyebrow">// 03 · STUDIO CANVAS</div>
            <h2 className="split-heading">
              Interrogate your system.
              <br />
              <span style={{ color: "#cbd5e1" }}>Zero hallucinations.</span>
            </h2>
            <p className="split-subheadline">
              Query your architecture through an autonomous reasoning agent backed by your compiled graph. Ask what breaks if a service changes, simulate architectural refactors, and inspect verified Mermaid diagrams with deterministic ground truth.
            </p>

            <div>
              <Link to="/chat" className="btn-border-beam-wrapper">
                <span className="btn-border-beam-core">
                  <span>Launch Studio Canvas</span>
                  <span style={{ color: "var(--accent-teal)", fontWeight: 700 }}>→</span>
                </span>
              </Link>
            </div>
          </div>

          {/* Right Column: Mini Interactive Studio Canvas Preview */}
          <div className="split-visual-right">
            <div className="feature-window-frame">
              <div className="repo-window-header">
                <div className="window-dots-cluster">
                  <span className="window-dot" style={{ background: "#ff5f56" }} />
                  <span className="window-dot" style={{ background: "#ffbd2e" }} />
                  <span className="window-dot" style={{ background: "#27c93f" }} />
                </div>
                <div className="repo-url-bar">
                  <span style={{ color: "#c9d1d9" }}>zenith-core / studio-canvas</span>
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--accent-teal)" }}>
                  AST GROUNDED REASONING
                </div>
              </div>

              <div className="studio-mini-preview">
                {/* Mini Dialogue Side */}
                <div className="mini-chat-side">
                  <div className="mini-msg-cluster">
                    <div className="mini-user-msg">
                      Query: What breaks if I modify DatabaseClient?
                    </div>
                    <div className="mini-agent-msg">
                      <strong style={{ color: "#ffffff", display: "block", marginBottom: "0.25rem" }}>
                        Deterministic AST Blast Analysis:
                      </strong>
                      Modifying <code className="inline-code">DatabaseClient</code> triggers cascading blast radius to 4 downstream consumers:
                      <span style={{ color: "var(--accent-teal)", display: "block", marginTop: "0.35rem", fontFamily: "var(--font-mono)", fontSize: "11.5px" }}>
                        ApiService → UserStore → AuthContext → Router
                      </span>
                      Zero circular dependency cycles detected.
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "0.75rem", borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "10.5px", color: "var(--text-faint)" }}>
                      MODEL: AST-GROUNDED PROMPT
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "10.5px", color: "var(--accent-teal)" }}>
                      VERIFIED GROUND TRUTH
                    </span>
                  </div>
                </div>

                {/* Mini DAG Node View Side */}
                <div className="mini-diagram-side">
                  <div className="mini-dag-container">
                    <div className="mini-dag-node root">
                      DatabaseClient.ts (Impact Root)
                    </div>
                    <div className="mini-dag-connector" />
                    <div className="mini-dag-node leaf" style={{ borderColor: "rgba(129, 140, 248, 0.4)", color: "#a5b4fc" }}>
                      ApiService.ts (Central Hub)
                    </div>
                    <div className="mini-dag-connector" />
                    <div style={{ display: "flex", gap: "0.5rem", width: "100%", justifyContent: "center" }}>
                      <div className="mini-dag-node leaf" style={{ fontSize: "10px", padding: "0.35rem 0.6rem" }}>
                        UserStore.ts
                      </div>
                      <div className="mini-dag-node leaf" style={{ fontSize: "10px", padding: "0.35rem 0.6rem" }}>
                        Router.tsx
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Technical Specifications Strip */}
      <section className="specs-strip-section">
        <div className="specs-strip-inner">
          <div className="specs-strip-item">
            <span className="specs-strip-label">PARSER RUNTIMES</span>
            <span className="specs-strip-value">Python 3.10–3.12 (ast) · TypeScript 5.x (SWC / ESM)</span>
          </div>
          <div className="specs-strip-item">
            <span className="specs-strip-label">GRAPH ENGINE</span>
            <span className="specs-strip-value">Tarjan SCC · Degree Centrality · Mermaid.js</span>
          </div>
          <div className="specs-strip-item">
            <span className="specs-strip-label">SECURITY</span>
            <span className="specs-strip-value">Zero Code Execution · In-Memory Static Analysis</span>
          </div>
        </div>
      </section>
    </div>

      {/* Modern Developer Footer with Subtle Architectural Contours */}
      <footer className="industrial-footer">
        <TopographicBackground />
        <div className="footer-inner">
          <div>
            <span style={{ color: "#ffffff", fontWeight: 700 }}>architect</span><span style={{ color: "var(--accent-teal)", fontWeight: 700 }}>ai</span> — AUTONOMOUS SOFTWARE ARCHITECTURE ENGINE
          </div>
          <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
            <Link to="/" style={{ color: "var(--text-secondary)" }}>Workspace</Link>
            <Link to="/chat" style={{ color: "var(--text-secondary)" }}>Studio Canvas</Link>
            <span style={{ color: "var(--text-faint)" }}>AST ENGINE V0.2</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
