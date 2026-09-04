# Database Entity-Relationship Diagram (ERD)

This document provides a detailed visual diagram of the PostgreSQL relational schema and vector storage structure managed by Prisma and `pgvector`.

---

```mermaid
erDiagram
    User ||--o{ EventMember : "membership"
    User ||--o{ Upload : "creates"
    User ||--o{ Photo : "uploads"
    User ||--o| UserFaceVector : "has selfie embedding"
    User ||--o{ UserIdentity : "identified as"

    Event ||--o{ EventMember : "has members"
    Event ||--o{ Upload : "contains batches"
    Event ||--o{ Photo : "contains photos"
    Event ||--o{ Identity : "groups faces into"
    Event ||--o{ UserIdentity : "links attendee to"

    EventMember }|--|| User : "references"
    EventMember }|--|| Event : "references"

    Upload ||--o{ Photo : "contains"
    Photo ||--o{ DetectedFace : "has detected faces"
    Photo ||--o| PhotoAnnotation : "has scene embedding"

    DetectedFace ||--o| FaceVector : "has 512-D vector"
    DetectedFace }o--o| Identity : "assigned to cluster"

    Identity ||--o{ DetectedFace : "groups"
    Identity ||--o{ UserIdentity : "linked to user"

    UserIdentity }|--|| User : "belongs to"
    UserIdentity }|--|| Event : "within event"
    UserIdentity }|--|| Identity : "points to"

    User {
        string id PK
        string displayName
        string email UK
        string passwordHash
        string profilePicture
        string selfieKey
        datetime createdAt
        datetime updatedAt
    }

    Event {
        string eventId PK
        string name
        string iconURL
        string eventCode UK
        datetime createdAt
        datetime updatedAt
    }

    EventMember {
        string userId PK,FK
        string eventId PK,FK
        EventRole role "ADMIN | CONTRIBUTOR | VIEWER"
        datetime joinedAt
    }

    Upload {
        string id PK
        string eventId FK
        string uploaderId FK
        UploadStatus status "PENDING | UPLOADING | PROCESSING | COMPLETED | FAILED"
        int totalFiles
        int uploadedFiles
        int failedFiles
        datetime createdAt
        datetime updatedAt
    }

    Photo {
        string id PK
        string eventId FK
        string uploaderId FK
        string uploadId FK
        string originalName
        string storageKey
        string mimeType
        int size
        StorageProvider storageProvider "MINIO | S3"
        PhotoProcessingStatus processingStatus "PENDING | PROCESSING | COMPLETED | FAILED"
        datetime processingStartedAt
        datetime processingCompletedAt
        string processingError
        datetime createdAt
        datetime updatedAt
    }

    DetectedFace {
        string id PK
        string photoId FK
        float boundingBoxX
        float boundingBoxY
        float boundingBoxW
        float boundingBoxH
        float confidence
        float leftEyeX
        float leftEyeY
        float rightEyeX
        float rightEyeY
        float noseX
        float noseY
        float leftMouthX
        float leftMouthY
        float rightMouthX
        float rightMouthY
        string identityId FK
        datetime createdAt
        datetime updatedAt
    }

    FaceVector {
        string id PK
        string detectedFaceId FK,UK
        vector_512 vector "PostgreSQL vector(512)"
        EmbeddingModel model "W600K_R50"
        int embeddingVersion
        datetime createdAt
        datetime updatedAt
    }

    PhotoAnnotation {
        string id PK
        string photoId FK,UK
        string caption
        vector_512 vector "PostgreSQL vector(512) CLIP"
        SceneEmbeddingModel sceneModel "CLIP_VIT_B32"
        datetime createdAt
        datetime updatedAt
    }

    Identity {
        string id PK
        string eventId FK
        string displayName "Nullable (e.g. Mom, Sarah)"
        boolean isConfirmed
        datetime createdAt
        datetime updatedAt
    }

    UserFaceVector {
        string id PK
        string userId FK,UK
        vector_512 vector "PostgreSQL vector(512)"
        EmbeddingModel model "W600K_R50"
        datetime createdAt
        datetime updatedAt
    }

    UserIdentity {
        string userId PK,FK
        string eventId PK,FK
        string identityId FK
    }
```
