# 03 — Feature List (Implementation Checklist)

International-standard dental practice management features. Organized by module.
`[MVP]` = build first. `[P2]` = phase 2 / future. Check off as implemented.

---

## 1. Patient Management `[MVP]`
- [ ] Patient registration — name, photo, DOB, gender, phone, email, address
- [ ] Emergency contact / guardian (for minors)
- [ ] Unique patient ID (auto-generated)
- [ ] Search — by name, phone, patient ID, DOB
- [ ] Medical history — allergies, current medications, conditions (diabetes, hypertension, cardiac, bleeding disorders), pregnancy flag
- [ ] Alert flags — allergy popup, premedication required, outstanding balance warning
- [ ] Patient status — active / inactive
- [ ] Family / household linking `[P2]`
- [ ] Referral source tracking `[P2]`
- [ ] Patient self-registration / portal `[P2]`

## 2. Appointment & Scheduling `[MVP-light]`
- [ ] Calendar view — day / week / month
- [ ] Multi-chair / operatory columns (2+ chairs)
- [ ] Book / reschedule (drag-drop) / cancel
- [ ] Status with color coding — booked, confirmed, arrived, in-chair, completed, no-show
- [ ] Provider (dentist) assignment
- [ ] Double-booking warning
- [ ] Recall / recurring appointments (6-month checkup) `[P2]`
- [ ] Reminder (SMS/WhatsApp) — `[P2]`, but offline = local print/manual; needs gateway if ever online
- [ ] Waitlist `[P2]`

## 3. Dental Charting `[MVP]` (core dental feature)
- [ ] Odontogram — adult (32 teeth) + child/primary (20 teeth) views
- [ ] Tooth numbering toggle — FDI / Universal / Palmer
- [ ] Per-tooth condition marking — caries, missing, filled, crown, bridge, implant, RCT, extraction
- [ ] Per-surface marking — mesial, distal, occlusal, buccal/facial, lingual/palatal
- [ ] Visual color codes (existing vs planned vs completed)
- [ ] Treatment plan directly on chart (proposed → completed)
- [ ] Per-tooth history timeline
- [ ] Periodontal charting — pocket depth (6 points/tooth), bleeding on probing, recession, mobility, furcation `[MVP-basic / P2-full]`
- [ ] Chart snapshot per visit (versioned)

## 4. Treatment / Clinical Records `[MVP]`
- [ ] Treatment plan builder — phases, priority, status, cost estimate
- [ ] Procedure catalog — codes (ADA CDT or custom local), name, default fee
- [ ] Clinical notes — templated + free text, per visit
- [ ] Progress / completed-treatment log
- [ ] Consent forms — digital signature `[P2]`
- [ ] Treatment cost estimate sheet (printable)

## 5. Prescription & Medicine `[MVP]`
- [ ] Drug database — name, generic, brand, category (searchable autocomplete)
- [ ] Common dental drug presets (amoxicillin, metronidazole, ibuprofen, paracetamol, chlorhexidine…)
- [ ] Dosage templates — dose, frequency, duration, route, instructions
- [ ] Allergy check — warn if drug conflicts with patient's recorded allergies
- [ ] Drug–drug interaction check `[P2]`
- [ ] Favorite / quick prescriptions per dentist
- [ ] Prescription print — clinic letterhead, patient info, Rx, dosage, signature
- [ ] Prescription history per patient
- [ ] Local (Bangladesh) brand formulary seed `[P2]`

## 6. Imaging / X-ray & Documents `[MVP-basic]`
- [ ] Upload image/document files per patient (jpg/png/pdf) — `[MVP]`
- [ ] Tag by type (intraoral, OPG, periapical, bitewing, photo, document) + optional tooth/visit — `[MVP]`
- [ ] Gallery view per patient — `[MVP]`
- [ ] Before/after side-by-side compare — `[MVP]`
- [ ] Include images in patient report/PDF — `[MVP]`
- [ ] Image annotation / markup `[P2]`
- [ ] DICOM support `[P2]`
- [ ] Digital X-ray sensor live capture (hardware SDK) `[P2]`
- [ ] Lab reports / consent docs attachment `[MVP-basic]`

## 7. Billing & Accounts `[MVP]`
- [ ] Invoice generation from procedures (auto-pull fees)
- [ ] Payment recording — full / partial / installment
- [ ] Payment methods — cash, card, mobile banking (bKash/Nagad)
- [ ] Patient ledger — charges, payments, running balance
- [ ] Outstanding dues tracking + alert
- [ ] Discounts / packages
- [ ] Receipt print
- [ ] Daily cash collection summary
- [ ] Insurance claims `[P2]` (region-dependent)

## 8. Reports & Analytics `[MVP-basic]`
- [ ] Patient report — full printable history (PDF)
- [ ] Treatment report per patient
- [ ] Daily collection report
- [ ] Revenue by procedure / by dentist `[P2]`
- [ ] Appointment stats — no-show rate, new vs returning `[P2]`
- [ ] Outstanding dues report
- [ ] Inventory report `[P2]`

## 9. Inventory / Stock `[P2]`
- [ ] Consumables catalog (gloves, anesthesia, composite, etc.)
- [ ] Stock in / out tracking
- [ ] Low-stock alerts
- [ ] Supplier + purchase orders
- [ ] Expiry tracking

## 10. Lab Management `[P2]`
- [ ] Lab work orders (crown, denture, bridge sent to lab)
- [ ] Status tracking — sent, received, fitted
- [ ] Lab vendor + cost

## 11. System / Admin `[MVP]`
- [ ] User accounts + login (JWT, bcrypt)
- [ ] Roles & permissions — admin, dentist, receptionist, assistant
- [ ] Clinic profile / settings (name, address, logo, letterhead)
- [ ] Audit log — who changed what, when `[MVP-basic]`
- [ ] Automatic daily database backup
- [ ] Manual export / backup button
- [ ] Restore from backup
- [ ] Multi-PC access over LAN (static IP, firewall)

## 12. Mobile / PWA `[MVP]`
- [ ] Responsive layout (works on phone)
- [ ] PWA manifest + service worker (installable, offline shell)
- [ ] Phone access via LAN IP
- [ ] Native Flutter mobile app `[P2]`

---

## MVP scope summary (what we build first)
1. Auth + users + roles
2. Patient management
3. Dental charting (odontogram + basic perio)
4. Treatment plan + procedures + clinical notes
5. Imaging/documents (file upload, gallery, before/after, in report)
6. Prescription + drug database
7. Billing + payments + ledger
8. Basic reports (patient full history PDF incl. images, daily collection)
9. Appointment (light)
10. Backup + clinic settings
11. PWA + responsive (mobile access)
