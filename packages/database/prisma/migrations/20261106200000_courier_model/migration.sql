-- CreateEnum
CREATE TYPE "CourierVehicleType" AS ENUM ('BICYCLE', 'SCOOTER', 'MOTORCYCLE', 'CAR');

-- AlterTable
ALTER TABLE "CourierProfile" ADD COLUMN     "phone" TEXT,
ADD COLUMN     "vehicleType" "CourierVehicleType",
ADD COLUMN     "vehiclePlate" TEXT,
ADD COLUMN     "licenseNumber" TEXT,
ADD COLUMN     "operatingCityId" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "activatedAt" TIMESTAMP(3),
ADD COLUMN     "reviewNotes" TEXT;

-- CreateIndex
CREATE INDEX "CourierProfile_status_idx" ON "CourierProfile"("status");

-- CreateIndex
CREATE INDEX "CourierProfile_operatingCityId_idx" ON "CourierProfile"("operatingCityId");

-- AddForeignKey
ALTER TABLE "CourierProfile" ADD CONSTRAINT "CourierProfile_operatingCityId_fkey" FOREIGN KEY ("operatingCityId") REFERENCES "OperatingCity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
