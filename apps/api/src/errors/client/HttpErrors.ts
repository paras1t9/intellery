import { StatusCodes } from "http-status-codes";
import { AppError } from "../AppError.js";

export class BadRequestError extends AppError {
  constructor(message: string, code = "BAD_REQUEST") {
    super(StatusCodes.BAD_REQUEST, message, true, code);
    this.name = "BadRequestError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized", code = "UNAUTHORIZED") {
    super(StatusCodes.UNAUTHORIZED, message, true, code);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action.", code = "FORBIDDEN") {
    super(StatusCodes.FORBIDDEN, message, true, code);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found.", code = "NOT_FOUND") {
    super(StatusCodes.NOT_FOUND, message, true, code);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code = "CONFLICT") {
    super(StatusCodes.CONFLICT, message, true, code);
    this.name = "ConflictError";
  }
}
