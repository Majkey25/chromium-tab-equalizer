import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('options page exposes saved sites, custom presets, and backup controls', async () => {
  const html = await readFile('extension/options.html', 'utf8');
  assert.match(html, /id="profiles"/);
  assert.match(html, /id="presets"/);
  assert.match(html, /id="export"/);
  assert.match(html, /id="import-file"/);
  assert.match(html, /id="import-button"/);
  assert.match(html, /id="clear-all"/);
});

test('options page keeps the same restrained visual language', async () => {
  const css = await readFile('extension/options.css', 'utf8');
  for (const banned of ['linear-gradient', 'radial-gradient', 'backdrop-filter', 'text-shadow', 'box-shadow']) {
    assert.equal(css.includes(banned), false, `found banned decorative CSS: ${banned}`);
  }
  assert.match(css, /prefers-color-scheme:\s*dark/);
  assert.match(css, /:focus-visible/);
});
