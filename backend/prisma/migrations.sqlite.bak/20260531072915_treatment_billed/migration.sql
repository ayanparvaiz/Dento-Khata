-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TreatmentItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,
    "toothNumber" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "fee" REAL NOT NULL,
    "completedAt" DATETIME,
    "billed" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "TreatmentItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TreatmentPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TreatmentItem_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_TreatmentItem" ("completedAt", "fee", "id", "planId", "priority", "procedureId", "status", "toothNumber") SELECT "completedAt", "fee", "id", "planId", "priority", "procedureId", "status", "toothNumber" FROM "TreatmentItem";
DROP TABLE "TreatmentItem";
ALTER TABLE "new_TreatmentItem" RENAME TO "TreatmentItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
