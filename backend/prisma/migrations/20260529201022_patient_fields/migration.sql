-- AlterTable
ALTER TABLE "MedicalHistory" ADD COLUMN "habits" TEXT;
ALTER TABLE "MedicalHistory" ADD COLUMN "pastDentalHistory" TEXT;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN "bloodGroup" TEXT;
ALTER TABLE "Patient" ADD COLUMN "maritalStatus" TEXT;
ALTER TABLE "Patient" ADD COLUMN "occupation" TEXT;
ALTER TABLE "Patient" ADD COLUMN "referralSource" TEXT;
