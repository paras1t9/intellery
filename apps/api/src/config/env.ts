import { z } from "zod";

const envSchema = z.object({
  // Server
  DATABASE_URL: z.url({ message: "Please provide a valid DATABASE_URL" }),
  JWT_SECRET: z.string().min(32),
  PORT: z.coerce.number(),

  // MinIO
  MINIO_ENDPOINT: z.string().min(1).default("localhost"),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_USE_SSL: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  MINIO_ACCESS_KEY: z.string().min(1),
  MINIO_SECRET_KEY: z.string().min(1),
  MINIO_BUCKET: z.string().min(1),

  // Redis
  REDIS_HOST: z.string().min(1).default("localhost"),
  REDIS_PORT: z.coerce.number().default(6379),
});

export const env = envSchema.parse(process.env);