# System Overview

## Purpose

Intellery is an AI-powered desktop application that enables photographers and event organizers to upload event photographs and allows attendees to retrieve all photographs containing their face.

The application is designed as a distributed system consisting of three primary applications:

- Desktop Application
- API Service
- AI Service

The system is built with scalability, maintainability, and cloud portability as core design principles.

---

# High-Level Architecture

```
                  +------------------+
                  | Desktop App      |
                  | Electron + React |
                  +--------+---------+
                           |
                    HTTPS / REST
                           |
                  +--------v---------+
                  | API Service      |
                  | Express + Prisma |
                  +----+--------+----+
                       |        |
                       |        |
             PostgreSQL|        |Object Storage
                       |        |
              +--------v--+  +--v---------+
              | PostgreSQL|  | MinIO / S3 |
              +-----------+  +------------+
                       |
                       |
                 Message Queue
                       |
              +--------v--------+
              | AI Service      |
              | Python Workers  |
              +--------+--------+
                       |
             Face Detection
             Embedding Generation
             Similarity Search
```

---

# Responsibilities

## Desktop

- User authentication
- Event management
- Upload photographs
- Search photographs
- View results

---

## API

- Authentication
- Authorization
- Business logic
- Metadata management
- Upload orchestration
- Storage interaction
- Worker coordination

---

## AI Service

- Face detection
- Face alignment
- Embedding generation
- Similarity search
- Background processing

---

# Data Storage

The project uses two storage systems.

## PostgreSQL

Stores structured application data.

Examples:

- Users
- Events
- Uploads
- Photos
- Detected Faces
- Face Embeddings

---

## Object Storage

Stores image files.

Development:

- MinIO

Production:

- AWS S3 (or compatible storage)

Only storage metadata is stored inside PostgreSQL.

---

# Future Components

The following components are planned but not yet implemented.

- Message Queue
- Background Workers
- WebSocket Progress Updates
- CDN
- Horizontal Scaling