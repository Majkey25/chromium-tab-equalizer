import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('popup exposes the full v1 mixer with accessible labels', async () => {
  const html = await readFile('extension/popup.html', 'utf8');
  assert.match(html, /id="power"/);
  assert.match(html, /id="volume"[^>]*min="0"[^>]*max="200"/);
  assert.match(html, /id="preamp"[^>]*min="-12"[^>]*max="12"/);
  assert.match(html, /id="balance"[^>]*min="-100"[^>]*max="100"/);
  assert.match(html, /id="remember"/);
  assert.match(html, /id="bypass"/);
  assert.match(html, /id="reset"/);
  assert.match(html, /<details/);
  for (const hz of [31,62,125,250,500,1000,2000,4000,8000,16000]) {
    assert.match(html, new RegExp(`data-eq="${hz}"`));
    assert.match(html, new RegExp(`aria-label="${hz >= 1000 ? `${hz / 1000} kHz` : `${hz} Hz`} equalizer"`));
  }
});

test('popup CSS stays compact and avoids decorative AI styling', async () => {
  const css = await readFile('extension/popup.css', 'utf8');
  assert.match(css, /width:\s*360px/);
  for (const banned of ['linear-gradient', 'radial-gradient', 'backdrop-filter', 'text-shadow', 'box-shadow']) {
    assert.equal(css.includes(banned), false, `found banned decorative CSS: ${banned}`);
  }
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-color-scheme:\s*dark/);
});
