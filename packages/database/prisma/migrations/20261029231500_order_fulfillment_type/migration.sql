-- CreateEnum
CREATE TYPE "FulfillmentType" AS ENUM ('DELIVERY', 'PICKUP');

-- AlterTable: add fulfillment, allow null delivery address for pickup
ALTER TABLE "Order" ADD COLUMN "fulfillmentType" "FulfillmentType" NOT NULL DEFAULT 'DELIVERY';

ALTER TABLE "Order" ALTER COLUMN "deliveryAddressId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Order_deliveryAddressId_idx" ON "Order"("deliveryAddressId");
