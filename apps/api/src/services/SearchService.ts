import { PrismaClient } from "../../generated/prisma/client.js";
import { StorageService } from "../storage/StorageService.js";
import { TextEmbedder } from "../vision/scene/TextEmbedder.js";

const ME_PATTERN = /\bme\b/i;

/*
 * Minimum cosine similarity to include a result.
 * CLIP image-text similarities are lower than image-image similarities —
 * 0.15 filters clear mismatches while keeping loosely relevant photos.
 */
const SIMILARITY_THRESHOLD = 0.15;

export interface PhotoSearchResult {
  photoId: string;
  url: string;
  similarity: number;
}

export interface SearchResponse {
  results: PhotoSearchResult[];
  meResolved: boolean;
}

export class SearchService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: StorageService,
    private readonly textEmbedder: TextEmbedder,
  ) {}

  async search(
    userId: string,
    eventId: string,
    query: string,
    limit: number,
  ): Promise<SearchResponse> {

    /*
     * 1. Embed the query into the CLIP text space (512-D vector).
     */
    const embedding = await this.textEmbedder.embed(query);
    const vector = `[${Array.from(embedding).join(",")}]`;

    /*
     * 2. Detect "me" in the query.
     *    If present, look up the user's face identity in this event.
     *    The UserIdentityResolver writes this record when the user joins.
     */
    let identityId: string | null = null;
    const hasMeKeyword = ME_PATTERN.test(query);

    if (hasMeKeyword) {
      const userIdentity = await this.prisma.userIdentity.findUnique({
        where: {
          userId_eventId: { userId, eventId },
        },
        select: { identityId: true },
      });
      identityId = userIdentity?.identityId ?? null;
    }

    /*
     * 3. Search PhotoAnnotation vectors using pgvector cosine distance (<=>) .
     *
     *    Two variants:
     *    - With "me" resolved: filter to photos containing the user's face.
     *    - Without "me": pure semantic scene search across the whole event.
     */
    type RawRow = { photoId: string; storageKey: string; similarity: number };
    let rows: RawRow[];

    if (hasMeKeyword && identityId) {
      rows = await this.prisma.$queryRaw<RawRow[]>`
        SELECT
          pa."photoId",
          p."storageKey",
          1 - (pa."vector" <=> ${vector}::vector) AS "similarity"
        FROM "PhotoAnnotation" pa
        INNER JOIN "Photo" p ON p."id" = pa."photoId"
        WHERE p."eventId" = ${eventId}
          AND pa."vector" IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM "DetectedFace" df
            WHERE df."photoId" = p."id"
              AND df."identityId" = ${identityId}
          )
        ORDER BY pa."vector" <=> ${vector}::vector
        LIMIT ${limit}
      `;
    } else {
      rows = await this.prisma.$queryRaw<RawRow[]>`
        SELECT
          pa."photoId",
          p."storageKey",
          1 - (pa."vector" <=> ${vector}::vector) AS "similarity"
        FROM "PhotoAnnotation" pa
        INNER JOIN "Photo" p ON p."id" = pa."photoId"
        WHERE p."eventId" = ${eventId}
          AND pa."vector" IS NOT NULL
        ORDER BY pa."vector" <=> ${vector}::vector
        LIMIT ${limit}
      `;
    }

    /*
     * 4. Filter by minimum similarity, then generate presigned URLs
     *    for all results concurrently.
     */
    const relevant = rows.filter(
      (row) => Number(row.similarity) >= SIMILARITY_THRESHOLD,
    );

    const results = await Promise.all(
      relevant.map(async (row) => ({
        photoId: row.photoId,
        url: await this.storage.getSignedUrl(row.storageKey, {
          expiresInSeconds: 60 * 60, // 1 hour
        }),
        similarity: Number(row.similarity),
      })),
    );

    return {
      results,
      /*
       * meResolved = true means "me" was found AND we know which face
       * cluster belongs to this user in this event.
       * meResolved = false means either "me" wasn't in the query,
       * or we couldn't match the user to a face cluster yet.
       */
      meResolved: hasMeKeyword && identityId !== null,
    };
  }
}
