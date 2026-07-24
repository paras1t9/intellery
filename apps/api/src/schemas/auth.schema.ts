import {z} from "zod";

const authFields = {
  email: z.email(),
  password: z.string().min(8),
};

export const registerSchema = z.object({
  displayName: z.string().min(3),
  ...authFields,
});

export const loginSchema = z.object(authFields);

export type RegisterUserInput = z.infer<typeof registerSchema>;
export type LoginUserInput = z.infer<typeof loginSchema>;
