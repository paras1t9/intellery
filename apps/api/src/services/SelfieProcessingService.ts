import fs from "node:fs";
import { Readable } from "node:stream";

import { PrismaClient } from "../../generated/prisma/client.js";
import { StatusCodes } from "http-status-codes";

import { StorageService } from "../storage/StorageService.js";
import { FaceNotDetectedError, MultipleFacesError } from "../errors/index.js";

import { ImageProcessor } from "../vision/common/ImageProcessor.js";
import { SCRFD_CONFIG } from "../vision/common/configs.js";
import { InsightFaceDetector } from "../vision/detection/InsightFaceDetector.js";
import { FaceAligner } from "../vision/recognition/FaceAligner.js";
import { FaceRecognizer } from "../vision/recognition/FaceRecognizer.js";
import { UserFaceVectorRepository } from "../vision/recognition/UserFaceVectorRepository.js";

export class SelfieProcessingService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: StorageService,
    private readonly imageProcessor: ImageProcessor,
    private readonly detector: InsightFaceDetector,
    private readonly aligner: FaceAligner,
    private readonly recognizer: FaceRecognizer,
    private readonly userFaceVectorRepository: UserFaceVectorRepository,
  ) {}

  async process(userId: string, filePath: string): Promise<void> {
    try {
      /*
       * 1. Read the selfie from disk into memory.
       *    Disk is the transit zone — MinIO is the source of truth.
       */
      const selfieBuffer = await fs.promises.readFile(filePath);

      /*
       * 2. Detect faces. Exactly one face must be present.
       */
      const processed = await this.imageProcessor.toTensor(
        selfieBuffer,
        SCRFD_CONFIG,
      );

      const detections = await this.detector.detect(
        processed.tensor,
        processed.scale,
      );

      if (detections.length === 0) {
        throw new FaceNotDetectedError();
      }

      if (detections.length > 1) {
        throw new MultipleFacesError();
      }

      /*
       * 3. Align and embed the single detected face.
       */
      const alignedFace = await this.aligner.align(selfieBuffer, detections[0]);
      const embedding = await this.recognizer.recognize(alignedFace);

      /*
       * 4. Upload selfie to MinIO — permanent storage.
       */
      const selfieKey = `users/${userId}/selfie.jpg`;

      await this.storage.upload({
        key: selfieKey,
        stream: Readable.from(selfieBuffer),
        size: selfieBuffer.length,
        contentType: "image/jpeg",
      });

      /*
       * 5. Persist selfie key and face embedding concurrently.
       */
      await Promise.all([
        this.prisma.user.update({
          where: { id: userId },
          data: { selfieKey },
        }),
        this.userFaceVectorRepository.save(userId, Array.from(embedding)),
      ]);

    } finally {
      /*
       * Always delete the local temp file — success or failure.
       * Same pattern as UploadService.processPhoto().
       */
      await fs.promises.unlink(filePath).catch(() => {});
    }
  }
}
