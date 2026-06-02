// Usage: node scripts/set-version.mjs <version>
// Keep Tauri artifact names aligned with the release tag version.
import { readFileSync, writeFileSync } from 'node:fs';

const version = process.argv[2];
if (!version) {
  console.error('Usage: node scripts/set-version.mjs <version>');
  process.exit(1);
}

for (const p of ['src-tauri/tauri.conf.json', 'package.json']) {
  const d = JSON.parse(readFileSync(p, 'utf8'));
  d.version = version;
  writeFileSync(p, JSON.stringify(d, null, 2) + '\n');
}

const cargoPath = 'src-tauri/Cargo.toml';
const cargo = readFileSync(cargoPath, 'utf8')
  .replace(/^version = ".*"/m, `version = "${version}"`);
writeFileSync(cargoPath, cargo);

console.log(`Synced version to ${version}`);
