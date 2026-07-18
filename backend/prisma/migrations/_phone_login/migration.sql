-- DropIndex
DROP INDEX "User_tenantId_username_key";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phone" TEXT NOT NULL,
ALTER COLUMN "username" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

