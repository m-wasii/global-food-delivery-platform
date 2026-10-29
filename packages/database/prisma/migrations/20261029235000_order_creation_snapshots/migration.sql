-- AlterTable: add snapshot columns (nullable first for backfill)
ALTER TABLE "Order" ADD COLUMN "restaurantName" TEXT;
ALTER TABLE "Order" ADD COLUMN "branchName" TEXT;
ALTER TABLE "Order" ADD COLUMN "deliveryLabel" TEXT;
ALTER TABLE "Order" ADD COLUMN "deliveryLine1" TEXT;
ALTER TABLE "Order" ADD COLUMN "deliveryLine2" TEXT;
ALTER TABLE "Order" ADD COLUMN "deliveryCity" TEXT;
ALTER TABLE "Order" ADD COLUMN "deliveryRegion" TEXT;
ALTER TABLE "Order" ADD COLUMN "deliveryPostalCode" TEXT;
ALTER TABLE "Order" ADD COLUMN "deliveryCountry" TEXT;
ALTER TABLE "Order" ADD COLUMN "itemsSubtotalCents" INTEGER;
ALTER TABLE "Order" ADD COLUMN "discountCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "serviceFeeCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "deliveryFeeCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "taxCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "taxRateBps" INTEGER NOT NULL DEFAULT 0;

-- Backfill names from live relations
UPDATE "Order" AS o
SET
  "restaurantName" = r."name",
  "branchName" = b."name"
FROM "RestaurantBranch" AS b
JOIN "Restaurant" AS r ON r."id" = b."restaurantId"
WHERE b."id" = o."restaurantBranchId";

-- Backfill delivery address snapshots when present
UPDATE "Order" AS o
SET
  "deliveryLabel" = a."label",
  "deliveryLine1" = a."line1",
  "deliveryLine2" = a."line2",
  "deliveryCity" = a."city",
  "deliveryRegion" = a."region",
  "deliveryPostalCode" = a."postalCode",
  "deliveryCountry" = a."country"
FROM "Address" AS a
WHERE a."id" = o."deliveryAddressId";

-- Approximate prior totals as items-only (fees were not stored)
UPDATE "Order" SET "itemsSubtotalCents" = "totalCents" WHERE "itemsSubtotalCents" IS NULL;
UPDATE "Order" SET "restaurantName" = 'Unknown restaurant' WHERE "restaurantName" IS NULL;
UPDATE "Order" SET "branchName" = 'Unknown branch' WHERE "branchName" IS NULL;

ALTER TABLE "Order" ALTER COLUMN "restaurantName" SET NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "branchName" SET NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "itemsSubtotalCents" SET NOT NULL;
