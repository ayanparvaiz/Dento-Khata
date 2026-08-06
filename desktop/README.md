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

## Releasing an update (auto-update)

The app checks `https://dento.devcenter.dev/update/latest.json` on startup and, if a newer
signed version is there, asks the doctor (in Bangla) and installs it — **data is never touched**
(it lives in the user's data dir, and the new version snapshots the SQLite DB before any schema
change).

To publish a new version:

1. Bump `version` in `src-tauri/tauri.conf.json` and `package.json`.
2. Push a tag `desktop-vX.Y.Z` → CI builds **signed** installers (uses the `TAURI_SIGNING_PRIVATE_KEY`
   repo secret) and updater artifacts (`.app.tar.gz`, `.nsis.zip` + `.sig`).
3. Download both artifacts, then generate the feed:
   ```bash
   node scripts/make-update-manifest.mjs 0.2.0 ./artifacts https://dento.devcenter.dev/update > latest.json
   ```
4. Upload `latest.json` + the installer files to the server:
   ```bash
   scp latest.json *.app.tar.gz *.nsis.zip dentist@dentist.devcenter.dev:/home/dentist/dento-data/update/
   ```

Installed apps pick it up on their next launch. Keep the private signing key
(`TAURI_SIGNING_PRIVATE_KEY`) safe — losing it means you can't publish updates.
