import { PrismaClient, PhotoProcessingStatus } from "../../generated/prisma/client.js";

import { StorageService } from "../storage/StorageService.js";

import { ImageProcessor } from "./common/ImageProcessor.js";
import { SCRFD_CONFIG } from "./common/configs.js";

import { InsightFaceDetector } from "./detection/InsightFaceDetector.js";

import { FaceAligner } from "./recognition/FaceAligner.js";
import { FaceRecognizer } from "./recognition/FaceRecognizer.js";
import { FaceVectorRepository } from "./recognition/FaceVectorRepository.js";

import { IdentityService } from "./identity/IdentityService.js";


export class FaceProcessingService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: StorageService,
    private readonly imageProcessor: ImageProcessor,
    private readonly detector: InsightFaceDetector,
    private readonly aligner: FaceAligner,
    private readonly recognizer: FaceRecognizer,
    private readonly vectorRepository: FaceVectorRepository,
    private readonly identityService: IdentityService,
  ) {}

  async process(
    photoId: string,
  ): Promise<void> {
    const photo =
      await this.prisma.photo.findUnique({
        where: {
          id: photoId,
        },
      });

    if (!photo) {
      throw new Error(
        `FaceProcessingService: photo "${photoId}" not found.`,
      );
    }

    await this.prisma.photo.update({
      where: {
        id: photoId,
      },
      data: {
        processingStatus: PhotoProcessingStatus.PROCESSING,
        processingStartedAt: new Date(),
        processingError: null,
      },
    });

    try {
      /*
       * ----------------------------------------
       * 1. Download image from storage
       * ----------------------------------------
       */

      const image =
        await this.storage.getObject(
          photo.storageKey,
        );


      /*
       * ----------------------------------------
       * 2. Prepare detector input
       * ----------------------------------------
       */

      const processed =
        await this.imageProcessor.toTensor(
          image,
          SCRFD_CONFIG,
        );


      /*
       * ----------------------------------------
       * 3. Detect faces
       * ----------------------------------------
       */

      const detections =
        await this.detector.detect(
          processed.tensor,
          processed.scale,
        );


      /*
       * ----------------------------------------
       * 4. Process every detected face
       * ----------------------------------------
       */

      for (const detection of detections) {
        const alignedFace =
          await this.aligner.align(
            image,
            detection,
          );

        const embedding =
          await this.recognizer.recognize(
            alignedFace,
          );


        /*
         * Create DetectedFace first because
         * FaceVector references it.
         */

        const detectedFace =
          await this.prisma.detectedFace.create({
            data: {
              photoId,

              boundingBoxX:
                detection.boundingBox.x,

              boundingBoxY:
                detection.boundingBox.y,

              boundingBoxW:
                detection.boundingBox.width,

              boundingBoxH:
                detection.boundingBox.height,

              confidence:
                detection.confidence,

              leftEyeX:
                detection.leftEye.x,

              leftEyeY:
                detection.leftEye.y,

              rightEyeX:
                detection.rightEye.x,

              rightEyeY:
                detection.rightEye.y,

              noseX:
                detection.nose.x,

              noseY:
                detection.nose.y,

              leftMouthX:
                detection.leftMouth.x,

              leftMouthY:
                detection.leftMouth.y,

              rightMouthX:
                detection.rightMouth.x,

              rightMouthY:
                detection.rightMouth.y,
            },
          });


        /*
         * Store normalized 512-D embedding
         * in pgvector.
         */

        await this.vectorRepository.save(
          detectedFace.id,
          Array.from(embedding),
        );

        await this.identityService.assignIdentity(
          detectedFace.id,
          photo.eventId,
          Array.from(embedding),
        );
      }


      /*
       * ----------------------------------------
       * 5. Mark processing complete
       * ----------------------------------------
       */

      await this.prisma.photo.update({
        where: {
          id: photoId,
        },
        data: {
          processingStatus: PhotoProcessingStatus.COMPLETED,
          processingCompletedAt: new Date(),
          processingError: null,
        },
      });

    } catch (error) {

      const message =
        error instanceof Error
          ? error.message
          : String(error);

      await this.prisma.photo.update({
        where: {
          id: photoId,
        },
        data: {
          processingStatus: PhotoProcessingStatus.FAILED,
          processingError: message,
        },
      });

      throw error;
    }
  }
}