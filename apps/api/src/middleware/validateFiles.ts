import { NextFunction, Request, Response } from "express";

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
      return next(new Error(`At least ${minFiles} file(s) must be uploaded.`));
    }

    if (files.length > maxFiles) {
      return next(new Error(`A maximum of ${maxFiles} files can be uploaded.`));
    }

    next();
  };
}