import { Queue } from "bullmq";
import { redisConfig } from "../../config/redis.js";

export interface PhotoJobData {
  photoId: string;
}

export const photoQueue = new Queue<PhotoJobData>("photo-processing", {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  },
});
