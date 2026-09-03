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

import { PhotoProcessingService } from "../vision/PhotoProcessingService.js";
import { IdentityService } from "../vision/identity/IdentityService.js";
import { UserFaceVectorRepository } from "../vision/recognition/UserFaceVectorRepository.js";

import { SceneEmbedder } from "../vision/scene/SceneEmbedder.js";
import { SceneVectorRepository } from "../vision/scene/SceneVectorRepository.js";
import { TextEmbedder } from "../vision/scene/TextEmbedder.js";

import { SelfieProcessingService } from "../services/SelfieProcessingService.js";
import { UserIdentityResolver } from "../vision/identity/UserIdentityResolver.js";

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

const clipVisionSession =
  await modelLoader.load(
    "./models/clip/vision_model.onnx"
  );

const clipTextSession =
  await modelLoader.load(
    "./models/clip/text_model.onnx"
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

const sceneEmbedder =
  new SceneEmbedder(clipVisionSession);

const sceneVectorRepository =
  new SceneVectorRepository();

export const textEmbedder =
  await TextEmbedder.create(
    clipTextSession,
    path.join(apiRoot, "models/clip/vocab.json"),
    path.join(apiRoot, "models/clip/merges.txt"),
  );

export const photoProcessingService =
  new PhotoProcessingService(
    prisma,
    storageService,
    imageProcessor,
    faceDetector,
    faceAligner,
    faceRecognizer,
    faceVectorRepository,
    identityService,
    sceneEmbedder,
    sceneVectorRepository,
  );

export const uploadService =
  new UploadService(
    prisma,
    storageService,
    photoQueue,
  );

const userFaceVectorRepository = new UserFaceVectorRepository();

export const selfieProcessingService =
  new SelfieProcessingService(
    prisma,
    storageService,
    imageProcessor,
    faceDetector,
    faceAligner,
    faceRecognizer,
    userFaceVectorRepository,
  );


export const userIdentityResolver =
  new UserIdentityResolver(
    prisma,
    userFaceVectorRepository,
  );

export const uploadController =
  new UploadController(
    uploadService
  );

export const photoWorker = new PhotoWorker(photoProcessingService);