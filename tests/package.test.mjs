import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const exec = promisify(execFile);
const zipPath = 'dist/chromium-tab-equalizer-1.0.0.zip';

test('package script is deterministic and emits matching checksum', async () => {
  await rm('dist', { recursive: true, force: true });
  await exec('python3', ['scripts/package.py']);
  const first = await readFile(zipPath);
  const firstHash = createHash('sha256').update(first).digest('hex');
  await exec('python3', ['scripts/package.py']);
  const second = await readFile(zipPath);
  const secondHash = createHash('sha256').update(second).digest('hex');
  assert.equal(firstHash, secondHash);
  const sums = await readFile('dist/SHA256SUMS.txt', 'utf8');
  assert.match(sums, new RegExp(`^${firstHash}  chromium-tab-equalizer-1\\.0\\.0\\.zip\\n$`));
});

test('release ZIP has manifest at its root and excludes development files', async () => {
  await exec('python3', ['scripts/package.py']);
  const { stdout } = await exec('python3', ['-c', `import zipfile; z=zipfile.ZipFile('${zipPath}'); print('\\n'.join(z.namelist()))`]);
  const names = stdout.trim().split(/\r?\n/);
  assert.ok(names.includes('manifest.json'));
  assert.ok(names.includes('service-worker.js'));
  assert.ok(names.includes('README.md'));
  assert.equal(names.some((name) => name.startsWith('tests/') || name.startsWith('.github/') || name.includes('node_modules')), false);
});
