import { UploadFile } from "./UploadFile.js";
export interface UploadFilesRequest {
  files: UploadFile[];
  eventId: string;
  uploadedBy: string;
}