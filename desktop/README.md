# Desktop — Dento Khata offline app (Tauri)

One installer that bundles **everything**: the NestJS backend, a standalone Node runtime,
SQLite, and the frontend. Installs like a normal app; no separate server, no Node on the PC.

- Runs `APP_MODE=offline` — SQLite database + uploads in the user's app-data dir.
- Serves the UI + API on one local port, so phones/tablets on the same WiFi connect too (LAN).
- macOS build is **universal** (Intel + Apple Silicon) so old Macs work.

## How it works

`src-tauri/src/main.rs` spawns the bundled backend (`bin/node-<arch>` running
`backend/dist/main.js`), waits for its port, then points the window at it, and kills it on
close. `scripts/prepare-backend.mjs` assembles `src-tauri/resources/` (backend + a flat
production `node_modules` + Prisma SQLite client + the official Node binaries + frontend).

## Build the installers

**Easiest — GitHub Actions (no local Windows needed):** run the *Build Desktop App* workflow
(Actions tab, "Run workflow"). It produces:
- `DentoKhata-macOS` — universal `.dmg` + `.app`
- `DentoKhata-Windows` — `.exe` (NSIS) + `.msi`

**Locally (macOS):**
```bash
# one-time: install Rust (https://rustup.rs) and macOS targets
rustup target add x86_64-apple-darwin aarch64-apple-darwin
cd backend && npm i --legacy-peer-deps && cd ../frontend && npm i && cd ../desktop && npm i
npm run tauri -- build --target universal-apple-darwin
# → src-tauri/target/universal-apple-darwin/release/bundle/{dmg,macos}/
```

Note: the `.app`/`.dmg`/`.exe` are **unsigned** — for public release you'll want an Apple
Developer cert (notarization) and a Windows code-signing cert; until then users approve it once.
