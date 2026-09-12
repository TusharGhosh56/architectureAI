import { useState } from "react";
import discoverImg from "../assets/process_discover.jpg";
import designImg from "../assets/process_design.jpg";
import developImg from "../assets/process_develop.jpg";
import deployImg from "../assets/process_deploy.jpg";

interface ProcessStep {
  id: string;
  title: string;
  category: string;
  image: string;
  alt: string;
  description: string;
}

const PROCESS_STEPS: ProcessStep[] = [
  {
    id: "discover",
    title: "DISCOVER",
    category: "RESEARCH",
    image: discoverImg,
    alt: "Collaborative engineering discovery and system exploration",
    description: "Interrogate dependencies, analyze repo blast radius, and discover hidden architectural bottlenecks.",
  },
  {
    id: "design",
    title: "DESIGN",
    category: "EXPERIENCE",
    image: designImg,
    alt: "Topological system architecture graph design and mapping",
    description: "Generate interactive topological node graphs and model refactor trajectories with zero hallucination.",
  },
  {
    id: "develop",
    title: "DEVELOP",
    category: "ENGINEERING",
    image: developImg,
    alt: "AST syntax parsing and code dependency engineering",
    description: "Compile Abstract Syntax Trees, eliminate circular import deadlocks, and refactor with verified ground truth.",
  },
  {
    id: "deploy",
    title: "DEPLOY",
    category: "LAUNCH",
    image: deployImg,
    alt: "Zero-defect automated cloud deployment pipeline",
    description: "Ship changes with mathematical blast-radius safety, verified CI checks, and guaranteed DAG purity.",
  },
];

export default function ProcessShowcase() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <section className="process-showcase-section" id="process">
      <div className="process-showcase-container">
        {/* Eyebrow tag matching the inspiration */}
        <div className="process-eyebrow-container">
          <span className="process-eyebrow-tag">PROCESS</span>
        </div>

        {/* 4 Interactive Process Rows */}
        <div className="process-list-container" role="list">
          {PROCESS_STEPS.map((step, idx) => {
            const isHovered = hoveredIndex === idx;

            return (
              <div
                key={step.id}
                role="listitem"
                className={`process-row ${isHovered ? "is-active" : ""}`}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => setHoveredIndex(isHovered ? null : idx)}
              >
                {/* Left Side: Heavy Typography Main Title */}
                <div className="process-title-wrapper">
                  <span className={`process-title ${isHovered ? "text-accent-blue" : ""}`}>
                    {step.title}
                  </span>
                </div>

                {/* Right Side / Middle: Hover-Revealed Thumbnail Card & Category Tag */}
                <div className="process-meta-wrapper">
                  {/* Floating Image Preview Card */}
                  <div
                    className={`process-image-card ${isHovered ? "card-visible" : "card-hidden"}`}
                    aria-hidden={!isHovered}
                  >
                    <img
                      src={step.image}
                      alt={step.alt}
                      className="process-card-thumbnail"
                      loading="eager"
                    />
                    <div className="process-card-overlay" />
                  </div>

                  {/* Category Tag on the Right */}
                  <span className={`process-category-tag ${isHovered ? "tag-dimmed" : ""}`}>
                    {step.category}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
