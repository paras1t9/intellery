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
     * 2. Collect all identity IDs that should filter the results.
     *
     *    a) "me" keyword → resolve via UserIdentity
     *    b) Any word matching a confirmed Identity.displayName → resolve via Identity table
     *
     *    Photos returned must contain at least one face from
     *    any of the resolved identities (OR logic).
     */
    const resolvedIdentityIds: string[] = [];
    let meResolved = false;

    const hasMeKeyword = ME_PATTERN.test(query);

    if (hasMeKeyword) {
      const userIdentity = await this.prisma.userIdentity.findUnique({
        where: { userId_eventId: { userId, eventId } },
        select: { identityId: true },
      });
      if (userIdentity) {
        resolvedIdentityIds.push(userIdentity.identityId);
        meResolved = true;
      }
    }

    /*
     * Tokenize query into individual words and check each against
     * confirmed Identity display names in this event.
     */
    const words = query.toLowerCase().match(/[a-z]+/g) ?? [];

    if (words.length > 0) {
      const namedIdentities = await this.prisma.identity.findMany({
        where: {
          eventId,
          isConfirmed: true,
          displayName: { in: words, mode: "insensitive" },
        },
        select: { id: true },
      });
      for (const ni of namedIdentities) {
        if (!resolvedIdentityIds.includes(ni.id)) {
          resolvedIdentityIds.push(ni.id);
        }
      }
    }

    /*
     * 3. Build pgvector query.
     *
     *    - If identity IDs were resolved: scene similarity + identity filter
     *      (photos must contain at least one of the resolved people).
     *    - Otherwise: pure scene similarity search across the whole event.
     */
    type RawRow = { photoId: string; storageKey: string; similarity: number };
    let rows: RawRow[];

    if (resolvedIdentityIds.length > 0) {
      /*
       * Prisma raw query with pgvector — identity list is serialised as a
       * Postgres text[] and matched with = ANY().
       */
      const idList = resolvedIdentityIds.join(",");
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
              AND df."identityId" = ANY(
                SELECT unnest(string_to_array(${idList}, ','))
              )
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
     * 4. Filter by minimum similarity, generate presigned URLs concurrently.
     */
    const relevant = rows.filter(
      (row) => Number(row.similarity) >= SIMILARITY_THRESHOLD,
    );

    const results = await Promise.all(
      relevant.map(async (row) => ({
        photoId:    row.photoId,
        url:        await this.storage.getSignedUrl(row.storageKey, { expiresInSeconds: 3600 }),
        similarity: Number(row.similarity),
      })),
    );

    return {
      results,
      meResolved,
    };
  }

}
