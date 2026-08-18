import { useEffect, useId, useRef, useState } from "react";
import mermaid from "mermaid";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Copy,
  Check,
  Download,
  Code2,
  Eye,
  X,
  Layers,
} from "lucide-react";

mermaid.initialize({
  startOnLoad: false,
  securityLevel: "loose",
  theme: "dark",
  themeVariables: {
    darkMode: true,
    background: "#090e1a",
    primaryColor: "#131d33",
    primaryTextColor: "#f1f5f9",
    primaryBorderColor: "#06b6d4",
    lineColor: "#64748b",
    secondaryColor: "#1e1b4b",
    tertiaryColor: "#0f172a",
    fontSize: "13px",
    fontFamily: "Plus Jakarta Sans, sans-serif",
  },
  suppressErrorRendering: true,
});

export type DiagramModel = {
  mermaid?: string;
  inferred?: boolean;
  type?: string;
  note?: string;
};

type Props = {
  chart?: string;
  model?: DiagramModel;
};

function cleanupMermaidTemp(renderId: string) {
  document.getElementById(renderId)?.remove();
  document.getElementById(`d${renderId}`)?.remove();
  document.getElementById(`i${renderId}`)?.remove();
  for (const el of Array.from(document.body.children)) {
    if (el.id === "root") continue;
    const tag = el.tagName.toLowerCase();
    const id = el.id || "";
    if (tag === "svg" || (tag === "div" && (id === `d${renderId}` || id.startsWith("mmd")))) {
      el.remove();
    }
  }
}

/** Strip ```mermaid fences and light prose */
function extractMermaidSource(chart: string): string {
  let raw = chart.trim();
  const fence = raw.match(/```(?:mermaid)?\s*([\s\S]*?)```/i);
  if (fence) raw = fence[1].trim();

  // Mermaid 11 dropped usecaseDiagram — convert if the model still emits it
  if (raw.toLowerCase().startsWith("usecasediagram")) {
    return usecaseDiagramToFlowchart(raw);
  }

  const start = raw.search(
    /^(?:flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram)\b/im,
  );
  if (start > 0) raw = raw.slice(start).trim();

  return raw
    .replace(/\u2013|\u2014/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    // Common LLM bug: A -->|label|> B  →  A -->|label| B
    .replace(/(-->|---|==>)\|([^|\n]+)\|>/g, "$1|$2|");
}

function usecaseDiagramToFlowchart(raw: string): string {
  const actors: string[] = [];
  const cases: string[] = [];
  const links: Array<[string, string]> = [];

  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.toLowerCase().startsWith("usecasediagram")) continue;

    const actor = t.match(/^actor\s+(?:["']([^"']+)["']|(\w+))(?:\s+as\s+["']?([^"']+)["']?)?/i);
    if (actor) {
      actors.push((actor[3] || actor[1] || actor[2] || "").trim());
      continue;
    }
    const uc = t.match(/^usecase\s+(?:\w+\s+as\s+)?["']?([^"']+)["']?$/i) || t.match(/^\(([^)]+)\)$/);
    if (uc) {
      cases.push(uc[1].trim());
      continue;
    }
    const arrow = t.match(
      /^(?:\(([^)]+)\)|["']([^"']+)["']|(\w+))\s*--+>\s*(?:\(([^)]+)\)|["']([^"']+)["']|(\w+))$/,
    );
    if (arrow) {
      const from = (arrow[1] || arrow[2] || arrow[3] || "").trim();
      const to = (arrow[4] || arrow[5] || arrow[6] || "").trim();
      if (from && to) links.push([from, to]);
    }
  }

  const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))];
  const actorList = uniq(actors.length ? actors : ["User"]);
  const caseList = uniq(cases.length ? cases : links.map(([, b]) => b));
  if (!caseList.length) caseList.push("Use Application");

  const idify = (label: string, prefix: string) =>
    `${prefix}_${label.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^(\d)/, "n_$1") || "x"}`;

  const lines = ["flowchart LR"];
  for (const a of actorList) lines.push(`  ${idify(a, "A")}["${a.replace(/"/g, "'")}"]`);
  for (const c of caseList) lines.push(`  ${idify(c, "U")}["${c.replace(/"/g, "'")}"]`);
  for (const [from, to] of links) {
    if (!actorList.includes(from) && !caseList.includes(from)) continue;
    if (!actorList.includes(to) && !caseList.includes(to)) continue;
    const fromId = actorList.includes(from) ? idify(from, "A") : idify(from, "U");
    const toId = actorList.includes(to) ? idify(to, "A") : idify(to, "U");
    lines.push(`  ${fromId} --> ${toId}`);
  }
  for (const a of actorList) {
    if (!links.some(([f]) => f === a) && caseList[0]) {
      lines.push(`  ${idify(a, "A")} --> ${idify(caseList[0], "U")}`);
    }
  }
  return lines.join("\n");
}

