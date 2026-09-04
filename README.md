# <p align="center">📸 INTELLERY</p>
<h3 align="center">AI-Powered Event Photography & Visual Identity Engine</h3>

<p align="center">
  Intellery is a high-performance, edge-accelerated visual intelligence platform designed for photographers, event organizers, and attendees. It processes bulk event photography in real-time, clusters attendees by biometric facial features, and unlocks multimodal natural language semantic search across thousands of images in milliseconds.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express-5.2-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/Prisma-7.8-2D3748?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/PostgreSQL-16_+_pgvector-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="Postgres pgvector" />
  <img src="https://img.shields.io/badge/MinIO-S3_Storage-C72C48?style=for-the-badge&logo=minio&logoColor=white" alt="MinIO" />
  <img src="https://img.shields.io/badge/Redis-7_BullMQ-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis BullMQ" />
  <img src="https://img.shields.io/badge/ONNX_Runtime-In_Process-005CED?style=for-the-badge&logo=onnx&logoColor=white" alt="ONNX Runtime" />
</p>

---

## ⚡ The Problem & The Solution

- **The Problem:** Photographers shoot thousands of photos during weddings, conferences, and parties. Finding photos of specific people or moments typically means scrolling through gigabytes of raw images or waiting days for manual sorting.
- **The Solution:** Intellery ingests hundreds of photos per batch, runs in-process deep learning models for facial detection, alignment, 512-D vector extraction, and scene captioning, storing embeddings in PostgreSQL with **pgvector**. Attendees register with a single selfie and immediately access their personalized gallery or search naturally (e.g. *"me laughing with mom on stage"*).

---

## ✨ Key Features

| Feature | Description |
| :--- | :--- |
| **🚀 High-Throughput Bulk Ingestion** | Upload up to **1,000 photos per batch** directly to S3-compatible storage (MinIO) with asynchronous background processing via **BullMQ** and **Redis**. |
| **🎯 In-Process Vision Pipeline** | Zero-IPC inference using **ONNX Runtime (Node.js)**: SCRFD for face detection, 5-point landmark affine transformation, and ArcFace (ResNet-50) for 512-D facial feature extraction. |
| **👥 Biometric Face Clustering** | Unsupervised face grouping per event using cosine similarity metrics in pgvector (`<=>`). Unknown attendees are clustered into identities that can be named and tagged. |
| **🤳 Instant Selfie Matching** | Attendees register with a selfie. When joining an event, Intellery automatically matches their face vector against event clusters and links their user account to their identity. |
| **🔍 Multimodal Natural Language Search** | OpenAI CLIP (ViT-B/32) vision and text encoders running locally. Search by natural descriptions (e.g., *"cutting the cake"*, *"dancing in dark lighting"*) combined with identity filters (*"me and John"*). |
| **🛡️ Robust Role-Based Access Control** | Event-level roles (`ADMIN`, `CONTRIBUTOR`, `VIEWER`) protecting upload pipelines, gallery visibility, and member management. |
| **📦 Pure TypeScript Monorepo** | Built on Turborepo with clean separation between API, desktop client, shared infrastructure, and comprehensive architecture decision records. |

---

## 🏗️ High-Level System Architecture

