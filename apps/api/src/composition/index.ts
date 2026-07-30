import prisma from "../infrastructure/prisma.js";
import { storageConfig } from "../config/storage.js";
import { minioClient } from "../infrastructure/storage/minioClient.js";

import { MinioStorageService } from "../storage/MinioStorageService.js";
import { UploadService } from "../services/UploadService.js";
import { UploadController } from "../controllers/uploadController.js";

export const storageService = new MinioStorageService(
  minioClient,
  storageConfig.bucket
);

export const uploadService = new UploadService(
  prisma,
  storageService
);

export const uploadController = new UploadController(
  uploadService
);