export default function MermaidDiagram({ chart, model }: Props) {
  const reactId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const hostRef = useRef<HTMLDivElement>(null);
  const modalHostRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [viewCode, setViewCode] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [renderedSvg, setRenderedSvg] = useState<string>("");

  const source = (chart || model?.mermaid || "").trim();
  const normalizedSource = extractMermaidSource(source);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      if (!source) {
        setError("No Mermaid string in response.");
        return;
      }
      setError(null);
      if (hostRef.current) hostRef.current.innerHTML = "";

      const renderId = `mmd${reactId}${Date.now().toString(36)}`;
      try {
        const { svg, bindFunctions } = await mermaid.render(renderId, normalizedSource);
        cleanupMermaidTemp(renderId);
        if (cancelled) return;
        setRenderedSvg(svg);
        if (hostRef.current) {
          hostRef.current.innerHTML = svg;
          bindFunctions?.(hostRef.current);
        }
      } catch (err) {
        cleanupMermaidTemp(renderId);
        console.warn("[MermaidDiagram] render failed", err, "\n", normalizedSource);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Mermaid render failed");
          if (hostRef.current) hostRef.current.innerHTML = "";
        }
      }
    }
    void render();
    return () => {
      cancelled = true;
    };
  }, [source, reactId, normalizedSource]);

  useEffect(() => {
    if (isFullscreen && modalHostRef.current && renderedSvg) {
      modalHostRef.current.innerHTML = renderedSvg;
    }
  }, [isFullscreen, renderedSvg]);

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(normalizedSource);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSvg = () => {
    if (!renderedSvg) return;
    const blob = new Blob([renderedSvg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `architecture-diagram-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="diagram-canvas-card">
      <div className="diagram-header-bar">
        <div className="diagram-title-badge">
          <Layers size={14} />
          <span>{model?.type || "Architecture Diagram"}</span>
        </div>

        <div className="diagram-tools-row">
          <button
            type="button"
            className="diagram-tool-btn"
            onClick={() => setZoom((z) => Math.max(0.6, z - 0.15))}
            title="Zoom Out"
          >
            <ZoomOut size={14} />
          </button>
          <button
            type="button"
            className="diagram-tool-btn"
            onClick={() => setZoom(1)}
            title="Reset Zoom"
          >
            <RotateCcw size={13} />
          </button>
          <button
            type="button"
            className="diagram-tool-btn"
            onClick={() => setZoom((z) => Math.min(2.0, z + 0.15))}
            title="Zoom In"
          >
            <ZoomIn size={14} />
          </button>

          <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.1)", margin: "0 2px" }} />

          <button
            type="button"
            className="diagram-tool-btn"
            onClick={() => setViewCode(!viewCode)}
            title={viewCode ? "View Diagram" : "View Mermaid Code"}
          >
            {viewCode ? <Eye size={14} /> : <Code2 size={14} />}
          </button>

          <button
            type="button"
            className="diagram-tool-btn"
            onClick={handleCopyCode}
            title="Copy Mermaid Code"
          >
            {copied ? <Check size={14} color="var(--emerald-400)" /> : <Copy size={14} />}
          </button>

          <button
            type="button"
            className="diagram-tool-btn"
            onClick={handleDownloadSvg}
            title="Download SVG"
          >
            <Download size={14} />
          </button>

          <button
            type="button"
            className="diagram-tool-btn"
            onClick={() => setIsFullscreen(true)}
            title="Fullscreen Modal"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      {viewCode ? (
        <div style={{ padding: "1.25rem", background: "#060911", overflowX: "auto" }}>
          <pre style={{ margin: 0, fontSize: "0.85rem", color: "var(--cyan-400)", fontFamily: "var(--font-mono)" }}>
            <code>{normalizedSource}</code>
          </pre>
        </div>
      ) : (
        <div className="diagram-viewport">
          <div
            ref={hostRef}
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: "center center",
              transition: "transform 0.2s ease",
            }}
          />
          {error && (
            <div
              style={{
                margin: "1rem",
                padding: "1rem",
                background: "rgba(244, 63, 94, 0.1)",
                border: "1px solid rgba(244, 63, 94, 0.3)",
                borderRadius: "var(--radius-sm)",
                color: "var(--rose-400)",
                fontSize: "0.85rem",
              }}
            >
              Could not render this specific diagram syntax. Try asking for a high-level flowchart.
            </div>
          )}
        </div>
      )}

      {/* Fullscreen Preview Modal */}
      {isFullscreen && (
        <div className="modal-backdrop" onClick={() => setIsFullscreen(false)}>
          <div className="modal-dialog-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="diagram-title-badge">
                <Layers size={16} />
                <span>{model?.type || "Architecture Diagram"} — Fullscreen Preview</span>
              </div>
              <button
                type="button"
                className="diagram-tool-btn"
                onClick={() => setIsFullscreen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div ref={modalHostRef} style={{ width: "100%", overflow: "auto" }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
