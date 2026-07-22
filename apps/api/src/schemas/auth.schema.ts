import {z} from "zod";

export const registerSchema = z.object({
    displayName: z.string().min(3),
    email: z.email(),
    password: z.string().min(8),
});

export const loginSchema = z.object({
    email: z.email(),
    password: z.string().min(8),
});

export type RegisterUserInput = z.infer<typeof registerSchema>;
export type LoginUserInput = z.infer<typeof loginSchema>;
