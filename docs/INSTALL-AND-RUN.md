# Install & Run (Windows primary · macOS supported)

The whole app runs on **one port (3000)** from the **server PC**. Other PCs and phones
on the same router open it by URL. Fully offline — no internet needed.

> Target: **Windows** clinic PCs. macOS works the same way (dev/secondary).

## A. One-time setup on the SERVER PC

Needs Node.js (already used for dev). From the project folder:

```bash
# 1) install deps
pnpm --dir backend install
pnpm --dir frontend install

# 2) build both
pnpm --dir frontend build
pnpm --dir backend build
```

## B. Run (every day / on boot)

```bash
cd backend
node dist/main.js
```

On start the server automatically:
- uses the **persistent data folder** (so updates never lose data),
- applies any pending DB migrations,
- takes a backup (startup + every 6h + on shutdown).

It prints: `Dental backend running at http://0.0.0.0:3000/api`

> Make this auto-start on Windows boot (Task Scheduler / NSSM service) so it's always on.

## C. Open the app

- **Server PC:** http://localhost:3000
- **2nd PC / phone (same WiFi/router):** `http://<SERVER-PC-LAN-IP>:3000`
  - Find the IP — Windows: `ipconfig` → IPv4 (e.g. `192.168.1.50`); macOS: `ipconfig getifaddr en0`.
  - On the phone: open that URL in Chrome → **Add to Home Screen** → opens like an app (PWA).
- First login: **admin / admin123** (change it).
- Windows Firewall: allow inbound **port 3000** on the private network (one time).

> Tip: give the server PC a **static LAN IP** (router DHCP reservation) so the URL never changes.

## D. Where the data lives (and backups)

| What | Location |
|------|----------|
| Database + uploads | `DATA_DIR` (dev: `dentist-app/data/`; prod: set `DATA_DIR`, e.g. `C:\DentalData`) |
| Backups | `BACKUP_DIR` (default `<DATA_DIR>/backups`; point to a **USB/2nd drive** for safety) |

Set the prod locations with environment variables before launch:
```bat
set DATA_DIR=C:\DentalData
set BACKUP_DIR=D:\DentalBackups   :: e.g. a USB / second drive
node dist\main.js
```

**Data safety (no data loss):** data folder lives outside the app, so reinstalling/updating
never touches it · automatic snapshots on startup + every 6h + shutdown · a **pre-migration**
backup before each update (reversible) · if the DB is ever missing it **auto-restores** the
newest backup on next start · WAL mode keeps the DB crash-safe.

## E. Updating to a new version (offline)

1. Copy the new build to the server PC (USB/pendrive).
2. Replace the app files (the `DATA_DIR` is separate — untouched).
3. Start it — it auto-backs-up, auto-migrates the existing data, and runs. No data lost.

(Windows `.exe` installer via Tauri is the polished delivery — see [../desktop/README.md](../desktop/README.md); requires Rust once.)

## F. Quick internet demo (optional)

Share the local app over the internet temporarily (no deploy):
```bash
cloudflared tunnel --url http://localhost:3000   # gives a public https URL
```
