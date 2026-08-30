import "dotenv/config";

import prisma from "./src/infrastructure/prisma.js";

import { FaceVectorRepository } from "./src/vision/recognition/FaceVectorRepository.js";
import { IdentityService } from "./src/vision/identity/IdentityService.js";

import {
  EventRole,
  PhotoProcessingStatus,
  UploadStatus,
} from "./generated/prisma/client.js";


async function main() {
  console.log("Starting identity assignment test...\n");

  /*
   * --------------------------------------------------
   * Create temporary user
   * --------------------------------------------------
   */

  const user = await prisma.user.create({
    data: {
      displayName: "Identity Test User",
      email: `identity-test-${Date.now()}@example.com`,
      passwordHash: "test-password",
    },
  });

  console.log("Temporary user:", user.id);


  /*
   * --------------------------------------------------
   * Create temporary event
   * --------------------------------------------------
   */

  const event = await prisma.event.create({
    data: {
      name: "Identity Test Event",
      eventCode: `IDENTITY-${Date.now()}`,
      members: {
        create: {
          userId: user.id,
          role: EventRole.ADMIN,
        },
      },
    },
  });

  console.log("Temporary event:", event.eventId);


  /*
   * --------------------------------------------------
   * Create temporary upload
   * --------------------------------------------------
   */

  const upload = await prisma.upload.create({
    data: {
      eventId: event.eventId,
      uploaderId: user.id,
      status: UploadStatus.COMPLETED,
      totalFiles: 3,
      uploadedFiles: 3,
    },
  });


  /*
   * --------------------------------------------------
   * Create temporary photos
   * --------------------------------------------------
   */

  const photoA = await prisma.photo.create({
    data: {
      eventId: event.eventId,
      uploaderId: user.id,
      uploadId: upload.id,
      originalName: "person-a.jpg",
      storageKey: "identity-test/person-a.jpg",
      mimeType: "image/jpeg",
      size: 100,
      processingStatus:
        PhotoProcessingStatus.COMPLETED,
    },
  });

  const photoB = await prisma.photo.create({
    data: {
      eventId: event.eventId,
      uploaderId: user.id,
      uploadId: upload.id,
      originalName: "person-b.jpg",
      storageKey: "identity-test/person-b.jpg",
      mimeType: "image/jpeg",
      size: 100,
      processingStatus:
        PhotoProcessingStatus.COMPLETED,
    },
  });

  const photoC = await prisma.photo.create({
    data: {
      eventId: event.eventId,
      uploaderId: user.id,
      uploadId: upload.id,
      originalName: "person-a-again.jpg",
      storageKey: "identity-test/person-a-again.jpg",
      mimeType: "image/jpeg",
      size: 100,
      processingStatus:
        PhotoProcessingStatus.COMPLETED,
    },
  });


  /*
   * --------------------------------------------------
   * Create repository + identity service
   * --------------------------------------------------
   */

  const vectorRepository =
    new FaceVectorRepository();

  const identityService =
    new IdentityService(
      prisma,
      vectorRepository,
    );


  /*
   * --------------------------------------------------
   * Fake embeddings
   *
   * We use simple normalized vectors.
   *
   * A and A-again are identical.
   * B is completely different.
   * --------------------------------------------------
   */

  const embeddingA =
    new Array(512).fill(0);

  embeddingA[0] = 1;


  const embeddingB =
    new Array(512).fill(0);

  embeddingB[1] = 1;


  /*
   * --------------------------------------------------
   * Create DetectedFace A
   * --------------------------------------------------
   */

  const detectedFaceA =
    await prisma.detectedFace.create({
      data: {
        photoId: photoA.id,

        boundingBoxX: 100,
        boundingBoxY: 100,
        boundingBoxW: 200,
        boundingBoxH: 200,

        confidence: 0.95,

        leftEyeX: 120,
        leftEyeY: 150,

        rightEyeX: 180,
        rightEyeY: 150,

        noseX: 150,
        noseY: 175,

        leftMouthX: 130,
        leftMouthY: 200,

        rightMouthX: 170,
        rightMouthY: 200,
      },
    });


  await vectorRepository.save(
    detectedFaceA.id,
    embeddingA,
  );


  /*
   * --------------------------------------------------
   * Assign Identity to A
   * --------------------------------------------------
   */

  const identityA =
    await identityService.assignIdentity(
      detectedFaceA.id,
      event.eventId,
      embeddingA,
    );

  console.log(
    "\nPerson A identity:",
    identityA.id,
  );


  /*
   * --------------------------------------------------
   * Create DetectedFace B
   * --------------------------------------------------
   */

  const detectedFaceB =
    await prisma.detectedFace.create({
      data: {
        photoId: photoB.id,

        boundingBoxX: 300,
        boundingBoxY: 100,
        boundingBoxW: 200,
        boundingBoxH: 200,

        confidence: 0.95,

        leftEyeX: 320,
        leftEyeY: 150,

        rightEyeX: 380,
        rightEyeY: 150,

        noseX: 350,
        noseY: 175,

        leftMouthX: 330,
        leftMouthY: 200,

        rightMouthX: 370,
        rightMouthY: 200,
      },
    });


  await vectorRepository.save(
    detectedFaceB.id,
    embeddingB,
  );


  /*
   * --------------------------------------------------
   * Assign Identity to B
   * --------------------------------------------------
   */

  const identityB =
    await identityService.assignIdentity(
      detectedFaceB.id,
      event.eventId,
      embeddingB,
    );

  console.log(
    "Person B identity:",
    identityB.id,
  );


  /*
   * --------------------------------------------------
   * Create Person A again
   * --------------------------------------------------
   */

  const detectedFaceA2 =
    await prisma.detectedFace.create({
      data: {
        photoId: photoC.id,

        boundingBoxX: 500,
        boundingBoxY: 100,
        boundingBoxW: 200,
        boundingBoxH: 200,

        confidence: 0.95,

        leftEyeX: 520,
        leftEyeY: 150,

        rightEyeX: 580,
        rightEyeY: 150,

        noseX: 550,
        noseY: 175,

        leftMouthX: 530,
        leftMouthY: 200,

        rightMouthX: 570,
        rightMouthY: 200,
      },
    });


  await vectorRepository.save(
    detectedFaceA2.id,
    embeddingA,
  );


  /*
   * --------------------------------------------------
   * Assign Identity to A again
   * --------------------------------------------------
   */

  const identityA2 =
    await identityService.assignIdentity(
      detectedFaceA2.id,
      event.eventId,
      embeddingA,
    );


  console.log(
    "Person A again identity:",
    identityA2.id,
  );


  /*
   * --------------------------------------------------
   * Verify results
   * --------------------------------------------------
   */

  console.log("\n==============================");
  console.log(" IDENTITY ASSIGNMENT TEST");
  console.log("==============================");

  console.log(
    "A created identity:",
    identityA.id,
  );

  console.log(
    "B created identity:",
    identityB.id,
  );

  console.log(
    "A again identity:",
    identityA2.id,
  );

  console.log(
    "A ↔ A again:",
    identityA.id === identityA2.id
      ? "PASS"
      : "FAIL",
  );

  console.log(
    "A ↔ B different:",
    identityA.id !== identityB.id
      ? "PASS"
      : "FAIL",
  );


  /*
   * --------------------------------------------------
   * Check database assignments
   * --------------------------------------------------
   */

  const faces =
    await prisma.detectedFace.findMany({
      where: {
        photoId: {
          in: [
            photoA.id,
            photoB.id,
            photoC.id,
          ],
        },
      },
      select: {
        id: true,
        photoId: true,
        identityId: true,
      },
    });


  console.log("\nDetected faces:");

  for (const face of faces) {
    console.log(face);
  }


  /*
   * --------------------------------------------------
   * Cleanup
   * --------------------------------------------------
   */

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

  console.log("\nTemporary event deleted.");
  console.log("Temporary user deleted.");

  console.log("\nIdentity assignment test complete.");
}


main()
  .catch((error) => {
    console.error(
      "Identity assignment test failed:",
      error,
    );

    process.exitCode = 1;
  });