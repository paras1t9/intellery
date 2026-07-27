import {z} from "zod";

const eventNameSchema = z
.string()
.trim()
.min(3)
.max(100);

const iconURLSchema = z
.string()
.url();

export const eventIdSchema = z.object({
  eventId: z.string().uuid(),
});

export const createEventSchema = z.object({
  name: eventNameSchema,
  iconURL: iconURLSchema.optional(),
});

export const updateEventSchema = createEventSchema
.partial()
.refine(
  (data) => Object.keys(data).length > 0,
  {
  message: "At least one field must be provided.",
  }
);

export const joinEventSchema = z.object({
  eventCode: z.string().trim().toUpperCase().length(6).regex(/^[A-Z0-9]+$/, "Invalid Event Code")
})

export const deleteEventParamsSchema = z.object({
  eventId: z.uuid(),
});
export const eventDetailsParamsSchema = deleteEventParamsSchema;

export const updateEventDetailsSchema = z.object({
  name: eventNameSchema.optional(),
  iconUrl :iconURLSchema.optional()
}).refine(
  (data) => data.name !== undefined || data.iconUrl !== undefined,
  {
  message: "At least one field must be provided.",
  }
)

export type CreateEventDto = z.infer<typeof createEventSchema>;
export type UpdateEventDto = z.infer<typeof updateEventSchema>;
export type JoinEventDto = z.infer<typeof joinEventSchema>;
export type DeleteEventDto = z.infer<typeof deleteEventParamsSchema>;
export type EventDetailsDto = z.infer<typeof eventDetailsParamsSchema>;
export type UpdateEventDetailsDto = z.infer<typeof updateEventDetailsSchema>