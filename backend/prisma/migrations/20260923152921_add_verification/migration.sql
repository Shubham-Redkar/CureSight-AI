-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verifiedResult" JSONB;
