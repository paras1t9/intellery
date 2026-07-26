import prisma from "../lib/prisma.js";
import { RegisterUserInput, LoginUserInput } from "../schemas/auth.schema.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { generateToken } from "../lib/jwt.js";
import { User } from "../../generated/prisma/client.js";
import { AppError } from "../errors/AppError.js";
import { StatusCodes } from "http-status-codes";

function toAuthResponse(user: User){
  const token = generateToken(user.id);
  
  return {
    user: {
        id: user.id,
        displayName: user.displayName,
        email: user.email
    },
    token
  }
}

export async function registerUser(input: RegisterUserInput) {
  const existingUser = await prisma.user.findUnique({
    where: {
      email: input.email
    },
  });

  if (existingUser) {
    throw new AppError(StatusCodes.CONFLICT,"Email already exists");
  }
  const hashedPassword = await hashPassword(input.password);
  const user = await prisma.user.create({
    data:
    {displayName: input.displayName,
    email: input.email,
    passwordHash: hashedPassword}
  })

  return toAuthResponse(user);

}

export async function loginUser(input:LoginUserInput){
  const existingUser = await prisma.user.findUnique({
    where: {
      email: input.email
    },
  });

  if (!existingUser) {
    throw new AppError(StatusCodes.BAD_REQUEST, "Invalid email or password");
  }
  const isVerified = await verifyPassword(input.password, existingUser.passwordHash);

  if(!isVerified){
    throw new AppError(StatusCodes.BAD_REQUEST,"Invalid email or password");
  }
  
  return toAuthResponse(existingUser);

}