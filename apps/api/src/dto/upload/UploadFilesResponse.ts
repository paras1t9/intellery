import { UploadStatus } from "../../../generated/prisma/enums.js";

export interface UploadFilesResponse {
  uploadId: string;
  totalFiles: number;
  uploadedFiles: number;
  failedFiles: number;
  status: UploadStatus;
}