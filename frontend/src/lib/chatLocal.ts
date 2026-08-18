export type PromptItem = {
  id: string;
  label: string;
  question: string;
  category: "Architecture" | "Dependencies" | "Use Cases" | "Code Quality";
  icon: string;
  description: string;
};

export const SUGGESTED_PROMPTS: PromptItem[] = [
  {
    id: "overview",
    label: "Codebase Overview",
    question: "What does this project do? Summarize the architecture and core design patterns.",
    category: "Architecture",
    icon: "Compass",
    description: "High-level summary of architecture, domains, and entrypoints",
  },
  {
    id: "graph",
    label: "Dependency Graph",
    question: "Generate a dependency graph for this project",
    category: "Dependencies",
    icon: "Network",
    description: "Visual node-link graph of AST module imports",
  },
  {
    id: "layers",
    label: "Layer Architecture",
    question: "Generate a high-level layered architecture diagram",
    category: "Architecture",
    icon: "Layers",
    description: "Top-to-bottom tiered architectural diagram",
  },
  {
    id: "usecase",
    label: "UML Use Cases",
    question: "Generate a UML use case diagram for this project",
    category: "Use Cases",
    icon: "Workflow",
    description: "Actor interactions and user capabilities flow",
  },
  {
    id: "core",
    label: "Core Modules",
    question: "What are the most important / depended-upon files in this repository?",
    category: "Code Quality",
    icon: "Cpu",
    description: "Highest in-degree centrality dependency hubs",
  },
  {
    id: "cycles",
    label: "Circular Dependency Check",
    question: "Are there any circular dependencies or cyclic imports?",
    category: "Code Quality",
    icon: "AlertTriangle",
    description: "Detect recursive or cyclic coupling hazards",
  },
];
