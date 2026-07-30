import { PrismaClient, Upload, UploadStatus, Photo } from "../../generated/prisma/client.js";
import { createReadStream } from "node:fs";
import { StorageService } from "../storage/StorageService.js";
import { UploadFilesRequest } from "../dto/upload/UploadFilesRequest.js";
import { UploadFilesResponse } from "../dto/upload/UploadFilesResponse.js";
import { UploadFile } from "../dto/upload/UploadFile.js";
import { generateObjectKey } from "../utils/objectKey.js";

export class UploadService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: StorageService
  ) {}

  async upload(
    request: UploadFilesRequest
  ): Promise<UploadFilesResponse> {
    const upload = await this.createUpload(request);

    for (const file of request.files) {
      try {
        await this.processPhoto(
          upload.id,
          request.eventId,
          request.uploadedBy,
          file
        );

        await this.incrementUploadedFiles(upload.id);
      } catch (error) {
        console.error(
          `Failed to process file: ${file.filename}`,
          error
        );

        await this.incrementFailedFiles(upload.id);
      }
    }
    const updatedUpload = await this.prisma.upload.findUniqueOrThrow({
      where: {
        id: upload.id,
      },
    });

    const finalStatus = 
      updatedUpload.failedFiles === 0
    ? UploadStatus.PROCESSING
    : UploadStatus.FAILED;


    await this.updateStatus(upload.id, finalStatus);

    return {
      uploadId: updatedUpload.id,
      totalFiles: updatedUpload.totalFiles,
      uploadedFiles: updatedUpload.uploadedFiles,
      failedFiles: updatedUpload.failedFiles,
      status: finalStatus
    };
  }

  private async createUpload(
    request: UploadFilesRequest
  ): Promise<Upload> {
    return this.prisma.upload.create({
      data: {
        eventId: request.eventId,
        uploaderId: request.uploadedBy,
        status: UploadStatus.UPLOADING,
        totalFiles: request.files.length,
      },
    });
  }

  private async processPhoto(
    uploadId: string,
    eventId: string,
    uploaderId: string,
    file: UploadFile
  ): Promise<void> {
    const storageKey = generateObjectKey(
      eventId,
      file.filename
    );

    const stream = createReadStream(file.path);

    await this.storage.upload({
      key: storageKey,
      stream: createReadStream(file.path),
      size: file.size,
      contentType: file.contentType,
    });

    try {
      await this.createPhoto(
        uploadId,
        eventId,
        uploaderId,
        file,
        storageKey
      );
    } catch (error) {
      try {
        await this.storage.delete(storageKey);
      } catch (cleanupError) {
        console.error(
          "Failed to cleanup uploaded object:",
          cleanupError
        );
      }

      throw error;
    }
  }

  private async createPhoto(
    uploadId: string,
    eventId: string,
    uploaderId: string,
    file: UploadFile,
    storageKey: string
  ): Promise<Photo> {
    return this.prisma.photo.create({
      data: {
        uploadId,
        eventId,
        uploaderId,
        originalName: file.filename,
        storageKey,
        mimeType: file.contentType,
        size: file.size,
      },
    });
  }

  private async incrementUploadedFiles(
    uploadId: string
  ): Promise<void> {
    await this.prisma.upload.update({
      where: {
        id: uploadId,
      },
      data: {
        uploadedFiles: {
          increment: 1,
        },
      },
    });
  }

  private async incrementFailedFiles(
    uploadId: string
  ): Promise<void> {
    await this.prisma.upload.update({
      where: {
        id: uploadId,
      },
      data: {
        failedFiles: {
          increment: 1,
        },
      },
    });
  }

  private async updateStatus(
    uploadId: string,
    status: UploadStatus
  ): Promise<void> {
    await this.prisma.upload.update({
      where: {
        id: uploadId,
      },
      data: {
        status,
      },
    });
  }
}