import { Request, Response } from "express";

import { UploadService } from "../services/UploadService.js";
import { UploadFilesRequest } from "../dto/upload/UploadFilesRequest.js";

export class UploadController {
  constructor(
    private readonly uploadService: UploadService
  ) {}

  private toUploadRequest(req: Request): UploadFilesRequest {
    const files = req.files as Express.Multer.File[];
    return {
        eventId: req.params.eventId as string,
        uploadedBy: req.user.id,
        files: files.map(file => ({
            filename: file.originalname,
            contentType: file.mimetype,
            size: file.size,
            path: file.path,
        })),
    };
  } 

  upload = async (req: Request, res: Response): Promise<void> => {
    const response = await this.uploadService.upload(
        this.toUploadRequest(req)
    );

    res.status(201).json(response);
  } 
}