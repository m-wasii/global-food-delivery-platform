-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "cuisineTags" TEXT[] DEFAULT ARRAY[]::TEXT[];
