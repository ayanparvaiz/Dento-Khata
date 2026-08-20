# Dento Khata — Offline product

One installer (Windows `.exe` / macOS `.dmg`) that bundles the whole app — NestJS backend,
a standalone Node runtime, SQLite, and the frontend. Installs like a normal app; no separate
server, no Node/Postgres on the PC. Sold one-time; unlocked by a license key.

Built from the **same codebase** as the online SaaS (`multi-vendor` branch), switched with
`APP_MODE=offline` — so features stay in sync. See `desktop/README.md` for build details.

## What's included (all done + verified)

- **Packaging** — Windows `.exe`/`.msi` + macOS universal `.dmg` (Intel + Apple Silicon, old Macs), built by GitHub Actions CI.
- **License** — one-time key = one PC. Ed25519-signed activation; super-admin console creates/lists/revokes keys and can free a PC (move to a new computer) or grant the cloud-backup add-on.
- **First-run** — enter key → clinic identity comes from the key → doctor sets a password → straight into the app.
- **Drug catalog** — ~8,900 Bangladesh medicines seeded into the local DB on first run (prescriptions work fully offline).
- **Multi-user / multi-device (LAN)** — reception, assistant, doctor connect from their own phones/tablets on the same WiFi; each with their own login + permissions. In-app "Connect device" screen shows the LAN address + QR.
- **Local backup** — free, unlimited (Settings).
- **Cloud backup (paid add-on, ৳1000/yr)** — push/restore from our server, gated by the license; duplicate-proof restore.
- **Auto-update** — signed, checks on startup, asks the doctor (Bangla, dismissible), installs + relaunches. **Never loses data** (data lives outside the app; the DB is snapshotted before any schema change).

## Everything is unlocked offline
The offline build is fully paid, so there is no free/Pro split — all features are on. SaaS-only
pieces (public signup, super-admin login, subscription paywall, Meta/Telegram) are disabled and
never exposed on the offline app or the online server.

## Publishing a new version — ONE command

After committing your code changes:

```bash
cd desktop && npm run release 0.1.3     # bump the number each time
```

GitHub CI then automatically: builds + **signs** both installers → writes `latest.json` → uploads
everything to the server. Every installed app auto-updates on its next launch. A normal code push
never triggers a build — only `npm run release` (a `desktop-v*` tag) does.

## Giving the installer to a customer (first install)

1. Customer pays → in the super-admin console create a license key (with their clinic/doctor/phone).
2. Send them **two things**: the installer + the license key.
   - **Windows:** https://dento.devcenter.dev/update/DentoKhata-setup.exe
   - **macOS:** https://dento.devcenter.dev/update/DentoKhata.dmg
   - (These stable links always point to the latest version. Or download from CI artifacts and send via Drive/WhatsApp.)
3. They install → enter the key → set a password → done. Future updates are automatic.

Misuse is prevented by the **license key** — the installer is useless without a key you sold, so
the download link being public is fine. Installers are **unsigned** (no paid code-signing cert
yet), so the first launch shows a warning: Windows → *More info → Run anyway*; macOS → *right-click → Open*.

## Where things live

- **Installers + update feed:** server `dento-data/update/` → `https://dento.devcenter.dev/update/` (persistent).
- **Per-user data (SQLite DB, uploads, DB snapshots):** the OS app-data dir (`%APPDATA%\com.dentokhata.app` / `~/Library/Application Support/com.dentokhata.app`) — untouched by updates.
- **Signing key (updater):** GitHub secret `TAURI_SIGNING_PRIVATE_KEY` (+ a backup in `desktop/UPDATER-SIGNING-KEY.secret.txt`, gitignored). Losing it = no more updates.
- **CI upload key:** GitHub secret `SERVER_SSH_KEY`.

## Left to do (yours)

Install `DentoKhata-setup.exe` on a real **Windows PC** and run through it once (install → license
screen → activate → use). That final smoke-test confirms the product is ready to sell.
