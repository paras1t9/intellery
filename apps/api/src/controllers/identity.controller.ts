import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { identityManagementService } from "../composition/index.js";
import { IdentityParams, NameIdentityDto } from "../schemas/identity.schema.js";

export async function listIdentities(req: Request, res: Response) {
  const userId      = req.user.id;
  const { eventId } = req.params as unknown as Pick<IdentityParams, "eventId">;

  const identities = await identityManagementService.listIdentities(userId, eventId);

  res.status(StatusCodes.OK).json({ success: true, data: { identities } });
}

export async function nameIdentity(req: Request, res: Response) {
  const userId                    = req.user.id;
  const { eventId, identityId }   = req.params as unknown as IdentityParams;
  const { displayName }           = req.body as NameIdentityDto;

  const updated = await identityManagementService.nameIdentity(
    userId,
    eventId,
    identityId,
    displayName,
  );

  res.status(StatusCodes.OK).json({ success: true, data: updated });
}
