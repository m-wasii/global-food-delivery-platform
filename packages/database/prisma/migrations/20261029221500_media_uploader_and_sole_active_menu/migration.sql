-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN "uploadedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "MediaAsset_uploadedByUserId_idx" ON "MediaAsset"("uploadedByUserId");

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Ensure at most one active menu per restaurant (keep oldest active; matches public menu orderBy).
UPDATE "Menu" AS m
SET "isActive" = false
WHERE m."isActive" = true
  AND EXISTS (
    SELECT 1
    FROM "Menu" AS older
    WHERE older."restaurantId" = m."restaurantId"
      AND older."isActive" = true
      AND older."createdAt" < m."createdAt"
  );

-- CreateIndex
CREATE UNIQUE INDEX "Menu_restaurantId_active_uidx" ON "Menu" ("restaurantId") WHERE "isActive" = true;
