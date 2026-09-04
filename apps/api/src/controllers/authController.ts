import { Request, Response } from "express";
import { LoginUserInput, RegisterUserInput } from "../schemas/authSchema.js";
import { loginUser, registerUser } from "../services/authService.js";
import { selfieProcessingService } from "../composition/index.js";
import { StatusCodes } from "http-status-codes";
import { BadRequestError } from "../errors/index.js";
import prisma from "../infrastructure/prisma.js";

export async function register(req: Request, res: Response) {
  const selfieFile = req.file;

  if (!selfieFile) {
    throw new BadRequestError(
      "A selfie photo is required to register.",
      "SELFIE_REQUIRED",
    );
  }

  const userInfo = req.body as RegisterUserInput;
  const result = await registerUser(userInfo);

  /*
   * Selfie processing is mandatory.
   * If it fails, delete the created user to keep the DB clean
   * and surface the error to the client.
   */
  try {
    await selfieProcessingService.process(result.user.id, selfieFile.path);
  } catch (selfieError) {
    await prisma.user.delete({ where: { id: result.user.id } }).catch(() => {});
    throw selfieError;
  }

  res.status(StatusCodes.CREATED).json({
    success: true,
    data: result,
  });
}

export async function login(req: Request, res: Response) {
  const userInfo = req.body as LoginUserInput;
  const user = await loginUser(userInfo);
  res.status(StatusCodes.OK).json({
    success: true,
    data: user,
  });
}