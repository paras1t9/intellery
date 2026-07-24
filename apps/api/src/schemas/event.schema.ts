import {z} from "zod";

const eventNameSchema = z
.string()
.trim()
.min(3)
.max(100);

const iconUrlSchema = z
.string()
.url();

export const createEventSchema = z.object({
  name: eventNameSchema,
  iconUrl: iconUrlSchema.optional(),
});

export const updateEventSchema = createEventSchema
.partial()
.refine(
  (data) => Object.keys(data).length > 0,
  {
  message: "At least one field must be provided.",
  }
);

export type CreateEventDto = z.infer<typeof createEventSchema>;
export type UpdateEventDto = z.infer<typeof updateEventSchema>;