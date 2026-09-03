import { z } from "zod";

export const searchParamsSchema = z.object({
  eventId: z.uuid(),
});

export const searchBodySchema = z.object({
  query: z.string().trim().min(1, "Search query cannot be empty.").max(500),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type SearchParams = z.infer<typeof searchParamsSchema>;
export type SearchBody  = z.infer<typeof searchBodySchema>;
