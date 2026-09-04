# Intellery REST API Documentation

This directory documents the REST API surface for Intellery.

---

## 🌐 Base URL & Protocol

- **Local Development:** `http://localhost:3000`
- **Protocol:** HTTP/1.1 (JSON & Multipart/form-data)
- **CORS:** Enabled for cross-origin client integration.

---

## 🔒 Authentication & Authorization

All authenticated endpoints require an `Authorization` HTTP header with a valid JSON Web Token (JWT):

```http
Authorization: Bearer <jwt_token>
```

Tokens are obtained via:
- `POST /auth/register` (returns token upon successful registration)
- `POST /auth/login` (returns token upon successful credential validation)

### Role-Based Access Control (RBAC)

Intellery enforces event-scoped roles stored in the `EventMember` relation:

| Role | Permissions |
| :--- | :--- |
| `ADMIN` | Full control over the event: update event metadata, delete event, manage member roles, trigger uploads, view all galleries, search photos. |
| `CONTRIBUTOR` | Can upload photos to the event, view galleries, and search photos. Cannot change event metadata or manage members. |
| `VIEWER` | Default role when joining via event code. Can view galleries, access personalized photos (`/photos/me`), and search photos. Cannot upload. |

---

## 📦 Standard Response Envelope

All API responses follow a uniform JSON envelope:

### Success Response (`2xx`)

```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response (`4xx` / `5xx`)

```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "Human-readable error description"
  }
}
```

For validation errors (`400 Bad Request`), detailed field errors are included:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
}
```

---

## 📄 Pagination Conventions

List endpoints (such as `/events/:eventId/photos`) support query parameters for pagination:

| Parameter | Type | Default | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- |
| `page` | Integer | `1` | $\ge 1$ | 1-based page number. |
| `limit` | Integer | `20` | $1 \dots 100$ | Number of records per page. |

### Paginated Response Structure

```json
{
  "success": true,
  "data": {
    "photos": [ ... ],
    "total": 142,
    "page": 1,
    "limit": 20,
    "hasMore": true
  }
}
```

---

## 📑 Detailed Guides in This Section

- 📘 **[API Endpoint Reference](file:///home/ayush/Projects/intellery/docs/api/api-reference.md):** Complete specifications for every route with request parameters, schemas, and cURL snippets.
- 📕 **[Error Handling Catalog](file:///home/ayush/Projects/intellery/docs/api/error-handling.md):** Exhaustive catalog of client and domain error codes.
