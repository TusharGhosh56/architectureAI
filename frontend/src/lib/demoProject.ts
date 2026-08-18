import type { AnalysisSession } from "./session";

export const DEMO_PROJECT: AnalysisSession = {
  project_id: "demo-ecommerce-microservices-v2",
  filename: "nexus-commerce-engine.zip",
  file_count: 46,
  edge_count: 138,
  important_files: [
    "src/services/order_orchestrator.ts",
    "src/gateway/api_router.ts",
    "src/domain/payment_processor.ts",
    "src/infrastructure/event_bus.ts",
    "src/database/schema_manager.ts",
    "src/auth/token_verifier.ts",
  ],
  circular_deps: [],
  diagram_mermaid: `flowchart TD
    subgraph ClientLayer ["Client & Edge Ingress"]
      WebClient["Web / Mobile Clients"]
      APIGateway["API Gateway & Auth Proxy\\n(src/gateway/api_router.ts)"]
    end

    subgraph CoreServices ["Microservices Domain Core"]
      OrderOrchestrator["Order Orchestrator\\n(src/services/order_orchestrator.ts)"]
      PaymentProcessor["Payment Processor\\n(src/domain/payment_processor.ts)"]
      InventoryService["Inventory Controller\\n(src/services/inventory.ts)"]
      UserAuthService["Auth & IAM Service\\n(src/auth/token_verifier.ts)"]
    end

    subgraph EventStream ["Asynchronous Event Mesh"]
      KafkaEventBus["Distributed Event Bus\\n(src/infrastructure/event_bus.ts)"]
    end

    subgraph DataPersistence ["Storage & Caching Layer"]
      PostgresDB[("PostgreSQL Cluster\\n(src/database/schema_manager.ts)")]
      RedisCache[("Redis Session Cache")]
    end

    WebClient -->|HTTPS / GraphQL| APIGateway
    APIGateway -->|Bearer Token Auth| UserAuthService
    APIGateway -->|Route Request| OrderOrchestrator
    OrderOrchestrator -->|Process Checkout| PaymentProcessor
    OrderOrchestrator -->|Reserve Stock| InventoryService
    OrderOrchestrator -->|Publish 'OrderCreated'| KafkaEventBus
    PaymentProcessor -->|Verify Card| PostgresDB
    KafkaEventBus -->|Async Sync| InventoryService
    UserAuthService -->|Read Sessions| RedisCache
    OrderOrchestrator -->|Store State| PostgresDB`,
  architecture_summary:
    "Nexus Commerce Engine is a distributed event-driven microservices architecture built with TypeScript and Python. Ingress requests pass through the API Gateway with JWT verification, dispatching to domain services (Order Orchestrator, Payment Processor, Inventory). State is persisted across PostgreSQL with Redis caching, and decoupling is enforced via an asynchronous Kafka Event Bus.",
  chunk_count: 248,
};

export const DEMO_SAMPLE_REPLIES: Record<string, { reply: string; diagram?: { mermaid: string; inferred?: boolean; type?: string; note?: string } }> = {
  overview: {
    reply: `### Architecture Overview: Nexus Commerce Engine

**Key Architectural Characteristics**:
1. **Edge Ingress & Gateway Layer**: The \`api_router.ts\` acts as the primary reverse proxy, performing token validation via \`token_verifier.ts\` before forwarding requests.
2. **Domain Service Layer**: Core business logic is isolated into domain controllers: \`order_orchestrator.ts\` handles saga orchestration, \`payment_processor.ts\` interfaces with external payment rails, and \`inventory.ts\` manages stock allocations.
3. **Decoupled Event Streaming**: Inter-service coordination relies on \`event_bus.ts\` to broadcast transactional events asynchronously, preventing cascading failures.
4. **Data Isolation**: Database models are centrally tracked in \`schema_manager.ts\` with Redis session stores.`,
    diagram: {
      type: "Layered Architecture",
      mermaid: DEMO_PROJECT.diagram_mermaid,
    },
  },
  graph: {
    reply: `Here is the AST-extracted dependency graph for the core subsystem modules. All links represent static import relations parsed directly from source files.`,
    diagram: {
      type: "Dependency Graph",
      mermaid: `flowchart LR
    API["src/gateway/api_router.ts"] --> Order["src/services/order_orchestrator.ts"]
    API --> Auth["src/auth/token_verifier.ts"]
    Order --> Pay["src/domain/payment_processor.ts"]
    Order --> Inv["src/services/inventory.ts"]
    Order --> Bus["src/infrastructure/event_bus.ts"]
    Order --> DB["src/database/schema_manager.ts"]
    Pay --> DB
    Inv --> DB
    Auth --> DB`,
    },
  },
  usecase: {
    reply: `Here is the generated UML Use Case diagram mapping actors (Customer, Admin, Payment Gateway) to primary system capabilities.`,
    diagram: {
      type: "UML Use Case",
      mermaid: `flowchart LR
    Customer["👤 Customer"]
    Admin["🛡️ Admin"]
    PaymentGW["💳 Payment Gateway"]

    UC_Browse["Browse Catalog"]
    UC_Order["Place Order & Checkout"]
    UC_Track["Track Shipment"]
    UC_Manage["Manage Inventory"]
    UC_Settle["Settle Transactions"]

    Customer --> UC_Browse
    Customer --> UC_Order
    Customer --> UC_Track
    Admin --> UC_Manage
    UC_Order --> UC_Settle
    PaymentGW --> UC_Settle`,
    },
  },
  layers: {
    reply: `The project follows a clean 4-tier layered architecture with strict unidirectional dependencies:`,
    diagram: {
      type: "High-Level Layers",
      mermaid: `flowchart TB
    subgraph Presentation ["1. Ingress / Presentation Layer"]
      Router["API Router & Endpoints"]
      Middlewares["Auth Middleware & Validators"]
    end
    subgraph Domain ["2. Core Domain Services"]
      Sagas["Order Orchestration Saga"]
      Billing["Payment & Invoicing"]
      Catalog["Inventory & Stock"]
    end
    subgraph Infrastructure ["3. Infrastructure & Messaging"]
      KafkaBus["Kafka Event Bus Adapter"]
      HttpClient["HTTP Third-party SDKs"]
    end
    subgraph Persistence ["4. Data & Persistence Layer"]
      Postgres["PostgreSQL Repositories"]
      Redis["Redis Cache"]
    end

    Presentation --> Domain
    Domain --> Infrastructure
    Domain --> Persistence
    Infrastructure --> Persistence`,
    },
  },
  core: {
    reply: `### Core Dependency Hubs

Based on AST in-degree centrality, these 5 files have the highest coupling in the codebase:

1. **\`src/services/order_orchestrator.ts\`** (18 inward references) — Central transaction orchestrator coordinating cart checkout and notifications.
2. **\`src/gateway/api_router.ts\`** (14 references) — Dispatches incoming REST/GraphQL endpoints to domain controllers.
3. **\`src/domain/payment_processor.ts\`** (11 references) — Financial transaction lifecycle and webhook handlers.
4. **\`src/infrastructure/event_bus.ts\`** (9 references) — Event pub/sub bridge used across all domain microservices.
5. **\`src/database/schema_manager.ts\`** (8 references) — Centralized ORM models and migration manifests.`,
  },
  cycles: {
    reply: `✅ **No circular dependencies detected!**\n\nThe AST graph analysis verified 138 directed edges across 46 source modules with zero strongly-connected cyclic components. All domain dependencies follow acyclic hierarchical patterns.`,
  },
};
