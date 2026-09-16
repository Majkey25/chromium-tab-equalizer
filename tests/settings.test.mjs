import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EQ_BANDS,
  BUILT_IN_PRESETS,
  applyPreset,
  applyUserPreset,
  sanitizeSettings,
  validateImportDocument,
} from '../extension/lib/settings.js';

test('sanitizes control ranges and all ten EQ bands', () => {
  assert.deepEqual(EQ_BANDS, [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]);
  const value = sanitizeSettings({
    enabled: 1,
    muted: 0,
    volume: 999,
    preamp: -99,
    balance: 4,
    compressor: { enabled: true, threshold: -120, ratio: 99 },
    eq: Object.fromEntries(EQ_BANDS.map((hz, i) => [hz, i % 2 ? 50 : -50])),
  });
  assert.equal(value.enabled, true);
  assert.equal(value.muted, false);
  assert.equal(value.volume, 2);
  assert.equal(value.preamp, -12);
  assert.equal(value.balance, 1);
  assert.equal(value.compressor.threshold, -100);
  assert.equal(value.compressor.ratio, 20);
  for (const gain of Object.values(value.eq)) assert.ok(gain >= -12 && gain <= 12);
});

test('applies Bass Boost while preserving runtime enabled state and volume', () => {
  const current = sanitizeSettings({ enabled: true, volume: 0.7 });
  const next = applyPreset('Bass Boost', current);
  assert.equal(next.enabled, true);
  assert.equal(next.volume, 0.7);
  assert.equal(next.eq[62] > 0, true);
  assert.equal(next.preset, 'Bass Boost');
  assert.equal(BUILT_IN_PRESETS.Flat !== undefined, true);
});

test('unknown preset leaves settings sanitized and unchanged except preset label', () => {
  const current = sanitizeSettings({ volume: 0.8, eq: { 62: 3 } });
  assert.deepEqual(applyPreset('Nope', current), current);
});

test('validates and sanitizes import documents', () => {
  const doc = validateImportDocument({
    schemaVersion: 1,
    profiles: { 'youtube.com': { volume: 9, eq: { 62: 6 } } },
    userPresets: { Quiet: { volume: 0.3 } },
    preferences: { theme: 'system' },
    ignored: 'drop me',
  });
  assert.equal(doc.schemaVersion, 1);
  assert.equal(doc.profiles['youtube.com'].volume, 2);
  assert.equal(doc.userPresets.Quiet.volume, 0.3);
  assert.deepEqual(doc.preferences, { theme: 'system' });
  assert.equal('ignored' in doc, false);
});

test('rejects malformed import documents', () => {
  assert.throws(() => validateImportDocument({ schemaVersion: 1, profiles: [] }), /profiles/i);
  assert.throws(() => validateImportDocument({ schemaVersion: 2, profiles: {}, userPresets: {}, preferences: {} }), /schema/i);
});


test('user preset applies saved audio values but keeps live mute/bypass/enabled state', () => {
  const current = sanitizeSettings({ enabled: true, muted: true, bypass: true, volume: 1.2, eq: { 62: 1 } });
  const next = applyUserPreset('Heavy', { volume: 0.55, preamp: -3, eq: { 62: 8 }, balance: -0.2 }, current);
  assert.equal(next.enabled, true);
  assert.equal(next.muted, true);
  assert.equal(next.bypass, true);
  assert.equal(next.volume, 0.55);
  assert.equal(next.preamp, -3);
  assert.equal(next.eq[62], 8);
  assert.equal(next.balance, -0.2);
  assert.equal(next.preset, 'Heavy');
});
