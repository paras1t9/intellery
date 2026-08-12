import {
  SignedUrlOptions,
  UploadRequest,
  UploadResult,
} from "./types.js";

export interface StorageService {
  upload(request: UploadRequest): Promise<UploadResult>;

  delete(key: string): Promise<void>;

  exists(key: string): Promise<boolean>;

  getObject(key: string): Promise<Buffer>;

  getSignedUrl(
    key: string,
    options?: SignedUrlOptions
  ): Promise<string>;
}