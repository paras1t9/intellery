// Base
export { AppError } from "./AppError.js";

// HTTP client errors
export {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from "./client/HttpErrors.js";

// Domain errors
export {
  FaceNotDetectedError,
  MultipleFacesError,
  ProcessingError,
  StorageError,
} from "./domain/DomainErrors.js";
