import { Request, Response, NextFunction } from "express";
import { z } from "zod";

export function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsedData = schema.parse(req.body);
    req.body = parsedData;
    next();
  };
}