import { useState, useRef, type MouseEvent } from "react";
import defaultBackImage from "../assets/repo_graph.jpg";
import defaultFrontImage from "../assets/repo_audit.jpg";

type Props = {
  backImage?: string;
  frontImage?: string;
  backTitle?: string;
  frontTitle?: string;
};

export default function ParallaxShowcase({
  backImage = defaultBackImage,
  frontImage = defaultFrontImage,
  backTitle = "zenith-core // AST Dependency Graph",
  frontTitle = "apollo-web // Architecture & Cycle Audit",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const normX = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    const normY = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    setOffset({ x: normX, y: normY });
  }

  function handleMouseLeave() {
    setOffset({ x: 0, y: 0 });
  }

  return (
    <div
      ref={containerRef}
      className="parallax-stage"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Ambient Spotlight Beam */}
      <div className="parallax-spotlight" />

      <div className="parallax-inner-scene">
        {/* Layer 1: Back Card (Main Architecture Graph) */}
        <div
          className="parallax-layer parallax-layer-back"
          style={{
            transform: `rotate(-13deg) translate3d(${offset.x * 12}px, ${offset.y * 12}px, 0px)`,
          }}
        >
          <div className="parallax-card-window">
            <div className="parallax-card-header">
              <div className="parallax-dots">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </div>
              <div className="parallax-card-title">{backTitle}</div>
              <div className="parallax-status-tag">AST RESOLVED</div>
            </div>
            <div className="parallax-card-media">
              <img src={backImage} alt={backTitle} draggable={false} />
            </div>
          </div>
        </div>

        {/* Layer 2: Front Card (Overlapping Metrics & Cycle Audit) */}
        <div
          className="parallax-layer parallax-layer-front"
          style={{
            transform: `rotate(-13deg) translate3d(${offset.x * 24}px, ${offset.y * 24}px, 40px)`,
          }}
        >
          <div className="parallax-card-window">
            <div className="parallax-card-header">
              <div className="parallax-dots">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </div>
              <div className="parallax-card-title">{frontTitle}</div>
              <div className="parallax-status-tag" style={{ color: "var(--accent-green)", borderColor: "rgba(0, 229, 153, 0.3)" }}>
                DAG HEALTHY
              </div>
            </div>
            <div className="parallax-card-media">
              <img src={frontImage} alt={frontTitle} draggable={false} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
