/**
 * Base class for all application errors.
 *
 * `statusCode` maps to the HTTP response status.
 * `expose`     controls whether the message is sent to the client (false → "Internal Server Error").
 * `code`       is a machine-readable string the frontend can switch on (e.g. "FACE_NOT_DETECTED").
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly expose:     boolean;
  readonly code:       string;

  constructor(
    statusCode: number,
    message:    string,
    expose:     boolean = true,
    code:       string  = "APP_ERROR",
  ) {
    super(message);
    this.name       = "AppError";
    this.statusCode = statusCode;
    this.expose     = expose;
    this.code       = code;
  }
}