```mermaid
flowchart TD
    subgraph Clients["Clients"]
        Web["Web / Desktop App\n(React / Electron)"]
    end

    subgraph API_Gateway["Intellery API Service (Express 5 + TypeScript)"]
        Auth["Auth Controller\n(JWT + Argon2)"]
        Upload["Upload Controller\n(Multer 1000-photo stream)"]
        EventCtrl["Event & Photo Controller\n(Galleries & Personalized Views)"]
        SearchCtrl["Search Controller\n(Multimodal Natural Language)"]
    end

    subgraph Storage["Storage & Messaging Tier"]
        MinIO[("MinIO / S3 Storage\n(Photo Buckets)")]
        RedisQueue[("Redis 7 + BullMQ\n(Photo Processing Queue)")]
        Postgres[("PostgreSQL 16 + pgvector\n(Metadata + 512-D Vectors)")]
    end

    subgraph Worker["Asynchronous In-Process AI Worker"]
        PhotoWorker["PhotoWorker (BullMQ Consumer)"]
        subgraph VisionEngine["Vision & AI Engine (ONNX Runtime)"]
            SCRFD["SCRFD 10G\n(Face Detection + 5-pt Keypoints)"]
            Aligner["FaceAligner\n(112x112 Umeyama Transform)"]
            ArcFace["ArcFace ResNet50\n(512-D Biometric Embedding)"]
            CLIP_Vision["CLIP ViT-B/32\n(512-D Scene Embedding)"]
            CLIP_Text["CLIP Text Encoder + BPE\n(Query Vectorizer)"]
        end
        IdentityService["Identity Clustering &\nUser Resolver"]
    end

    Web -->|REST / Multipart| API_Gateway
    Upload -->|Stream Photos| MinIO
    Upload -->|Enqueue Job| RedisQueue
    RedisQueue --> PhotoWorker
    PhotoWorker -->|Download Image| MinIO
    PhotoWorker --> SCRFD
    SCRFD --> Aligner
    Aligner --> ArcFace
    PhotoWorker --> CLIP_Vision
    ArcFace --> Postgres
    CLIP_Vision --> Postgres
    IdentityService <--> Postgres
    SearchCtrl --> CLIP_Text
    CLIP_Text -->|pgvector Cosine Search| Postgres
```

---

## 🧠 The Computer Vision & AI Pipeline

```
Raw Image (MinIO)
       │
       ├───────────────────────────────────────────────┐
       ▼                                               ▼
[SCRFD 10G Face Detector]                     [CLIP ViT-B/32 Vision]
       │ (Bounding boxes + 5 landmarks)                │
       ▼                                               ▼
[Face Aligner (Umeyama Transform)]            512-D Scene Vector
       │ (Normalized 112x112 RGB)                      │
       ▼                                               ▼
[ArcFace ResNet-50 Feature Extractor]         [PhotoAnnotation Table]
       │ (512-D Normalized Vector)             (pgvector Cosine ANN)
       ▼
[FaceVector Table (pgvector)]
       │
       ▼
[Identity Clustering & User Auto-Resolution]
 (Matches against user selfie or existing event clusters)
```

1. **Detection:** SCRFD (Sample and Computation Redistribution for Face Detection) predicts face bounding boxes and 5 facial keypoints (eyes, nose, mouth corners) with score threshold `0.5`.
2. **Alignment:** An affine transformation maps keypoints to standard canonical coordinates, producing a normalized $112 \times 112$ RGB crop invariant to facial tilt and head poses.
3. **Face Embedding:** ArcFace (ResNet-50 backbone trained on MS1MV3) projects each face crop into a hypersphere embedding of 512 dimensions.
4. **Scene Embedding:** Concurrently, OpenAI CLIP ViT-B/32 generates a 512-dimensional visual semantics vector representing the overall photo composition, atmosphere, and objects.
5. **Vector Indexing & Retrieval:** PostgreSQL with `pgvector` indexes embeddings using cosine distance (`<=>`), enabling sub-5ms similarity searches across hundreds of thousands of vectors.

---

## 📂 Repository Structure

