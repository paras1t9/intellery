-- CreateEnum
CREATE TYPE "StorageProvider" AS ENUM ('MINIO', 'S3');

-- AlterTable
ALTER TABLE "Photo" ADD COLUMN     "storageProvider" "StorageProvider" NOT NULL DEFAULT 'MINIO';
