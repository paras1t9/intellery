# Developer Getting Started & Local Environment Setup

This guide walks through setting up the Intellery development environment from scratch.

---

## 📋 Prerequisites

Ensure the following tools are installed on your workstation:

- **Node.js**: v20.10.0 or higher (`node -v`)
- **pnpm**: v9.0.0 or higher (`npm install -g pnpm`)
- **Docker & Docker Compose**: For PostgreSQL (with pgvector), MinIO, and Redis (`docker compose version`)
- **Git**: With Git LFS if models are tracked via LFS

---

## 🛠️ Step-by-Step Installation

### 1. Clone the Monorepo

```bash
git clone https://github.com/your-org/intellery.git
cd intellery
```

### 2. Install Dependencies

Install all dependencies across monorepo workspaces using `pnpm`:

```bash
pnpm install
```

---

## 🐳 3. Start Infrastructure Containers

Start the required local backing services using Docker Compose:

```bash
cd infra/docker
docker compose up -d
cd ../..
```

This starts:
1. **PostgreSQL 16 with pgvector:** Listening on port `5432` (Credentials: `intellery` / `intellery`, Database: `intellery`).
2. **MinIO Object Storage:** API on port `9000`, web console on `http://localhost:9001` (Credentials: `intellery` / `intellery123`).
3. **MinIO Bucket Initializer:** Automatically runs `mc mb local/intellery` to ensure the `intellery` bucket exists.
4. **Redis 7:** Task broker for BullMQ on port `6379`.

To verify containers are healthy:

```bash
docker compose -f infra/docker/compose.yaml ps
```

---

## ⚙️ 4. Configure Environment Variables

Create the `.env` file in `apps/api/.env`:

```env
PORT=3000
DATABASE_URL="postgresql://intellery:intellery@localhost:5432/intellery?schema=public"
JWT_SECRET="your-super-secret-jwt-key-at-least-32-chars-long"

MINIO_ENDPOINT="localhost"
MINIO_PORT=9000
MINIO_USE_SSL="false"
MINIO_ACCESS_KEY="intellery"
MINIO_SECRET_KEY="intellery123"
MINIO_BUCKET="intellery"

REDIS_HOST="localhost"
REDIS_PORT=6379
```

---

## 🧠 5. Verify ONNX Model Assets

The API service requires 4 local ONNX model weights and CLIP tokenizer files in `apps/api/models/`:

```
apps/api/models/
├── clip/
│   ├── merges.txt
│   ├── text_model.onnx
│   ├── vision_model.onnx
│   └── vocab.json
└── insightface/
    ├── detection/
    │   └── scrfd_10g_bnkps.onnx
    └── recognition/
        └── w600k_r50.onnx
```

Verify these files are present and non-empty. If downloading manually:
- **SCRFD 10G:** [InsightFace Model Zoo](https://github.com/deepinsight/insightface)
- **ArcFace w600k_r50:** [InsightFace Recognition Models](https://github.com/deepinsight/insightface)
- **CLIP ViT-B/32:** Exported via Hugging Face `transformers` or ONNX model zoo.

---

## 🗄️ 6. Database Migration & Prisma Client

Push the Prisma schema to PostgreSQL and generate the strongly typed Prisma client:

```bash
cd apps/api
pnpm prisma db push
pnpm prisma generate
cd ../..
```

*(Note: Prisma generates its client to `apps/api/generated/prisma`)*.

---

## 🚀 7. Run the API Server

Start the API service in development mode with hot-reloading:

```bash
pnpm --filter @intellery/api dev
```

You should see startup logs confirming:
1. ONNX model sessions loaded (`scrfd_10g_bnkps.onnx`, `w600k_r50.onnx`, `vision_model.onnx`, `text_model.onnx`).
2. CLIP BPE Tokenizer initialized.
3. BullMQ `PhotoWorker` listening for jobs.
4. Server listening on `http://localhost:3000`.

---

## 🩺 8. Smoke Testing the Setup

In a separate terminal, test the `/health` route:

```bash
curl http://localhost:3000/health
```

Expected output:
```json
{"status":"ok","database":"connected"}
```
