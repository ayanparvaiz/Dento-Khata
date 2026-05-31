# 01 — Architecture

## Overview: Local server + thin clients

One PC acts as the **server** (runs backend + SQLite DB + hosts the web app).
All other devices (2nd PC, mobile phone) are **clients** that connect over the
local router. No internet is involved — everything stays on the LAN.

```
        ┌──────────────────────────────────────────┐
        │   ROUTER  (WiFi/LAN, no internet needed)  │
        └──────┬───────────────┬───────────────┬────┘
               │               │               │
       ┌───────┴───────┐  ┌────┴─────┐   ┌─────┴──────┐
       │  SERVER PC    │  │  PC #2   │   │   PHONE    │
       │ (reception)   │  │ client   │   │   client   │
       │               │  │          │   │            │
       │ • Backend API │  │ Tauri app│   │  Browser   │
       │ • SQLite DB   │  │   OR     │   │  → PWA     │
       │ • Web app host│  │ browser  │   │ (installed)│
       └───────────────┘  └──────────┘   └────────────┘
       LAN URL: http://192.168.1.x:3000
```

### Why this model
- **Single source of truth:** one DB on the server PC. No multi-DB sync, no conflicts.
- **Offline:** all traffic is LAN. Internet never required.
- **Universal client:** the React web app is responsive — same code serves PC and phone.
- **Cheap & simple:** no cloud cost, no servers to rent, data never leaves the chamber.

## Client access methods

| Device | How it connects | Notes |
|--------|-----------------|-------|
| Server PC | Local (localhost) or Tauri shell | Always on while clinic open |
| 2nd PC | Tauri desktop app → server LAN IP, **or** Chrome/Edge → server IP | Desktop app = pro feel |
| Phone/Tablet | Chrome → `http://192.168.1.x:3000` → "Add to Home Screen" → PWA | Looks/works like a native app, offline-capable shell |

**Important:** Tauri/Electron only runs on Windows PCs. The phone NEVER uses Tauri —
it uses the PWA (the same web app installed from the browser). One React codebase
covers every device.

## Network setup (one-time)

1. All devices join the **same router** (WiFi or Ethernet). Internet not required —
   the router just provides the local network.
2. Assign the **server PC a static LAN IP** (e.g. `192.168.1.50`) via router DHCP
   reservation, so the address never changes.
3. Backend listens on `0.0.0.0:3000` so LAN devices can reach it.
4. Windows Firewall: allow inbound on the backend port for the private network.
5. Clients open `http://192.168.1.50:3000`.

## Deployment on the server PC

The server PC runs three things, ideally bundled so the dentist double-clicks one icon:
1. **Backend API** (Node process)
2. **SQLite database file** (single `.db` file on disk)
3. **Static web app** served by the backend

Run as a **Windows service / auto-start on boot** so it's always available when
the clinic opens. Use a UPS on the server PC to survive short power cuts.

### Single-icon packaging options
- **Tauri/Electron app** that also spawns the backend + serves the DB (server PC).
- Or a **Windows service** (e.g. via `node-windows` / NSSM) + a desktop shortcut to the URL.

## Backup strategy (critical — medical data)

SQLite = the entire database is **one file**. Backup is trivial:
- **Automatic daily** backup: copy the `.db` file to a backup folder + a USB/pendrive
  or a network drive on the 2nd PC (scheduled task / app cron).
- **Manual export** button in the app (admin) → timestamped DB copy + optional CSV/PDF.
- Keep **rolling backups** (last 7 daily + last 4 weekly).
- Test restore periodically.

> Use SQLite **WAL mode** (`PRAGMA journal_mode=WAL`) so backup-while-running is safe
> and concurrent reads don't block writes.

## Concurrency (2 PC + phone writing at once)

- SQLite serializes writes; reads are concurrent (WAL).
- For a single chamber (2–4 simultaneous users) this is fine.
- Backend should use a single connection pool / queue writes; Prisma + `better-sqlite3`
  handles this well.
- If the clinic ever scales to many operatories/users, migrate to PostgreSQL
  (Prisma makes the swap low-effort — same schema, change the datasource).

## Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| Server PC powered off → system down | Reception PC = server, auto-start, UPS |
| Data loss / corruption | Daily auto-backup + manual export, WAL mode, rolling copies |
| LAN IP changes | Static IP / DHCP reservation on the router |
| Power cut mid-write | WAL mode + UPS; SQLite is crash-resilient |
| Unauthorized access | Login + roles; LAN is private (no internet exposure) |
