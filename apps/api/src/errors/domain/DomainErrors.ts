import { BadRequestError } from "../client/HttpErrors.js";

/**
 * Thrown when no face is detected in a selfie or photo.
 */
export class FaceNotDetectedError extends BadRequestError {
  constructor(message = "No face detected. Please take a clearer photo facing the camera.") {
    super(message, "FACE_NOT_DETECTED");
    this.name = "FaceNotDetectedError";
  }
}

/**
 * Thrown when multiple faces are detected in a selfie (which must have exactly one).
 */
export class MultipleFacesError extends BadRequestError {
  constructor(message = "Multiple faces detected. Your selfie must contain only your face.") {
    super(message, "MULTIPLE_FACES");
    this.name = "MultipleFacesError";
  }
}

/**
 * Thrown when AI model processing fails unrecoverably.
 */
export class ProcessingError extends BadRequestError {
  constructor(message = "Photo processing failed. Please try again.") {
    super(message, "PROCESSING_ERROR");
    this.name = "ProcessingError";
  }
}

/**
 * Thrown for storage (MinIO) operation failures.
 * Not exposed to the client — surfaces as 500.
 */
export class StorageError extends Error {
  readonly code = "STORAGE_ERROR";
  constructor(message: string) {
    super(message);
    this.name = "StorageError";
  }
}
