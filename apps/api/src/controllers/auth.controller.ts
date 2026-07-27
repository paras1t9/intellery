import { Request, Response } from "express";
import { LoginUserInput, RegisterUserInput } from "../schemas/auth.schema.js";
import { loginUser, registerUser } from "../services/auth.service.js";
import { StatusCodes } from "http-status-codes";

export async function register(req: Request, res: Response){
  const userInfo = req.body as RegisterUserInput;
  const user = await registerUser(userInfo);
  res.status(StatusCodes.CREATED).json({
    success: true,
    data: user
  })
}
export async function login(req: Request, res: Response){
  const userInfo = req.body as LoginUserInput;
  const user = await loginUser(userInfo);
  res.status(StatusCodes.OK).json({
    success: true,
    data: user
  })
}