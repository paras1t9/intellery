# Computer Vision & AI Pipeline Deep Dive

## Overview

Intellery embeds a full computer vision and deep learning inference engine directly inside its Node.js backend. By leveraging `onnxruntime-node` with native C++ acceleration, the platform eliminates external microservice latency, network serialization overhead, and GPU-to-CPU transfer bottlenecks.

The AI pipeline consists of two complementary systems:
1. **Biometric Face Intelligence Pipeline:** Detects faces, aligns facial geometry, extracts identity embeddings, clusters unknown faces, and matches registered users.
2. **Multimodal Visual Semantics Pipeline:** Encodes photographic scenes using OpenAI CLIP and evaluates natural language text queries using in-process tokenization and vector similarity.

---

## 1. Biometric Face Pipeline

```
Raw Image Buffer
       │
       ▼
1. Image Preprocessing (Sharp) ──► Resize preserving aspect ratio (max 640x640), RGB normalize
       │
       ▼
2. SCRFD 10G Detection ──────────► Multi-scale anchor evaluation (strides 8, 16, 32)
       │                           Scores, Bounding Boxes, 5-point facial landmarks
       ▼
3. Non-Maximum Suppression ──────► IoU threshold 0.4, Score threshold 0.5
       │
       ▼
4. Facial Landmark Alignment ────► Umeyama 5-point affine transformation to 112x112 RGB
       │
       ▼
5. ArcFace ResNet-50 ────────────► 512-dimensional L2-normalized feature vector
       │
       ▼
6. Vector Persistence ───────────► Saved to PostgreSQL via pgvector (vector(512))
       │
       ▼
7. Incremental Face Clustering ──► Cosine similarity match (threshold >= 0.55) -> Event Identity
```

---

### Step 1: Face Detection (SCRFD 10G)

- **Model:** `scrfd_10g_bnkps.onnx` (Sample and Computation Redistribution for Face Detection).
- **Inputs:** Dynamic tensor `[1, 3, H, W]` in RGB order normalized by mean `[127.5, 127.5, 127.5]` and std `[128.0, 128.0, 128.0]`.
- **Feature Pyramids & Strides:**
  SCRFD operates over 3 stride scales to detect faces across all sizes:
  - **Stride 8:** Detects small faces ($16 \times 16$ to $64 \times 64$ px). Output nodes: Score `448`, Box `451`, Landmarks `454`.
  - **Stride 16:** Detects medium faces ($64 \times 64$ to $256 \times 256$ px). Output nodes: Score `471`, Box `474`, Landmarks `477`.
  - **Stride 32:** Detects large close-up faces ($256 \times 256$+ px). Output nodes: Score `494`, Box `497`, Landmarks `500`.

- **Prediction Decoding:**
  For each anchor $(x, y)$ at stride $s$:
  $$\text{center}_x = x \cdot s, \quad \text{center}_y = y \cdot s$$
  Bounding boxes are predicted as distance offsets $(dx_1, dy_1, dx_2, dy_2)$ from the anchor center:
  $$x_1 = (\text{center}_x - dx_1 \cdot s) / \text{scale}$$
  $$y_1 = (\text{center}_y - dy_1 \cdot s) / \text{scale}$$
  $$x_2 = (\text{center}_x + dx_2 \cdot s) / \text{scale}$$
  $$y_2 = (\text{center}_y + dy_2 \cdot s) / \text{scale}$$

- **Landmark Extraction:**
  SCRFD predicts 5 facial landmark keypoints:
  1. Left eye $(x, y)$
  2. Right eye $(x, y)$
  3. Nose tip $(x, y)$
  4. Left mouth corner $(x, y)$
  5. Right mouth corner $(x, y)$

- **Post-Processing:**
  Detections with confidence score $< 0.50$ are discarded. The remaining candidates are filtered using Non-Maximum Suppression (NMS) with an Intersection-over-Union (IoU) threshold of $0.40$.

---

### Step 2: Facial Landmark Alignment (`FaceAligner.ts`)

Facial recognition models require normalized, frontalized face crops. Feeding an unaligned, tilted bounding box significantly degrades embedding accuracy.

Intellery implements the **Umeyama Algorithm** (least-squares estimation of similarity transformation) to compute an optimal 2D affine matrix $M$:

$$\begin{bmatrix} x' \\ y' \\ 1 \end{bmatrix} = \begin{bmatrix} a & b & t_x \\ c & d & t_y \\ 0 & 0 & 1 \end{bmatrix} \begin{bmatrix} x \\ y \\ 1 \end{bmatrix}$$

