-- AlterTable
ALTER TABLE "CourierProfile" ADD COLUMN     "isOnline" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onlineChangedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "CourierProfile_isOnline_idx" ON "CourierProfile"("isOnline");
