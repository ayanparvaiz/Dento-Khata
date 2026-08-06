// Release a new offline version in ONE command:
//   cd desktop && npm run release 0.2.0
// Bumps the version, commits, tags `desktop-vX.Y.Z`, and pushes. GitHub CI then builds +
// signs the installers, writes latest.json, and uploads everything to the server — so every
// installed offline app auto-updates. You don't touch anything else.
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version || '')) {
  console.error('Usage: npm run release <version>   e.g.  npm run release 0.2.0');
  process.exit(1);
}

const desktop = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const f of [join(desktop, 'src-tauri', 'tauri.conf.json'), join(desktop, 'package.json')]) {
  const j = JSON.parse(readFileSync(f, 'utf8'));
  j.version = version;
  writeFileSync(f, JSON.stringify(j, null, 2) + '\n');
}

const run = (c) => execSync(c, { stdio: 'inherit' });
run('git add -A');
run(`git commit -m "release desktop v${version}"`);
run('git push');
run(`git tag -f desktop-v${version}`);
run(`git push -f origin desktop-v${version}`);

console.log(`\n✅ Released v${version}.`);
console.log('   GitHub is now building + signing the installers and publishing the update.');
console.log('   Watch it:  https://github.com/Naimehossein77/dentist-app/actions');
console.log('   In ~15 min all installed offline apps will auto-update on next launch.');
