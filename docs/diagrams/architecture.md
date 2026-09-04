# System Architecture Diagrams

This document collects architectural and structural diagrams illustrating the deployment and runtime topology of Intellery.

---

## 1. Container & Deployment Topology

```mermaid
graph TB
    subgraph Host["Docker Host / Local Dev Environment"]
        subgraph Ports["Exposed Ports"]
            P3000["Port 3000 (API)"]
            P5432["Port 5432 (Postgres)"]
            P9000["Port 9000 (MinIO API)"]
            P9001["Port 9001 (MinIO Console)"]
            P6379["Port 6379 (Redis)"]
        end

        subgraph Containers["Docker Compose Services"]
            PG["intellery-postgres\n(pgvector/pgvector:pg16)"]
            MINIO["intellery-minio\n(minio/minio)"]
            MINIO_INIT["intellery-minio-init\n(minio/mc auto bucket maker)"]
            REDIS["intellery-redis\n(redis:7)"]
        end

        subgraph NodeProcess["Node.js Host Process (pnpm dev)"]
            ExpressApp["Express 5 Web Server"]
            QueueWorker["BullMQ PhotoWorker"]
            ONNXEngine["ONNX Runtime C++ Engine\n(4 In-Memory Models)"]
        end
    end

    ExpressApp --- P3000
    PG --- P5432
    MINIO --- P9000
    MINIO --- P9001
    REDIS --- P6379

    MINIO_INIT -->|mc mb local/intellery| MINIO
    ExpressApp -->|TCP @prisma/adapter-pg| PG
    ExpressApp -->|HTTP S3 API| MINIO
    ExpressApp -->|BullMQ Queue| REDIS
    QueueWorker -->|BullMQ Consumer| REDIS
    QueueWorker -->|In-Process Direct Memory| ONNXEngine
```

---

## 2. Layered Software Architecture

```mermaid
graph TD
    subgraph PresentationLayer["1. Presentation & HTTP Gateway"]
        Routes["Express Routes (/auth, /events, /health)"]
        Validation["Zod Validation Middleware"]
        AuthMid["JWT Auth & Role Guards"]
        Controllers["Controllers (auth, event, photo, identity, search)"]
    end

    subgraph ServiceLayer["2. Domain & Application Services"]
        AuthService["AuthService"]
        EventService["EventService"]
        UploadService["UploadService"]
        PhotoService["PhotoService"]
        IdentityMgmtService["IdentityManagementService"]
        SearchService["SearchService"]
        SelfieProcService["SelfieProcessingService"]
    end

    subgraph VisionLayer["3. In-Process Computer Vision Layer"]
        ImageProc["ImageProcessor (sharp)"]
        Detector["InsightFaceDetector (SCRFD 10G)"]
        Aligner["FaceAligner (Umeyama Transform)"]
        Recognizer["FaceRecognizer (ArcFace ResNet50)"]
        SceneEmb["SceneEmbedder (CLIP ViT-B/32)"]
        TextEmb["TextEmbedder (CLIP Text + BPE)"]
        IdentitySvc["IdentityService (Clustering)"]
        UserResolver["UserIdentityResolver"]
    end

    subgraph InfrastructureLayer["4. Infrastructure & Persistence"]
        PrismaClient["Prisma Client with pgvector adapter"]
        MinioClient["MinioStorageService"]
        BullMQWorker["BullMQ PhotoWorker & Queue"]
    end

    PresentationLayer --> ServiceLayer
    ServiceLayer --> VisionLayer
    ServiceLayer --> InfrastructureLayer
    VisionLayer --> InfrastructureLayer
```
