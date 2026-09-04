import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../errors/AppError.js";

/*
 * Maps Prisma error codes to HTTP semantics.
 * Reference: https://www.prisma.io/docs/reference/api-reference/error-reference
 */
const PRISMA_ERROR_MAP: Record<string, { status: number; message: string; code: string }> = {
  P2002: { status: 409, message: "A record with that value already exists.", code: "CONFLICT" },
  P2025: { status: 404, message: "Record not found.",                        code: "NOT_FOUND" },
  P2003: { status: 409, message: "A related record does not exist.",          code: "FOREIGN_KEY_VIOLATION" },
  P2014: { status: 409, message: "The change violates a required relation.",  code: "RELATION_VIOLATION" },
};

export function errorHandler(
  err:  Error,
  req:  Request,
  res:  Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction,
): void {

  /*
   * 1. Zod validation errors → 400 with per-field detail.
   *    These are thrown by the validate() middleware.
   */
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      code:    "VALIDATION_ERROR",
      message: "Validation failed.",
      errors:  err.issues.map((issue) => ({
        field:   issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }


  /*
   * 2. Prisma known request errors → map to appropriate HTTP codes.
   */
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = PRISMA_ERROR_MAP[err.code];
    if (mapped) {
      res.status(mapped.status).json({
        success: false,
        code:    mapped.code,
        message: mapped.message,
      });
      return;
    }
  }

  /*
   * 3. Prisma validation errors (bad schema usage on our side) → 400.
   */
  if (err instanceof Prisma.PrismaClientValidationError) {
    console.error("[Prisma] Validation error:", err.message);
    res.status(400).json({
      success: false,
      code:    "DB_VALIDATION_ERROR",
      message: "A database validation error occurred.",
    });
    return;
  }

  /*
   * 4. Multer errors (file upload failures) → 400.
   */
  if (isMulterError(err)) {
    const messages: Record<string, string> = {
      LIMIT_FILE_SIZE:  "The uploaded file exceeds the size limit.",
      LIMIT_FILE_COUNT: "Too many files uploaded.",
      LIMIT_UNEXPECTED_FILE: "Unexpected file field.",
    };
    res.status(400).json({
      success: false,
      code:    `UPLOAD_${err.code}`,
      message: messages[err.code] ?? "File upload error.",
    });
    return;
  }

  /*
   * 5. JWT errors → 401.
   */
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError" || err.name === "NotBeforeError") {
    res.status(401).json({
      success: false,
      code:    "INVALID_TOKEN",
      message: err.name === "TokenExpiredError" ? "Your session has expired. Please log in again." : "Invalid token.",
    });
    return;
  }

  /*
   * 6. Our own AppError hierarchy → use the attached statusCode + code.
   */
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      code:    err.code,
      message: err.expose ? err.message : "An internal error occurred.",
    });
    return;
  }

  /*
   * 7. Fallback — unknown errors.
   *    Log the full error server-side; send a generic message to the client.
   */
  console.error("[Unhandled Error]", {
    name:    err.name,
    message: err.message,
    stack:   err.stack,
    path:    req.path,
    method:  req.method,
  });

  res.status(500).json({
    success: false,
    code:    "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred. Please try again later.",
  });
}

/*
 * Type guard for Multer errors.
 * Multer doesn't export its error class as an ES module in all environments,
 * so we check the shape instead of using instanceof.
 */
function isMulterError(err: Error): err is Error & { code: string } {
  return err.name === "MulterError" && "code" in err;
}