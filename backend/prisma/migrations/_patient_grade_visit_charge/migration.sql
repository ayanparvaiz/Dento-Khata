-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "behaviourGrade" TEXT;

-- AlterTable
ALTER TABLE "TreatmentRecord" ADD COLUMN     "amount" DOUBLE PRECISION NOT NULL DEFAULT 0;

