# Intellery API Reference Specification

> **Base URL:** `http://localhost:3000`  
> **Standard Header:** `Authorization: Bearer <jwt_token>` (for all authenticated endpoints)

---

## Table of Contents

- [Health](#1-health)
- [Authentication](#2-authentication)
  - [Register User](#post-authregister)
  - [Login User](#post-authlogin)
- [Events](#3-events)
  - [Create Event](#post-eventscreate)
  - [Join Event](#post-eventsjoin)
  - [List User Events](#get-events)
  - [Get Event Details](#get-eventseventid)
  - [Update Event](#patch-eventseventid)
  - [Delete Event](#delete-eventseventid)
- [Members](#4-members)
  - [List Event Members](#get-eventseventidmembers)
  - [Update Member Role](#patch-eventseventidmembersuserid)
- [Uploads](#5-uploads)
  - [Batch Upload Photos](#post-eventseventiduploads)
- [Photos](#6-photos)
  - [Get Event Photo Gallery](#get-eventseventidphotos)
  - [Get Personalized Photos (Me)](#get-eventseventidphotosme)
- [Identities](#7-identities)
  - [List Event Identities](#get-eventseventididentities)
  - [Name / Rename Identity](#patch-eventseventididentitiesidentityid)
- [Search](#8-multimodal-search)
  - [Natural Language Search](#post-eventseventidsearch)

---

## 1. Health

### `GET /health`
Checks API service health and database connectivity.

- **Auth:** Public
- **Response (200 OK):**
```json
{
  "status": "ok",
  "database": "connected"
}
```

---

## 2. Authentication

### `POST /auth/register`
Registers a new user account. Optionally accepts a portrait selfie to extract biometric facial features for automatic photo matching in events.

- **Auth:** Public
- **Content-Type:** `multipart/form-data`
- **Form Fields:**

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `email` | String | Yes | Valid email address |
| `password` | String | Yes | Minimum 8 characters |
| `displayName` | String | Yes | Minimum 1 character |
| `selfie` | File (image) | No | JPEG/PNG portrait photo containing exactly one face |

- **Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "c3d4e5f6-...",
      "email": "ayush@example.com",
      "displayName": "Ayush Mehta",
      "profilePicture": null,
      "selfieKey": "selfies/c3d4e5f6-...jpg",
      "hasSelfie": true,
      "createdAt": "2026-09-04T12:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

- **Error Codes:**
  - `400 BAD_REQUEST` / `CONFLICT`: Email already registered.
  - `400 FACE_NOT_DETECTED`: Provided selfie contained no detectable face.
  - `400 MULTIPLE_FACES`: Provided selfie contained more than one face.

---

### `POST /auth/login`
Authenticates existing credentials and issues a JWT Bearer token.

- **Auth:** Public
- **Content-Type:** `application/json`
- **Request Body:**
```json
{
  "email": "ayush@example.com",
  "password": "securepassword123"
}
```

- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "c3d4e5f6-...",
      "email": "ayush@example.com",
      "displayName": "Ayush Mehta",
      "profilePicture": null,
      "hasSelfie": true
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

- **Error Codes:**
  - `401 UNAUTHORIZED`: Invalid email or password.

---

## 3. Events

### `POST /events/create`
Creates a new event. The creating user automatically becomes the `ADMIN`.

- **Auth:** Bearer Token
- **Content-Type:** `application/json`
- **Request Body:**

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `name` | String | Yes | Event title (1 to 100 characters) |
| `eventCode` | String | Yes | Unique 6-character alphanumeric code |
| `iconURL` | String | No | Optional icon URL |

- **Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "eventId": "evt-789...",
    "name": "Annual Gala 2026",
    "eventCode": "GALA26",
    "iconURL": null,
    "createdAt": "2026-09-04T12:00:00.000Z",
    "updatedAt": "2026-09-04T12:00:00.000Z"
  }
}
```

---

### `POST /events/join`
Joins an existing event by its 6-character code. Triggers immediate selfie auto-matching.

- **Auth:** Bearer Token
- **Content-Type:** `application/json`
- **Request Body:**
```json
{
  "eventCode": "GALA26"
}
```

- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "eventId": "evt-789...",
    "name": "Annual Gala 2026",
    "iconURL": null,
    "role": "VIEWER"
  }
}
```

---

### `GET /events`
Lists all events the authenticated user is a member of.

- **Auth:** Bearer Token
- **Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "eventId": "evt-789...",
      "name": "Annual Gala 2026",
      "iconURL": null,
      "eventCode": "GALA26",
      "role": "ADMIN",
      "joinedAt": "2026-09-04T12:00:00.000Z"
    }
  ]
}
```

---

### `GET /events/:eventId`
Retrieves event details including member and photo counts.

- **Auth:** Bearer Token
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "eventId": "evt-789...",
    "name": "Annual Gala 2026",
    "iconURL": null,
    "eventCode": "GALA26",
    "createdAt": "2026-09-04T12:00:00.000Z",
    "updatedAt": "2026-09-04T12:00:00.000Z",
    "memberCount": 42,
    "photoCount": 350,
    "role": "ADMIN"
  }
}
```

---

### `PATCH /events/:eventId`
Updates event name or icon URL (Requires `ADMIN` role).

- **Auth:** Bearer Token
- **Request Body:**
```json
{
  "name": "Annual Gala 2026 (Updated)",
  "iconURL": "https://example.com/icon.png"
}
```
- **Response (200 OK):** Updated event entity.

---

### `DELETE /events/:eventId`
Deletes an event and all associated photos, faces, and vectors (Requires `ADMIN` role).

- **Auth:** Bearer Token
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "message": "Event deleted successfully."
  }
}
```

---

## 4. Members

### `GET /events/:eventId/members`
Lists all members in the event.

- **Auth:** Bearer Token
- **Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "userId": "usr-123...",
      "role": "ADMIN",
      "joinedAt": "2026-09-04T12:00:00.000Z",
      "user": {
        "displayName": "Ayush Mehta",
        "email": "ayush@example.com",
        "profilePicture": null
      }
    }
  ]
}
```

---

### `PATCH /events/:eventId/members/:userId`
Promotes or demotes an event member (`ADMIN` only).

- **Auth:** Bearer Token
- **Request Body:**
```json
{
  "role": "CONTRIBUTOR"
}
```
- **Response (200 OK):** Updated membership record.

---

## 5. Uploads

### `POST /events/:eventId/uploads`
Bulk uploads photos to the event (1 to 1,000 files). Uploaded images are stored in MinIO and enqueued into BullMQ for asynchronous AI processing. Requires `ADMIN` or `CONTRIBUTOR` role.

- **Auth:** Bearer Token
- **Content-Type:** `multipart/form-data`
- **Field Name:** `photos` (multiple files)
- **Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "uploadId": "upl-456...",
    "totalFiles": 25,
    "status": "PROCESSING",
    "message": "25 photos accepted for processing."
  }
}
```

---

## 6. Photos

### `GET /events/:eventId/photos`
Fetches the full event gallery with presigned image download URLs.

- **Auth:** Bearer Token
- **Query Parameters:**
  - `page`: Page number (default: `1`)
  - `limit`: Items per page (default: `20`, max: `100`)
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "photos": [
      {
        "id": "pht-101...",
        "url": "http://localhost:9000/intellery/photos/...?X-Amz-Signature=...",
        "createdAt": "2026-09-04T12:30:00.000Z",
        "processingStatus": "COMPLETED"
      }
    ],
    "total": 350,
    "page": 1,
    "limit": 20,
    "hasMore": true
  }
}
```

---

### `GET /events/:eventId/photos/me`
Personalized gallery returning only photos that contain the authenticated user's face.

- **Auth:** Bearer Token
- **Query Parameters:** `page`, `limit`
- **Response (200 OK):** Same structure as gallery, filtered to user's face cluster.

---

## 7. Identities

### `GET /events/:eventId/identities`
Lists face clusters discovered in photos containing the user. Returns face crop coordinates for thumbnail rendering.

- **Auth:** Bearer Token
- **Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "ident-001...",
      "displayName": "Mom",
      "isConfirmed": true,
      "sampleFace": {
        "photoUrl": "http://localhost:9000/intellery/photos/...?...",
        "box": {
          "x": 120.5,
          "y": 85.0,
          "width": 64.0,
          "height": 80.0
        }
      }
    }
  ]
}
```

---

### `PATCH /events/:eventId/identities/:identityId`
Names or renames a face cluster. Once confirmed, this name can be queried via natural language search.

- **Auth:** Bearer Token
- **Request Body:**
```json
{
  "name": "Sarah"
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "ident-001...",
    "displayName": "Sarah",
    "isConfirmed": true,
    "updatedAt": "2026-09-04T13:00:00.000Z"
  }
}
```

---

## 8. Multimodal Search

### `POST /events/:eventId/search`
Searches event photos using natural language descriptions combined with face identity resolution.

- **Auth:** Bearer Token
- **Request Body:**
```json
{
  "query": "me laughing with Sarah on the dance floor",
  "limit": 30
}
```

- **Query Resolution Rules:**
  - If `"me"` is present: Resolves to the authenticated user's identity.
  - If any word matches a named identity (e.g. `"Sarah"`): Filters for photos containing Sarah.
  - Visual description (e.g. `"laughing on the dance floor"`): Embeds text via CLIP ViT-B/32 and performs cosine ANN search in pgvector.

- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "photoId": "pht-101...",
        "url": "http://localhost:9000/intellery/photos/...?...",
        "similarity": 0.284
      }
    ],
    "meResolved": true
  }
}
```
