# Dental Practice Management System

Fully offline, LAN-based dental clinic management software for a dental chamber
(2 Windows PCs + mobile phone access via router, no internet required).

International-standard dental practice management — inspired by Dentrix, Open Dental,
Eaglesoft, Curve Dental, CareStack.

## Project Goal

A single dentist chamber wants management software that:
- Runs **completely offline** (no internet dependency)
- Is accessed from **2 Windows PCs + mobile phone** over a local router (LAN)
- Matches **international dental software standards** (odontogram, perio charting,
  prescriptions, billing, patient records)

## Architecture (one-line)

One PC = server (backend + SQLite DB + web app host). Other PC + phone = clients
over LAN. Single database = single source of truth = no sync conflicts.

## Documentation Index

| Doc | Contents |
|-----|----------|
| [docs/01-ARCHITECTURE.md](docs/01-ARCHITECTURE.md) | System architecture, deployment, network, backup |
| [docs/02-TECH-STACK.md](docs/02-TECH-STACK.md) | Chosen technologies + reasoning |
| [docs/03-FEATURES.md](docs/03-FEATURES.md) | Full feature list (MVP + future) as implementation checklist |
| [docs/04-DATABASE-SCHEMA.md](docs/04-DATABASE-SCHEMA.md) | Prisma/SQLite data model design |
| [docs/05-ROADMAP.md](docs/05-ROADMAP.md) | Implementation order — what we build, in sequence |

## Status

- [x] Requirements gathered
- [x] Architecture decided
- [x] Tech stack decided
- [x] Planning docs written
- [x] **Phase 0 — Scaffold done** (NestJS + Prisma/SQLite + seed; React + Vite + Tailwind shell; LAN-verified)
- [x] **Phase 1 — Auth, users & roles done** (JWT login, global guard, role-based access, Users page, Settings page; 13/13 API tests pass)
- [x] **Phase 2 — Patient management done** (auto patient code, search, registration with dentist-standard fields, medical/dental history, medical alert banner, detail tabs; API + 5/5 UI tests pass)
- [x] **Phase 3 — Dental charting done** (interactive odontogram: adult 32 + child 20 teeth, FDI/Universal/Palmer notation, per-tooth/surface conditions with color coding + status, findings panel, basic perio; API + 5/5 UI tests pass)
- [x] **Phase 3b — Visual upgrade done** (anatomical tooth SVG w/ clickable surfaces, whole-tooth markers, brush; full perio chart w/ SVG line graph)
- [x] **Phase 4 — Treatment planning & clinical notes done** (multi-plan, staff-editable fee in BDT ৳, printable estimate, notes w/ templates)
- [x] **Phase 5 — Prescription & medicine done** (8,900+ BD dental medicines bundled offline from MedEx, generic-grouped alternatives search, allergy warning vs patient history, letterhead Rx print, history)
- [x] **Phase 4b — Imaging done** (X-ray/photo/PDF upload, gallery, before/after compare, served from server PC)
- [x] **Phase 6 — Billing done** (invoice + line items, payments cash/bKash/Nagad/card, ledger billed/paid/balance, receipt print, BDT ৳)
- [x] **Phase 7 — Reports done** (daily collection by method, outstanding dues)
- [x] **Phase 8 — Appointments done** (day schedule, patient/dentist/chair booking, color-coded status workflow)
- [x] **Phase 9 — Hardening done** (admin DB backup download, audit log on writes, installable PWA w/ service worker, Tauri desktop config)
- [x] **Full MVP complete — 38/38 browser e2e checks pass** across all modules

> Build the Windows installer: see [desktop/README.md](desktop/README.md) (requires Rust, one-time).

## Run (development)

Two processes. Open two terminals:

```bash
# Terminal 1 — backend (server PC)
cd backend
pnpm start:dev        # http://0.0.0.0:3000/api   (first time: pnpm install, pnpm prisma migrate dev, pnpm db:seed)

# Terminal 2 — frontend
cd frontend
pnpm dev              # http://localhost:5173  + Network http://<server-LAN-IP>:5173
```

Other devices (2nd PC, phone) open the **Network** URL shown by Vite, e.g.
`http://192.168.1.63:5173`. The web app auto-targets the backend at the same host on port 3000.

Default login (after Phase 1): `admin` / `admin123` — change immediately.

## Decisions locked

- **Deployment:** Fully offline, LAN via router
- **Clients:** 2 Windows PCs (Tauri desktop app) + mobile phone (PWA via browser)
- **Desktop app:** Tauri (LOCKED) — light & low-RAM, must run well on OLD PCs
- **Database:** SQLite (single file, easy backup, WAL mode for concurrency)
- **Approach:** MVP first, then expand
- **Top priorities:** Dental charting, Prescription/medicine, Patient report/history, Billing
