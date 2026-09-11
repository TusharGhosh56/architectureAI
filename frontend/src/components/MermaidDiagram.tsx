import { useEffect, useId, useRef, useState } from "react";
import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: false,
  securityLevel: "loose",
  theme: "dark",
  themeVariables: {
    darkMode: true,
    background: "#020202",
    mainBkg: "#0d0d0d",
    primaryColor: "#0d0d0d",
    primaryBorderColor: "#383838",
    primaryTextColor: "#f5f5f5",
    lineColor: "#ff5500",
    secondaryColor: "#141414",
    tertiaryColor: "#1a1a1a",
    fontFamily: "JetBrains Mono, monospace",
    fontSize: "12px",
  },
});

type Props = {
  chart: string;
  inferred?: boolean;
  onSelectNode?: (nodeName: string) => void;
};

export default function MermaidDiagram({ chart, inferred = false, onSelectNode }: Props) {
  const id = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>("");
  const [scale, setScale] = useState(1);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      if (!chart.trim()) return;
      setRenderError(null);
      try {
        const cleanChart = chart.replace(/```mermaid/g, "").replace(/```/g, "").trim();
        const { svg } = await mermaid.render(`mermaid-${id}`, cleanChart);
        if (!cancelled) {
          setSvgContent(svg);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Mermaid error:", err);
          setRenderError(err instanceof Error ? err.message : "Diagram rendering failed");
        }
      }
    }
    void render();
    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  function handleZoomIn() {
    setScale((prev) => Math.min(prev + 0.15, 2.5));
  }

  function handleZoomOut() {
    setScale((prev) => Math.max(prev - 0.15, 0.4));
  }

  function handleReset() {
    setScale(1);
  }

  function handleDownload() {
    if (!svgContent) return;
    const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `architecture-graph-${id}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (renderError) {
    return (
      <div style={{ padding: "1rem", fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--accent-red)" }}>
        <div>[GRAPH RENDERING ERROR]</div>
        <pre style={{ color: "var(--text-muted)", marginTop: "0.5rem", whiteSpace: "pre-wrap" }}>
          {chart}
        </pre>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%" }}>
      <div
        style={{
          height: 36,
          borderBottom: "1px solid var(--border-hairline)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 0.85rem",
          background: "#050505",
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ color: "var(--text-muted)" }}>CANVAS //</span>
          <span style={{ color: "var(--text-white)" }}>AST DEPENDENCY TOPOLOGY</span>
          {inferred && (
            <span style={{ color: "var(--accent-orange)", border: "1px solid var(--accent-orange)", padding: "1px 4px", fontSize: "9px" }}>
              INFERRED
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <button type="button" className="btn-icon-tiny" onClick={handleZoomIn} title="Zoom in">
            +
          </button>
          <button type="button" className="btn-icon-tiny" onClick={handleZoomOut} title="Zoom out">
            -
          </button>
          <button type="button" className="btn-icon-tiny" onClick={handleReset} title="Reset scale">
            1:1
          </button>
          <button type="button" className="btn-icon-tiny" onClick={handleDownload} title="Export SVG">
            SVG
          </button>
        </div>
      </div>

      <div
        className="canvas-viewport"
        ref={containerRef}
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          transition: "transform 0.1s ease-out",
        }}
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    </div>
  );
}
