-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "purchaseTrackedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "fbc" TEXT,
ADD COLUMN     "fbp" TEXT,
ADD COLUMN     "signupUa" TEXT;

