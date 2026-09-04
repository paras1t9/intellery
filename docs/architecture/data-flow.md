# Data Flow & Transaction Lifecycles

This document outlines the end-to-end data lifecycle across all major workflows in Intellery, showing how data moves across controllers, services, database tables, object storage, and background workers.

---

## 1. User Registration with Selfie

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Router as Auth Router
    participant Multer as Upload Middleware
    participant AuthCtrl as Auth Controller
    participant AuthSvc as Auth Service
    participant Storage as MinIO Storage
    participant SelfieSvc as Selfie Processing Service
    participant Vision as SCRFD + ArcFace
    participant DB as PostgreSQL

    User->>Router: POST /auth/register (multipart: email, password, name, selfie file)
    Router->>Multer: Parse multipart stream
    Multer-->>Router: Form fields + selfie Buffer
    Router->>AuthCtrl: register(req, res)
    AuthCtrl->>AuthSvc: register(email, password, displayName)
    AuthSvc->>DB: Hash password (Argon2) & create User record
    DB-->>AuthSvc: User { id, email, displayName }

    opt Selfie was provided
        AuthCtrl->>Storage: upload(buffer, "selfies/{userId}.jpg")
        Storage-->>AuthCtrl: selfieKey
        AuthCtrl->>DB: Update User set selfieKey
        AuthCtrl->>SelfieSvc: processSelfie(userId, buffer)
        SelfieSvc->>Vision: Detect face (SCRFD 10G)
        Note over Vision: Must detect exactly 1 face
        Vision->>Vision: Landmark align to 112x112
        Vision->>Vision: ArcFace embed -> 512-D vector
        SelfieSvc->>DB: Insert UserFaceVector (userId, vector)
    end

    AuthCtrl-->>User: 201 Created { success: true, data: { user, token } }
```

---

## 2. Event Creation & Member Joining

```mermaid
sequenceDiagram
    autonumber
    actor Attendee
    participant Router as Event Router
    participant EventCtrl as Event Controller
    participant EventSvc as Event Service
    participant Resolver as UserIdentityResolver
    participant DB as PostgreSQL

    Attendee->>Router: POST /events/join { eventCode: "EVT123" }
    Router->>EventCtrl: joinEvent(req, res)
    EventCtrl->>EventSvc: joinEvent(userId, "EVT123")
    EventSvc->>DB: Query Event by eventCode
    DB-->>EventSvc: Event { eventId, name, ... }
    EventSvc->>DB: Insert EventMember (userId, eventId, role: VIEWER)
    
    EventSvc->>Resolver: resolve(userId, eventId)
    Resolver->>DB: Fetch UserFaceVector for userId
    alt User has a registered selfie
        DB-->>Resolver: 512-D face vector
        Resolver->>DB: Query event's DetectedFace & FaceVector using cosine distance (<=>)
        alt Closest face cluster >= 0.55 similarity
            DB-->>Resolver: Matched identityId
            Resolver->>DB: Upsert UserIdentity (userId, eventId, identityId)
        else No match found
            Note over Resolver: Attendee's face not in event photos yet
        end
    end

    EventCtrl-->>Attendee: 200 OK { success: true, data: { eventId, name, role } }
```

---

## 3. Bulk Photo Upload Flow

```mermaid
sequenceDiagram
    autonumber
    actor Photographer
    participant Router as Upload Router
    participant Multer as Multer Memory Storage
    participant UploadCtrl as Upload Controller
    participant UploadSvc as Upload Service
    participant Storage as MinIO Storage
    participant DB as PostgreSQL
    participant Queue as BullMQ (Redis)

    Photographer->>Router: POST /events/:eventId/uploads (multipart: 1 to 1,000 files)
    Router->>Multer: Buffer files in memory
    Router->>UploadCtrl: upload(req, res)
    UploadCtrl->>UploadSvc: createUploadBatch(eventId, userId, files)
    
    UploadSvc->>DB: Create Upload record (status: PENDING, totalFiles: N)
    
    loop For each file in batch
        UploadSvc->>Storage: putObject("photos/{eventId}/{photoId}.jpg", buffer)
        UploadSvc->>DB: Create Photo record (status: PENDING, storageKey)
        UploadSvc->>Queue: photoQueue.add("process-photo", { photoId })
    end

    UploadSvc->>DB: Update Upload status = PROCESSING
    UploadCtrl-->>Photographer: 201 Created { uploadId, totalFiles, status: "PROCESSING" }
