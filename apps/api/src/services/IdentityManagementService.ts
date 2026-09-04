import { PrismaClient } from "../../generated/prisma/client.js";
import { StorageService } from "../storage/StorageService.js";
import { AppError } from "../errors/AppError.js";
import { StatusCodes } from "http-status-codes";

export interface BoundingBox {
  x:      number;
  y:      number;
  width:  number;
  height: number;
}

export interface IdentityItem {
  identityId:              string;
  displayName:             string | null;
  isConfirmed:             boolean;
  faceCount:               number;
  /*
   * The client uses representativePhotoUrl + boundingBox to render
   * a cropped face thumbnail without any backend resizing.
   */
  representativePhotoId:   string | null;
  representativePhotoUrl:  string | null;
  boundingBox:             BoundingBox | null;
}

export class IdentityManagementService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: StorageService,
  ) {}

  private async assertMembership(userId: string, eventId: string): Promise<void> {
    const membership = await this.prisma.eventMember.findFirst({
      where: { userId, eventId },
    });
    if (!membership) {
      throw new AppError(StatusCodes.FORBIDDEN, "You are not a member of this event.");
    }
  }

  /**
   * Returns all identities in this event (named + unnamed), with a
   * representative face sample for the dropdown.
   *
   * The representative face is the detected face with the highest
   * confidence score in the identity cluster.
   */
  async listIdentities(
    userId:  string,
    eventId: string,
  ): Promise<IdentityItem[]> {
    await this.assertMembership(userId, eventId);

    const identities = await this.prisma.identity.findMany({
      where: { eventId },
      include: {
        _count: { select: { faces: true } },
        /*
         * Pick the single highest-confidence face as the representative.
         */
        faces: {
          orderBy:  { confidence: "desc" },
          take:     1,
          include:  { photo: { select: { id: true, storageKey: true } } },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return Promise.all(
      identities.map(async (identity) => {
        const rep = identity.faces[0] ?? null;

        const representativePhotoUrl = rep
          ? await this.storage.getSignedUrl(rep.photo.storageKey, { expiresInSeconds: 3600 })
          : null;

        return {
          identityId:             identity.id,
          displayName:            identity.displayName,
          isConfirmed:            identity.isConfirmed,
          faceCount:              identity._count.faces,
          representativePhotoId:  rep?.photo.id ?? null,
          representativePhotoUrl,
          boundingBox:            rep
            ? {
                x:      rep.boundingBoxX,
                y:      rep.boundingBoxY,
                width:  rep.boundingBoxW,
                height: rep.boundingBoxH,
              }
            : null,
        };
      }),
    );
  }

  /**
   * Sets or updates the display name for an identity.
   * Marks isConfirmed = true.
   * Throws 404 if the identity doesn't belong to this event.
   */
  async nameIdentity(
    userId:      string,
    eventId:     string,
    identityId:  string,
    displayName: string,
  ): Promise<IdentityItem> {
    await this.assertMembership(userId, eventId);

    const existing = await this.prisma.identity.findFirst({
      where: { id: identityId, eventId },
    });

    if (!existing) {
      throw new AppError(
        StatusCodes.NOT_FOUND,
        "Identity not found in this event.",
      );
    }

    await this.prisma.identity.update({
      where: { id: identityId },
      data:  { displayName, isConfirmed: true },
    });

    /*
     * Return the updated identity via listIdentities (single item).
     */
    const items = await this.listIdentities(userId, eventId);
    const updated = items.find((i) => i.identityId === identityId);

    if (!updated) {
      throw new AppError(StatusCodes.INTERNAL_SERVER_ERROR, "Failed to retrieve updated identity.");
    }

    return updated;
  }
}
