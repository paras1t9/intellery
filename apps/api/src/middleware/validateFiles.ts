import { NextFunction, Request, Response } from "express";
import { BadRequestError } from "../errors/index.js";

interface FileValidationOptions {
  minFiles?: number;
  maxFiles?: number;
}

export function validateFiles({
  minFiles = 1,
  maxFiles = Infinity,
}: FileValidationOptions) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const files = req.files as Express.Multer.File[] | undefined;

    if (!files || files.length < minFiles) {
      return next(
        new BadRequestError(
          `At least ${minFiles} file(s) must be uploaded.`,
          "MISSING_FILES",
        ),
      );
    }

    if (files.length > maxFiles) {
      return next(
        new BadRequestError(
          `A maximum of ${maxFiles} file(s) can be uploaded at once.`,
          "TOO_MANY_FILES",
        ),
      );
    }

    next();
  };
}