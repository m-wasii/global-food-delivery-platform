/*
  Warnings:

  - Added the required column `operatingCityId` to the `RestaurantBranch` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "RestaurantStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "BranchStatus" AS ENUM ('INACTIVE', 'ACTIVE');

-- AlterTable
ALTER TABLE "Address" ADD COLUMN     "latitude" DECIMAL(9,6),
ADD COLUMN     "longitude" DECIMAL(9,6);

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "status" "RestaurantStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "RestaurantBranch" ADD COLUMN     "deliveryRadiusKm" DECIMAL(6,2),
ADD COLUMN     "latitude" DECIMAL(9,6),
ADD COLUMN     "longitude" DECIMAL(9,6),
ADD COLUMN     "operatingCityId" TEXT NOT NULL,
ADD COLUMN     "status" "BranchStatus" NOT NULL DEFAULT 'INACTIVE';

-- CreateTable
CREATE TABLE "OperatingCity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperatingCity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OperatingCity_slug_key" ON "OperatingCity"("slug");

-- CreateIndex
CREATE INDEX "OperatingCity_country_isActive_idx" ON "OperatingCity"("country", "isActive");

-- CreateIndex
CREATE INDEX "Restaurant_status_idx" ON "Restaurant"("status");

-- CreateIndex
CREATE INDEX "RestaurantBranch_operatingCityId_idx" ON "RestaurantBranch"("operatingCityId");

-- CreateIndex
CREATE INDEX "RestaurantBranch_status_idx" ON "RestaurantBranch"("status");

-- CreateIndex
CREATE INDEX "RestaurantBranch_restaurantId_status_idx" ON "RestaurantBranch"("restaurantId", "status");

-- AddForeignKey
ALTER TABLE "RestaurantBranch" ADD CONSTRAINT "RestaurantBranch_operatingCityId_fkey" FOREIGN KEY ("operatingCityId") REFERENCES "OperatingCity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
