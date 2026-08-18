import { Cpu, ShieldCheck, Zap, GitBranch } from "lucide-react";

export default function Footer() {
  return (
    <footer className="footer-saas">
      <div className="footer-container">
        <div className="footer-top">
          <div>
            <div className="brand-logo" style={{ marginBottom: "0.5rem" }}>
              <div className="brand-icon-box" style={{ width: 28, height: 28 }}>
                <Cpu size={16} />
              </div>
              <span style={{ fontSize: "1.1rem" }}>
                Architect<span className="gradient-text">AI</span>
              </span>
            </div>
            <p className="footer-desc">
              Autonomous software architecture extraction, AST static analysis, and vector-grounded LLM intelligence.
            </p>
          </div>

          <div style={{ display: "flex", gap: "2.5rem", flexWrap: "wrap" }}>
            <div>
              <h4 style={{ fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
                Technology Core
              </h4>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.4rem", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                <li style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}><Zap size={13} color="var(--cyan-400)" /> Tree-Sitter & Python AST</li>
                <li style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}><GitBranch size={13} color="var(--indigo-400)" /> NetworkX Directed Graphs</li>
                <li style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}><ShieldCheck size={13} color="var(--emerald-400)" /> ChromaDB Local Embeddings</li>
              </ul>
            </div>

            <div>
              <h4 style={{ fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
                Privacy & Safety
              </h4>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", maxWidth: "240px", margin: 0, lineHeight: 1.5 }}>
                100% of embeddings and AST graphs are generated locally in session. No code training or telemetry storage.
              </p>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <span>&copy; {new Date().getFullYear()} ArchitectAI Platform. Built for modern engineering teams.</span>
          <div style={{ display: "flex", gap: "1rem" }}>
            <span style={{ color: "var(--text-muted)" }}>FastAPI + React 19 + Mermaid JS</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
