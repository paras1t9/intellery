import {z} from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url({
    message: "Please provide a valid URL"
  }),
  JWT_SECRET: z.string().min(32),
  PORT: z.coerce.number()
});

export const env = envSchema.parse(process.env);