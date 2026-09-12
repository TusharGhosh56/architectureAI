import Navbar from "../components/Navbar";
import ArchitectCanvas from "../components/ArchitectCanvas";
import FeatureShowcase from "../components/FeatureShowcase";
import HowItWorks from "../components/HowItWorks";
import LoopingWords from "../components/LoopingWords";
import { LogoIcon } from "../components/Icons";
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
              <button
                type="button"
                className="btn-border-beam-wrapper"
                onClick={() => {
                  const fileInput = document.getElementById("workspace-file-input") as HTMLInputElement | null;
                  if (fileInput) {
                    fileInput.dataset.source = "hero";
                    fileInput.click();
                  } else {
                    document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth" });
                  }
                }}
              >
                <span className="btn-border-beam-core">
                  <span>Analyze Codebase (.zip)</span>
                  <span style={{ color: "var(--accent-teal)", fontWeight: 700 }}>→</span>
                </span>
              </button>
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
        <div id="features">
          <FeatureShowcase />
        </div>
      </div>

      {/* Modern Developer Footer */}
      <footer className="developer-footer">
        <div className="footer-container">
          {/* Main Footer 4-Column Grid */}
          <div className="footer-grid">
            {/* Col 1: Brand & Philosophy */}
            <div className="footer-brand-col">
              <div className="footer-brand-header">
                <LogoIcon size={26} />
                <span className="footer-brand-name">
                  Architect<span style={{ color: "#38bdf8" }}>AI</span>
                </span>
              </div>
              <p className="footer-brand-desc">
                Autonomous codebase architecture intelligence. Transforming opaque multi-tier repositories into verified dependency graphs, cycle audits, and zero-hallucination code reasoning.
              </p>
            </div>

            {/* Col 2: Capabilities */}
            <div className="footer-nav-col">
              <h4 className="footer-col-title">Capabilities</h4>
              <ul className="footer-link-list">
                <li><a href="/#features">In-Memory Ingestion</a></li>
                <li><a href="/#features">Dependency Topology</a></li>
                <li><a href="/#features">Cycle Detection Audit</a></li>
                <li><Link to="/chat">AI Studio Canvas</Link></li>
                <li><a href="/#features">Impact & Blast Radius</a></li>
              </ul>
            </div>

            {/* Col 3: Engine Core */}
            <div className="footer-nav-col">
              <h4 className="footer-col-title">Engine Core</h4>
              <ul className="footer-link-list">
                <li><span>Python AST (3.10–3.12)</span></li>
                <li><span>TypeScript SWC Parser</span></li>
                <li><span>Deterministic Grounding</span></li>
                <li><span>Mermaid.js Compiler</span></li>
                <li><span>O(V+E) Graph Propagation</span></li>
              </ul>
            </div>

            {/* Col 4: Platform */}
            <div className="footer-nav-col">
              <h4 className="footer-col-title">Platform</h4>
              <ul className="footer-link-list">
                <li><Link to="/">Workbench Studio</Link></li>
                <li><Link to="/chat">Canvas Playground</Link></li>
                <li><a href="https://github.com" target="_blank" rel="noreferrer">GitHub Repository</a></li>
                <li><a href="#features">Demo Codebases</a></li>
                <li><span style={{ color: "var(--text-faint)", fontSize: "12px" }}>MIT Licensed Open Core</span></li>
              </ul>
            </div>
          </div>

          {/* Sub-Footer Bottom Bar */}
          <div className="footer-bottom-bar">
            <div className="footer-copyright">
              © 2026 ArchitectAI. Built for engineering teams refactoring mission-critical codebases.
            </div>
            <div className="footer-legal-links">
              <span>Deterministic In-Memory Isolation</span>
              <span className="footer-separator">·</span>
              <span>Zero Execution Security</span>
              <span className="footer-separator">·</span>
              <span className="footer-latency-badge">18ms AST Latency</span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
