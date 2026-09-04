# ADR-0001: Monorepo & High-Level System Architecture

- **Status:** Accepted
- **Date:** 2026-07-29
- **Authors:** Ayush Mehta

---

# Context

Intellery is an AI-powered desktop application designed for photographers and event organizers to upload event photographs and allow attendees to retrieve all photographs containing their face.

The application is expected to evolve into a distributed system consisting of multiple independently deployable services. The system must be scalable, fault tolerant, maintainable, and cloud-ready while remaining simple enough for local development.

Several architectural decisions were required regarding repository structure, application boundaries, communication, and technology stack.

---

# Decision

## Repository Structure

The project will use a **pnpm monorepo** managed using **Turborepo**.

```
intellery/
├── apps/
│   ├── api/
│   ├── ai/
│   └── desktop/
│
├── packages/
│   ├── shared-types/
│   ├── eslint-config/
│   ├── tsconfig/
│   └── ...
│
├── docs/
├── infra/
└── package.json
```

### Rationale

- Single source of truth
- Shared TypeScript types
- Shared tooling and linting
- Easier dependency management
- Independent applications with shared code

---

## Application Architecture

The system is divided into three primary applications.

### Desktop

Responsibilities

- User interface
- Authentication
- Event management
- Uploading photographs
- Viewing search results

Technology

- Electron
- React
- TypeScript

---

### API

Responsibilities

- Business logic
- Authentication
- Authorization
- Metadata management
- Upload orchestration
- Communication with storage
- Communication with AI workers

Technology

- Express
- Prisma
- PostgreSQL

---

### AI Service

Responsibilities

- Face detection
- Face alignment
- Embedding generation
- Similarity search
- Background processing

Technology

- Python
- Deep learning models
- Worker processes

---

## Database

Primary database:

- PostgreSQL

Stores:

- Users
- Events
- Event members
- Uploads
- Photos
- Detected faces
- Face embeddings (initially using pgvector)

---

## Object Storage

Photographs will **not** be stored inside PostgreSQL.

Instead, images will be stored inside object storage.

Development:

- MinIO

Production:

- AWS S3 (or compatible object storage)

Only storage metadata (storage keys, MIME types, etc.) will be stored in PostgreSQL.

---

## Communication

Initial communication:

```
Desktop
      │
      ▼
REST API
```

Future architecture:

```
Desktop
      │
      ▼
REST API
      │
      ├────────► PostgreSQL
      │
      ├────────► Object Storage
      │
      └────────► Message Queue
                     │
                     ▼
                AI Workers
```

AI processing is intentionally asynchronous.

---

## Shared Packages

Reusable code should be extracted into packages when shared by multiple applications.

Examples:

- shared-types
- validation schemas
- shared utilities
- SDKs

Application-specific business logic remains inside each application.

---

## Architectural Principles

The project follows the following principles:

- Separation of concerns
- Single responsibility
- Dependency inversion
- Domain-driven design
- Asynchronous processing where appropriate
- Interface-driven architecture
- Cloud portability
- Failure recovery
- Scalability over premature optimization

---

# Consequences

## Advantages

- Clear separation of responsibilities
- Easier long-term maintenance
- Independent deployment of services
- Shared code without duplication
- Cloud-ready architecture
- Supports future scaling

## Trade-offs

- Higher initial complexity
- Requires infrastructure for multiple services
- Increased documentation effort
- More coordination between applications

---

# Alternatives Considered

## Single Express Monolith

Pros

- Easier initially

Cons

- AI tightly coupled with API
- Harder to scale
- Reduced maintainability

Rejected.

---

## Separate Repositories

Pros

- Independent repositories

Cons

- Difficult code sharing
- Version synchronization
- Duplicate tooling

Rejected.

---

# Future Evolution

Expected future additions include:

- Message queue
- Background workers
- WebSocket progress updates
- Distributed AI processing
- Object storage replication
- CDN integration
- Horizontal scaling
- Dedicated vector database (if pgvector becomes insufficient)

---

# References

Related Architecture Decision Records:

- [ADR-0002 — Relational Domain Model and pgvector Persistence](file:///home/ayush/Projects/intellery/docs/adr/ADR-0002-domain-model.md)
- [ADR-0003 — Asynchronous Photo Ingestion Pipeline](file:///home/ayush/Projects/intellery/docs/adr/ADR-0003-photo-upload-pipeline.md)
- [ADR-0004 — In-Process ONNX Runtime AI Pipeline](file:///home/ayush/Projects/intellery/docs/adr/ADR-0004-in-process-onnx-ai-pipeline.md)