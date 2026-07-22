import { NextFunction, Request, Response } from "express";
import { verifyToken } from "../lib/jwt.js";
import prisma from "../lib/prisma.js";
import { AppError } from "../errors/AppError.js";
import { StatusCodes } from "http-status-codes";

export async function authMiddleware(req: Request, res: Response, next: NextFunction){
  const header = req.header("Authorization") as string;
  if(!header || !header.startsWith("Bearer ")){
    throw new AppError(
    StatusCodes.UNAUTHORIZED,
    "Unauthorized"
);
  }
  const token = header.slice(7);
  const tokenVerified = verifyToken(token)
  const userId = tokenVerified.sub;
  const user = await prisma.user.findUnique({
    where:{
      id: userId
    }
  })
  if(!user){
    throw new AppError(
    StatusCodes.UNAUTHORIZED,
    "Unauthorized"
);
  }
  req.user = user;
}