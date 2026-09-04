# 📖 Intellery Engineering Documentation Hub

Welcome to the engineering documentation for **Intellery**. This directory serves as the centralized technical knowledge base for the platform's architecture, AI pipelines, API contracts, architectural decision records (ADRs), and developer workflows.

---

## 🗺️ Documentation Directory Index

```
docs/
├── adr/                    # Architecture Decision Records
│   ├── ADR-0001-monorepo-system-architecture.md
│   ├── ADR-0002-domain-model.md
│   ├── ADR-0003-photo-upload-pipeline.md
│   └── ADR-0004-in-process-onnx-ai-pipeline.md
│
├── architecture/           # Core System Design & AI Specifications
│   ├── system-overview.md  # High-level architecture, services & data stores
│   ├── ai-pipeline.md      # SCRFD, ArcFace, CLIP, alignment & vector math
│   └── data-flow.md        # End-to-end lifecycle transactions & sequences
│
├── api/                    # API Specifications & Contracts
│   ├── README.md           # API principles, auth, conventions & pagination
│   ├── api-reference.md    # Complete endpoint-by-endpoint reference
│   └── error-handling.md   # Error hierarchy, status codes & recovery
│
├── diagrams/               # Architecture, ERD & Flowcharts
│   ├── architecture.md     # High-level topology & service diagrams
│   ├── entity-relationship.md # Complete Prisma ERD & relational mapping
│   └── ai-workflow.md      # Computer vision & multimodal search flows
│
└── development/            # Local Setup, Conventions & Contribution
    ├── getting-started.md  # Developer onboarding, Docker, models & setup
    └── conventions.md      # Coding style, naming rules & architecture layers
```

---

## 🧭 Reading Paths by Role

### For Backend Engineers
1. Start with [Architecture Overview](file:///home/ayush/Projects/intellery/docs/architecture/system-overview.md) to understand service boundaries and data stores.
2. Read [Developer Getting Started](file:///home/ayush/Projects/intellery/docs/development/getting-started.md) to spin up local Docker dependencies and boot the API.
3. Review [Conventions & Standards](file:///home/ayush/Projects/intellery/docs/development/conventions.md) before writing any code.
4. Consult [API Reference](file:///home/ayush/Projects/intellery/docs/api/api-reference.md) and [Error Handling](file:///home/ayush/Projects/intellery/docs/api/error-handling.md).

### For AI & Vision Engineers
1. Study the [AI Pipeline Deep Dive](file:///home/ayush/Projects/intellery/docs/architecture/ai-pipeline.md) for full mathematical details on landmark transformations, ArcFace feature normalization, and CLIP multimodal embeddings.
2. Read [ADR-0004: In-Process ONNX Runtime](file:///home/ayush/Projects/intellery/docs/adr/ADR-0004-in-process-onnx-ai-pipeline.md) to understand memory management and model deployment in Node.js.
3. Review [AI Workflow Diagrams](file:///home/ayush/Projects/intellery/docs/diagrams/ai-workflow.md).

### For Frontend Developers
1. Review [API Overview & Conventions](file:///home/ayush/Projects/intellery/docs/api/README.md) for authentication, pagination, and URL structure.
2. Use [API Reference](file:///home/ayush/Projects/intellery/docs/api/api-reference.md) as the ground-truth specification for request and response formats.
3. Read [Error Handling](file:///home/ayush/Projects/intellery/docs/api/error-handling.md) to correctly handle error codes like `FACE_NOT_DETECTED` or `MULTIPLE_FACES`.

---

## 📜 Architectural Decision Records (ADRs)

Every major architectural choice is documented as an ADR:

- **[ADR-0001: Monorepo & System Architecture](file:///home/ayush/Projects/intellery/docs/adr/ADR-0001-monorepo-system-architecture.md)** — Decision to adopt a Turborepo-managed pnpm monorepo.
- **[ADR-0002: Domain Model & Vector Persistence](file:///home/ayush/Projects/intellery/docs/adr/ADR-0002-domain-model.md)** — Relational structure in PostgreSQL with 512-D vector embeddings in `pgvector`.
- **[ADR-0003: Asynchronous Photo Upload Pipeline](file:///home/ayush/Projects/intellery/docs/adr/ADR-0003-photo-upload-pipeline.md)** — Ingestion architecture using Multer streaming, MinIO S3 object storage, and BullMQ task queueing.
- **[ADR-0004: In-Process ONNX Runtime AI Pipeline](file:///home/ayush/Projects/intellery/docs/adr/ADR-0004-in-process-onnx-ai-pipeline.md)** — Replacing external Python services with in-process C++ ONNX Runtime bindings for zero-IPC latency.

---

## 💡 Documentation Principles

- **Living Documentation:** Documentation evolves directly with the codebase. When modifying schemas or routes, update the corresponding docs in the same commit.
- **Precision:** Document exact field names, types, HTTP codes, and vector dimensions.
- **Visual Clarity:** Use Mermaid diagrams to explain multi-step asynchronous transactions and relational dependencies.