- **Reference Canonical Coordinates (Standard ArcFace 112x112):**
  - Left Eye: `(38.2946, 51.6963)`
  - Right Eye: `(73.5318, 51.5014)`
  - Nose Tip: `(56.0252, 71.7366)`
  - Left Mouth Corner: `(41.5493, 92.3655)`
  - Right Mouth Corner: `(70.7299, 92.2041)`

The calculated affine transformation corrects roll, pitch, translation, and scale, warping the face into a standardized $112 \times 112$ RGB buffer.

---

### Step 3: Biometric Feature Extraction (ArcFace ResNet-50)

- **Model:** `w600k_r50.onnx` (Additive Angular Margin Loss, ResNet-50 backbone trained on Glint360k / MS1MV3).
- **Input:** `[1, 3, 112, 112]` RGB tensor normalized by mean `127.5` and std `128.0`.
- **Output:** 512-dimensional vector $\mathbf{v} \in \mathbb{R}^{512}$.
- **L2 Normalization:**
  $$\hat{\mathbf{v}} = \frac{\mathbf{v}}{\|\mathbf{v}\|_2}$$
  Because all vectors lie on the unit hypersphere, the cosine similarity between two face embeddings $\mathbf{a}$ and $\mathbf{b}$ simplifies to their dot product:
  $$\text{sim}(\mathbf{a}, \mathbf{b}) = \mathbf{a} \cdot \mathbf{b} = 1 - \frac{1}{2}\|\mathbf{a} - \mathbf{b}\|_2^2$$

---

### Step 4: Incremental Face Clustering (`IdentityService.ts`)

Rather than recomputing expensive offline DBSCAN or hierarchical clustering over the entire database, Intellery performs **online incremental clustering**:

1. When a new face vector $\hat{\mathbf{v}}$ is extracted from a photo in Event $E$:
2. A pgvector ANN query searches for existing face vectors in Event $E$:
   ```sql
   SELECT "detectedFaceId", 1 - ("vector" <=> $vector::vector) AS similarity
   FROM "FaceVector" fv
   JOIN "DetectedFace" df ON df."id" = fv."detectedFaceId"
   JOIN "Photo" p ON p."id" = df."photoId"
   WHERE p."eventId" = $eventId AND df."id" != $currentFaceId
   ORDER BY "vector" <=> $vector::vector
   LIMIT 20;
   ```
3. **Cluster Assignment Logic:**
   - **Threshold:** $\text{sim} \ge 0.55$ (cosine distance $\le 0.45$).
   - If no match exceeds $0.55$: Create a new `Identity` entity in Event $E$ with `displayName = null` and attach the face.
   - If a match exceeds $0.55$:
     - If the matched face already belongs to an `Identity`, assign the new face to that same `Identity`.
     - If the matched face does not have an `Identity`, create a new `Identity` and attach both faces.

---

### Step 5: User Selfie Enrollment & Auto-Resolution (`UserIdentityResolver.ts`)

1. **Registration:**
   - When a user registers with a selfie (`POST /auth/register`), the image is processed through SCRFD.
   - **Validation:** Exactly one face must be detected (`FaceNotDetectedError` if 0, `MultipleFacesError` if > 1).
   - The aligned face is embedded via ArcFace and stored in `UserFaceVector`.
2. **Event Join Auto-Match:**
   - When the user joins an event (`POST /events/join`), `UserIdentityResolver.resolve(userId, eventId)` queries the event's detected faces.
   - It computes the cosine similarity between the user's selfie embedding and all face clusters in the event.
   - If the best similarity is $\ge 0.55$, it inserts/upserts a `UserIdentity` record:
     ```
     (userId, eventId, identityId)
     ```
   - From this moment on, all photos in that identity cluster are instantly returned when the user views their personal gallery (`/photos/me`) or searches using the word *"me"*.

---

## 2. Multimodal Scene & Natural Language Search

Intellery integrates OpenAI's **Contrastive Language-Image Pre-training (CLIP)** model architecture using the ViT-B/32 vision transformer and text encoder.

```
       [Raw Photo Buffer]                           [User Text Query]
               │                                            │
               ▼                                            ▼
      Sharp Image Pipeline                        ClipTokenizer (BPE)
(Resize 224x224, Center Crop, RGB)           (Regex split, BPE merge, Vocab)
               │                                            │
               ▼                                            ▼
    CLIP Visual Model (ONNX)                     CLIP Text Model (ONNX)
               │                                            │
               ▼                                            ▼
      512-D Scene Vector                           512-D Query Vector
               │                                            │
               ▼                                            │
     Stored in PostgreSQL                                   │
      (PhotoAnnotation)                                     │
               │                                            │
               └───────────────────┬────────────────────────┘
                                   ▼
                   PostgreSQL pgvector Cosine ANN Search
                   1 - (pa.vector <=> query_vector::vector)
```

