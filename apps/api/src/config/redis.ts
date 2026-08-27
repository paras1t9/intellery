import { env } from "./env.js";

export const redisConfig = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
};

