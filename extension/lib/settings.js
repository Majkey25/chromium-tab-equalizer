export const EQ_BANDS = Object.freeze([31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]);

const BOOLEAN_KEYS = ['enabled', 'muted', 'bypass', 'mono', 'limiter'];
const clamp = (value, min, max, fallback) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
};
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export const DEFAULT_SETTINGS = Object.freeze({
  enabled: false,
  volume: 1,
  muted: false,
  bypass: false,
  preamp: 0,
  balance: 0,
  mono: false,
  compressor: Object.freeze({ enabled: false, threshold: -24, ratio: 4 }),
  limiter: true,
  eq: Object.freeze(Object.fromEntries(EQ_BANDS.map((hz) => [hz, 0]))),
  preset: 'Flat',
});

export const BUILT_IN_PRESETS = Object.freeze({
  Flat: Object.freeze({}),
  'Bass Boost': Object.freeze({ eq: Object.freeze({ 31: 4, 62: 5, 125: 4, 250: 2 }), preamp: -2 }),
  'Treble Boost': Object.freeze({ eq: Object.freeze({ 2000: 2, 4000: 4, 8000: 5, 16000: 3 }), preamp: -2 }),
  Vocal: Object.freeze({ eq: Object.freeze({ 125: -2, 250: -1, 1000: 2, 2000: 4, 4000: 3, 8000: 1 }), preamp: -1 }),
  Night: Object.freeze({
    eq: Object.freeze({ 31: -4, 62: -3, 125: -2, 2000: 2, 4000: 2 }),
    compressor: Object.freeze({ enabled: true, threshold: -30, ratio: 6 }),
    preamp: -3,
  }),
});

export function cloneDefaultSettings() {
  return structuredClone(DEFAULT_SETTINGS);
}

export function sanitizeSettings(input = {}) {
  if (!isObject(input)) input = {};
  const value = cloneDefaultSettings();

  for (const key of BOOLEAN_KEYS) {
    if (key in input) value[key] = Boolean(input[key]);
  }

  value.volume = clamp(input.volume ?? value.volume, 0, 2, value.volume);
  value.preamp = clamp(input.preamp ?? value.preamp, -12, 12, value.preamp);
  value.balance = clamp(input.balance ?? value.balance, -1, 1, value.balance);

  if (isObject(input.compressor)) {
    if ('enabled' in input.compressor) value.compressor.enabled = Boolean(input.compressor.enabled);
    value.compressor.threshold = clamp(input.compressor.threshold ?? value.compressor.threshold, -100, 0, value.compressor.threshold);
    value.compressor.ratio = clamp(input.compressor.ratio ?? value.compressor.ratio, 1, 20, value.compressor.ratio);
  }

  if (isObject(input.eq)) {
    for (const hz of EQ_BANDS) value.eq[hz] = clamp(input.eq[hz] ?? value.eq[hz], -12, 12, value.eq[hz]);
  }

  value.preset = typeof input.preset === 'string' && input.preset.trim() ? input.preset.trim().slice(0, 80) : 'Flat';
  return value;
}

export function applyUserPreset(name, preset, current = {}) {
  const live = sanitizeSettings(current);
  const saved = sanitizeSettings(preset);
  const next = sanitizeSettings({
    ...saved,
    enabled: live.enabled,
    muted: live.muted,
    bypass: live.bypass,
    preset: String(name ?? '').trim().slice(0, 80) || 'Custom',
  });
  next.preset = String(name ?? '').trim().slice(0, 80) || 'Custom';
  return next;
}

export function applyPreset(name, current = {}) {
  if (!(name in BUILT_IN_PRESETS)) return sanitizeSettings(current);
  const base = sanitizeSettings(current);
  const patch = BUILT_IN_PRESETS[name];
  const next = sanitizeSettings({
    ...base,
    ...patch,
    enabled: base.enabled,
    volume: base.volume,
    muted: base.muted,
    bypass: base.bypass,
    balance: base.balance,
    mono: base.mono,
    limiter: base.limiter,
    eq: { ...base.eq, ...(patch.eq ?? {}) },
    compressor: { ...base.compressor, ...(patch.compressor ?? {}) },
    preset: name,
  });
  next.preset = name;
  return next;
}

function sanitizeRecord(record, label) {
  if (!isObject(record)) throw new TypeError(`${label} must be an object`);
  const output = {};
  for (const [name, settings] of Object.entries(record)) {
    if (!isObject(settings)) throw new TypeError(`${label}.${name} must be an object`);
    output[String(name).slice(0, 253)] = sanitizeSettings(settings);
  }
  return output;
}

export function validateImportDocument(value) {
  if (!isObject(value)) throw new TypeError('Import document must be an object');
  if (value.schemaVersion !== 1) throw new TypeError('Unsupported schemaVersion');
  const profiles = sanitizeRecord(value.profiles, 'profiles');
  const userPresets = sanitizeRecord(value.userPresets, 'userPresets');
  if (!isObject(value.preferences)) throw new TypeError('preferences must be an object');
  const preferences = {};
  if (['system', 'light', 'dark'].includes(value.preferences.theme)) preferences.theme = value.preferences.theme;
  return { schemaVersion: 1, profiles, userPresets, preferences };
}
