-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "MenuItem_menuCategoryId_sortOrder_idx" ON "MenuItem"("menuCategoryId", "sortOrder");
