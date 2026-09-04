import { z } from "zod";

export const identityParamsSchema = z.object({
  eventId:    z.uuid(),
  identityId: z.uuid(),
});

export const nameIdentitySchema = z.object({
  displayName: z.string().trim().min(1).max(100),
});

export type IdentityParams  = z.infer<typeof identityParamsSchema>;
export type NameIdentityDto = z.infer<typeof nameIdentitySchema>;
