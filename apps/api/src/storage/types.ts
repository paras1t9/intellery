import { Readable } from "node:stream";

export interface UploadRequest {
  key: string;
  stream: Readable;
  size: number;
  contentType: string;
  metadata?: Record<string, string>;
}

export interface UploadResult {
  key: string;
  etag: string;
}

export interface SignedUrlOptions {
  expiresInSeconds?: number;
  responseHeaders?: Record<string, string>;
}