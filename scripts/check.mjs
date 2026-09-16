import { execFileSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(full);
  }
  return files;
}

const files = [
  ...(await walk('extension')).filter((file) => file.endsWith('.js')),
  ...(await walk('scripts')).filter((file) => file.endsWith('.mjs')),
  ...(await walk('tests')).filter((file) => file.endsWith('.mjs')),
].sort();

for (const file of files) execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });

const manifest = JSON.parse(await readFile('extension/manifest.json', 'utf8'));
const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
if (manifest.version !== packageJson.version) throw new Error(`Version mismatch: manifest ${manifest.version}, package ${packageJson.version}`);
if (manifest.manifest_version !== 3) throw new Error('Manifest V3 is required.');
console.log(`Checked ${files.length} JavaScript files; manifest/package version ${manifest.version}.`);
