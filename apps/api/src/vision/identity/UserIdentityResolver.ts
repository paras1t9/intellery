import { PrismaClient } from "../../../generated/prisma/client.js";
import { UserFaceVectorRepository } from "../recognition/UserFaceVectorRepository.js";

/*
 * How similar the user's selfie embedding must be to a face
 * in the event before we consider it a match.
 *
 * Same threshold used by IdentityService for face clustering.
 */
const USER_IDENTITY_THRESHOLD = 0.55;

export class UserIdentityResolver {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly userFaceVectorRepository: UserFaceVectorRepository,
  ) {}

  /**
   * Searches an event's face clusters for the user's face and,
   * if a match is found above the threshold, writes a UserIdentity
   * record so that "me" resolves to their identityId in searches.
   *
   * Safe to call multiple times — upserts the UserIdentity row.
   *
   * @returns The matched identityId, or null if no face match was found.
   */
  async resolve(userId: string, eventId: string): Promise<string | null> {
    /*
     * 1. Fetch the user's registered selfie embedding.
     *    If they haven't submitted a selfie yet, bail out.
     */
    const userEmbedding =
      await this.userFaceVectorRepository.findByUserId(userId);

    if (!userEmbedding) {
      return null;
    }

    const vector = `[${userEmbedding.join(",")}]`;

    /*
     * 2. Find the closest face vectors in this event using
     *    pgvector cosine distance (<=>) and join up to the identity.
     *
     *    We group by identityId and take the best (minimum) distance
     *    per identity, so one noisy face in a cluster doesn't skew the result.
     */
    const rows = await this.prisma.$queryRaw<
      Array<{ identityId: string; bestSimilarity: number }>
    >`
      SELECT
        df."identityId",
        1 - MIN(fv."vector" <=> ${vector}::vector) AS "bestSimilarity"
      FROM "FaceVector" fv
      INNER JOIN "DetectedFace" df
        ON df."id" = fv."detectedFaceId"
      INNER JOIN "Photo" p
        ON p."id" = df."photoId"
      WHERE
        p."eventId" = ${eventId}
        AND df."identityId" IS NOT NULL
      GROUP BY df."identityId"
      ORDER BY "bestSimilarity" DESC
      LIMIT 1
    `;

    if (rows.length === 0) {
      return null;
    }

    const best = rows[0];

    if (best.bestSimilarity < USER_IDENTITY_THRESHOLD) {
      return null;
    }

    /*
     * 3. Persist the mapping — upsert so re-joining an event is safe.
     *    The composite PK is (userId, eventId) so one record per user per event.
     */
    await this.prisma.userIdentity.upsert({
      where: {
        userId_eventId: { userId, eventId },
      },
      create: {
        userId,
        eventId,
        identityId: best.identityId,
      },
      update: {
        identityId: best.identityId,
      },
    });

    return best.identityId;
  }
}
