import { Readable } from "stream";

export interface UploadFile {
  filename: string;
  contentType: string;
  size: number;
  path: string;
}