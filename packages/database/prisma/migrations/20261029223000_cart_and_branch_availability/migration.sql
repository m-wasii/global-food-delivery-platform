-- CreateTable
CREATE TABLE "UserRestaurantPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "favoredBranchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRestaurantPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchMenuItemAvailability" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchMenuItemAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cart" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "selectedBranchId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserRestaurantPreference_restaurantId_idx" ON "UserRestaurantPreference"("restaurantId");

-- CreateIndex
CREATE INDEX "UserRestaurantPreference_favoredBranchId_idx" ON "UserRestaurantPreference"("favoredBranchId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRestaurantPreference_userId_restaurantId_key" ON "UserRestaurantPreference"("userId", "restaurantId");

-- CreateIndex
CREATE INDEX "BranchMenuItemAvailability_branchId_idx" ON "BranchMenuItemAvailability"("branchId");

-- CreateIndex
CREATE INDEX "BranchMenuItemAvailability_menuItemId_idx" ON "BranchMenuItemAvailability"("menuItemId");

-- CreateIndex
CREATE UNIQUE INDEX "BranchMenuItemAvailability_branchId_menuItemId_key" ON "BranchMenuItemAvailability"("branchId", "menuItemId");

-- CreateIndex
CREATE INDEX "Cart_userId_idx" ON "Cart"("userId");

-- CreateIndex
CREATE INDEX "Cart_restaurantId_idx" ON "Cart"("restaurantId");

-- CreateIndex
CREATE INDEX "Cart_selectedBranchId_idx" ON "Cart"("selectedBranchId");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_userId_restaurantId_key" ON "Cart"("userId", "restaurantId");

-- CreateIndex
CREATE INDEX "CartItem_cartId_idx" ON "CartItem"("cartId");

-- CreateIndex
CREATE INDEX "CartItem_menuItemId_idx" ON "CartItem"("menuItemId");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_cartId_menuItemId_key" ON "CartItem"("cartId", "menuItemId");

-- AddForeignKey
ALTER TABLE "UserRestaurantPreference" ADD CONSTRAINT "UserRestaurantPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRestaurantPreference" ADD CONSTRAINT "UserRestaurantPreference_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRestaurantPreference" ADD CONSTRAINT "UserRestaurantPreference_favoredBranchId_fkey" FOREIGN KEY ("favoredBranchId") REFERENCES "RestaurantBranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchMenuItemAvailability" ADD CONSTRAINT "BranchMenuItemAvailability_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "RestaurantBranch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchMenuItemAvailability" ADD CONSTRAINT "BranchMenuItemAvailability_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_selectedBranchId_fkey" FOREIGN KEY ("selectedBranchId") REFERENCES "RestaurantBranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