```
intellery/
├── apps/
│   ├── api/                    # Core REST API & in-process AI engine
│   │   ├── models/             # Local ONNX models (SCRFD, ArcFace, CLIP)
│   │   ├── prisma/             # Database schema and pgvector migrations
│   │   ├── src/
│   │   │   ├── composition/    # Dependency injection & service bootstrapper
│   │   │   ├── config/         # Zod-validated environment config
│   │   │   ├── controllers/    # Express route controllers (camelCase)
│   │   │   ├── dto/            # Data transfer object definitions
│   │   │   ├── errors/         # Typed error hierarchy (HTTP & Domain errors)
│   │   │   ├── infrastructure/ # Prisma, MinIO client, BullMQ worker/queue
│   │   │   ├── middleware/     # Auth, file validation, error handlers
│   │   │   ├── routes/         # Express 5 route definitions
│   │   │   ├── schemas/        # Zod validation schemas
│   │   │   ├── services/       # Core business & orchestration services
│   │   │   ├── storage/        # Storage abstraction layer (MinIO / S3)
│   │   │   └── vision/         # Detection, Alignment, Recognition, CLIP
│   └── desktop/                # Cross-platform desktop client (Electron + React)
├── docs/                       # Complete engineering documentation hub
│   ├── adr/                    # Architecture Decision Records (ADRs 0001 - 0004)
│   ├── api/                    # Comprehensive API reference & error catalog
│   ├── architecture/           # Deep-dive architecture, AI pipeline & data flows
│   ├── development/            # Local developer onboarding, setup & conventions
│   └── diagrams/               # System, ERD & workflow Mermaid diagrams
├── infra/
│   └── docker/                 # Docker Compose (Postgres 16 + pgvector, MinIO, Redis)
├── package.json                # Monorepo root package.json
├── pnpm-workspace.yaml         # PNPM workspace configuration
└── turbo.json                  # Turborepo task pipeline configuration
```

---

## 🚀 Quick Start & Local Setup

### 1. Prerequisites

- **Node.js**: v20.x or higher
- **pnpm**: v9.x or higher (`npm install -g pnpm`)
- **Docker & Docker Compose**: For local infrastructure services
- **Git LFS** (or downloaded ONNX model files)

### 2. Clone the Repository

```bash
git clone https://github.com/your-org/intellery.git
cd intellery
```

### 3. Install Dependencies

```bash
pnpm install
```

### 4. Start Infrastructure Containers

Start PostgreSQL (with `pgvector`), MinIO (with auto bucket initialization), and Redis:

```bash
cd infra/docker
docker compose up -d
cd ../..
```

Verify services:
- **PostgreSQL**: `localhost:5432` (User: `intellery`, Pass: `intellery`, DB: `intellery`)
- **MinIO Console**: `http://localhost:9001` (User: `intellery`, Pass: `intellery123`)
- **Redis**: `localhost:6379`

### 5. Configure Environment Variables

Create `apps/api/.env`:

```env
PORT=3000
DATABASE_URL="postgresql://intellery:intellery@localhost:5432/intellery?schema=public"
JWT_SECRET="your-super-secure-jwt-secret-at-least-32-chars-long"

MINIO_ENDPOINT="localhost"
MINIO_PORT=9000
MINIO_USE_SSL="false"
MINIO_ACCESS_KEY="intellery"
MINIO_SECRET_KEY="intellery123"
MINIO_BUCKET="intellery"

REDIS_HOST="localhost"
REDIS_PORT=6379
```

### 6. Verify ONNX Model Files

Ensure the following 4 ONNX models and tokenizer assets reside in `apps/api/models/`:

```
apps/api/models/
├── clip/
│   ├── merges.txt
│   ├── text_model.onnx
│   ├── vision_model.onnx
│   └── vocab.json
└── insightface/
    ├── detection/scrfd_10g_bnkps.onnx
    └── recognition/w600k_r50.onnx
```

### 7. Run Database Migrations

Apply the Prisma schema and enable the pgvector extension:

```bash
cd apps/api
pnpm prisma db push
# or
pnpm prisma migrate dev
```

### 8. Run the Development Server

```bash
pnpm --filter @intellery/api dev
```

The API will boot, load all 4 ONNX models into memory, connect to Redis and MinIO, and start listening on `http://localhost:3000`.

---

## 📡 Core API Cheatsheet

