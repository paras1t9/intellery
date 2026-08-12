import { Client } from "minio";

import { StorageService } from "./StorageService.js";
import {
  SignedUrlOptions,
  UploadRequest,
  UploadResult,
} from "./types.js";

export class MinioStorageService implements StorageService {
  constructor(
    private readonly client: Client,
    private readonly bucket: string
  ) {}

  async upload(
    request: UploadRequest
  ): Promise<UploadResult> {
    const result = await this.client.putObject(
      this.bucket,
      request.key,
      request.stream,
      request.size,
      {
        "Content-Type": request.contentType,
        ...request.metadata,
      }
    );

    return {
      key: request.key,
      etag: result.etag,
    };
  }

  async delete(key: string): Promise<void> {
    await this.client.removeObject(
      this.bucket,
      key
    );
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.statObject(
        this.bucket,
        key
      );

      return true;
    } catch {
      return false;
    }
  }

  async getObject(key: string): Promise<Buffer> {
    const stream =
      await this.client.getObject(
        this.bucket,
        key
      );

    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
      chunks.push(
        Buffer.isBuffer(chunk)
          ? chunk
          : Buffer.from(chunk)
      );
    }

    return Buffer.concat(chunks);
  }

  async getSignedUrl(
    key: string,
    options?: SignedUrlOptions
  ): Promise<string> {
    return this.client.presignedGetObject(
      this.bucket,
      key,
      options?.expiresInSeconds ?? 60 * 60
    );
  }
}