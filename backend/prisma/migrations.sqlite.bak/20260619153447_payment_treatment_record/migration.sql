-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT,
    "appointmentId" TEXT,
    "treatmentRecordId" TEXT,
    "invoiceId" TEXT,
    "amount" REAL NOT NULL,
    "method" TEXT NOT NULL,
    "paidAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedBy" TEXT,
    "note" TEXT,
    CONSTRAINT "Payment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payment_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Payment_treatmentRecordId_fkey" FOREIGN KEY ("treatmentRecordId") REFERENCES "TreatmentRecord" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Payment" ("amount", "appointmentId", "id", "invoiceId", "method", "note", "paidAt", "patientId", "receivedBy") SELECT "amount", "appointmentId", "id", "invoiceId", "method", "note", "paidAt", "patientId", "receivedBy" FROM "Payment";
DROP TABLE "Payment";
ALTER TABLE "new_Payment" RENAME TO "Payment";
CREATE INDEX "Payment_patientId_idx" ON "Payment"("patientId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
