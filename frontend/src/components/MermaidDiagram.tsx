import { useEffect, useId, useRef } from "react";
import mermaid from "mermaid";

mermaid.initialize({ startOnLoad: false, securityLevel: "loose" });

type Props = {
  chart: string;
  inferred?: boolean;
};

export default function MermaidDiagram({ chart, inferred = false }: Props) {
  const id = useId().replace(/:/g, "");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      if (!ref.current || !chart.trim()) return;
      const { svg } = await mermaid.render(`mermaid-${id}`, chart);
      if (!cancelled && ref.current) {
        ref.current.innerHTML = svg;
      }
    }
    void render();
    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  return (
    <div>
      {inferred && (
        <p style={{ fontSize: "0.85rem", color: "#666" }}>
          AI-inferred — verify against source
        </p>
      )}
      <div ref={ref} />
    </div>
  );
}
