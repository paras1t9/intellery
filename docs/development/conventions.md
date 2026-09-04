# Project Conventions, Standards & Style Guide

This document defines the engineering standards, naming conventions, and architectural rules governing the Intellery codebase.

---

## 🏷️ File & Symbol Naming Conventions

To maintain strict consistency across all source code:

| Artifact Type | Convention | Example |
| :--- | :--- | :--- |
| **Controllers** | `camelCase` ending in `Controller.ts` | `authController.ts`, `eventController.ts`, `photoController.ts` |
| **Services** | `PascalCase` or `camelCase` ending in `Service.ts` | `PhotoService.ts`, `SearchService.ts`, `authService.ts` |
| **Routes** | `camelCase` ending in `Routes.ts` | `authRoutes.ts`, `eventRoutes.ts`, `uploadRoutes.ts` |
| **Schemas** | `camelCase` ending in `Schema.ts` | `authSchema.ts`, `eventSchema.ts`, `photoSchema.ts` |
| **DTOs** | `camelCase` ending in `Dto.ts` | `eventDto.ts` |
| **Middleware** | `camelCase` ending in `Middleware.ts` | `authMiddleware.ts`, `errorMiddleware.ts`, `validationMiddleware.ts` |
| **Vision Classes** | `PascalCase` matching domain responsibility | `FaceDetector.ts`, `FaceAligner.ts`, `SceneEmbedder.ts` |
| **Database Models** | `PascalCase` singular (Prisma) | `User`, `Event`, `Photo`, `DetectedFace`, `FaceVector` |

> ⚠️ **Prohibited:** Do **not** use dot-separated naming conventions (e.g. `auth.controller.ts`, `event.routes.ts`). All files must follow `camelCase` or `PascalCase`.

---

## 📦 TypeScript & ESM Import Rules

The backend operates in pure ECMAScript Modules (`"type": "module"`).

1. **Explicit `.js` Extensions:** All relative imports must include the `.js` extension even when importing `.ts` source files:
   ```typescript
   // Correct
   import { authMiddleware } from "../middleware/authMiddleware.js";
   import { searchService } from "../composition/index.js";

   // Incorrect (will fail at runtime)
   import { authMiddleware } from "../middleware/authMiddleware";
   ```
2. **Path Aliases:** Avoid non-standard path aliases unless configured in both `tsconfig.json` and Node loader. Relative imports with `.js` are preferred.

---

## 🏛️ Architectural Layering Rules

```
[ Routes ] ──► [ Middleware ] ──► [ Controllers ] ──► [ Services ] ──► [ Repositories / Prisma ]
```

1. **Routes:** Only declare path, HTTP method, middleware chain (auth, validation, file upload), and controller handler binding. No business logic.
2. **Middleware:** Intercept requests for authentication, validation, or file parsing. Must call `next()` or throw typed errors.
3. **Controllers:** Extract parameters from `req`, invoke services, and format the response envelope `{ success: true, data }`.
4. **Services:** Contain domain logic, transaction coordination, and queue dispatching. Never interact directly with `req` or `res` objects.
5. **Repositories & Infrastructure:** Encapsulate raw database queries, pgvector math, and MinIO storage operations.

---

## 🚨 Error Throwing Guidelines

Never throw generic `Error` instances or return raw HTTP status codes from services:

```typescript
// ❌ Incorrect
throw new Error("User not found");
res.status(404).send("Not found");

// ✅ Correct
import { NotFoundError } from "../errors/client/HttpErrors.js";
throw new NotFoundError("Event not found with code: " + code);
```

### Domain Error Guidelines
- When processing selfies, if no face is detected, throw `FaceNotDetectedError`.
- If more than 1 face is detected in a registration selfie, throw `MultipleFacesError`.
- For authorization failures, throw `ForbiddenError`.
- For duplicate unique keys, throw `ConflictError`.

---

## 🔍 Vector Math & Database Queries

1. **Relational Operations:** Use standard Prisma client query methods (`findUnique`, `findMany`, `create`, `update`, `delete`).
2. **Vector Similarity Queries:** Use Prisma's `$queryRaw` tagged template with explicit casting to `::vector`:
   ```typescript
   const rows = await this.prisma.$queryRaw<Array<{ photoId: string; similarity: number }>>`
     SELECT
       pa."photoId",
       1 - (pa."vector" <=> ${vector}::vector) AS "similarity"
     FROM "PhotoAnnotation" pa
     WHERE pa."vector" IS NOT NULL
     ORDER BY pa."vector" <=> ${vector}::vector
     LIMIT ${limit}
   `;
   ```
   Always type the return shape with an explicit interface or generic parameter.
