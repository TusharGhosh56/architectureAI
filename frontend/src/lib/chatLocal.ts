export const SUGGESTED_PROMPTS = [
  {
    id: "overview",
    label: "What does this project do?",
    question: "What does this project do? Summarize the architecture briefly.",
  },
  {
    id: "graph",
    label: "Show the dependency graph",
    question: "Generate a dependency graph for this project",
  },
  {
    id: "usecase",
    label: "Use case diagram",
    question: "Generate a UML use case diagram for this project",
  },
  {
    id: "layers",
    label: "Architecture layers",
    question: "Generate a high-level layered architecture diagram",
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
] as const;
