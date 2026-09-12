import { useEffect, useId, useRef, useState, useCallback } from "react";
import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: false,
  securityLevel: "loose",
  theme: "base",
  themeVariables: {
    darkMode: true,
    background: "transparent",
    mainBkg: "#0d1322",
    primaryColor: "#0f172a",
    primaryBorderColor: "rgba(99, 102, 241, 0.6)",
    primaryTextColor: "#f8fafc",
    lineColor: "#2dd4bf",
    secondaryColor: "#1e293b",
    tertiaryColor: "#0f172a",
    edgeLabelBackground: "#0b0f19",
    fontFamily: "Inter, system-ui, -apple-system, sans-serif",
    fontSize: "14px",
    nodeBorder: "rgba(99, 102, 241, 0.6)",
    clusterBkg: "rgba(15, 23, 42, 0.55)",
    clusterBorder: "rgba(255, 255, 255, 0.15)",
    titleColor: "#f8fafc",
  },
  flowchart: {
    htmlLabels: true,
    curve: "basis",
    nodeSpacing: 45,
    rankSpacing: 55,
    padding: 12,
  },
});

type Props = {
  chart: string;
  inferred?: boolean;
  onSelectNode?: (nodeName: string) => void;
};

export default function MermaidDiagram({ chart, inferred = false, onSelectNode }: Props) {
  const id = useId().replace(/:/g, "");
  const viewportRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>("");
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);
  const naturalDimensionsRef = useRef({ width: 1000, height: 800 });

  // Compute fit scale to fit entire diagram in viewport
  const fitToView = useCallback(() => {
    if (!viewportRef.current) return;
    const vpRect = viewportRef.current.getBoundingClientRect();
    const vpW = vpRect.width || 800;
    const vpH = vpRect.height || 600;
    const { width: svgW, height: svgH } = naturalDimensionsRef.current;

    const scaleX = (vpW - 60) / svgW;
    const scaleY = (vpH - 60) / svgH;
    const fit = Math.min(scaleX, scaleY, 1.2);
    const newScale = Math.max(Number(fit.toFixed(2)), 0.1);

    const newPanX = (vpW - svgW * newScale) / 2;
    const newPanY = (vpH - svgH * newScale) / 2;

    setScale(newScale);
    setPan({ x: Math.round(newPanX), y: Math.round(newPanY) });
  }, []);

  // Snap to 1:1 (True 100% resolution for crystal-clear readability)
  const snapTo100 = useCallback(() => {
    if (!viewportRef.current) {
      setScale(1);
      return;
    }
    const vpRect = viewportRef.current.getBoundingClientRect();
    const vpW = vpRect.width || 800;
    const { width: svgW } = naturalDimensionsRef.current;

    // Center horizontally at 1:1, start top with 40px margin
    const newPanX = (vpW - svgW) / 2;
    setScale(1);
    setPan({ x: Math.round(newPanX), y: 40 });
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      if (!chart.trim()) return;
      setRenderError(null);
      try {
        const cleanChart = chart.replace(/```mermaid/g, "").replace(/```/g, "").trim();
        const { svg } = await mermaid.render(`mermaid-${id}`, cleanChart);
        if (!cancelled) {
          // Extract natural viewBox dimensions
          const vbMatch = svg.match(/viewBox=["']\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*["']/);
          let vbW = 1000;
          let vbH = 800;
          if (vbMatch) {
            vbW = parseFloat(vbMatch[3]);
            vbH = parseFloat(vbMatch[4]);
          }
          naturalDimensionsRef.current = { width: vbW, height: vbH };

          // Remove max-width and percentage width so the SVG renders unconstrained at native resolution
          const cleanSvg = svg
            .replace(/width=["']100%["']/, `width="${vbW}"`)
            .replace(/style=["'][^"']*max-width:[^"']*["']/g, "")
            .replace(/max-width:\s*[^;"]*;?/g, "");

          setSvgContent(cleanSvg);

          // Initial positioning: if graph is large, calculate fit or initial view
          setTimeout(() => {
            if (viewportRef.current) {
              const vp = viewportRef.current.getBoundingClientRect();
              const fit = Math.min((vp.width - 60) / vbW, (vp.height - 60) / vbH, 1.0);
              const initialScale = Math.min(Math.max(fit, 0.25), 1.0);
              const px = (vp.width - vbW * initialScale) / 2;
              const py = Math.max((vp.height - vbH * initialScale) / 2, 20);
              setScale(Number(initialScale.toFixed(2)));
              setPan({ x: Math.round(px), y: Math.round(py) });
            }
          }, 50);
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

  // Click-to-interrogate node listener (only on click, not drag)
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !onSelectNode) return;
    function handleClick(e: MouseEvent) {
      if (hasMovedRef.current) return;
      const target = (e.target as Element).closest(".node, .actor");
      if (target) {
        const text = target.textContent?.trim();
        if (text && onSelectNode) {
          onSelectNode(text);
        }
      }
    }
    el.addEventListener("click", handleClick);
    return () => el.removeEventListener("click", handleClick);
  }, [svgContent, onSelectNode]);

  // Pan handlers
  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    setIsDragging(true);
    hasMovedRef.current = false;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...pan };
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      hasMovedRef.current = true;
    }
    setPan({
      x: panStartRef.current.x + dx,
      y: panStartRef.current.y + dy,
    });
  }

  function handleMouseUp() {
    setIsDragging(false);
  }

  // Native non-passive wheel & pinch listener to prevent full-page browser zoom
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    function handleWheelNative(e: WheelEvent) {
      if (!el) return;
      // Prevents full webpage zoom in Chrome/Edge/Safari
      e.preventDefault();
      e.stopPropagation();

      const vpRect = el.getBoundingClientRect();
      const mouseX = e.clientX - vpRect.left;
      const mouseY = e.clientY - vpRect.top;

      if (e.ctrlKey) {
        // Trackpad pinch gesture (Chrome/Edge send wheel with ctrlKey=true)
        const pinchFactor = Math.pow(1.01, -e.deltaY);
        setScale((currScale) => {
          const newScale = Math.min(Math.max(Number((currScale * pinchFactor).toFixed(3)), 0.05), 8.0);
          setPan((currPan) => {
            const newPanX = mouseX - (mouseX - currPan.x) * (newScale / currScale);
            const newPanY = mouseY - (mouseY - currPan.y) * (newScale / currScale);
            return { x: Math.round(newPanX), y: Math.round(newPanY) };
          });
          return newScale;
        });
      } else {
        // Standard mouse wheel or two-finger scroll zoom centered at cursor
        const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
        setScale((currScale) => {
          const newScale = Math.min(Math.max(Number((currScale * zoomFactor).toFixed(3)), 0.05), 8.0);
          setPan((currPan) => {
            const newPanX = mouseX - (mouseX - currPan.x) * (newScale / currScale);
            const newPanY = mouseY - (mouseY - currPan.y) * (newScale / currScale);
            return { x: Math.round(newPanX), y: Math.round(newPanY) };
          });
          return newScale;
        });
      }
    }

    function preventGesture(e: Event) {
      e.preventDefault();
    }

    // passive: false is REQUIRED so e.preventDefault() blocks browser full-page zoom
    el.addEventListener("wheel", handleWheelNative, { passive: false });
    el.addEventListener("gesturestart", preventGesture, { passive: false });
    el.addEventListener("gesturechange", preventGesture, { passive: false });

    return () => {
      el.removeEventListener("wheel", handleWheelNative);
      el.removeEventListener("gesturestart", preventGesture);
      el.removeEventListener("gesturechange", preventGesture);
    };
  }, []);

  function handleZoomIn() {
    setScale((prev) => Math.min(Number((prev * 1.25).toFixed(2)), 8.0));
  }

  function handleZoomOut() {
    setScale((prev) => Math.max(Number((prev / 1.25).toFixed(2)), 0.05));
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
      <div className="canvas-error-box">
        <div className="canvas-error-title">[TOPOLOGY RENDERING NOTICE]</div>
        <p className="canvas-error-desc">Mermaid was unable to parse the syntax tree. Raw graph representation:</p>
        <pre className="canvas-error-pre">{chart}</pre>
      </div>
    );
  }

  return (
    <div className="studio-canvas-container">
      {/* Floating Glass Tool Dock */}
      <div className="studio-floating-dock">
        {inferred ? (
          <span className="studio-inferred-badge">INFERRED</span>
        ) : (
          <span className="studio-verified-badge">GROUNDED AST</span>
        )}

        <div className="studio-dock-divider" />

        <span className="studio-zoom-display">{Math.round(scale * 100)}%</span>
        
        <button type="button" className="studio-tool-btn" onClick={handleZoomIn} title="Zoom In (or scroll wheel)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="11" y1="8" x2="11" y2="14" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        </button>
        
        <button type="button" className="studio-tool-btn" onClick={handleZoomOut} title="Zoom Out (or scroll wheel)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        </button>

        <button type="button" className="studio-tool-btn" onClick={fitToView} title="Fit Entire Graph on Screen">
          Fit
        </button>

        <button type="button" className="studio-tool-btn" onClick={snapTo100} title="100% Actual Size (1:1 Crisp Text)">
          1:1
        </button>

        <button type="button" className="studio-tool-btn studio-tool-btn-export" onClick={handleDownload} title="Export Architecture SVG">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span>SVG</span>
        </button>
      </div>

      {/* Viewport with Cosmic Grid & Scaling Surface */}
      <div
        ref={viewportRef}
        className={`studio-canvas-viewport ${isDragging ? "is-dragging" : ""}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          ref={containerRef}
          className="studio-mermaid-wrapper"
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale})`,
            transition: isDragging ? "none" : "transform 0.08s ease-out",
          }}
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      </div>
    </div>
  );
}
