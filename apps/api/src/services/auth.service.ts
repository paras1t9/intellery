import prisma from "../lib/prisma.js";
import { RegisterUserInput } from "../schemas/auth.schema.js";

export async function registerUser(email: string) {
  const existingUser = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (existingUser) {
    throw new Error("Email already exists");
  }
}