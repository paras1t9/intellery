import "dotenv/config";

import { readFile } from "node:fs/promises";
import { InferenceSession } from "onnxruntime-node";

import prisma from "./src/infrastructure/prisma.js";

import { ImageProcessor } from "./src/vision/common/ImageProcessor.js";
import { InsightFaceDetector } from "./src/vision/detection/InsightFaceDetector.js";
import { FaceAligner } from "./src/vision/recognition/FaceAligner.js";
import { FaceRecognizer } from "./src/vision/recognition/FaceRecognizer.js";
import { FaceVectorRepository } from "./src/vision/recognition/FaceVectorRepository.js";
import { IdentityService } from "./src/vision/identity/IdentityService.js";

import {
  EventRole,
  PhotoProcessingStatus,
  UploadStatus,
} from "./generated/prisma/client.js";


const DETECTION_MODEL =
  "./models/insightface/detection/scrfd_10g_bnkps.onnx";

const RECOGNITION_MODEL =
  "./models/insightface/recognition/w600k_r50.onnx";

const IMAGE_A =
  "./uploads/another-face.jpg";

const IMAGE_B =
  "./uploads/same-person-goggles.jpg";


async function main() {
  console.log("Starting real identity test...\n");


  // --------------------------------------------------
  // Load models
  // --------------------------------------------------

  console.log("Loading models...");

  const detectionSession =
    await InferenceSession.create(
      DETECTION_MODEL,
    );

  const recognitionSession =
    await InferenceSession.create(
      RECOGNITION_MODEL,
    );

  console.log("Models loaded.\n");


  // --------------------------------------------------
  // Create vision components
  // --------------------------------------------------

  const imageProcessor =
    new ImageProcessor();

  const detector =
    new InsightFaceDetector(
      detectionSession,
    );

  const aligner =
    new FaceAligner();

  const recognizer =
    new FaceRecognizer(
      recognitionSession,
    );

  const vectorRepository =
    new FaceVectorRepository();

  const identityService =
    new IdentityService(
      prisma,
      vectorRepository,
    );


  // --------------------------------------------------
  // Temporary user
  // --------------------------------------------------

  const user =
    await prisma.user.create({
      data: {
        displayName: "Real Identity Test User",
        email: `real-identity-${Date.now()}@example.com`,
        passwordHash: "test-password",
      },
    });

  console.log(
    "Temporary user:",
    user.id,
  );


  // --------------------------------------------------
  // Temporary event
  // --------------------------------------------------

  const event =
    await prisma.event.create({
      data: {
        name: "Real Identity Test Event",
        eventCode: `REAL-IDENTITY-${Date.now()}`,
        members: {
          create: {
            userId: user.id,
            role: EventRole.ADMIN,
          },
        },
      },
    });

  console.log(
    "Temporary event:",
    event.eventId,
  );


  // --------------------------------------------------
  // Temporary upload
  // --------------------------------------------------

  const upload =
    await prisma.upload.create({
      data: {
        eventId: event.eventId,
        uploaderId: user.id,
        status: UploadStatus.PROCESSING,
        totalFiles: 2,
      },
    });


  // --------------------------------------------------
  // Process one image
  // --------------------------------------------------

  async function processImage(
    imagePath: string,
    label: string,
  ) {
    console.log("\n==============================");
    console.log(`Processing ${label}`);
    console.log("==============================");

    const image =
      await readFile(imagePath);


    // ----------------------------------------------
    // Create Photo
    // ----------------------------------------------

    const photo =
      await prisma.photo.create({
        data: {
          eventId: event.eventId,
          uploaderId: user.id,
          uploadId: upload.id,
          originalName: imagePath.split("/").pop()!,
          storageKey: `real-identity-test/${label}.jpg`,
          mimeType: "image/jpeg",
          size: image.length,
          processingStatus:
            PhotoProcessingStatus.PROCESSING,
          processingStartedAt:
            new Date(),
        },
      });


    try {
      // --------------------------------------------
      // Image preprocessing
      // --------------------------------------------

      const processed =
        await imageProcessor.toTensor(
          image,
          {
            width: 640,
            height: 640,
            mean: [127.5, 127.5, 127.5],
            std: [128, 128, 128],
          },
        );


      // --------------------------------------------
      // Detection
      // --------------------------------------------

      const detections =
        await detector.detect(
          processed.tensor,
          processed.scale,
        );

      console.log(
        `Faces detected: ${detections.length}`,
      );


      if (detections.length === 0) {
        throw new Error(
          `No face detected in ${imagePath}`,
        );
      }


      /*
       * For this test we expect exactly one face
       * in each image.
       */

      if (detections.length !== 1) {
        throw new Error(
          `Expected exactly 1 face, detected ${detections.length}.`,
        );
      }


      const detection =
        detections[0];

      console.log(
        "Detection:",
        detection,
      );


      // --------------------------------------------
      // Create DetectedFace
      // --------------------------------------------

      const detectedFace =
        await prisma.detectedFace.create({
          data: {
            photoId: photo.id,

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


      // --------------------------------------------
      // Alignment
      // --------------------------------------------

      const alignedFace =
        await aligner.align(
          image,
          detection,
        );


      // --------------------------------------------
      // Recognition
      // --------------------------------------------

      const embedding =
        await recognizer.recognize(
          alignedFace,
        );

      console.log(
        "Embedding generated:",
        embedding.length,
      );


      // --------------------------------------------
      // Store vector
      // --------------------------------------------

      await vectorRepository.save(
        detectedFace.id,
        Array.from(embedding),
      );

      console.log(
        "Embedding stored.",
      );


      // --------------------------------------------
      // Assign identity
      // --------------------------------------------

      const identity =
        await identityService.assignIdentity(
          detectedFace.id,
          event.eventId,
          Array.from(embedding),
        );


      console.log(
        "Assigned identity:",
        identity.id,
      );


      // --------------------------------------------
      // Mark photo completed
      // --------------------------------------------

      await prisma.photo.update({
        where: {
          id: photo.id,
        },
        data: {
          processingStatus:
            PhotoProcessingStatus.COMPLETED,

          processingCompletedAt:
            new Date(),
        },
      });


      return {
        photoId: photo.id,
        detectedFaceId: detectedFace.id,
        identityId: identity.id,
      };

    } catch (error) {

      await prisma.photo.update({
        where: {
          id: photo.id,
        },
        data: {
          processingStatus:
            PhotoProcessingStatus.FAILED,

          processingError:
            error instanceof Error
              ? error.message
              : String(error),
        },
      });

      throw error;
    }
  }


  // --------------------------------------------------
  // Process both real images
  // --------------------------------------------------

  const resultA =
    await processImage(
      IMAGE_A,
      "person-a",
    );


  const resultB =
    await processImage(
      IMAGE_B,
      "person-a-goggles",
    );


  // --------------------------------------------------
  // Results
  // --------------------------------------------------

  console.log("\n==============================");
  console.log(" REAL IDENTITY TEST");
  console.log("==============================");

  console.log(
    "\nPerson A:",
    resultA,
  );

  console.log(
    "\nPerson A + goggles:",
    resultB,
  );


  console.log(
    "\nSame identity:",
    resultA.identityId ===
      resultB.identityId
      ? "PASS"
      : "FAIL",
  );


  // --------------------------------------------------
  // Verify database
  // --------------------------------------------------

  const identities =
    await prisma.identity.findMany({
      where: {
        eventId: event.eventId,
      },
      include: {
        faces: true,
      },
    });


  console.log(
    "\nIdentities created:",
    identities.length,
  );


  for (const identity of identities) {
    console.log({
      identityId: identity.id,
      faceCount: identity.faces.length,
      confirmed: identity.isConfirmed,
    });
  }


  // --------------------------------------------------
  // Cleanup
  // --------------------------------------------------

  await prisma.event.delete({
    where: {
      eventId: event.eventId,
    },
  });

  await prisma.user.delete({
    where: {
      id: user.id,
    },
  });


  console.log(
    "\nTemporary event deleted.",
  );

  console.log(
    "Temporary user deleted.",
  );

  console.log(
    "\nReal identity test complete.",
  );
}


main()
  .catch((error) => {
    console.error(
      "\nReal identity test failed:",
      error,
    );

    process.exitCode = 1;
  });