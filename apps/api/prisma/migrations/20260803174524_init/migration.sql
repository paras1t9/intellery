CREATE EXTENSION IF NOT EXISTS vector;
-- CreateEnum
CREATE TYPE "EventRole" AS ENUM ('ADMIN', 'CONTRIBUTOR', 'VIEWER');
-- CreateEnum
CREATE TYPE "StorageProvider" AS ENUM ('MINIO', 'S3');
-- CreateEnum
CREATE TYPE "PhotoProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
-- CreateEnum
CREATE TYPE "EmbeddingModel" AS ENUM ('ARCFACE');
-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM (
    'PENDING',
    'UPLOADING',
    'PROCESSING',
    'COMPLETED',
    'FAILED'
);
-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "profilePicture" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "Event" (
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "iconURL" TEXT,
    "eventCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Event_pkey" PRIMARY KEY ("eventId")
);
-- CreateTable
CREATE TABLE "EventMember" (
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "role" "EventRole" NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventMember_pkey" PRIMARY KEY ("userId", "eventId")
);
-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageProvider" "StorageProvider" NOT NULL DEFAULT 'MINIO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "processingStatus" "PhotoProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "processingStartedAt" TIMESTAMP(3),
    "processingCompletedAt" TIMESTAMP(3),
    "processingError" TEXT,
    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "DetectedFace" (
    "id" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "boundingBoxX" DOUBLE PRECISION NOT NULL,
    "boundingBoxY" DOUBLE PRECISION NOT NULL,
    "boundingBoxW" DOUBLE PRECISION NOT NULL,
    "boundingBoxH" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "leftEyeX" DOUBLE PRECISION NOT NULL,
    "leftEyeY" DOUBLE PRECISION NOT NULL,
    "rightEyeX" DOUBLE PRECISION NOT NULL,
    "rightEyeY" DOUBLE PRECISION NOT NULL,
    "noseX" DOUBLE PRECISION NOT NULL,
    "noseY" DOUBLE PRECISION NOT NULL,
    "leftMouthX" DOUBLE PRECISION NOT NULL,
    "leftMouthY" DOUBLE PRECISION NOT NULL,
    "rightMouthX" DOUBLE PRECISION NOT NULL,
    "rightMouthY" DOUBLE PRECISION NOT NULL,
    "identityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DetectedFace_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "FaceVector" (
    "id" TEXT NOT NULL,
    "detectedFaceId" TEXT NOT NULL,
    "vector" vector(512) NOT NULL,
    "model" "EmbeddingModel" NOT NULL,
    "embeddingVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FaceVector_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "Upload" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "status" "UploadStatus" NOT NULL DEFAULT 'PENDING',
    "totalFiles" INTEGER NOT NULL,
    "uploadedFiles" INTEGER NOT NULL DEFAULT 0,
    "failedFiles" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "PhotoAnnotation" (
    "id" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PhotoAnnotation_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "Identity" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "displayName" TEXT,
    "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Identity_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
-- CreateIndex
CREATE UNIQUE INDEX "Event_eventCode_key" ON "Event"("eventCode");
-- CreateIndex
CREATE INDEX "EventMember_eventId_idx" ON "EventMember"("eventId");
-- CreateIndex
CREATE INDEX "Photo_uploadId_idx" ON "Photo"("uploadId");
-- CreateIndex
CREATE INDEX "Photo_eventId_idx" ON "Photo"("eventId");
-- CreateIndex
CREATE INDEX "Photo_uploaderId_idx" ON "Photo"("uploaderId");
-- CreateIndex
CREATE INDEX "DetectedFace_photoId_idx" ON "DetectedFace"("photoId");
-- CreateIndex
CREATE INDEX "DetectedFace_identityId_idx" ON "DetectedFace"("identityId");
-- CreateIndex
CREATE UNIQUE INDEX "FaceVector_detectedFaceId_key" ON "FaceVector"("detectedFaceId");
-- CreateIndex
CREATE INDEX "FaceVector_model_idx" ON "FaceVector"("model");
-- CreateIndex
CREATE INDEX "FaceVector_embeddingVersion_idx" ON "FaceVector"("embeddingVersion");
-- CreateIndex
CREATE INDEX "Upload_eventId_idx" ON "Upload"("eventId");
-- CreateIndex
CREATE INDEX "Upload_uploaderId_idx" ON "Upload"("uploaderId");
-- CreateIndex
CREATE UNIQUE INDEX "PhotoAnnotation_photoId_key" ON "PhotoAnnotation"("photoId");
-- CreateIndex
CREATE INDEX "PhotoAnnotation_photoId_idx" ON "PhotoAnnotation"("photoId");
-- CreateIndex
CREATE INDEX "Identity_eventId_idx" ON "Identity"("eventId");
-- AddForeignKey
ALTER TABLE "EventMember"
ADD CONSTRAINT "EventMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "EventMember"
ADD CONSTRAINT "EventMember_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("eventId") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Photo"
ADD CONSTRAINT "Photo_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Photo"
ADD CONSTRAINT "Photo_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("eventId") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Photo"
ADD CONSTRAINT "Photo_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "DetectedFace"
ADD CONSTRAINT "DetectedFace_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "DetectedFace"
ADD CONSTRAINT "DetectedFace_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE
SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "FaceVector"
ADD CONSTRAINT "FaceVector_detectedFaceId_fkey" FOREIGN KEY ("detectedFaceId") REFERENCES "DetectedFace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Upload"
ADD CONSTRAINT "Upload_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("eventId") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Upload"
ADD CONSTRAINT "Upload_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "PhotoAnnotation"
ADD CONSTRAINT "PhotoAnnotation_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Identity"
ADD CONSTRAINT "Identity_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("eventId") ON DELETE CASCADE ON UPDATE CASCADE;