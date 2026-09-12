import { useState } from "react";

type ShowcaseTab = "graph" | "centrality" | "cycles" | "agent";

export default function StudioShowcase() {
  const [activeTab, setActiveTab] = useState<ShowcaseTab>("graph");

  return (
    <div className="studio-showcase-container">
      <div className="studio-showcase-window">
        {/* Window Chrome Header Bar */}
        <div className="showcase-window-bar">
          <div className="window-dots-cluster">
            <span className="window-dot" />
            <span className="window-dot" />
            <span className="window-dot" />
          </div>

          {/* Interactive Navigation Tabs */}
          <div className="showcase-tabs-nav">
            <button
              type="button"
              className={`showcase-tab-btn ${activeTab === "graph" ? "active" : ""}`}
              onClick={() => setActiveTab("graph")}
            >
              01. DEPENDENCY GRAPH
            </button>
            <button
              type="button"
              className={`showcase-tab-btn ${activeTab === "centrality" ? "active" : ""}`}
              onClick={() => setActiveTab("centrality")}
            >
              02. CENTRALITY RANKINGS
            </button>
            <button
              type="button"
              className={`showcase-tab-btn ${activeTab === "cycles" ? "active" : ""}`}
              onClick={() => setActiveTab("cycles")}
            >
              03. CYCLE AUDIT
            </button>
            <button
              type="button"
              className={`showcase-tab-btn ${activeTab === "agent" ? "active" : ""}`}
              onClick={() => setActiveTab("agent")}
            >
              04. GROUNDED AGENT
            </button>
          </div>

          <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--accent-teal)" }}>
            ● DAG HEALTH: 100%
          </div>
        </div>

        {/* Viewport Body */}
        <div className="showcase-viewport-body">
          {/* TAB 1: Visual Dependency Graph */}
          {activeTab === "graph" && (
            <div className="showcase-graph-canvas">
              <svg width="100%" height="480" viewBox="0 0 920 440" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <filter id="glow-indigo" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                  <marker id="arrow-active" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 8 5 L 0 9 z" fill="#818cf8" />
                  </marker>
                  <marker id="arrow-subtle" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 8 5 L 0 9 z" fill="#334155" />
                  </marker>
                </defs>

                {/* Grid Connection Edges */}
                <path d="M 460 70 L 260 160" stroke="#818cf8" strokeWidth="1.75" markerEnd="url(#arrow-active)" />
                <path d="M 460 70 L 660 160" stroke="#818cf8" strokeWidth="1.75" markerEnd="url(#arrow-active)" />
                <path d="M 260 195 L 140 290" stroke="#334155" strokeWidth="1.25" markerEnd="url(#arrow-subtle)" />
                <path d="M 260 195 L 340 290" stroke="#334155" strokeWidth="1.25" markerEnd="url(#arrow-subtle)" />
                <path d="M 660 195 L 560 290" stroke="#818cf8" strokeWidth="1.75" markerEnd="url(#arrow-active)" />
                <path d="M 660 195 L 780 290" stroke="#334155" strokeWidth="1.25" markerEnd="url(#arrow-subtle)" />
                <path d="M 560 325 L 460 390" stroke="#2dd4bf" strokeWidth="1.5" strokeDasharray="4 4" />
                <path d="M 780 325 L 460 390" stroke="#334155" strokeWidth="1.25" markerEnd="url(#arrow-subtle)" />

                {/* Node: app/main.py (Root Foundation) */}
                <g transform="translate(370, 40)" style={{ cursor: "pointer" }}>
                  <rect
                    width="180"
                    height="40"
                    rx="8"
                    fill="#111420"
                    stroke="#818cf8"
                    strokeWidth="1.75"
                    filter="url(#glow-indigo)"
                  />
                  <text x="90" y="25" fill="#ffffff" fontFamily="JetBrains Mono" fontSize="12" fontWeight="600" textAnchor="middle">
                    app/main.py
                  </text>
                  <circle cx="160" cy="20" r="4" fill="#2dd4bf" />
                </g>

                {/* Node: app/api/router.py */}
                <g transform="translate(170, 160)" style={{ cursor: "pointer" }}>
                  <rect width="180" height="38" rx="8" fill="#0f131d" stroke="#334155" strokeWidth="1.2" />
                  <text x="90" y="24" fill="#cbd5e1" fontFamily="JetBrains Mono" fontSize="12" textAnchor="middle">
                    app/api/router.py
                  </text>
                </g>

                {/* Node: app/agents/orchestrator.py */}
                <g transform="translate(560, 160)" style={{ cursor: "pointer" }}>
                  <rect width="200" height="38" rx="8" fill="#111420" stroke="#818cf8" strokeWidth="1.5" />
                  <text x="100" y="24" fill="#ffffff" fontFamily="JetBrains Mono" fontSize="12" fontWeight="600" textAnchor="middle">
                    agents/orchestrator.py
                  </text>
                </g>

                {/* Leaf Nodes */}
                <g transform="translate(50, 290)">
                  <rect width="160" height="36" rx="6" fill="#0b0d13" stroke="#252b3b" strokeWidth="1" />
                  <text x="80" y="23" fill="#94a3b8" fontFamily="JetBrains Mono" fontSize="11" textAnchor="middle">
                    auth/security.py
                  </text>
                </g>

                <g transform="translate(260, 290)">
                  <rect width="150" height="36" rx="6" fill="#0b0d13" stroke="#252b3b" strokeWidth="1" />
                  <text x="75" y="23" fill="#94a3b8" fontFamily="JetBrains Mono" fontSize="11" textAnchor="middle">
                    api/health.py
                  </text>
                </g>

                <g transform="translate(470, 290)">
                  <rect width="180" height="36" rx="6" fill="#111420" stroke="#2dd4bf" strokeWidth="1.5" />
                  <text x="90" y="23" fill="#ffffff" fontFamily="JetBrains Mono" fontSize="11" fontWeight="600" textAnchor="middle">
                    services/vector_store.py
                  </text>
                </g>

                <g transform="translate(700, 290)">
                  <rect width="150" height="36" rx="6" fill="#0b0d13" stroke="#252b3b" strokeWidth="1" />
                  <text x="75" y="23" fill="#94a3b8" fontFamily="JetBrains Mono" fontSize="11" textAnchor="middle">
                    db/session.py
                  </text>
                </g>

                {/* Bottom Model Base */}
                <g transform="translate(370, 390)">
                  <rect width="180" height="36" rx="6" fill="#0b0d13" stroke="#252b3b" strokeWidth="1" />
                  <text x="90" y="23" fill="#64748b" fontFamily="JetBrains Mono" fontSize="11" textAnchor="middle">
                    models/base.py
                  </text>
                </g>
              </svg>

              {/* Floating Bottom Telemetry Pill */}
              <div
                style={{
                  position: "absolute",
                  bottom: "1rem",
                  left: "1.25rem",
                  right: "1.25rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.6rem 1rem",
                  background: "rgba(10, 13, 19, 0.85)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "8px",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  color: "var(--text-secondary)",
                }}
              >
                <div>
                  <span style={{ color: "var(--text-white)", fontWeight: 600 }}>zenith-core</span> · 28 SOURCE NODES · 54 EDGES
                </div>
                <div style={{ display: "flex", gap: "1rem" }}>
                  <span>ZOOM: 100%</span>
                  <span style={{ color: "var(--accent-teal)" }}>● COMPILER DAG VERIFIED</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Centrality Rankings */}
          {activeTab === "centrality" && (
            <div style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#ffffff", marginBottom: "0.25rem" }}>
                    Topological In-Degree Blast Radius
                  </h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
                    Modules ranked by downstream dependent count. Modifications to these files carry maximum architectural gravity.
                  </p>
                </div>
                <div className="mono-tag mono-tag-indigo">GRAVITY METRIC</div>
              </div>

              <table className="tech-table">
                <thead>
                  <tr>
                    <th style={{ width: "40px" }}>RANK</th>
                    <th>MODULE PATH</th>
                    <th>DOWNSTREAM DEPENDENTS</th>
                    <th>ROLE CLASSIFICATION</th>
                    <th>BLAST RADIUS</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ color: "var(--accent-indigo-bright)", fontWeight: 700 }}>#1</td>
                    <td style={{ color: "#ffffff", fontWeight: 600 }}>app/main.py</td>
                    <td>18 dependent modules</td>
                    <td><span className="mono-tag mono-tag-indigo">FOUNDATION ENTRY</span></td>
                    <td style={{ color: "var(--accent-rose)" }}>CRITICAL (94%)</td>
                  </tr>
                  <tr>
                    <td style={{ color: "var(--accent-indigo-bright)", fontWeight: 700 }}>#2</td>
                    <td style={{ color: "#ffffff", fontWeight: 600 }}>app/agents/orchestrator.py</td>
                    <td>12 dependent modules</td>
                    <td><span className="mono-tag mono-tag-teal">COORDINATOR</span></td>
                    <td style={{ color: "var(--accent-amber)" }}>HIGH (72%)</td>
                  </tr>
                  <tr>
                    <td style={{ color: "var(--accent-indigo-bright)", fontWeight: 700 }}>#3</td>
                    <td style={{ color: "#ffffff", fontWeight: 600 }}>app/services/vector_store.py</td>
                    <td>9 dependent modules</td>
                    <td><span className="mono-tag">SUBSYSTEM</span></td>
                    <td style={{ color: "var(--accent-teal)" }}>MEDIUM (45%)</td>
                  </tr>
                  <tr>
                    <td style={{ color: "var(--accent-indigo-bright)", fontWeight: 700 }}>#4</td>
                    <td style={{ color: "#ffffff", fontWeight: 600 }}>app/core/config.py</td>
                    <td>8 dependent modules</td>
                    <td><span className="mono-tag">CONFIG / ENV</span></td>
                    <td style={{ color: "var(--accent-teal)" }}>MODERATE (38%)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: Cycle Audit */}
          {activeTab === "cycles" && (
            <div style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#ffffff", marginBottom: "0.25rem" }}>
                  Tarjan Strongly Connected Components (Cycle Detection)
                </h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
                  Discovers circular import chains that break modular encapsulation and cause initialization race conditions.
                </p>
              </div>

              <div
                style={{
                  background: "rgba(245, 158, 11, 0.05)",
                  border: "1px solid rgba(245, 158, 11, 0.3)",
                  borderRadius: "8px",
                  padding: "1.25rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--accent-amber)", fontWeight: 700 }}>
                    [CYCLE VIOLATION DETECTED // 2-NODE LOOP]
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    SEVERITY: HIGH
                  </span>
                </div>

                <div
                  style={{
                    background: "#080a0f",
                    padding: "0.85rem 1rem",
                    borderRadius: "6px",
                    fontFamily: "var(--font-mono)",
                    fontSize: "12.5px",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                  }}
                >
                  <span style={{ color: "#ffffff", fontWeight: 700 }}>app/auth/security.py</span>
                  <span style={{ color: "var(--accent-amber)", margin: "0 0.6rem" }}>➔</span>
                  <span style={{ color: "#ffffff", fontWeight: 700 }}>app/services/user_service.py</span>
                  <span style={{ color: "var(--accent-amber)", margin: "0 0.6rem" }}>➔</span>
                  <span style={{ color: "#ffffff", fontWeight: 700 }}>app/auth/security.py</span>
                </div>

                <div style={{ fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  <strong>Automated Decoupling Prescription:</strong> Extract the shared user authentication interface
                  into <code style={{ color: "var(--accent-teal)" }}>app/core/interfaces.py</code> to break the circular dependency.
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Grounded Agent */}
          {activeTab === "agent" && (
            <div style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#ffffff", marginBottom: "0.25rem" }}>
                  Native Tool-Calling Grounded Agent
                </h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
                  Queries real AST graph nodes and retrieves function-level embeddings with zero hallucinations.
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div
                  style={{
                    background: "rgba(99, 102, 241, 0.1)",
                    border: "1px solid rgba(99, 102, 241, 0.3)",
                    borderRadius: "8px",
                    padding: "0.85rem 1.1rem",
                    fontFamily: "var(--font-mono)",
                    fontSize: "12px",
                    color: "var(--text-white)",
                  }}
                >
                  &gt; [USER] Which modules interface directly with the vector database?
                </div>

                <div
                  style={{
                    background: "var(--bg-surface-elevated)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "8px",
                    padding: "1rem 1.25rem",
                    fontSize: "13px",
                    lineHeight: 1.6,
                    color: "var(--text-secondary)",
                  }}
                >
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--accent-teal)", marginBottom: "0.4rem" }}>
                    &gt; [ARCHITECT ENGINE // VERIFIED AST GROUNDING]
                  </div>
                  AST traversal identifies exactly one module directly calling the vector database client:
                  <strong style={{ color: "#ffffff" }}> app/services/vector_store.py</strong>.
                  <br />
                  Downstream consumers include <strong style={{ color: "#ffffff" }}>app/agents/orchestrator.py</strong> via
                  the <code style={{ color: "var(--accent-indigo-bright)" }}>retrieve_relevant_chunks()</code> invocation.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
