import githubRepoImg from "../assets/github_repo.jpg";

export default function ArchitectCanvas() {
  return (
    <div className="hero-visual-right">
      {/* Oversized GitHub Repository Window that fills hero height and extends past right viewport edge */}
      <div className="repo-bleed-window">
        {/* macOS / GitHub Window Chrome Bar */}
        <div className="repo-window-header">
          <div className="window-dots-cluster">
            <span className="window-dot" style={{ background: "#ff5f56" }} />
            <span className="window-dot" style={{ background: "#ffbd2e" }} />
            <span className="window-dot" style={{ background: "#27c93f" }} />
          </div>

          <div className="repo-url-bar">
            <span style={{ color: "#c9d1d9" }}>github.com/zenith-core/enterprise-mesh</span>
            <span
              style={{
                fontSize: "10px",
                padding: "0.1rem 0.4rem",
                borderRadius: "9999px",
                background: "rgba(255, 255, 255, 0.08)",
                color: "#8b949e",
              }}
            >
              Public
            </span>
          </div>

          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--accent-teal)",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--accent-teal)" }} />
            <span>UNMAPPED REPOSITORY</span>
          </div>
        </div>

        {/* Clean, Oversized AI-Generated GitHub Repository Interface Image */}
        <div className="repo-image-wrapper">
          <img
            src={githubRepoImg}
            alt="AI-Generated Complex GitHub Repository (zenith-core / enterprise-mesh)"
            className="repo-bleed-image"
            loading="eager"
          />
        </div>
      </div>
    </div>
  );
}
