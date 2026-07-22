import jwt, { JwtPayload } from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "../errors/AppError.js";
import {StatusCodes} from "http-status-codes";

export function generateToken(userId : string): string{
  
  const secret = env.JWT_SECRET;

  if (!secret) {
    throw new AppError(StatusCodes.INTERNAL_SERVER_ERROR,"JWT_SECRET is not configured");
  }
  const token = jwt.sign(
    {
      sub: userId
    },
    secret,
    {
      expiresIn: "7d"
    }
  );
  return token;
}

export function verifyToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch {
    throw new AppError(
      StatusCodes.UNAUTHORIZED,
      "Invalid or expired token",
    );
  }
}