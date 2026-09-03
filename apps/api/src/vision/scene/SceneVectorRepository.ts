import prisma from "../../infrastructure/prisma.js";

export class SceneVectorRepository {
  async save(photoId: string, embedding: number[]): Promise<void> {
    if (embedding.length !== 512) {
      throw new Error(
        `SceneVectorRepository: expected 512-D embedding, got ${embedding.length}.`,
      );
    }

    const vector = `[${embedding.join(",")}]`;

    /*
     * Upsert — if the photo is re-processed, replace the old vector.
     */
    await prisma.$executeRaw`
      INSERT INTO "PhotoAnnotation" (
        "id",
        "photoId",
        "caption",
        "vector",
        "sceneModel",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        gen_random_uuid(),
        ${photoId},
        '',
        ${vector}::vector,
        'CLIP_VIT_B32'::"SceneEmbeddingModel",
        NOW(),
        NOW()
      )
      ON CONFLICT ("photoId")
      DO UPDATE SET
        "vector"     = EXCLUDED."vector",
        "sceneModel" = EXCLUDED."sceneModel",
        "updatedAt"  = NOW()
    `;
  }

  async findByPhotoId(photoId: string): Promise<number[] | null> {
    const rows = await prisma.$queryRaw<Array<{ vector: string }>>`
      SELECT "vector"::text AS vector
      FROM "PhotoAnnotation"
      WHERE "photoId" = ${photoId}
      LIMIT 1
    `;

    if (rows.length === 0 || !rows[0].vector) return null;

    return rows[0].vector
      .slice(1, -1)
      .split(",")
      .map(Number);
  }
}