---

### Step 1: Scene Embedding (`SceneEmbedder.ts`)

- **Model:** `vision_model.onnx` (OpenAI CLIP ViT-B/32).
- **Preprocessing:**
  - Resize and crop to $224 \times 224$ px using `sharp`.
  - Normalize pixel values using ImageNet mean `[0.48145466, 0.4578275, 0.40821073]` and std `[0.26862954, 0.26130258, 0.27577711]`.
  - Format as NCHW tensor `[1, 3, 224, 224]`.
- **Inference:** Produces a 512-D visual feature vector.
- **Normalization:** L2-normalized so dot products represent cosine similarity.
- **Persistence:** Stored in the `PhotoAnnotation` table with a `vector(512)` column.

---

### Step 2: In-Process CLIP Tokenizer (`ClipTokenizer.ts`)

To avoid external Python dependencies for text tokenization, Intellery includes a native TypeScript implementation of the Byte-Pair Encoding (BPE) tokenizer:

1. **Byte-to-Unicode Mapping:** Maps every possible byte ($0 \dots 255$) to a unique Unicode character to handle arbitrary UTF-8 characters without out-of-vocabulary crashes.
2. **Regex Splitting:** Splits incoming text into word fragments preserving punctuation and contractions:
   ```regex
   /'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+/gu
   ```
3. **BPE Merges:** Applies 48,894 vocabulary merge rules loaded from `merges.txt`.
4. **Vocabulary Lookup:** Maps tokens to token IDs from `vocab.json` (vocabulary size 49,408).
5. **Context Framing:** Adds `<|startoftext|>` (`49406`) and `<|endoftext|>` (`49407`), padding to a fixed context length of 77 tokens with zeroes.

---

### Step 3: Text Embedding (`TextEmbedder.ts`)

- **Model:** `text_model.onnx` (CLIP Transformer text encoder).
- **Input:** `[1, 77]` tensor of int64 token IDs.
- **Output:** 512-dimensional normalized text embedding representing the semantic concept.

---

### Step 4: Hybrid Search Resolution (`SearchService.ts`)

When a user submits a natural language search (e.g. *"me and mom smiling at the dinner table"*):

1. **Text Embedding:** The entire query string is vectorized into a 512-D CLIP text embedding $\mathbf{q}$.
2. **Keyword & Identity Resolution:**
   - **"me" Detection:** If the word `"me"` is present (`/\bme\b/i`), the service looks up the user's mapped `identityId` in `UserIdentity` for this event.
   - **Named Identity Detection:** All other words in the query are cross-referenced against confirmed `Identity.displayName` values in this event (e.g., `"mom"` $\rightarrow$ Identity ID `id-123`).
3. **Unified Query Execution:**
   - **Case A (Identities resolved):** Finds photos whose scene vectors have high cosine similarity to the text query **AND** contain at least one detected face belonging to the resolved identities:
     ```sql
     SELECT pa."photoId", p."storageKey",
            1 - (pa."vector" <=> ${vector}::vector) AS similarity
     FROM "PhotoAnnotation" pa
     JOIN "Photo" p ON p."id" = pa."photoId"
     WHERE p."eventId" = ${eventId}
       AND pa."vector" IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM "DetectedFace" df
         WHERE df."photoId" = p."id"
           AND df."identityId" = ANY(ARRAY['identity-me', 'identity-mom']::text[])
       )
     ORDER BY pa."vector" <=> ${vector}::vector
     LIMIT ${limit};
     ```
   - **Case B (No identities resolved):** Performs pure semantic scene search across all photos in the event ordered by cosine similarity:
     ```sql
     SELECT pa."photoId", p."storageKey",
            1 - (pa."vector" <=> ${vector}::vector) AS similarity
     FROM "PhotoAnnotation" pa
     JOIN "Photo" p ON p."id" = pa."photoId"
     WHERE p."eventId" = ${eventId}
       AND pa."vector" IS NOT NULL
     ORDER BY pa."vector" <=> ${vector}::vector
     LIMIT ${limit};
     ```
4. **Threshold Filtering & URL Signing:**
   - Filters out results below the similarity cutoff ($\text{similarity} < 0.15$).
   - Generates presigned MinIO download URLs concurrently for all matched images.
   - Returns the ranked photos alongside a `meResolved: boolean` flag.
