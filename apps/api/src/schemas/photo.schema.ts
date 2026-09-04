import { z } from "zod";

export const photoGalleryParamsSchema = z.object({
  eventId: z.uuid(),
});

export const photoGalleryQuerySchema = z.object({
  /*
   * Cursor is the ISO timestamp of the last item seen.
   * Omit on the first page.
   */
  cursor: z.string().datetime().optional(),
  limit:  z.coerce.number().int().min(1).max(100).default(30),
});

export type PhotoGalleryParams = z.infer<typeof photoGalleryParamsSchema>;
export type PhotoGalleryQuery  = z.infer<typeof photoGalleryQuerySchema>;
