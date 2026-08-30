import prisma from "../../infrastructure/prisma.js";

export class UserFaceVectorRepository {
  async save(
    userId: string,
    embedding: number[],
  ): Promise<void> {
    if (embedding.length !== 512) {
      throw new Error(
        `UserFaceVectorRepository: expected 512-D embedding, got ${embedding.length}.`,
      );
    }

    const vector = `[${embedding.join(",")}]`;

    /*
     * Upsert — if the user re-submits their selfie,
     * replace the old embedding with the new one.
     */
    await prisma.$executeRaw`
      INSERT INTO "UserFaceVector" (
        "id",
        "userId",
        "vector",
        "model",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        gen_random_uuid(),
        ${userId},
        ${vector}::vector,
        'W600K_R50'::"EmbeddingModel",
        NOW(),
        NOW()
      )
      ON CONFLICT ("userId")
      DO UPDATE SET
        "vector"    = EXCLUDED."vector",
        "model"     = EXCLUDED."model",
        "updatedAt" = NOW()
    `;
  }

  async findByUserId(userId: string): Promise<number[] | null> {
    const rows = await prisma.$queryRaw<Array<{ vector: string }>>`
      SELECT "vector"::text AS vector
      FROM "UserFaceVector"
      WHERE "userId" = ${userId}
      LIMIT 1
    `;

    if (rows.length === 0) return null;

    return rows[0].vector
      .slice(1, -1)
      .split(",")
      .map(Number);
  }
}
