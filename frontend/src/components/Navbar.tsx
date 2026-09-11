import { Link, useLocation, useNavigate } from "react-router-dom";
import { loadAnalysis, clearAnalysis } from "../lib/session";

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const session = loadAnalysis();
  const isChat = location.pathname === "/chat";

  function handleReset() {
    clearAnalysis();
    navigate("/");
  }

  return (
    <header className="masthead">
      <div className="masthead-left">
        <Link to="/" className="masthead-brand">
          <span>architect</span><span style={{ color: "var(--accent-teal)" }}>ai</span>
        </Link>        

        {session && (
          <div className="status-indicator" style={{ borderLeft: "1px solid var(--border-subtle)", paddingLeft: "0.75rem" }}>
            <span style={{ color: "var(--text-white)", fontWeight: 600 }}>{session.filename}</span>
            <span style={{ color: "var(--text-muted)" }}>({session.file_count} NODES · {session.edge_count} EDGES)</span>
          </div>
        )}
      </div>

      <div className="masthead-right">
        <div className="segment-switch">
          <Link
            to="/"
            className={`segment-btn ${!isChat ? "active" : ""}`}
          >
            01. WORKBENCH
          </Link>
          <Link
            to="/chat"
            className={`segment-btn ${isChat ? "active" : ""}`}
          >
            02. STUDIO CANVAS
          </Link>
        </div>

        {session && (
          <button
            type="button"
            className="btn-icon-tiny"
            style={{ fontSize: "10px", padding: "0.25rem 0.55rem" }}
            onClick={handleReset}
            title="Clear active project from memory"
          >
            RESET
          </button>
        )}
      </div>
    </header>
  );
}
