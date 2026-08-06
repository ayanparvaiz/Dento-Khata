// Assembles everything the offline .app/.exe needs into src-tauri/resources/:
//   backend/ (dist + node_modules + prisma + package.json)  — the NestJS server
//   frontend/dist                                            — served by the backend on LAN
//   bin/node                                                 — the Node runtime to run it
// Tauri bundles resources/ into the installer; at runtime the Rust shell spawns
// `bin/node backend/dist/main.js` with APP_MODE=offline + a SQLite db in the user's app-data.
import { execSync } from 'child_process';
import { cpSync, mkdirSync, rmSync, copyFileSync, existsSync, chmodSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Recursively delete files matching a suffix (e.g. source maps — they expose the TS source).
function stripFiles(dir, suffix) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) stripFiles(p, suffix);
    else if (name.endsWith(suffix)) unlinkSync(p);
  }
}

const desktop = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(desktop, '..');
const backend = join(root, 'backend');
const frontend = join(root, 'frontend');
const res = join(desktop, 'src-tauri', 'resources');
const run = (cmd, cwd, env = {}) => execSync(cmd, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });

console.log('▶ building backend + SQLite client');
run('npm run build', backend);
run('npm run prisma:sqlite', backend);

console.log('▶ building offline frontend');
run('npm run build', frontend, { VITE_APP_MODE: 'offline' });

console.log('▶ assembling resources');
rmSync(res, { recursive: true, force: true });
const resBackend = join(res, 'backend');
mkdirSync(resBackend, { recursive: true });
cpSync(join(backend, 'dist'), join(resBackend, 'dist'), { recursive: true });
cpSync(join(backend, 'prisma'), join(resBackend, 'prisma'), { recursive: true });
copyFileSync(join(backend, 'package.json'), join(resBackend, 'package.json'));
mkdirSync(join(res, 'frontend'), { recursive: true });
cpSync(join(frontend, 'dist'), join(res, 'frontend', 'dist'), { recursive: true });

// Don't ship source maps — they expose the original TypeScript/source in a sold product.
stripFiles(join(resBackend, 'dist'), '.map');
stripFiles(join(res, 'frontend', 'dist'), '.map');

// Flat, self-contained production node_modules (the backend uses pnpm, whose symlinked
// node_modules can't be bundled). prisma (a devDep) is added so runtime `db push` works.
console.log('▶ installing production dependencies into the bundle');
run('npm install --omit=dev --legacy-peer-deps --no-audit --no-fund --loglevel=error', resBackend);
run('npm install prisma@6 --no-save --legacy-peer-deps --no-audit --no-fund --loglevel=error', resBackend);
console.log('▶ generating SQLite Prisma client for the bundle');
run('npx --no-install prisma generate --schema prisma/schema.sqlite.prisma', resBackend);

// Node runtime for the target. We ship the OFFICIAL standalone Node binary (nodejs.org) —
// NOT the local/homebrew node, which is only a thin wrapper linking to a shared libnode.
const NODE_VER = process.env.NODE_VERSION || 'v22.11.0';
mkdirSync(join(res, 'bin'), { recursive: true });

function officialNode(platform, arch, destName) {
  const dest = join(res, 'bin', destName);
  if (existsSync(dest)) return;
  if (platform === 'darwin') {
    const name = `node-${NODE_VER}-darwin-${arch}`;
    execSync(`curl -fsSL https://nodejs.org/dist/${NODE_VER}/${name}.tar.gz -o /tmp/${name}.tar.gz`, { stdio: 'inherit' });
    execSync(`tar xzf /tmp/${name}.tar.gz -C /tmp`);
    copyFileSync(`/tmp/${name}/bin/node`, dest);
    chmodSync(dest, 0o755);
  } else if (platform === 'win32') {
    // On Windows CI, NODE_BINARY points to the extracted node.exe.
    if (process.env.NODE_BINARY) copyFileSync(process.env.NODE_BINARY, dest);
  }
}

if (process.platform === 'darwin') {
  // Ship BOTH arches so the universal .app runs on Apple Silicon AND old Intel Macs.
  officialNode('darwin', 'arm64', 'node-arm64');
  officialNode('darwin', 'x64', 'node-x64');
} else if (process.platform === 'win32') {
  officialNode('win32', 'x64', 'node.exe');
}

console.log('✓ resources ready at', res);
