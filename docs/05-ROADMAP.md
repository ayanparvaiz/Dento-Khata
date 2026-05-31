# 05 — Implementation Roadmap

Build order. We implement **one phase at a time, in sequence** ("ake ake").
Each phase = backend (NestJS module + Prisma) + frontend (React feature) + test.

---

## Phase 0 — Scaffold & foundation
- [ ] Monorepo structure (backend / frontend / desktop / docs)
- [ ] Backend: NestJS init, Prisma + SQLite (`better-sqlite3`), WAL mode
- [ ] `schema.prisma` from [04-DATABASE-SCHEMA.md](04-DATABASE-SCHEMA.md), first migration
- [ ] Seed script: default admin, procedure catalog, common drugs
- [ ] Frontend: Vite + React + TS + Tailwind + shadcn/ui init
- [ ] API client (axios/fetch) + TanStack Query setup
- [ ] App shell — layout, sidebar nav, routing
- [ ] Backend listens on `0.0.0.0`, CORS for LAN

## Phase 1 — Auth, users & roles
- [ ] Login (JWT + bcrypt)
- [ ] User CRUD (admin)
- [ ] Role-based guards (ADMIN / DENTIST / RECEPTIONIST / ASSISTANT)
- [ ] Protected routes on frontend, role-aware nav
- [ ] Clinic settings page (name, logo, letterhead, tooth notation, currency)

## Phase 2 — Patient management
- [ ] Patient CRUD + photo upload (local file storage)
- [ ] Auto patient code (P-00001…)
- [ ] Search (name / phone / code / DOB)
- [ ] Medical history form + allergy/condition flags
- [ ] Alert popups (allergy, premed, dues)
- [ ] Patient detail page (tabs: overview, chart, treatment, Rx, billing, history)

## Phase 3 — Dental charting (core)
- [ ] SVG odontogram component (adult + child, FDI/Universal/Palmer toggle)
- [ ] Per-tooth + per-surface condition marking
- [ ] Color codes: existing / planned / completed
- [ ] ToothRecord CRUD API + UI
- [ ] Per-tooth history timeline
- [ ] Basic perio charting (pocket depth, bleeding, mobility)

## Phase 4 — Treatment planning & clinical notes
- [ ] Procedure catalog management
- [ ] Treatment plan builder (phases, priority, cost estimate)
- [ ] Link treatment items to teeth + mark completed (syncs chart status)
- [ ] Clinical notes (templates + free text)
- [ ] Printable treatment estimate sheet

## Phase 4b — Imaging & documents (basic, file upload) `[MVP]`
- [ ] File upload API (jpg/png/pdf) → store on server PC disk (`uploads/patients/<id>/`)
- [ ] `PatientFile` records (category, tooth/visit tag, takenAt, caption)
- [ ] Patient gallery view (thumbnails, filter by category)
- [ ] Before/after side-by-side compare
- [ ] Include images in patient report PDF (Phase 7)
- [ ] Source-agnostic design (future digital-sensor capture = same file flow)

## Phase 5 — Prescription & medicine
- [ ] Drug database management + search/autocomplete
- [ ] Dosage templates + favorites per dentist
- [ ] Prescription builder
- [ ] Allergy check against patient history (warning)
- [ ] Prescription print (letterhead, signature)
- [ ] Prescription history per patient

## Phase 6 — Billing & accounts
- [ ] Invoice generation (pull procedures + fees)
- [ ] Discounts
- [ ] Payment recording (cash/card/bKash/Nagad, full/partial)
- [ ] Patient ledger + outstanding balance
- [ ] Receipt print
- [ ] Daily collection summary

## Phase 7 — Reports
- [ ] Patient full history report → PDF
- [ ] Treatment report
- [ ] Daily collection report
- [ ] Outstanding dues report

## Phase 8 — Appointments (light)
- [ ] Calendar (day/week), multi-chair columns
- [ ] Book / reschedule / cancel, status colors
- [ ] Dentist assignment, double-booking warning

## Phase 9 — System hardening: backup & deployment
- [ ] Automatic daily DB backup (scheduled) + manual export button
- [ ] Restore from backup
- [ ] Audit logging on writes
- [ ] PWA manifest + service worker (mobile installable)
- [ ] Responsive QA on phone
- [ ] Package server PC bundle (Tauri/Electron + backend + auto-start)
- [ ] Network setup guide (static IP, firewall) — see [01-ARCHITECTURE.md](01-ARCHITECTURE.md)

---

## Phase 2+ / Future (after MVP ships)
- [ ] Imaging / X-ray attachment + annotation
- [ ] Inventory / stock management
- [ ] Lab work tracking
- [ ] Advanced analytics dashboard
- [ ] Recall/recurring appointments + reminders
- [ ] Consent forms with digital signature
- [ ] Family/household linking
- [ ] Native Flutter mobile app
- [ ] Full perio charting (6-point, furcation, charting graph)

---

## Working agreement
- One phase at a time, in order. Don't start the next until current is working + tested.
- Each phase: backend first → frontend → manual test → check off boxes here.
- Keep [README.md](../README.md) status section updated.
