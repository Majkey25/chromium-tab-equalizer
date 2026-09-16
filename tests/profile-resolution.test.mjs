import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHostname, resolveNavigationSettings } from '../extension/lib/profile-resolution.js';

test('normalizes www hostnames but preserves meaningful subdomains', () => {
  assert.equal(normalizeHostname('https://www.youtube.com/watch?v=x'), 'youtube.com');
  assert.equal(normalizeHostname('music.youtube.com'), 'music.youtube.com');
  assert.equal(normalizeHostname('WWW.Example.COM.'), 'example.com');
});

test('saved site profile overrides prior temporary tab settings on navigation', () => {
  const result = resolveNavigationSettings({
    url: 'https://www.youtube.com/watch?v=x',
    profiles: { 'youtube.com': { volume: 0.42 } },
    temporaryAfterNavigation: { hostname: 'youtube.com', settings: { volume: 0.9 } },
  });
  assert.equal(result.source, 'site');
  assert.equal(result.settings.volume, 0.42);
});

test('temporary state for the new hostname wins only when no site profile exists', () => {
  const result = resolveNavigationSettings({
    url: 'https://music.youtube.com',
    profiles: {},
    temporaryAfterNavigation: { hostname: 'music.youtube.com', settings: { volume: 0.55 } },
  });
  assert.equal(result.source, 'temporary');
  assert.equal(result.settings.volume, 0.55);
});

test('unknown hostname starts Flat on navigation', () => {
  const result = resolveNavigationSettings({ url: 'https://example.com', profiles: {}, temporaryAfterNavigation: null });
  assert.equal(result.source, 'default');
  assert.equal(result.settings.volume, 1);
  assert.equal(result.settings.preset, 'Flat');
});

test('rejects unsupported schemes for normalization', () => {
  assert.throws(() => normalizeHostname('chrome://extensions'), /http/i);
});
