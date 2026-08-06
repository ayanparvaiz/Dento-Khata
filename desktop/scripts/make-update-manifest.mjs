// Emits the Tauri v2 `latest.json` update feed, pointing at STABLE (no-space) filenames on
// the server so URLs never break and never change per release.
//
//   node make-update-manifest.mjs <version> <macSig> <winSig> <baseUrl> > latest.json
//
// macSig / winSig are the .sig file CONTENTS ('' if that platform is missing).
//   - macOS updater artifact  → <baseUrl>/DentoKhata.app.tar.gz   (universal; both arches)
//   - Windows updater artifact → <baseUrl>/DentoKhata-setup.exe    (Tauri v2 signs the setup.exe itself)
const [, , version, macSig, winSig, baseUrl] = process.argv;
if (!version || !baseUrl) {
  console.error('usage: make-update-manifest.mjs <version> <macSig> <winSig> <baseUrl>');
  process.exit(1);
}

const platforms = {};
if (macSig) {
  const mac = { signature: macSig, url: `${baseUrl}/DentoKhata.app.tar.gz` };
  platforms['darwin-aarch64'] = mac;
  platforms['darwin-x86_64'] = mac;
}
if (winSig) {
  platforms['windows-x86_64'] = { signature: winSig, url: `${baseUrl}/DentoKhata-setup.exe` };
}
if (Object.keys(platforms).length === 0) {
  console.error('No signatures given — nothing to publish.');
  process.exit(1);
}

process.stdout.write(JSON.stringify({
  version,
  notes: 'নতুন সংস্করণ — উন্নতি ও নতুন সুবিধা।',
  pub_date: new Date().toISOString(),
  platforms,
}, null, 2));
