# ADR-0003: Asynchronous Photo Ingestion Pipeline

- **Status:** Accepted
- **Date:** 2026-08-18
- **Authors:** Ayush Mehta

---

## Context

In event photography, photographers routinely dump hundreds of high-resolution RAW or JPEG images in a single batch (frequently 500 to 1,000 images per shoot).

Executing computer vision inference (face detection, facial alignment, ArcFace feature extraction, clustering, and CLIP scene embedding) synchronously inside the HTTP upload request is impossible:
1. HTTP gateways and reverse proxies (NGINX, Cloudflare, ALB) enforce client timeouts (typically 30 to 120 seconds).
2. Deep learning inference requires CPU/GPU computation time of 100ms to 500ms per image. Processing 1,000 images would take over 3 to 8 minutes.
3. Server memory spikes and crash risks increase if hundreds of megabytes of image buffers remain in flight across long-lived HTTP connections.

---

## Decision

We designed an **asynchronous, two-phase decoupled ingestion pipeline**:

```
[Client] ──(POST /uploads: 1000 files)──► [Express API + Multer]
                                                │
                                    ┌───────────┴───────────┐
                                    ▼                       ▼
                              [MinIO / S3]         [PostgreSQL DB]
                            Stream raw images      Create Upload &
                                                   Photo rows (PENDING)
                                                            │
                                                            ▼
                                                   [BullMQ PhotoQueue]
                                                    (Redis 7 Task Queue)
                                                            │
[Client] ◄──(201 Created: uploadId, count)──────────────────┘
                                                            │
                                                   (Async Execution)
                                                            ▼
                                                   [PhotoWorker Consumer]
                                                   - Pulls job
                                                   - Marks PROCESSING
                                                   - Runs Vision Pipeline
                                                   - Persists Embeddings
                                                   - Marks COMPLETED
```

### Key Architectural Choices

1. **Storage Tier Separation:**
   Raw images are stored directly in **MinIO** (S3-compatible object store) under structured keys:
   `photos/{eventId}/{photoId}.jpg`. The database only stores metadata and storage keys.
2. **Session Batch Tracking:**
   An `Upload` record tracks batch metadata:
   - `totalFiles`: Number of files received in the request.
   - `uploadedFiles`: Count of files successfully persisted to object storage.
   - `failedFiles`: Count of invalid or failed files.
   - `status`: `PENDING` $\rightarrow$ `PROCESSING` $\rightarrow$ `COMPLETED` / `FAILED`.
3. **Queueing Subsystem:**
   We adopted **BullMQ** backed by **Redis 7**:
   - For every uploaded image, a discrete job `{ photoId }` is enqueued into `PhotoQueue`.
   - Each job represents an isolated unit of work that can be processed, retried, or audited independently.
4. **Worker Execution:**
   `PhotoWorker` processes jobs with configurable concurrency:
   - Downloads the image buffer from MinIO (single source of truth).
   - Executes SCRFD detection and CLIP embedding concurrently.
   - Embeds each detected face with ArcFace and assigns it to an event identity cluster.
   - Transitions `photo.processingStatus` from `PROCESSING` to `COMPLETED`.

---

## Consequences

### Positive
- **Immediate Response:** Clients receive a `201 Created` confirmation in seconds, regardless of whether 10 or 1,000 photos were uploaded.
- **Fault Tolerance & Resilience:** If a worker crashes or an image is corrupted, the failure is isolated to that specific `photoId` without failing the entire batch.
- **Horizontal Scalability:** Additional worker processes or containers can be scaled independently of the API gateway to drain the Redis queue faster.

### Negative / Trade-offs
- The client must poll or query photo status (`photo.processingStatus`) to know when AI processing is complete.
- Additional infrastructure dependency on Redis.
