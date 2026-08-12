import prisma from "../../infrastructure/prisma.js";

export interface FaceSimilarityResult {
  detectedFaceId: string;
  photoId: string;
  distance: number;
  similarity: number;

  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export class FaceVectorRepository {
  
  async save(
    detectedFaceId: string,
    embedding: number[],
  ): Promise<void> {
    if (embedding.length !== 512) {
      throw new Error(
        `FaceVectorRepository: expected 512-dimensional embedding, received ${embedding.length}.`,
      );
    }

    const vector = `[${embedding.join(",")}]`;

    await prisma.$executeRaw`
      INSERT INTO "FaceVector" (
        "id",
        "detectedFaceId",
        "vector",
        "model",
        "embeddingVersion",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        gen_random_uuid(),
        ${detectedFaceId},
        ${vector}::vector,
        'W600K_R50'::"EmbeddingModel",
        1,
        NOW(),
        NOW()
      )
    `;
  }

  async findByDetectedFaceId(
    detectedFaceId: string,
  ): Promise<number[] | null> {
    const rows = await prisma.$queryRaw<
      Array<{ vector: string }>
    >`
      SELECT "vector"::text AS vector
      FROM "FaceVector"
      WHERE "detectedFaceId" = ${detectedFaceId}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return null;
    }

    const vector = rows[0].vector;

    return vector
      .slice(1, -1)
      .split(",")
      .map(Number);
  }

  async searchSimilar(
    eventId: string,
    embedding: number[],
    limit: number = 20,
  ): Promise<FaceSimilarityResult[]> {
    if (embedding.length !== 512) {
      throw new Error(
        `FaceVectorRepository: expected 512-dimensional embedding, received ${embedding.length}.`,
      );
    }

    if (limit <= 0) {
      throw new Error(
        "FaceVectorRepository: limit must be greater than 0.",
      );
    }

    const vector = `[${embedding.join(",")}]`;

    const rows = await prisma.$queryRaw<
      Array<{
        detectedFaceId: string;
        photoId: string;
        distance: number;
        boundingBoxX: number;
        boundingBoxY: number;
        boundingBoxW: number;
        boundingBoxH: number;
      }>
    >`
      SELECT
        fv."detectedFaceId",
        df."photoId",

        fv."vector" <=> ${vector}::vector AS distance,

        df."boundingBoxX",
        df."boundingBoxY",
        df."boundingBoxW",
        df."boundingBoxH"

      FROM "FaceVector" fv

      INNER JOIN "DetectedFace" df
        ON df."id" = fv."detectedFaceId"

      INNER JOIN "Photo" p
        ON p."id" = df."photoId"

      WHERE p."eventId" = ${eventId}

      ORDER BY fv."vector" <=> ${vector}::vector

      LIMIT ${limit}
    `;

    return rows.map((row) => ({
      detectedFaceId: row.detectedFaceId,
      photoId: row.photoId,

      distance: row.distance,
      similarity: 1 - row.distance,

      boundingBox: {
        x: row.boundingBoxX,
        y: row.boundingBoxY,
        width: row.boundingBoxW,
        height: row.boundingBoxH,
      },
    }));
  }
}