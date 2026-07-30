import path from "path";
import { randomUUID } from "crypto";

export function generateObjectKey(
  eventId: string,
  filename: string
  ): string {
  const extension = path.extname(filename);

  return `events/${eventId}/originals/${randomUUID()}${extension}`;
}