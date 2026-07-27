import { Request, Response, NextFunction } from "express";
import { z } from "zod";

export function validate(
  schema: z.ZodSchema,
  source: "body" | "params" | "query" = "body"
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsedData = schema.parse(req[source]);

    req[source] = parsedData;

    next();
  };
}