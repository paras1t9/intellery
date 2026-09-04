import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { photoService } from "../composition/index.js";
import { PhotoGalleryParams, PhotoGalleryQuery } from "../schemas/photo.schema.js";

export async function getGallery(req: Request, res: Response) {
  const userId   = req.user.id;
  const { eventId } = req.params  as unknown as PhotoGalleryParams;
  const { cursor, limit } = req.query as unknown as PhotoGalleryQuery;

  const page = await photoService.getGallery(userId, eventId, cursor, limit);

  res.status(StatusCodes.OK).json({ success: true, data: page });
}

export async function getMyPhotos(req: Request, res: Response) {
  const userId   = req.user.id;
  const { eventId } = req.params as unknown as PhotoGalleryParams;
  const { cursor, limit } = req.query as unknown as PhotoGalleryQuery;

  const page = await photoService.getMyPhotos(userId, eventId, cursor, limit);

  res.status(StatusCodes.OK).json({ success: true, data: page });
}