```

---

## 4. Asynchronous Photo Processing Pipeline

```mermaid
sequenceDiagram
    autonumber
    participant Queue as BullMQ Redis Queue
    participant Worker as PhotoWorker
    participant Svc as PhotoProcessingService
    participant Storage as MinIO Storage
    participant Vision as Vision Engine (ONNX)
    participant IdentitySvc as IdentityService
    participant DB as PostgreSQL

    Queue->>Worker: Job: "process-photo" { photoId }
    Worker->>Svc: process(photoId)
    Svc->>DB: Update Photo status = PROCESSING, startedAt = now()
    Svc->>Storage: getObject(storageKey)
    Storage-->>Svc: rawImageBuffer

    par Concurrently Run Face Detection & Scene Embedding
        Svc->>Vision: SCRFD 10G Detect (ImageProcessor -> Tensor -> Detect)
        Vision-->>Svc: Array of detections [bbox, landmarks, confidence]
    and
        Svc->>Vision: SceneEmbedder.embed (CLIP ViT-B/32)
        Vision-->>Svc: 512-D scene vector
    end

    loop For each detected face
        Svc->>Vision: FaceAligner.align(rawImageBuffer, detection)
        Vision-->>Svc: 112x112 aligned face buffer
        Svc->>Vision: FaceRecognizer.recognize(alignedFace)
        Vision-->>Svc: 512-D face embedding vector
        Svc->>DB: Insert DetectedFace (boundingBox, landmarks, confidence)
        Svc->>DB: Insert FaceVector (detectedFaceId, vector(512))
        Svc->>IdentitySvc: assignIdentity(detectedFaceId, eventId, vector)
        IdentitySvc->>DB: Search existing face vectors in event (pgvector cosine <= 0.45)
        alt Match found
            IdentitySvc->>DB: Link detectedFace to existing Identity
        else No match found
            IdentitySvc->>DB: Create new Identity & link detectedFace
        end
    end

    Svc->>DB: Insert PhotoAnnotation (photoId, caption: "", sceneVector: vector(512))
    Svc->>DB: Update Photo status = COMPLETED, completedAt = now()
    Worker-->>Queue: Job completed successfully
```

---

## 5. Multimodal Natural Language Search Flow

```mermaid
sequenceDiagram
    autonumber
    actor Attendee
    participant SearchCtrl as Search Controller
    participant SearchSvc as Search Service
    participant Tokenizer as ClipTokenizer (BPE)
    participant TextModel as CLIP Text Model (ONNX)
    participant DB as PostgreSQL (pgvector)
    participant Storage as MinIO Storage

    Attendee->>SearchCtrl: POST /events/:eventId/search { query: "me and mom at dinner", limit: 30 }
    SearchCtrl->>SearchSvc: search(userId, eventId, query, limit)
    
    SearchSvc->>Tokenizer: Tokenize "me and mom at dinner"
    Tokenizer-->>SearchSvc: 77 int64 token IDs
    SearchSvc->>TextModel: Run inference
    TextModel-->>SearchSvc: 512-D normalized query vector
    
    SearchSvc->>SearchSvc: Parse query for "me" and named identities
    opt "me" is in query
        SearchSvc->>DB: Find UserIdentity (userId, eventId)
        DB-->>SearchSvc: identityId for "me"
    end
    opt Named entities match confirmed identities
        SearchSvc->>DB: Find Identity WHERE displayName ILIKE "mom"
        DB-->>SearchSvc: identityId for "mom"
    end

    SearchSvc->>DB: Run pgvector cosine query (with face identity filter if resolved)
    DB-->>SearchSvc: Rows [{ photoId, storageKey, similarity }]

    SearchSvc->>SearchSvc: Filter rows where similarity >= 0.15
    
    par Concurrently generate presigned URLs
        loop For each matching photo
            SearchSvc->>Storage: getSignedUrl(storageKey, expiresIn: 3600)
            Storage-->>SearchSvc: presignedDownloadUrl
        end
    end

    SearchSvc-->>SearchCtrl: { results: [{ photoId, url, similarity }], meResolved: true }
    SearchCtrl-->>Attendee: 200 OK
```
