/**
 * Classic AI-app diagram renderer:
 *   receive Mermaid text (often from ```mermaid fences) → mermaid.render() → SVG
 */
import { useEffect, useId, useRef, useState } from "react";
import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: false,
  securityLevel: "loose",
  theme: "neutral",
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

/** Strip ```mermaid fences and light prose — same step most AI UIs do. */
export function extractMermaidSource(chart: string): string {
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
  const [error, setError] = useState<string | null>(null);

  const source = (chart || model?.mermaid || "").trim();

  useEffect(() => {
    let cancelled = false;
    async function render() {
      if (!hostRef.current || !source) {
        setError(source ? null : "No Mermaid string in response.");
        return;
      }
      setError(null);
      hostRef.current.innerHTML = "";

      const normalized = extractMermaidSource(source);
      const renderId = `mmd${reactId}${Date.now().toString(36)}`;
      try {
        const { svg, bindFunctions } = await mermaid.render(renderId, normalized);
        cleanupMermaidTemp(renderId);
        if (cancelled || !hostRef.current) return;
        hostRef.current.innerHTML = svg;
        bindFunctions?.(hostRef.current);
      } catch (err) {
        cleanupMermaidTemp(renderId);
        console.warn("[MermaidDiagram] render failed", err, "\n", normalized);
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
  }, [source, reactId]);

  return (
    <div className="diagram-root">
      <div ref={hostRef} />
      {error && (
        <pre
          style={{
            marginTop: "0.5rem",
            padding: "0.75rem",
            background: "#fff4f0",
            border: "1px solid #e7c4b8",
            fontSize: "0.8rem",
            whiteSpace: "pre-wrap",
          }}
        >
          Couldn’t draw this diagram. Try asking again.
        </pre>
      )}
    </div>
  );
}
