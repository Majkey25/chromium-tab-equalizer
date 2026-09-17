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
  assert.match(html, /data-reset-section="level"/);
  assert.match(html, /data-reset-section="eq"/);
  assert.match(html, /data-reset-section="advanced"/);
  assert.match(html, /icons\/icon\.svg/);
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

test('toolbar icon is frameless and the mute state is unmistakable', async () => {
  const [icon, css, js] = await Promise.all([
    readFile('extension/icons/icon.svg', 'utf8'),
    readFile('extension/popup.css', 'utf8'),
    readFile('extension/popup.js', 'utf8'),
  ]);

  assert.doesNotMatch(icon, /<rect\b/i, 'toolbar icon must not contain a square or rounded-rectangle frame');
  assert.match(icon, /linearGradient/i, 'toolbar icon should use the approved modern gradient');
  assert.match(css, /#mute\[aria-pressed="true"\][\s\S]*background:/, 'active mute needs a dedicated filled visual state');
  assert.match(css, /#mute\[aria-pressed="true"\][\s\S]*color:\s*#fff/i, 'active mute needs high-contrast text');
  assert.match(js, /elements\.mute\.textContent\s*=\s*s\.muted\s*\?\s*['"]Muted['"]\s*:\s*['"]Mute['"]/, 'mute label should change to Muted when active');
});
