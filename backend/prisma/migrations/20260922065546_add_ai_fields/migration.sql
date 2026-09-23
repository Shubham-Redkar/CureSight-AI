-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "annotatedImageKey" TEXT,
ADD COLUMN     "measurements" JSONB,
ADD COLUMN     "woundDetected" BOOLEAN;
