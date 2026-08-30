import prisma from "../infrastructure/prisma.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { storageConfig } from "../config/storage.js";
import { minioClient } from "../infrastructure/storage/minioClient.js";

import { MinioStorageService } from "../storage/MinioStorageService.js";

import { UploadService } from "../services/UploadService.js";
import { UploadController } from "../controllers/uploadController.js";

import { ModelLoader } from "../infrastructure/ai/ModelLoader.js";

import { ImageProcessor } from "../vision/common/ImageProcessor.js";

import { InsightFaceDetector } from "../vision/detection/InsightFaceDetector.js";

import { FaceAligner } from "../vision/recognition/FaceAligner.js";
import { FaceRecognizer } from "../vision/recognition/FaceRecognizer.js";
import { FaceVectorRepository } from "../vision/recognition/FaceVectorRepository.js";

import { FaceProcessingService } from "../vision/FaceProcessingService.js";
import { IdentityService } from "../vision/identity/IdentityService.js";

import { PhotoWorker } from "../infrastructure/queue/PhotoWorker.js";
import { photoQueue } from "../infrastructure/queue/PhotoQueue.js";

//////////////////////
const currentFile =
  fileURLToPath(import.meta.url);

const currentDirectory =
  path.dirname(currentFile);

const apiRoot =
  path.resolve(
    currentDirectory,
    "../.."
  );

//////////////////////

export const storageService =
  new MinioStorageService(
    minioClient,
    storageConfig.bucket
  );


const modelLoader =
  new ModelLoader();

const detectionSession =
  await modelLoader.load(
    "./models/insightface/detection/scrfd_10g_bnkps.onnx"
  );

const recognitionSession =
  await modelLoader.load(
    "./models/insightface/recognition/w600k_r50.onnx"
  );

const imageProcessor =
  new ImageProcessor();

const faceDetector =
  new InsightFaceDetector(
    detectionSession
  );

const faceAligner =
  new FaceAligner();

const faceRecognizer =
  new FaceRecognizer(
    recognitionSession
  );

const faceVectorRepository =
  new FaceVectorRepository();

const identityService =
  new IdentityService(
    prisma,
    faceVectorRepository,
  );

export const faceProcessingService =
  new FaceProcessingService(
    prisma,
    storageService,
    imageProcessor,
    faceDetector,
    faceAligner,
    faceRecognizer,
    faceVectorRepository,
    identityService
  );

export const uploadService =
  new UploadService(
    prisma,
    storageService,
    photoQueue,
  );



export const uploadController =
  new UploadController(
    uploadService
  );

export const photoWorker = new PhotoWorker(faceProcessingService);