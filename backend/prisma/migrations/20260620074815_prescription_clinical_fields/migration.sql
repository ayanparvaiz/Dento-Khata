-- AlterTable
ALTER TABLE "PrescriptionItem" ADD COLUMN "timing" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Prescription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "dentistId" TEXT,
    "diagnosis" TEXT,
    "chiefComplaint" TEXT,
    "onExam" TEXT,
    "examGrid" TEXT,
    "investigation" TEXT,
    "notes" TEXT,
    "advice" TEXT,
    "followUp" TEXT,
    "planId" TEXT,
    "totalBill" REAL,
    "discount" REAL,
    "paidToday" REAL,
    "visitsNeeded" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Prescription_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Prescription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TreatmentPlan" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Prescription" ("advice", "createdAt", "dentistId", "diagnosis", "id", "patientId") SELECT "advice", "createdAt", "dentistId", "diagnosis", "id", "patientId" FROM "Prescription";
DROP TABLE "Prescription";
ALTER TABLE "new_Prescription" RENAME TO "Prescription";
CREATE INDEX "Prescription_patientId_idx" ON "Prescription"("patientId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
