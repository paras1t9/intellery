import { z } from "zod";

export const uploadSchema = z.object({
  eventId: z.uuid(),
});

export type UploadInput = z.infer<typeof uploadSchema>;