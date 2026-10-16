-- DropIndex
DROP INDEX "RestaurantMembership_userId_idx";

-- DropIndex
DROP INDEX "RestaurantMembership_userId_key";

-- AlterTable
ALTER TABLE "RestaurantMembership" ADD CONSTRAINT "RestaurantMembership_pkey" PRIMARY KEY ("id");
