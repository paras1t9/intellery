import { Request, Response, NextFunction } from "express";
import { z } from "zod";

export function validate(
  schema: z.ZodSchema,
  source: "body" | "params" | "query" = "body"
) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req[source] = schema.parse(req[source]);
      next();
    } catch (error) {
      next(error);
    }
  };
}