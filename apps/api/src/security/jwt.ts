import jwt, { JwtPayload } from "jsonwebtoken";
import { env } from "../config/env.js";

export function generateToken(userId : string): string{
  
  const secret = env.JWT_SECRET;

  if (!secret) {
    /*
     * This is a server misconfiguration, not a client error.
     * Throw a plain Error — it will surface as 500.
     */
    throw new Error("JWT_SECRET is not configured.");
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
  /*
   * Let the original JsonWebTokenError / TokenExpiredError propagate.
   * The error middleware maps these to 401 by checking err.name.
   */
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}