import type { AnalysisSession } from "./session";

export const SAMPLE_PROJECTS: AnalysisSession[] = [
  {
    project_id: "sample-fastapi-service",
    filename: "fastapi-agent-service.zip",
    file_count: 28,
    edge_count: 54,
    important_files: [
      "app/main.py",
      "app/api/router.py",
      "app/agents/orchestrator.py",
      "app/services/vector_store.py",
      "app/core/config.py",
      "app/db/session.py",
      "app/auth/security.py",
    ],
    circular_deps: [
      ["app/auth/security.py", "app/services/user_service.py", "app/auth/security.py"],
    ],
    diagram_mermaid: `graph TD
  Main["app/main.py"] --> Router["app/api/router.py"]
  Main --> Config["app/core/config.py"]
  Router --> Auth["app/auth/security.py"]
  Router --> Agent["app/agents/orchestrator.py"]
  Router --> Health["app/api/health.py"]
  Agent --> VectorStore["app/services/vector_store.py"]
  Agent --> LLMClient["app/llm/client.py"]
  Auth --> UserService["app/services/user_service.py"]
  UserService --> Auth
  UserService --> DB["app/db/session.py"]
  VectorStore --> Config
  LLMClient --> Config
  DB --> Models["app/models/base.py"]

  classDef core fill:#141414,stroke:#ff5500,stroke-width:2px,color:#ffffff
  classDef module fill:#0a0a0a,stroke:#333333,stroke-width:1px,color:#d4d4d4
  classDef warn fill:#1f130a,stroke:#ff5500,stroke-dasharray: 4 4,color:#ff9966

  class Main,Router,Agent core
  class Config,VectorStore,LLMClient,DB,Models module
  class Auth,UserService warn`,
    architecture_summary:
      "A production asynchronous FastAPI service coordinating agentic LLM workflows and vector search. Uses an orchestrator agent that interfaces with custom vector embeddings and security handlers. Detected a circular dependency cycle between auth/security.py and services/user_service.py that should be decoupled via dependency injection.",
    chunk_count: 86,
  },
  {
    project_id: "sample-react-architecture",
    filename: "modern-react-dashboard.zip",
    file_count: 36,
    edge_count: 68,
    important_files: [
      "src/App.tsx",
      "src/lib/apiClient.ts",
      "src/context/AuthContext.tsx",
      "src/state/globalStore.ts",
      "src/components/layout/Shell.tsx",
      "src/hooks/useMetrics.ts",
      "src/routes/index.tsx",
    ],
    circular_deps: [],
    diagram_mermaid: `graph TD
  Index["src/main.tsx"] --> App["src/App.tsx"]
  App --> Router["src/routes/index.tsx"]
  App --> AuthCtx["src/context/AuthContext.tsx"]
  Router --> Shell["src/components/layout/Shell.tsx"]
  Shell --> Dashboard["src/pages/Dashboard.tsx"]
  Shell --> Studio["src/pages/Studio.tsx"]
  Dashboard --> MetricsHook["src/hooks/useMetrics.ts"]
  MetricsHook --> API["src/lib/apiClient.ts"]
  AuthCtx --> API
  API --> Config["src/config/env.ts"]
  Dashboard --> Store["src/state/globalStore.ts"]

  classDef core fill:#141414,stroke:#ffffff,stroke-width:2px,color:#ffffff
  classDef module fill:#0a0a0a,stroke:#333333,stroke-width:1px,color:#d4d4d4

  class Index,App,Router,Shell core
  class Dashboard,Studio,MetricsHook,API,Config,Store,AuthCtx module`,
    architecture_summary:
      "A modular TypeScript React 19 architecture featuring a clean unidirectional data flow. Route-level code splitting via central layout shell, with unified authentication context and typed API interceptors. Zero circular dependencies detected with a healthy, layered DAG topology.",
    chunk_count: 104,
  },
];
