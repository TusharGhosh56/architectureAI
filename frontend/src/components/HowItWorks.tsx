import { useEffect, useRef, useState } from "react";

interface StepData {
  number: string;
  title: string;
  description: string;
  pinColor: string;
  glowColor: string;
  rotation: number;
  align: "left" | "right";
  offsetPercent: number; // horizontal margin offset
}

const STEPS: StepData[] = [
  {
    number: "01",
    title: "Ingest Repository Archive",
    description:
      "Drop any .zip codebase archive. The compiler unpacks and analyzes files purely in-memory with zero arbitrary code execution or credential leakage.",
    pinColor: "#f59e0b",
    glowColor: "rgba(245, 158, 11, 0.15)",
    rotation: -3.5,
    align: "left",
    offsetPercent: 10,
  },
  {
    number: "02",
    title: "Parse Syntax Trees",
    description:
      "Native Python AST and TypeScript SWC engines extract symbol tables, import dependencies, and export declarations in parallel threads.",
    pinColor: "#38bdf8",
    glowColor: "rgba(56, 189, 248, 0.15)",
    rotation: 3.2,
    align: "right",
    offsetPercent: 12,
  },
  {
    number: "03",
    title: "Map Graph Topology",
    description:
      "Tarjan's SCC cycle-finding algorithm isolates circular dependencies while degree centrality quantifies architectural blast-radius gravity.",
    pinColor: "#c084fc",
    glowColor: "rgba(192, 132, 252, 0.15)",
    rotation: -2.8,
    align: "left",
    offsetPercent: 14,
  },
  {
    number: "04",
    title: "Interrogate & Refactor",
    description:
      "Ask your codebase complex refactor questions, generate verified Mermaid DAGs, and simulate structural changes with zero LLM hallucinations.",
    pinColor: "#fb923c",
    glowColor: "rgba(251, 146, 60, 0.15)",
    rotation: 3.5,
    align: "right",
    offsetPercent: 10,
  },
];

// Realistic 3D Pushpin Vector Component
function Pushpin({ color }: { color: string }) {
  return (
    <div className="card-pushpin-anchor">
      {/* Soft Pin Cast Shadow */}
      <div className="pushpin-cast-shadow" />
      <svg
        width="28"
        height="36"
        viewBox="0 0 28 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="pushpin-svg"
      >
        {/* Needle Tip */}
        <path
          d="M14 22L14 35"
          stroke="#94a3b8"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Needle Highlight */}
        <path
          d="M14 22L14 33"
          stroke="#e2e8f0"
          strokeWidth="0.75"
          strokeLinecap="round"
        />
        {/* Pushpin Body / Head */}
        <defs>
          <linearGradient id={`pinGrad-${color}`} x1="6" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffffff" stopOpacity="0.6" />
            <stop offset="0.3" stopColor={color} />
            <stop offset="1" stopColor="#0f172a" />
          </linearGradient>
          <radialGradient id={`pinCap-${color}`} cx="14" cy="5" r="7" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffffff" stopOpacity="0.8" />
            <stop offset="0.5" stopColor={color} />
            <stop offset="1" stopColor="#1e293b" />
          </radialGradient>
        </defs>
        {/* Top Rim of Pushpin */}
        <ellipse cx="14" cy="5" rx="7" ry="3" fill={`url(#pinCap-${color})`} />
        {/* Body Cone */}
        <path
          d="M7 5C7 5 9 14 10 17C11 20 8 21 8 22H20C20 21 17 20 18 17C19 14 21 5 21 5H7Z"
          fill={`url(#pinGrad-${color})`}
        />
        {/* Grip Ridge */}
        <ellipse cx="14" cy="18" rx="4.5" ry="1.5" fill="rgba(255,255,255,0.25)" />
      </svg>
    </div>
  );
}

export default function HowItWorks() {
  const containerRef = useRef<HTMLDivElement>(null);
  const pinRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [linePath, setLinePath] = useState<string>("");

  // Dynamically calculate the SVG thread line connecting pin centers
  useEffect(() => {
    const updatePath = () => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const points: { x: number; y: number }[] = [];

      pinRefs.current.forEach((pinEl) => {
        if (pinEl) {
          const pinRect = pinEl.getBoundingClientRect();
          points.push({
            x: pinRect.left + pinRect.width / 2 - containerRect.left,
            y: pinRect.top + pinRect.height / 2 - containerRect.top,
          });
        }
      });

      if (points.length >= 2) {
        // Build polyline connecting the pins
        let pathStr = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
          pathStr += ` L ${points[i].x} ${points[i].y}`;
        }
        setLinePath(pathStr);
      }
    };

    updatePath();
    const handleResize = () => updatePath();
    window.addEventListener("resize", handleResize);

    // Initial timeout to ensure layout settles
    const timer = setTimeout(updatePath, 250);

    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(timer);
    };
  }, []);

  return (
    <section className="how-it-works-section" id="how-it-works">
      {/* Background Blueprint / Faint Line Grid */}
      <div className="blueprint-lines-overlay" />

      <div className="how-it-works-header">
        <h2 className="how-it-works-title">
          How ArchitectAI compiles
          <br />
          <span style={{ color: "#cbd5e1" }}>ground truth from code.</span>
        </h2>
        <p className="how-it-works-subtitle">
          Every file, import, and call is mathematically linked. Here is how your codebase transforms from a raw archive into an interactive topological intelligence canvas.
        </p>
      </div>

      {/* Tactile Pinned Pipeline Container */}
      <div className="pinned-pipeline-container" ref={containerRef}>
        {/* Dynamic Connecting Dashed Thread SVG */}
        <svg className="pipeline-threads-svg" aria-hidden="true">
          {linePath && (
            <>
              {/* Outer faint glow line */}
              <path
                d={linePath}
                fill="none"
                stroke="rgba(255, 255, 255, 0.08)"
                strokeWidth="4"
              />
              {/* Crisp dashed thread line */}
              <path
                d={linePath}
                fill="none"
                stroke="rgba(255, 255, 255, 0.35)"
                strokeWidth="2"
                strokeDasharray="8 8"
                strokeLinecap="round"
              />
            </>
          )}
        </svg>

        {/* 4 Alternating Pinned Cards */}
        {STEPS.map((step, idx) => {
          const isLeft = step.align === "left";
          return (
            <div
              key={step.number}
              className={`pinned-card-wrapper ${isLeft ? "align-left" : "align-right"}`}
              style={{
                marginLeft: isLeft ? `${step.offsetPercent}%` : "auto",
                marginRight: !isLeft ? `${step.offsetPercent}%` : "auto",
              }}
            >
              <div
                className="pinned-tactile-card"
                style={
                  {
                    "--card-rotation": `${step.rotation}deg`,
                    "--card-glow": step.glowColor,
                    "--accent-num-color": step.pinColor,
                  } as React.CSSProperties
                }
              >
                {/* 3D Pushpin anchored to top center */}
                <div
                  ref={(el) => (pinRefs.current[idx] = el)}
                  className="pushpin-container"
                >
                  <Pushpin color={step.pinColor} />
                </div>

                {/* Card Content */}
                <div className="pinned-card-body">
                  <div className="pinned-step-header">
                    <span className="pinned-step-num">{step.number}</span>
                  </div>

                  <h3 className="pinned-card-title">{step.title}</h3>
                  <p className="pinned-card-desc">{step.description}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
