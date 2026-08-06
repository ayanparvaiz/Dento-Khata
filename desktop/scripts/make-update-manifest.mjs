// Builds the Tauri v2 `latest.json` update feed from the CI build artifacts.
//
//   node make-update-manifest.mjs <version> <artifactsDir> <baseUrl> > latest.json
//
// Then upload latest.json + the installer artifacts to the server's /update/ dir
// (served at <baseUrl>). The offline app checks <baseUrl>/latest.json on startup.
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, basename } from 'path';

const [, , version, dir, baseUrl] = process.argv;
if (!version || !dir || !baseUrl) {
  console.error('usage: make-update-manifest.mjs <version> <artifactsDir> <baseUrl>');
  process.exit(1);
}

// recursive file list
function walk(d) {
  return readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const files = walk(dir);
const find = (suffix) => files.find((f) => f.endsWith(suffix));
const sigOf = (f) => readFileSync(f, 'utf8').trim();

const platforms = {};

// macOS universal (.app.tar.gz) — one file serves both Apple Silicon and Intel.
const macTar = find('.app.tar.gz');
const macSig = find('.app.tar.gz.sig');
if (macTar && macSig) {
  const entry = { signature: sigOf(macSig), url: `${baseUrl}/${basename(macTar)}` };
  platforms['darwin-aarch64'] = entry;
  platforms['darwin-x86_64'] = entry;
}

// Windows (.nsis.zip)
const winZip = find('.nsis.zip');
const winSig = find('.nsis.zip.sig');
if (winZip && winSig) {
  platforms['windows-x86_64'] = { signature: sigOf(winSig), url: `${baseUrl}/${basename(winZip)}` };
}

if (Object.keys(platforms).length === 0) {
  console.error('No signed artifacts (.app.tar.gz / .nsis.zip + .sig) found in', dir);
  process.exit(1);
}

process.stdout.write(JSON.stringify({
  version,
  notes: 'নতুন সংস্করণ — উন্নতি ও নতুন সুবিধা।',
  pub_date: new Date().toISOString(),
  platforms,
}, null, 2));
