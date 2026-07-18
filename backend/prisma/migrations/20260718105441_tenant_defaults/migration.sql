-- AlterTable
ALTER TABLE "Appointment" ALTER COLUMN "tenantId" SET DEFAULT '';

-- AlterTable
ALTER TABLE "ClinicSettings" ALTER COLUMN "tenantId" SET DEFAULT '';

-- AlterTable
ALTER TABLE "ClinicalNote" ALTER COLUMN "tenantId" SET DEFAULT '';

-- AlterTable
ALTER TABLE "Invoice" ALTER COLUMN "tenantId" SET DEFAULT '';

-- AlterTable
ALTER TABLE "InvoiceItem" ALTER COLUMN "tenantId" SET DEFAULT '';

-- AlterTable
ALTER TABLE "MedicalHistory" ALTER COLUMN "tenantId" SET DEFAULT '';

-- AlterTable
ALTER TABLE "Patient" ALTER COLUMN "tenantId" SET DEFAULT '';

-- AlterTable
ALTER TABLE "PatientFile" ALTER COLUMN "tenantId" SET DEFAULT '';

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "tenantId" SET DEFAULT '';

-- AlterTable
ALTER TABLE "PerioRecord" ALTER COLUMN "tenantId" SET DEFAULT '';

-- AlterTable
ALTER TABLE "Prescription" ALTER COLUMN "tenantId" SET DEFAULT '';

-- AlterTable
ALTER TABLE "PrescriptionItem" ALTER COLUMN "tenantId" SET DEFAULT '';

-- AlterTable
ALTER TABLE "Procedure" ALTER COLUMN "tenantId" SET DEFAULT '';

-- AlterTable
ALTER TABLE "Subscription" ALTER COLUMN "tenantId" SET DEFAULT '';

-- AlterTable
ALTER TABLE "SubscriptionPayment" ALTER COLUMN "tenantId" SET DEFAULT '';

-- AlterTable
ALTER TABLE "ToothRecord" ALTER COLUMN "tenantId" SET DEFAULT '';

-- AlterTable
ALTER TABLE "TreatmentItem" ALTER COLUMN "tenantId" SET DEFAULT '';

-- AlterTable
ALTER TABLE "TreatmentPlan" ALTER COLUMN "tenantId" SET DEFAULT '';

-- AlterTable
ALTER TABLE "TreatmentRecord" ALTER COLUMN "tenantId" SET DEFAULT '';

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "tenantId" SET DEFAULT '';