| Method | Endpoint | Description | Auth |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Service health & database connectivity check | Public |
| `POST` | `/auth/register` | Register user with email, password & optional selfie | Public |
| `POST` | `/auth/login` | Authenticate user and obtain Bearer JWT | Public |
| `POST` | `/events/create` | Create an event with a name and unique 6-char code | Bearer |
| `POST` | `/events/join` | Join an event by code (triggers selfie face auto-matching) | Bearer |
| `GET` | `/events` | List all events user is a member of | Bearer |
| `GET` | `/events/:eventId` | Get event details, member count, photo count | Bearer |
| `POST` | `/events/:eventId/uploads` | Bulk upload up to 1,000 photos (multipart/form-data) | Bearer |
| `GET` | `/events/:eventId/photos` | Paginated photo gallery with presigned image URLs | Bearer |
| `GET` | `/events/:eventId/photos/me` | Personalized gallery: photos containing attendee's face | Bearer |
| `GET` | `/events/:eventId/identities` | List detected face clusters (named and unnamed) | Bearer |
| `PATCH` | `/events/:eventId/identities/:id` | Name or rename an identity cluster (e.g. "Mom", "Sarah") | Bearer |
| `POST` | `/events/:eventId/search` | Multimodal natural language search (e.g. "me on stage") | Bearer |

> 📖 **Full API Reference**: Check out [docs/api/api-reference.md](file:///home/ayush/Projects/intellery/docs/api/api-reference.md) for complete request schemas, response examples, and cURL snippets.

---

## 📚 Complete Engineering Documentation

The repository includes comprehensive engineering documentation located in the [`docs/`](file:///home/ayush/Projects/intellery/docs/) directory:

- 🏛️ **[Architecture Overview](file:///home/ayush/Projects/intellery/docs/architecture/system-overview.md)** — Core components, micro-services boundaries, and data pipelines.
- 🧠 **[Computer Vision Pipeline](file:///home/ayush/Projects/intellery/docs/architecture/ai-pipeline.md)** — SCRFD, landmark alignment, ArcFace, and CLIP ViT-B/32 integration.
- 🔄 **[Data Flow Lifecycle](file:///home/ayush/Projects/intellery/docs/architecture/data-flow.md)** — Step-by-step transaction flow from upload to semantic search.
- 📜 **[Architecture Decision Records (ADRs)](file:///home/ayush/Projects/intellery/docs/adr/)**:
  - [ADR-0001: Monorepo & System Architecture](file:///home/ayush/Projects/intellery/docs/adr/ADR-0001-monorepo-system-architecture.md)
  - [ADR-0002: PostgreSQL & pgvector Domain Model](file:///home/ayush/Projects/intellery/docs/adr/ADR-0002-domain-model.md)
  - [ADR-0003: Asynchronous Photo Upload Pipeline](file:///home/ayush/Projects/intellery/docs/adr/ADR-0003-photo-upload-pipeline.md)
  - [ADR-0004: In-Process ONNX Runtime AI Pipeline](file:///home/ayush/Projects/intellery/docs/adr/ADR-0004-in-process-onnx-ai-pipeline.md)
- 🔌 **[API Documentation](file:///home/ayush/Projects/intellery/docs/api/)**:
  - [API Reference](file:///home/ayush/Projects/intellery/docs/api/api-reference.md) — Complete endpoint reference with parameters and status codes.
  - [Error Handling](file:///home/ayush/Projects/intellery/docs/api/error-handling.md) — Typed error hierarchy and standard error payloads.
- 📊 **[System Diagrams](file:///home/ayush/Projects/intellery/docs/diagrams/)**:
  - [System Architecture Diagrams](file:///home/ayush/Projects/intellery/docs/diagrams/architecture.md)
  - [Database Entity-Relationship Diagram](file:///home/ayush/Projects/intellery/docs/diagrams/entity-relationship.md)
  - [AI Processing Workflow](file:///home/ayush/Projects/intellery/docs/diagrams/ai-workflow.md)
- 🛠️ **[Developer Guides](file:///home/ayush/Projects/intellery/docs/development/)**:
  - [Local Development & Onboarding](file:///home/ayush/Projects/intellery/docs/development/getting-started.md)
  - [Project Conventions & Standards](file:///home/ayush/Projects/intellery/docs/development/conventions.md)

---

## 🛡️ License

This project is licensed under the [ISC License](LICENSE).
