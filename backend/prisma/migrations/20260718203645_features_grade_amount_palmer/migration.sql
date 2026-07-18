-- AlterTable
ALTER TABLE "Patient" ADD COLUMN "behaviourGrade" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ClinicSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'clinic',
    "name" TEXT NOT NULL DEFAULT 'My Dental Clinic',
    "address" TEXT,
    "phone" TEXT,
    "logoPath" TEXT,
    "letterhead" TEXT,
    "headerTitle" TEXT,
    "headerSubtitle" TEXT,
    "headerExtra" TEXT,
    "footerLeft" TEXT,
    "footerRight" TEXT,
    "themeColor" TEXT,
    "toothNotation" TEXT NOT NULL DEFAULT 'PALMER',
    "currency" TEXT NOT NULL DEFAULT 'BDT'
);
INSERT INTO "new_ClinicSettings" ("address", "currency", "footerLeft", "footerRight", "headerExtra", "headerSubtitle", "headerTitle", "id", "letterhead", "logoPath", "name", "phone", "themeColor", "toothNotation") SELECT "address", "currency", "footerLeft", "footerRight", "headerExtra", "headerSubtitle", "headerTitle", "id", "letterhead", "logoPath", "name", "phone", "themeColor", "toothNotation" FROM "ClinicSettings";
DROP TABLE "ClinicSettings";
ALTER TABLE "new_ClinicSettings" RENAME TO "ClinicSettings";
CREATE TABLE "new_TreatmentRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "planId" TEXT,
    "content" TEXT NOT NULL,
    "amount" REAL NOT NULL DEFAULT 0,
    "visitDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TreatmentRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TreatmentRecord_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TreatmentPlan" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TreatmentRecord" ("authorId", "content", "createdAt", "id", "patientId", "planId", "visitDate") SELECT "authorId", "content", "createdAt", "id", "patientId", "planId", "visitDate" FROM "TreatmentRecord";
DROP TABLE "TreatmentRecord";
ALTER TABLE "new_TreatmentRecord" RENAME TO "TreatmentRecord";
CREATE INDEX "TreatmentRecord_patientId_idx" ON "TreatmentRecord"("patientId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
