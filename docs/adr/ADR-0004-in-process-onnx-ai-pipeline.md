# ADR-0004: In-Process ONNX Runtime AI Pipeline

- **Status:** Accepted
- **Date:** 2026-08-25
- **Authors:** Ayush Mehta

---

## Context

AI-driven web platforms commonly segregate architecture into two tiers:
1. A **Backend API** (Node.js, Go, or Ruby) managing authentication, database relations, and user requests.
2. An **External AI Microservice** (Python FastAPI/Flask or TorchServe) running PyTorch/TensorFlow models, communicating with the API via REST or gRPC.

When evaluating this design for Intellery, significant drawbacks emerged:
1. **Network & IPC Overhead:** Transferring 5MB to 20MB raw photo buffers over HTTP or gRPC between Node.js and Python for hundreds of images introduces severe latency and doubles memory utilization.
2. **Operational Complexity:** Managing two distinct runtime environments (Node.js ecosystem + Python virtualenv / Conda with complex C-extension dependencies) complicates local developer setup, CI/CD pipelines, and cloud container orchestration.
3. **Serialization Costs:** Marshaling image arrays, landmark keypoints, and 512-dimensional floating-point vectors back and forth between JSON/Protobuf and Python/Node runtimes wastes CPU cycles.

---

## Decision

We decided to run all deep learning models **in-process within the Node.js backend** using **`onnxruntime-node`** (official Microsoft ONNX Runtime C++ native bindings for Node.js) paired with **`sharp`** (libvips) for high-speed image preprocessing.

### Models Deployed In-Process

| Pipeline Stage | Model File | Architecture | Primary Task |
| :--- | :--- | :--- | :--- |
| **Face Detection** | `scrfd_10g_bnkps.onnx` | SCRFD 10G | Multi-scale face bounding boxes + 5-point facial landmarks |
| **Face Alignment** | In-process TypeScript | Umeyama Affine Matrix | Warp face to canonical 112x112 RGB reference coordinates |
| **Face Recognition** | `w600k_r50.onnx` | ArcFace ResNet-50 | 512-D L2-normalized biometric identity embedding |
| **Scene Vision** | `vision_model.onnx` | OpenAI CLIP ViT-B/32 | 512-D holistic scene semantics embedding |
| **Scene Text** | `text_model.onnx` | OpenAI CLIP Transformer | 512-D natural language query embedding |
| **Tokenizer** | In-process TypeScript | Byte-Pair Encoding (BPE) | In-process regex BPE tokenizer with 49,408 vocabulary |

---

## Rationale & Benefits

1. **Zero-Copy & Zero-IPC Overhead:**
   Image buffers decoded by `sharp` are converted directly into typed arrays (`Float32Array`) and passed into ONNX Runtime tensors within the same virtual memory space. There is zero network latency or inter-process communication serialization.
2. **C++ Native Performance:**
   ONNX Runtime utilizes optimized C++ kernels with automatic hardware acceleration (AVX2, AVX-512, NEON, or CUDA/TensorRT execution providers). In-process Node.js execution achieves identical or superior inference throughput compared to standard Python PyTorch inference.
3. **Single Monolithic Service Deployment:**
   Developers need only run `pnpm install` and start one Node.js process. No Python virtual environments, package version conflicts, or external microservice healthcheck coordination are required.
4. **Custom BPE Tokenizer:**
   By implementing the OpenAI CLIP BPE tokenizer natively in TypeScript (`ClipTokenizer.ts`), the search service vectorizes text queries in microseconds without shelling out to external processes or Python scripts.

---

## Consequences

### Positive
- Drastic reduction in latency per photo processed.
- Drastic reduction in deployment footprint and developer onboarding friction.
- Seamless horizontal scaling: scale the Node.js worker container and both API and AI inference scale together.

### Negative / Trade-offs
- Node.js process memory footprint is higher (~1.2GB RAM baseline at boot due to resident ONNX model weights).
- Heavy CPU inference on the main process must be coordinated carefully with worker queues (`BullMQ`) to prevent blocking the Express event loop.
