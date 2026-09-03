import { createEvent, deleteEvent, getEventDetails, getEventMembers, getUserEvents, joinEvent, updateEvent, updateMemberRole } from "../controllers/event.controller.js";
import { search } from "../controllers/search.controller.js";
import { createEventSchema, joinEventSchema, deleteEventParamsSchema, eventDetailsParamsSchema, updateEventDetailsSchema, eventIdSchema, UpdateMemberRoleSchema } from "../schemas/event.schema.js";
import { searchParamsSchema, searchBodySchema } from "../schemas/search.schema.js";
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
  getUserEvents
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
  validate(eventIdSchema, "params"),
  validate(updateEventDetailsSchema),
  updateEvent
)

router.get(
  "/:eventId/members",
  authMiddleware,
  validate(eventIdSchema, "params"),
  getEventMembers
)

router.patch(
  "/:eventId/members/:userId",
  authMiddleware,
  validate(UpdateMemberRoleSchema),
  updateMemberRole 
)
router.post(
  "/:eventId/search",
  authMiddleware,
  validate(searchParamsSchema, "params"),
  validate(searchBodySchema),
  search
);

export default router;