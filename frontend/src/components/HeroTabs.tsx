import { Tabs, type Tab } from "./ui/tabs";
import repoGraphImg from "../assets/repo_graph.jpg";
import repoAuditImg from "../assets/repo_audit.jpg";

export default function HeroTabs() {
  const tabs: Tab[] = [
    {
      title: "Graph Canvas",
      value: "graph",
      content: (
        <div className="tab-pane-card">
          <div className="tab-card-header">
            <div className="tab-card-dots">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </div>
            <div className="tab-card-title">zenith-core // AST Dependency Topology</div>
            <div className="tab-tag tab-tag-orange">AST RESOLVED</div>
          </div>
          <div className="tab-media-wrapper">
            <img
              src={repoGraphImg}
              alt="AST Dependency Graph"
              className="tab-media-img"
            />
          </div>
        </div>
      ),
    },
    {
      title: "Centrality",
      value: "centrality",
      content: (
        <div className="tab-pane-card">
          <div className="tab-card-header">
            <div className="tab-card-dots">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </div>
            <div className="tab-card-title">apollo-web // Architecture & Cycle Audit</div>
            <div className="tab-tag tab-tag-green">HEALTH: 91%</div>
          </div>
          <div className="tab-media-wrapper">
            <img
              src={repoAuditImg}
              alt="Architecture Metrics Dashboard"
              className="tab-media-img"
            />
          </div>
        </div>
      ),
    },
    {
      title: "Cycle Audit",
      value: "cycles",
      content: (
        <div className="tab-pane-card tab-pane-interactive">
          <div className="tab-card-header">
            <div className="tab-card-dots">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </div>
            <div className="tab-card-title">audit // Recursive Import Cycle Detection</div>
            <div className="tab-tag tab-tag-orange">1 CYCLE DETECTED</div>
          </div>
          <div className="tab-interactive-body">
            <div className="mono-tag" style={{ color: "var(--accent-orange)", marginBottom: "0.5rem" }}>
              [CYCLE_VIOLATION // TARJAN SCC]
            </div>
            <div className="cycle-path-box">
              <span style={{ color: "#ffffff", fontWeight: 700 }}>app/auth/security.py</span>
              <span style={{ color: "var(--accent-orange)", margin: "0 0.5rem" }}>➔</span>
              <span style={{ color: "#ffffff", fontWeight: 700 }}>app/services/user_service.py</span>
              <span style={{ color: "var(--accent-orange)", margin: "0 0.5rem" }}>➔</span>
              <span style={{ color: "#ffffff", fontWeight: 700 }}>app/auth/security.py</span>
            </div>
            <div style={{ marginTop: "1rem", fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              <strong>Prescription:</strong> Decouple tight import binding by extracting shared interface into{" "}
              <code style={{ color: "var(--accent-orange)" }}>app/core/interfaces.py</code>.
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Studio Agent",
      value: "agent",
      content: (
        <div className="tab-pane-card tab-pane-interactive">
          <div className="tab-card-header">
            <div className="tab-card-dots">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </div>
            <div className="tab-card-title">agent // Zero-Hallucination Query</div>
            <div className="tab-tag tab-tag-green">TOOL CALLING</div>
          </div>
          <div className="tab-interactive-body">
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--accent-orange)" }}>
                &gt; [USER] Explain the primary entry point and dependency flow
              </div>
              <div
                style={{
                  background: "#0d0d10",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  padding: "0.85rem",
                  borderRadius: "4px",
                  fontSize: "12px",
                  lineHeight: 1.6,
                  color: "#d4d4d8",
                }}
              >
                Topological traversal confirms <strong style={{ color: "#ffffff" }}>app/main.py</strong> initializes the
                FastAPI router and mounts 4 sub-routers. <strong style={{ color: "var(--accent-orange)" }}>orchestrator.py</strong>{" "}
                acts as the central coordinator with an in-degree gravity rank of #2.
              </div>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="hero-tabs-wrapper">
      <Tabs tabs={tabs} />
    </div>
  );
}
