# 04 — Database Schema Design (Prisma / SQLite)

Draft data model for the MVP. This is the design reference — the actual
`backend/prisma/schema.prisma` is generated from this during scaffold.

> SQLite notes: no native enums (use string + app-level validation or Prisma enums
> which Prisma maps to TEXT), no native arrays (use JSON string or relation tables),
> `DateTime` stored as TEXT/INTEGER. Enable WAL mode at runtime.

## Entity overview

```
User ─┐
      ├─< AuditLog
Patient ─┬─< MedicalHistory (1:1)
         ├─< Appointment >─ User(dentist)
         ├─< ToothRecord (dental chart)
         ├─< PerioRecord
         ├─< TreatmentPlan ─< TreatmentItem >─ Procedure
         ├─< ClinicalNote
         ├─< Prescription ─< PrescriptionItem >─ Drug
         └─< Invoice ─< InvoiceItem >─ Procedure
                     └─< Payment
ClinicSettings (singleton)
```

## Models (draft)

### Auth & users
```
model User {
  id          String   @id @default(cuid())
  username    String   @unique
  passwordHash String
  fullName    String
  role        Role     // ADMIN | DENTIST | RECEPTIONIST | ASSISTANT
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  appointments Appointment[]
  auditLogs   AuditLog[]
}

enum Role { ADMIN DENTIST RECEPTIONIST ASSISTANT }
```

### Patient
```
model Patient {
  id            String   @id @default(cuid())
  code          String   @unique          // human-readable patient ID e.g. P-00123
  fullName      String
  photoPath     String?
  dateOfBirth   DateTime?
  gender        String?                    // MALE | FEMALE | OTHER
  phone         String?
  email         String?
  address       String?
  emergencyName String?
  emergencyPhone String?
  guardianName  String?                    // for minors
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  medicalHistory MedicalHistory?
  appointments   Appointment[]
  toothRecords   ToothRecord[]
  perioRecords   PerioRecord[]
  treatmentPlans TreatmentPlan[]
  clinicalNotes  ClinicalNote[]
  prescriptions  Prescription[]
  invoices       Invoice[]
  files          PatientFile[]
}

model MedicalHistory {
  id          String  @id @default(cuid())
  patientId   String  @unique
  patient     Patient @relation(fields: [patientId], references: [id])
  allergies   String?            // JSON array or comma list
  medications String?
  conditions  String?            // diabetes, hypertension, cardiac, bleeding...
  isPregnant  Boolean @default(false)
  premedRequired Boolean @default(false)
  notes       String?
  updatedAt   DateTime @updatedAt
}
```

### Appointment
```
model Appointment {
  id         String   @id @default(cuid())
  patientId  String
  patient    Patient  @relation(fields: [patientId], references: [id])
  dentistId  String?
  dentist    User?    @relation(fields: [dentistId], references: [id])
  chair      String?              // operatory / chair label
  startTime  DateTime
  endTime    DateTime
  status     String   @default("BOOKED") // BOOKED CONFIRMED ARRIVED IN_CHAIR COMPLETED NO_SHOW CANCELLED
  reason     String?
  notes      String?
  createdAt  DateTime @default(now())
}
```

### Dental charting
```
model ToothRecord {
  id         String   @id @default(cuid())
  patientId  String
  patient    Patient  @relation(fields: [patientId], references: [id])
  toothNumber String              // FDI notation, e.g. "11", "48", primary "55"
  surface    String?              // M | D | O | B | L (null = whole tooth)
  condition  String               // CARIES MISSING FILLED CROWN BRIDGE IMPLANT RCT EXTRACTED HEALTHY ...
  status     String   @default("EXISTING") // EXISTING | PLANNED | COMPLETED
  note       String?
  recordedAt DateTime @default(now())
  recordedBy String?              // userId
}

model PerioRecord {
  id          String  @id @default(cuid())
  patientId   String
  patient     Patient @relation(fields: [patientId], references: [id])
  toothNumber String
  pocketDepth String?             // JSON: 6 points {mb,b,db,ml,l,dl}
  bleeding    String?             // JSON: which points bled
  recession   String?
  mobility    Int?                // 0-3
  furcation   Int?                // 0-3
  recordedAt  DateTime @default(now())
}
```

### Treatment & procedures
```
model Procedure {
  id        String  @id @default(cuid())
  code      String  @unique       // ADA CDT or custom
  name      String
  category  String?
  defaultFee Float  @default(0)
  isActive  Boolean @default(true)
}

model TreatmentPlan {
  id        String   @id @default(cuid())
  patientId String
  patient   Patient  @relation(fields: [patientId], references: [id])
  title     String?
  status    String   @default("PROPOSED") // PROPOSED | ACCEPTED | IN_PROGRESS | COMPLETED
  createdAt DateTime @default(now())
  items     TreatmentItem[]
}

model TreatmentItem {
  id          String  @id @default(cuid())
  planId      String
  plan        TreatmentPlan @relation(fields: [planId], references: [id])
  procedureId String
  procedure   Procedure @relation(fields: [procedureId], references: [id])
  toothNumber String?
  priority    Int     @default(0)
  status      String  @default("PLANNED") // PLANNED | COMPLETED
  fee         Float
  completedAt DateTime?
}

model ClinicalNote {
  id         String   @id @default(cuid())
  patientId  String
  patient    Patient  @relation(fields: [patientId], references: [id])
  content    String
  authorId   String?
  createdAt  DateTime @default(now())
}
```

