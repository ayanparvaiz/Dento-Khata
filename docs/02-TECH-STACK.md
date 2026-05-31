# 02 — Tech Stack

All choices optimize for: **offline LAN, single-chamber scale, one codebase for PC + phone,
easy backup, maintainable.**

## Summary

| Layer | Choice | Why |
|-------|--------|-----|
| Backend | **Node.js + NestJS** | Structured, modular, scalable; TypeScript end-to-end |
| ORM | **Prisma** | Type-safe, easy migrations, painless SQLite→Postgres path later |
| Database | **SQLite** (`better-sqlite3`, WAL mode) | Single file, zero-config, trivial backup, fine for chamber scale |
| Frontend | **React + TypeScript + Vite** | Fast, modern, SPA |
| UI | **Tailwind CSS + shadcn/ui** | Professional, accessible components, responsive |
| State/data | **TanStack Query** | Server-state caching, optimistic updates |
| Forms | **React Hook Form + Zod** | Validation shared with backend (Zod) |
| Desktop (PC) | **Tauri** (LOCKED — not Electron) | Native window, light (~10MB), low RAM; MUST run on old PCs |
| Mobile | **PWA** (responsive web app) | Installable from browser, no app store, MVP-fast. Flutter native = phase 2 |
| Auth | **JWT + bcrypt** (local) | Simple local login + role permissions; no external IdP (offline) |
| PDF/print | **react-to-print** + **pdfmake/Puppeteer** | Prescriptions, receipts, patient reports |
| Charting UI | **Custom SVG odontogram** (React) | Tooth chart is bespoke; build as reusable component |

## Reasoning notes

### Backend: NestJS
Modular (one module per feature: patients, charting, prescriptions, billing…),
dependency injection, guards for role-based auth, validation pipes. Familiar Node
ecosystem (matches existing `lotus-backend` experience). Express is the fallback if
lighter is preferred.

### Database: SQLite (chosen)
- The whole DB is **one file** → backup = copy file, restore = replace file.
- **Zero install/config** — no DB server to maintain on Windows.
- WAL mode gives concurrent reads + safe online backup.
- Single chamber (2 PC + phone) is well within SQLite's comfort zone.
- **Migration path:** Prisma `datasource` swap → PostgreSQL if scaling later, schema unchanged.

### Frontend: React + Vite + Tailwind + shadcn/ui
- Responsive design = **one codebase for desktop and mobile**.
- shadcn/ui = professional, customizable components (tables, dialogs, calendars, forms).
- Vite = fast dev + small production bundle (good for low-spec PCs).

### Desktop wrapper: Tauri (LOCKED)
- Wraps the same web app in a native Windows window → pro feel, double-click launch.
- **Tiny footprint, low RAM, uses the OS WebView** — runs well on OLD clinic PCs.
  This is the deciding factor: Electron (~150MB, heavy RAM) is rejected for that reason.
- **Phone does not use this** — phone uses the PWA.
- Tauri builds the frontend (Vite) and ships a small native installer; the server PC's
  Tauri build can also launch/host the backend + SQLite.

### Mobile: PWA first
- The responsive React app + a web manifest + service worker = installable PWA.
- Phone opens the server LAN IP in Chrome → "Add to Home Screen" → app icon.
- No separate mobile build for MVP. **Flutter native app = phase 2** (we have flutter-ui tooling).

## Repository structure (monorepo)

```
dentist-app/
├── docs/                  # planning docs (this folder)
├── backend/               # NestJS + Prisma + SQLite
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts        # drug DB seed, default admin, demo data
│   └── src/
│       ├── auth/
│       ├── patients/
│       ├── appointments/
│       ├── charting/      # odontogram + perio
│       ├── treatment/
│       ├── prescriptions/
│       ├── drugs/
│       ├── billing/
│       ├── reports/
│       ├── users/
│       └── backup/
├── frontend/              # React + Vite + Tailwind + shadcn
│   └── src/
│       ├── components/
│       ├── features/      # mirror backend modules
│       ├── lib/           # api client, query setup
│       └── pages/
├── desktop/               # Tauri shell (wraps frontend)
└── scripts/               # backup task, build, package
```

## Versions (targets)
- Node.js 20 LTS+ (24 LTS if available on the PC)
- NestJS 10+, Prisma 5+
- React 18+, Vite 5+, Tailwind 3+
- Tauri 2
