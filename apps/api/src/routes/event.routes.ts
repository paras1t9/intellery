import { createEvent, joinEvent } from "../controllers/event.controller.js";
import { createEventSchema, joinEventSchema } from "../schemas/event.schema.js";
import { validate } from "../middleware/validation.middleware.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { Router } from "express";

const router = Router();
router.post(
  "/create",
  authMiddleware,
  validate(createEventSchema),
  createEvent
);

router.post(
  "/join",
  authMiddleware,
  validate(joinEventSchema),
  joinEvent
);

export default router;