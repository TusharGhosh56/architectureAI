import Navbar from "../components/Navbar";
import ArchitectCanvas from "../components/ArchitectCanvas";
import FeatureShowcase from "../components/FeatureShowcase";
import HowItWorks from "../components/HowItWorks";
import TopographicBackground from "../components/TopographicBackground";
import LoopingWords from "../components/LoopingWords";
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

      {/* Section 01: Unified Interactive Feature & Ingestion Showcase */}
      <FeatureShowcase />

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
