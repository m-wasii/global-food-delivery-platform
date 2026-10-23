-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "storageKey" TEXT,
    "publicUrl" TEXT NOT NULL,
    "mimeType" TEXT,
    "byteSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN "coverMediaId" TEXT;

-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN "imageMediaId" TEXT;

-- Migrate legacy inline image URLs into MediaAsset rows when present.
INSERT INTO "MediaAsset" ("id", "provider", "storageKey", "publicUrl", "mimeType", "byteSize", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'external_url', NULL, "imageUrl", NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "MenuItem"
WHERE "imageUrl" IS NOT NULL;

UPDATE "MenuItem" AS mi
SET "imageMediaId" = ma."id"
FROM "MediaAsset" AS ma
WHERE mi."imageUrl" IS NOT NULL
  AND ma."publicUrl" = mi."imageUrl"
  AND ma."provider" = 'external_url'
  AND mi."imageMediaId" IS NULL;

-- AlterTable
ALTER TABLE "MenuItem" DROP COLUMN "imageUrl";

-- CreateIndex
CREATE INDEX "MediaAsset_provider_idx" ON "MediaAsset"("provider");

-- CreateIndex
CREATE INDEX "MenuItem_imageMediaId_idx" ON "MenuItem"("imageMediaId");

-- CreateIndex
CREATE INDEX "Restaurant_coverMediaId_idx" ON "Restaurant"("coverMediaId");

-- AddForeignKey
ALTER TABLE "Restaurant" ADD CONSTRAINT "Restaurant_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_imageMediaId_fkey" FOREIGN KEY ("imageMediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
