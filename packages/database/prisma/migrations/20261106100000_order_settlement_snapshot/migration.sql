-- EAT-49: auditable marketplace settlement on every order
ALTER TABLE "Order" ADD COLUMN "commissionBaseCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "commissionRateBps" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "commissionCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "restaurantNetCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "platformRevenueCents" INTEGER NOT NULL DEFAULT 0;
