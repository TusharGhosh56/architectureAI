export const SUGGESTED_PROMPTS = [
  {
    id: "overview",
    label: "What does this project do?",
    question: "What does this project do?",
  },
  {
    id: "graph",
    label: "Show the dependency graph",
    question: "Generate a dependency graph for this project",
  },
  {
    id: "core",
    label: "What are the core files?",
    question: "What are the most important / depended-upon files?",
  },
  {
    id: "cycles",
    label: "Any circular dependencies?",
    question: "Are there any circular dependencies?",
  },
  {
    id: "auth",
    label: "Explain the auth module",
    question: "Explain how authentication works in this codebase",
  },
] as const;

export type LocalChatResult = {
  content: string;
  mermaid?: string;
  inferred?: boolean;
};

/** Grounded answers from the last analysis until the full agent ships. */
export function answerFromAnalysis(
  question: string,
  analysis: {
    architecture_summary: string;
    important_files: string[];
    circular_deps: string[][];
    diagram_mermaid: string;
    file_count: number;
    edge_count: number;
  },
): LocalChatResult | null {
  const q = question.toLowerCase();

  if (
    q.includes("dependency graph") ||
    q.includes("generate a graph") ||
    q.includes("diagram") ||
    (q.includes("show") && q.includes("graph"))
  ) {
    return {
      content:
        "Here’s the extracted dependency diagram from your upload — edges come from real imports, not model guesses.",
      mermaid: analysis.diagram_mermaid,
      inferred: false,
    };
  }

  if (
    q.includes("what does") ||
    q.includes("overview") ||
    q.includes("summary") ||
    q.includes("architecture")
  ) {
    return {
      content:
        analysis.architecture_summary ||
        `Analyzed ${analysis.file_count} source files with ${analysis.edge_count} internal import edges.`,
    };
  }

  if (
    q.includes("important") ||
    q.includes("core") ||
    q.includes("central") ||
    q.includes("depended")
  ) {
    const list =
      analysis.important_files.length > 0
        ? analysis.important_files.map((f) => `• ${f}`).join("\n")
        : "No central files detected yet.";
    return {
      content: `Most depended-upon files (by in-degree):\n\n${list}`,
    };
  }

  if (q.includes("circular") || q.includes("cycle")) {
    if (!analysis.circular_deps.length) {
      return { content: "No circular dependencies detected in the parsed import graph." };
    }
    const cycles = analysis.circular_deps
      .slice(0, 8)
      .map((c, i) => `${i + 1}. ${c.join(" → ")}`)
      .join("\n");
    return { content: `Found circular dependencies:\n\n${cycles}` };
  }

  return null;
}
