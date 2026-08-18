import { Link, useNavigate } from "react-router-dom";
import { Cpu, Sparkles, Layers, ArrowRight } from "lucide-react";
import { saveAnalysis } from "../lib/session";
import { DEMO_PROJECT } from "../lib/demoProject";

export default function Navbar() {
  const navigate = useNavigate();

  const handleLaunchDemo = () => {
    saveAnalysis({ ...DEMO_PROJECT, is_demo: true });
    navigate("/chat");
  };

  return (
    <header className="navbar-fixed">
      <div className="navbar-container">
        <Link to="/" className="brand-logo">
          <div className="brand-icon-box">
            <Cpu size={20} />
          </div>
          <span>
            Architect<span className="gradient-text">AI</span>
          </span>
          <span className="pill-badge" style={{ fontSize: "0.7rem", padding: "0.15rem 0.5rem" }}>
            v2.4 Neural
          </span>
        </Link>

        <nav aria-label="Main Navigation">
          <ul className="nav-links">
            <li>
              <a href="#workspace" className="nav-link">
                Workspace
              </a>
            </li>
            <li>
              <a href="#superpowers" className="nav-link">
                Superpowers
              </a>
            </li>
            <li>
              <a href="#diagrams" className="nav-link">
                Diagrams
              </a>
            </li>
            <li>
              <a href="#faq" className="nav-link">
                FAQ
              </a>
            </li>
          </ul>
        </nav>

        <div className="nav-actions">
          <button
            type="button"
            onClick={handleLaunchDemo}
            className="btn btn-secondary btn-sm"
            title="Explore instant pre-analyzed demo codebase"
          >
            <Sparkles size={14} className="text-cyan-400" />
            <span>Try Live Demo</span>
          </button>

          <a href="#workspace" className="btn btn-primary btn-sm">
            <Layers size={14} />
            <span>Upload ZIP</span>
            <ArrowRight size={13} />
          </a>
        </div>
      </div>
    </header>
  );
}
