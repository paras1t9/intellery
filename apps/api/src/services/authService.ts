import prisma from "../infrastructure/prisma.js";
import { RegisterUserInput, LoginUserInput } from "../schemas/authSchema.js";
import { hashPassword, verifyPassword } from "../security/password.js";
import { generateToken } from "../security/jwt.js";
import { User } from "../../generated/prisma/client.js";
import { BadRequestError, ConflictError } from "../errors/index.js";

function toAuthResponse(user: User) {
  const token = generateToken(user.id);
  return {
    user: {
      id:          user.id,
      displayName: user.displayName,
      email:       user.email,
    },
    token,
  };
}

export async function registerUser(input: RegisterUserInput) {
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (existingUser) {
    throw new ConflictError("An account with this email already exists.", "EMAIL_TAKEN");
  }

  const hashedPassword = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      displayName:  input.displayName,
      email:        input.email,
      passwordHash: hashedPassword,
    },
  });

  return toAuthResponse(user);
}

export async function loginUser(input: LoginUserInput) {
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!existingUser) {
    throw new BadRequestError("Invalid email or password.", "INVALID_CREDENTIALS");
  }

  const isVerified = await verifyPassword(input.password, existingUser.passwordHash);

  if (!isVerified) {
    throw new BadRequestError("Invalid email or password.", "INVALID_CREDENTIALS");
  }

  return toAuthResponse(existingUser);
}