-- AlterTable
ALTER TABLE "RestaurantBranch" ADD COLUMN     "temporarilyClosed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'UTC';

-- CreateTable
CREATE TABLE "BranchWeeklyHours" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "openTimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "closeTimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchWeeklyHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchAvailabilityException" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT true,
    "openTimeMinutes" INTEGER,
    "closeTimeMinutes" INTEGER,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchAvailabilityException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BranchWeeklyHours_branchId_idx" ON "BranchWeeklyHours"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "BranchWeeklyHours_branchId_dayOfWeek_key" ON "BranchWeeklyHours"("branchId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "BranchAvailabilityException_branchId_idx" ON "BranchAvailabilityException"("branchId");

-- CreateIndex
CREATE INDEX "BranchAvailabilityException_branchId_startDate_endDate_idx" ON "BranchAvailabilityException"("branchId", "startDate", "endDate");

-- AddForeignKey
ALTER TABLE "BranchWeeklyHours" ADD CONSTRAINT "BranchWeeklyHours_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "RestaurantBranch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchAvailabilityException" ADD CONSTRAINT "BranchAvailabilityException_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "RestaurantBranch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
