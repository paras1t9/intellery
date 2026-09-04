# Error Handling Architecture & Catalog

Intellery implements a strongly typed, hierarchical error handling architecture. Every error produced by the API is converted into a standard JSON envelope with an appropriate HTTP status code, a machine-readable `code` string, and human-readable feedback.

---

## 🏗️ Error Class Hierarchy

```
Error (Node.js built-in)
  │
  ├──► AppError (Base operational error class)
  │      │
  │      ├──► BadRequestError (400)
  │      │      ├──► FaceNotDetectedError ("FACE_NOT_DETECTED")
  │      │      ├──► MultipleFacesError ("MULTIPLE_FACES")
  │      │      └──► ProcessingError ("PROCESSING_ERROR")
  │      │
  │      ├──► UnauthorizedError (401 - "UNAUTHORIZED")
  │      ├──► ForbiddenError (403 - "FORBIDDEN")
  │      ├──► NotFoundError (404 - "NOT_FOUND")
  │      └──► ConflictError (409 - "CONFLICT")
  │
  └──► StorageError (Internal MinIO failure - 500)
```

---

## 📬 Standard Error Response Contract

All errors caught by the global error middleware (`errorMiddleware.ts`) are serialized to this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE_STRING",
    "message": "Human readable explanation of the failure."
  }
}
```

---

## 📖 Complete Error Code Catalog

| HTTP Status | Error Code | Class | Root Cause | Client Action |
| :--- | :--- | :--- | :--- | :--- |
| `400` | `BAD_REQUEST` | `BadRequestError` | Malformed JSON, missing required headers, or invalid arguments. | Verify request syntax and required fields. |
| `400` | `VALIDATION_ERROR` | `ValidationError` | Zod schema validation failure on body, query, or path params. | Inspect `error.details` array for field-level errors. |
| `400` | `FACE_NOT_DETECTED` | `FaceNotDetectedError` | The registration selfie contained no detectable face. | Prompt user to upload a clear, well-lit portrait facing forward. |
| `400` | `MULTIPLE_FACES` | `MultipleFacesError` | The registration selfie contained 2 or more faces. | Prompt user to upload a photo containing only their own face. |
| `400` | `PROCESSING_ERROR` | `ProcessingError` | Image decoding or ONNX model execution failed unrecoverably. | Check image file integrity or retry with another format (JPEG/PNG). |
| `401` | `UNAUTHORIZED` | `UnauthorizedError` | Missing, expired, or malformed JWT in `Authorization` header. | Redirect user to login screen to obtain a fresh token. |
| `403` | `FORBIDDEN` | `ForbiddenError` | User lacks necessary event role (e.g. non-admin attempting delete). | Display permission denied message. |
| `404` | `NOT_FOUND` | `NotFoundError` | Event, photo, member, or identity does not exist. | Verify resource ID. |
| `409` | `CONFLICT` | `ConflictError` | Unique constraint collision (e.g. duplicate email, duplicate eventCode). | Provide a different email or regenerate event code. |
| `500` | `INTERNAL_SERVER_ERROR` | `Error` | Unhandled runtime exception or database connectivity loss. | Retry request; alert engineering if persistent. |

---

## 🛠️ Middleware Implementation Details

The global `errorHandler` middleware distinguishes between operational errors (`AppError`) and programmer/system errors:

1. **Operational Errors (`isOperational: true`):**
   Logs warning and returns the specific status code, error code, and message.
2. **Unhandled Exceptions:**
   Logs the complete stack trace to `stderr` and returns a sanitized generic `500 Internal Server Error` to prevent exposing internal infrastructure details to clients.
3. **Zod Validation Integration:**
   `validationMiddleware.ts` intercepts invalid payloads before route handlers execute, assembling all Zod issues into a standardized `VALIDATION_ERROR` response.
