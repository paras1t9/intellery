import { Router } from "express";

import { uploadController } from "../composition/index.js";
import { uploadMiddleware } from "../middleware/upload.js";
import { validate } from "../middleware/validation.middleware.js";
import { validateFiles } from "../middleware/validateFiles.js";
import { eventIdSchema } from "../schemas/event.schema.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = Router();

router.post(
  "/events/:eventId/uploads",
  authMiddleware,
  uploadMiddleware.array("photos", 1000),
  validateFiles({ minFiles: 1, maxFiles: 1000 }),
  validate(eventIdSchema, "params"),
  uploadController.upload
);

export default router;