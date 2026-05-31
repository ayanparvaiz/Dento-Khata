# Desktop (Tauri) — Windows installer

Wraps the React frontend in a lightweight native Windows window (Tauri = small,
low-RAM, runs on old PCs). This produces the single `.exe` / `.msi` installer.

> **Status:** config scaffolded. Building requires the Rust toolchain, which is not
> yet installed on this machine. The steps below produce the installer once Rust is set up.

## One-time setup (on the build PC, internet needed once)

1. Install Rust: https://rustup.rs  (`rustup-init.exe` on Windows)
2. Install Tauri CLI: `pnpm add -D @tauri-apps/cli`
3. Generate app icons (creates `src-tauri/icons/`): `pnpm tauri icon ../frontend/public/icon.svg`

## Build the installer

```bash
cd desktop
pnpm tauri build
```

Output: `desktop/src-tauri/target/release/bundle/` → `.msi` and `.exe` (NSIS) installers.

## Architecture reminder

- The **server PC** runs the backend (`backend/`, port 3000) + SQLite + (optionally) this
  desktop app. Run the backend as an auto-start service so it's always available.
- The **2nd PC** installs this desktop app (or just opens the server's LAN IP in a browser).
- The **phone** opens `http://<server-LAN-IP>:5173` (dev) or the served build, then
  "Add to Home Screen" → PWA. Phones do **not** use Tauri.

See [../docs/01-ARCHITECTURE.md](../docs/01-ARCHITECTURE.md) for the full offline LAN setup
(static IP, firewall, daily backup).
