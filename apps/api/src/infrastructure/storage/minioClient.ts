import { Client } from "minio";
import { storageConfig } from "../../config/storage.js";

export const minioClient = new Client({
  endPoint: storageConfig.endPoint,
  port: storageConfig.port,
  useSSL: storageConfig.useSSL,
  accessKey: storageConfig.accessKey,
  secretKey: storageConfig.secretKey,
});