import {
  FileCodeIcon,
  GitBranchIcon,
  LayersIcon,
  AlertCircleIcon,
  CheckIcon,
} from "./Icons";
import type { AnalysisSession } from "../lib/session";

type Props = {
  data: AnalysisSession;
  compact?: boolean;
};

export default function StatsOverview({ data, compact = false }: Props) {
  const hasCycles = data.circular_deps && data.circular_deps.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", width: "100%" }}>
      <div className="analysis-stats-bar">
        <div className="stat-item">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="stat-label">Source Files</span>
            <FileCodeIcon size={16} color="var(--cyan)" />
          </div>
          <div className="stat-value">{data.file_count}</div>
        </div>

        <div className="stat-item">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="stat-label">Import Edges</span>
            <GitBranchIcon size={16} color="var(--indigo-bright)" />
          </div>
          <div className="stat-value">{data.edge_count}</div>
        </div>

        <div className="stat-item">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="stat-label">Central Modules</span>
            <LayersIcon size={16} color="var(--cyan-bright)" />
          </div>
          <div className="stat-value">{data.important_files.length}</div>
        </div>

        <div className="stat-item">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="stat-label">Circular Cycles</span>
            {hasCycles ? (
              <AlertCircleIcon size={16} color="var(--amber)" />
            ) : (
              <CheckIcon size={16} color="var(--emerald)" />
            )}
          </div>
          <div className="stat-value" style={{ color: hasCycles ? "var(--amber)" : "var(--emerald)" }}>
            {data.circular_deps?.length || 0}
          </div>
        </div>
      </div>

      {!compact && data.important_files && data.important_files.length > 0 && (
        <div
          style={{
            padding: "1rem",
            borderRadius: "var(--radius-md)",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <div
            style={{
              fontSize: "0.8rem",
              fontWeight: 600,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "0.6rem",
            }}
          >
            Core Architecture Nodes (Ranked by In-Degree Centrality)
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {data.important_files.slice(0, 8).map((file, idx) => (
              <span key={file} className="badge badge-cyan">
                <span style={{ color: "var(--cyan)", fontWeight: 700 }}>#{idx + 1}</span>
                <span className="font-mono">{file}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {!compact && hasCycles && (
        <div
          style={{
            padding: "0.85rem 1rem",
            borderRadius: "var(--radius-md)",
            background: "var(--amber-glow)",
            border: "1px solid rgba(245, 158, 11, 0.3)",
            display: "flex",
            flexDirection: "column",
            gap: "0.4rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--amber)", fontWeight: 600, fontSize: "0.88rem" }}>
            <AlertCircleIcon size={16} />
            <span>Circular Dependency Warning ({data.circular_deps.length} cycle detected)</span>
          </div>
          <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
            {data.circular_deps.slice(0, 3).map((cycle, i) => (
              <div key={i} style={{ marginTop: 2 }}>
                • {cycle.join(" ➔ ")}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
