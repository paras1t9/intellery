import { PrismaClient, PhotoProcessingStatus } from "../../generated/prisma/client.js";
import { StorageService } from "../storage/StorageService.js";
import { ForbiddenError } from "../errors/index.js";

export interface PhotoItem {
  photoId:          string;
  url:              string;
  processingStatus: PhotoProcessingStatus;
  faceCount:        number;
  createdAt:        string;
}

export interface PhotoPage {
  photos:     PhotoItem[];
  nextCursor: string | null;
  total:      number;
}

export class PhotoService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: StorageService,
  ) {}

  /*
   * Verify the requesting user is a member of the event.
   * Throws 403 if not.
   */
  private async assertMembership(userId: string, eventId: string): Promise<void> {
    const membership = await this.prisma.eventMember.findFirst({
      where: { userId, eventId },
    });
    if (!membership) {
      throw new ForbiddenError("You are not a member of this event.");
    }
  }

  /**
   * Returns all COMPLETED photos in the event, newest first.
   * Cursor-based: pass the `createdAt` of the last item as the next cursor.
   */
  async getGallery(
    userId:   string,
    eventId:  string,
    cursor:   string | undefined,
    limit:    number,
  ): Promise<PhotoPage> {
    await this.assertMembership(userId, eventId);

    const [photos, total] = await Promise.all([
      this.prisma.photo.findMany({
        where: {
          eventId,
          processingStatus: PhotoProcessingStatus.COMPLETED,
          ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
        },
        orderBy:  { createdAt: "desc" },
        take:     limit + 1, // +1 to detect next page
        include:  { _count: { select: { detectedFaces: true } } },
      }),

      this.prisma.photo.count({
        where: {
          eventId,
          processingStatus: PhotoProcessingStatus.COMPLETED,
        },
      }),
    ]);

    const hasNextPage = photos.length > limit;
    const page        = photos.slice(0, limit);

    const items = await Promise.all(
      page.map(async (photo) => ({
        photoId:          photo.id,
        url:              await this.storage.getSignedUrl(photo.storageKey, { expiresInSeconds: 3600 }),
        processingStatus: photo.processingStatus,
        faceCount:        photo._count.detectedFaces,
        createdAt:        photo.createdAt.toISOString(),
      })),
    );

    return {
      photos:     items,
      nextCursor: hasNextPage ? page[page.length - 1]!.createdAt.toISOString() : null,
      total,
    };
  }

  /**
   * Returns only photos that contain the logged-in user's face,
   * identified by their UserIdentity for this event.
   *
   * Returns { meResolved: false, photos: [] } if the user hasn't been
   * matched to a face cluster yet.
   */
  async getMyPhotos(
    userId:  string,
    eventId: string,
    cursor:  string | undefined,
    limit:   number,
  ): Promise<PhotoPage & { meResolved: boolean }> {
    await this.assertMembership(userId, eventId);

    /*
     * Look up which face identity cluster belongs to this user.
     */
    const userIdentity = await this.prisma.userIdentity.findUnique({
      where: {
        userId_eventId: { userId, eventId },
      },
      select: { identityId: true },
    });

    if (!userIdentity) {
      return { photos: [], nextCursor: null, total: 0, meResolved: false };
    }

    const identityId = userIdentity.identityId;

    const [photos, total] = await Promise.all([
      this.prisma.photo.findMany({
        where: {
          eventId,
          processingStatus: PhotoProcessingStatus.COMPLETED,
          /*
           * Photo must contain at least one DetectedFace belonging
           * to the user's identity cluster.
           */
          detectedFaces: {
            some: { identityId },
          },
          ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
        },
        orderBy: { createdAt: "desc" },
        take:    limit + 1,
        include: { _count: { select: { detectedFaces: true } } },
      }),

      this.prisma.photo.count({
        where: {
          eventId,
          processingStatus: PhotoProcessingStatus.COMPLETED,
          detectedFaces: { some: { identityId } },
        },
      }),
    ]);

    const hasNextPage = photos.length > limit;
    const page        = photos.slice(0, limit);

    const items = await Promise.all(
      page.map(async (photo) => ({
        photoId:          photo.id,
        url:              await this.storage.getSignedUrl(photo.storageKey, { expiresInSeconds: 3600 }),
        processingStatus: photo.processingStatus,
        faceCount:        photo._count.detectedFaces,
        createdAt:        photo.createdAt.toISOString(),
      })),
    );

    return {
      photos:     items,
      nextCursor: hasNextPage ? page[page.length - 1]!.createdAt.toISOString() : null,
      total,
      meResolved: true,
    };
  }
}