### Prescription & drugs
```
model Drug {
  id        String  @id @default(cuid())
  name      String                // brand
  generic   String?
  category  String?               // antibiotic, analgesic, antiseptic...
  form      String?               // tablet, capsule, syrup, gel
  strength  String?               // 500mg
  isActive  Boolean @default(true)
}

model Prescription {
  id         String   @id @default(cuid())
  patientId  String
  patient    Patient  @relation(fields: [patientId], references: [id])
  dentistId  String?
  diagnosis  String?
  advice     String?
  createdAt  DateTime @default(now())
  items      PrescriptionItem[]
}

model PrescriptionItem {
  id             String @id @default(cuid())
  prescriptionId String
  prescription   Prescription @relation(fields: [prescriptionId], references: [id])
  drugId         String?
  drug           Drug?  @relation(fields: [drugId], references: [id])
  drugName       String              // snapshot (in case drug edited later)
  dosage         String              // e.g. "1+0+1"
  frequency      String?
  duration       String?             // "7 days"
  route          String?             // oral, topical
  instruction    String?             // after meal...
}
```

### Billing
```
model Invoice {
  id         String   @id @default(cuid())
  number     String   @unique
  patientId  String
  patient    Patient  @relation(fields: [patientId], references: [id])
  subtotal   Float    @default(0)
  discount   Float    @default(0)
  total      Float    @default(0)
  status     String   @default("UNPAID") // UNPAID | PARTIAL | PAID
  createdAt  DateTime @default(now())
  items      InvoiceItem[]
  payments   Payment[]
}

model InvoiceItem {
  id          String @id @default(cuid())
  invoiceId   String
  invoice     Invoice @relation(fields: [invoiceId], references: [id])
  procedureId String?
  procedure   Procedure? @relation(fields: [procedureId], references: [id])
  description String
  toothNumber String?
  qty         Int    @default(1)
  unitPrice   Float
  amount      Float
}

model Payment {
  id        String   @id @default(cuid())
  invoiceId String
  invoice   Invoice  @relation(fields: [invoiceId], references: [id])
  amount    Float
  method    String   // CASH | CARD | BKASH | NAGAD | OTHER
  paidAt    DateTime @default(now())
  receivedBy String?
  note      String?
}
```

### Imaging & documents
```
model PatientFile {
  id          String   @id @default(cuid())
  patientId   String
  patient     Patient  @relation(fields: [patientId], references: [id])
  filePath    String              // local stored path (server PC disk)
  fileName    String              // original name
  mimeType    String              // image/jpeg, image/png, application/pdf
  fileType    String   @default("IMAGE") // IMAGE | DOCUMENT
  category    String?             // INTRAORAL | OPG | PERIAPICAL | BITEWING | PHOTO | LAB_REPORT | CONSENT | OTHER
  toothNumber String?             // optional link to a tooth
  appointmentId String?           // optional link to a visit
  caption     String?
  takenAt     DateTime?           // date the x-ray/photo was taken
  uploadedAt  DateTime @default(now())
  uploadedBy  String?
}
```
> Files stored on the server PC disk (e.g. `backend/uploads/patients/<id>/`); only the
> path is in the DB. Backup must include the uploads folder alongside the `.db` file.
> Design is source-agnostic — a future digital-sensor capture just produces a file +
> a `PatientFile` row, so no schema change needed for P2.

### System
```
model ClinicSettings {
  id        String @id @default("clinic")  // singleton row
  name      String
  address   String?
  phone     String?
  logoPath  String?
  letterhead String?            // header text/html for prints
  toothNotation String @default("FDI") // FDI | UNIVERSAL | PALMER
  currency  String @default("BDT")
}

model AuditLog {
  id        String   @id @default(cuid())
  userId    String?
  user      User?    @relation(fields: [userId], references: [id])
  action    String   // CREATE | UPDATE | DELETE
  entity    String   // table name
  entityId  String?
  detail    String?  // JSON diff
  createdAt DateTime @default(now())
}
```

## Notes
- Add `@@index` on foreign keys + frequently searched columns (Patient.code, phone, name).
- Store dosage/pocket-depth multi-value fields as JSON strings (SQLite has no arrays).
- Money as `Float` for MVP; consider integer cents/paisa if rounding becomes an issue.
- Seed: default ADMIN user, a starter Procedure catalog, a common-dental-drug Drug list.
