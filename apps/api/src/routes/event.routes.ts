import { createEvent, deleteEvent, getEventDetails, getEvents, joinEvent, updateEvent } from "../controllers/event.controller.js";
import { createEventSchema, joinEventSchema, deleteEventParamsSchema, eventDetailsParamsSchema, updateEventDetailsSchema, eventIdSchema } from "../schemas/event.schema.js";
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

router.get(
  "/",
  authMiddleware,
  getEvents
)

router.delete(
  "/:eventId",
  authMiddleware,
  validate(deleteEventParamsSchema, "params"),
  deleteEvent
);

router.get(
  "/:eventId",
  authMiddleware,
  validate(eventDetailsParamsSchema, "params"),
  getEventDetails
)

router.patch(
  "/:eventId",
  authMiddleware,
  validate(eventIdSchema),
  validate(updateEventDetailsSchema),
  updateEvent
)
export default router;