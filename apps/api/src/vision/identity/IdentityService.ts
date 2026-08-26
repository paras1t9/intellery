import {
  PrismaClient,
  Identity,
} from "../../../generated/prisma/client.js";

import {
  FaceVectorRepository,
  FaceSimilarityResult,
} from "../recognition/FaceVectorRepository.js";


const IDENTITY_MATCH_THRESHOLD = 0.55;


export class IdentityService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly vectorRepository: FaceVectorRepository,
  ) {}


  async assignIdentity(
    detectedFaceId: string,
    eventId: string,
    embedding: number[],
  ): Promise<Identity> {

    /*
     * Search for visually similar faces,
     * but only inside this event.
     */

    const matches =
      await this.vectorRepository.searchSimilar(
        eventId,
        embedding,
        20,
      );


    /*
     * The newly inserted vector will normally
     * appear as the first result with similarity 1.
     *
     * We must not match the face against itself.
     */

    const candidate =
      matches.find(
        (match) =>
          match.detectedFaceId !==
          detectedFaceId
      );


    /*
     * No previous face exists in this event.
     * Create a new identity.
     */

    if (
      !candidate ||
      candidate.similarity <
        IDENTITY_MATCH_THRESHOLD
    ) {
      return this.createIdentity(
        eventId,
        detectedFaceId,
      );
    }


    /*
     * A sufficiently similar face exists.
     *
     * Check whether that face already belongs
     * to an identity.
     */

    const matchedFace =
      await this.prisma.detectedFace.findUnique({
        where: {
          id: candidate.detectedFaceId,
        },
        select: {
          identityId: true,
        },
      });


    if (matchedFace?.identityId) {
      await this.prisma.detectedFace.update({
        where: {
          id: detectedFaceId,
        },
        data: {
          identityId:
            matchedFace.identityId,
        },
      });

      return this.prisma.identity.findUniqueOrThrow({
        where: {
          id: matchedFace.identityId,
        },
      });
    }


    /*
     * The similar face doesn't have an identity yet.
     *
     * Create one identity and attach both faces.
     */

    const identity =
      await this.prisma.identity.create({
        data: {
          eventId,
          faces: {
            connect: [
              {
                id: candidate.detectedFaceId,
              },
              {
                id: detectedFaceId,
              },
            ],
          },
        },
      });


    return identity;
  }


  private async createIdentity(
    eventId: string,
    detectedFaceId: string,
  ): Promise<Identity> {

    return this.prisma.identity.create({
      data: {
        eventId,
        faces: {
          connect: {
            id: detectedFaceId,
          },
        },
      },
    });
  }
}