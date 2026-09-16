import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import path from 'node:path';
import process from 'node:process';

const fixture = path.resolve('tests/fixtures/audio.html');
const html = await readFile(fixture);
const server = createServer((req, res) => {
  if (req.url === '/' || req.url === '/audio.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(html);
  } else {
    res.writeHead(404); res.end('Not found');
  }
});
await new Promise((resolve) => server.listen(4173, '127.0.0.1', resolve));

console.log('\nManual Chromium Tab Equalizer smoke test');
console.log('1. Load extension/ unpacked in Chrome or Brave.');
console.log('2. Open http://127.0.0.1:4173/audio.html');
console.log('3. Click Start tone and verify the tone is audible.');
console.log('4. Open the extension popup and click Enable.');
console.log('5. Close the popup: audio must continue.');
console.log('6. Reopen it and verify volume, one EQ band, balance/mono, bypass, and mute audibly change only this tab.');
console.log('7. Open a second audio tab and confirm it is unaffected until explicitly enabled.');
console.log('8. Disable processing and confirm normal tab audio returns.\n');

const rl = createInterface({ input: process.stdin, output: process.stdout });
const browser = (await rl.question('Browser + exact version: ')).trim();
const result = (await rl.question('Type PASS only if every step passed, otherwise type FAIL: ')).trim().toUpperCase();
const notes = (await rl.question('Notes (optional): ')).trim();
rl.close();
server.close();

if (!['PASS', 'FAIL'].includes(result)) throw new Error('Result must be PASS or FAIL.');
await mkdir('.reference', { recursive: true });
const record = { date: new Date().toISOString(), browser, result, notes };
await writeFile('.reference/smoke.json', `${JSON.stringify(record, null, 2)}\n`);
console.log(`Recorded ${result} in .reference/smoke.json`);
if (result !== 'PASS') process.exitCode = 1;
