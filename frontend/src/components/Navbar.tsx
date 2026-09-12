import { Link, useLocation } from "react-router-dom";
import { LogoIcon } from "./Icons";

export default function Navbar() {
  const location = useLocation();
  const isChat = location.pathname === "/chat";

  return (
    <header className="masthead">
      <div className="masthead-left">
        <Link to="/" className="masthead-brand" title="ArchitectAI Home">
          <div className="masthead-logo-wrap">
            <LogoIcon size={24} className="masthead-logo-icon" />
          </div>
          <div className="masthead-title-group">
            <span className="masthead-brand-title">
              Architect<span className="masthead-brand-highlight">AI</span>
            </span>
          </div>
        </Link>
      </div>

      <div className="masthead-right">
        <div className="segment-switch">
          <Link
            to="/"
            className={`segment-btn ${!isChat ? "active" : ""}`}
          >
            Workbench
          </Link>
          <Link
            to="/chat"
            className={`segment-btn ${isChat ? "active" : ""}`}
          >
            Studio Canvas
          </Link>
        </div>

      </div>
    </header>
  );
}
