import { Worker } from "bullmq";
import { redisConfig } from "../../config/redis.js";
import { PhotoJobData } from "./PhotoQueue.js";
import { PhotoProcessingService } from "../../vision/PhotoProcessingService.js";

export class PhotoWorker {
  constructor(
    private readonly photoProcessing: PhotoProcessingService
  ) {}

  start(): void {
    const worker = new Worker<PhotoJobData>(
      "photo-processing",
      async (job) => {
        await this.photoProcessing.process(job.data.photoId);
      },
      {
        connection: redisConfig,
        concurrency: 1,
      }
    );

    worker.on("completed", (job) => {
      console.log(`[PhotoWorker] Job ${job.id} completed — photoId: ${job.data.photoId}`);
    });

    worker.on("failed", (job, err) => {
      if (!job) return;

      const attemptsExhausted =
        job.attemptsMade >= (job.opts.attempts ?? 1);

      if (attemptsExhausted) {
        console.error(
          `[PhotoWorker] Job ${job.id} permanently failed after ${job.attemptsMade} attempt(s) — photoId: ${job.data.photoId}`,
          err.message,
        );
      } else {
        console.warn(
          `[PhotoWorker] Job ${job.id} failed (attempt ${job.attemptsMade}) — will retry — photoId: ${job.data.photoId}`,
          err.message,
        );
      }
    });

    /*
     * Unhandled "error" events crash the Node process.
     * This listener catches worker-level errors (e.g. Redis
     * connection lost) so they are logged rather than fatal.
     */
    worker.on("error", (err) => {
      console.error("[PhotoWorker] Worker error:", err.message);
    });
  }
}
