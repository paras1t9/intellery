import { NextFunction, Request, Response } from "express";
import { verifyToken } from "../security/jwt.js";
import prisma from "../infrastructure/prisma.js";
import { UnauthorizedError } from "../errors/index.js";

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.header("Authorization");

    if (!header || !header.startsWith("Bearer ")) {
      return next(new UnauthorizedError("No token provided."));
    }

    const token    = header.slice(7);
    const verified = verifyToken(token);
    const userId   = verified.sub;

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return next(new UnauthorizedError("User no longer exists."));
    }

    req.user = {
      id:             user.id,
      displayName:    user.displayName,
      email:          user.email,
      profilePicture: user.profilePicture,
    };

    next();
  } catch (err) {
    /*
     * verifyToken throws JsonWebTokenError / TokenExpiredError on invalid tokens.
     * Passing them to next() lets the error middleware map them to 401.
     */
    next(err);
  }
}