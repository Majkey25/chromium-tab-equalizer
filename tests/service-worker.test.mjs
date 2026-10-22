import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { cloneDefaultSettings } from '../extension/lib/settings.js';

const tab = { id: 7, url: 'https://fixture.invalid/' };
const session = new Map();
let config;
let localReads;
let sessionReads;
let listener;
let updated;
let audioMessages;
let removed;
let holdLocalRead;
let holdAudio;

globalThis.chrome = {
  storage: {
    local: {
      async get(key) { localReads += 1; if (holdLocalRead) await holdLocalRead; return { [key]: config }; },
      async set(values) { config = values.config; }
    },
    session: {
      async get(key) { sessionReads += 1; return { [key]: session.get(key) }; },
      async set(values) { for (const [key, value] of Object.entries(values)) session.set(key, value); },
      async remove(key) { session.delete(key); }
    }
  },
  runtime: {
    onMessage: { addListener(value) { listener = value; } },
    async getContexts() { return []; },
    getURL(path) { return `chrome-extension://test/${path}`; },
    async sendMessage(message) { audioMessages.push(message); if (holdAudio?.type === message.type) await holdAudio.promise; return { ok: true }; }
  },
  offscreen: { async createDocument() {} },
  tabs: {
    async query() { return [tab]; },
    async get() { return tab; },
    onRemoved: { addListener(value) { removed = value; } },
    onUpdated: { addListener(value) { updated = value; } }
  },
  tabCapture: { async getMediaStreamId() { return 'fixture-stream'; } }
};
await import('../extension/service-worker.js');

beforeEach(() => {
  tab.url = 'https://fixture.invalid/';
  session.clear();
  config = { schemaVersion: 1, profiles: {}, userPresets: {}, preferences: {} };
  localReads = 0;
  sessionReads = 0;
  audioMessages = [];
  holdLocalRead = null;
  holdAudio = null;
});

test('IPv6 pages resolve saved profiles, start capture and follow navigation', async () => {
  tab.url = 'http://[::1]:4173/audio.html';
  config.profiles['[::1]'] = { volume: 0.42 };
  const inactive = await request('GET_TAB_STATE');
  assert.equal(inactive.ok, true, inactive.error);
  assert.equal(inactive.state.hostname, '[::1]');
  assert.equal(inactive.state.settings.volume, 0.42);
  const started = await request('START_TAB');
  assert.equal(started.ok, true, started.error);
  assert.equal(started.state.active, true);
  assert.equal(started.state.settings.volume, 0.42);
  updated(tab.id, { url: 'http://[::1]:4173/next' });
  await new Promise(setImmediate);
  assert.equal(session.get('tab:7').url, 'http://[::1]:4173/next');
  assert.deepEqual(audioMessages.map(message => message.type), ['AUDIO_START']);
  config.profiles['[2001:db8::1]'] = { volume: 0.6 };
  updated(tab.id, { url: 'https://[2001:db8::1]/' });
  await new Promise(setImmediate);
  assert.equal(session.get('tab:7').hostname, '[2001:db8::1]');
  assert.equal(session.get('tab:7').settings.volume, 0.6);
  assert.deepEqual(audioMessages.map(message => message.type), ['AUDIO_START', 'AUDIO_REPLACE']);
});

function request(type, data = {}) {
  return new Promise(resolve => listener({ type, ...data }, {}, resolve));
}

test('active session returns its existing controls without reading unrelated profiles', async () => {
  const state = { tabId: tab.id, active: true, hostname: 'fixture.invalid', settings: cloneDefaultSettings(), error: null };
  state.settings.volume = 0.63;
  session.set('tab:7', state);
  config.profiles['fixture.invalid'] = { volume: 0.12 };
  const response = await request('GET_TAB_STATE');
  assert.equal(response.ok, true);
  assert.equal(response.state, state);
  assert.equal(response.state.settings.volume, 0.63);
  assert.equal(localReads, 0);
  assert.equal(sessionReads, 1);
});

test('missing session still resolves its saved site profile from current config', async () => {
  config.profiles['fixture.invalid'] = { volume: 0.42 };
  const response = await request('GET_TAB_STATE');
  assert.equal(response.ok, true);
  assert.equal(response.state.active, false);
  assert.equal(response.state.settings.enabled, false);
  assert.equal(response.state.settings.volume, 0.42);
  assert.equal(response.state.rememberForSite, true);
  assert.equal(localReads, 1);
});

test('stored inactive failure is preserved and config validation still runs', async () => {
  const state = { active: false, settings: cloneDefaultSettings(), error: 'Capture stopped' };
  session.set('tab:7', state);
  const response = await request('GET_TAB_STATE');
  assert.equal(response.state, state);
  assert.equal(response.state.error, 'Capture stopped');
  assert.equal(localReads, 1);
  config.profiles = null;
  const invalid = await request('GET_TAB_STATE');
  assert.equal(invalid.ok, false);
  assert.match(invalid.error, /profiles must be an object/);
});

test('stop clears active session and returns the current saved-site fallback', async () => {
  config.profiles['fixture.invalid'] = { volume: 0.42 };
  session.set('tab:7', { active: true, settings: cloneDefaultSettings() });
  const response = await request('STOP_TAB');
  assert.equal(response.ok, true);
  assert.equal(response.state.active, false);
  assert.equal(response.state.settings.volume, 0.42);
  assert.equal(session.has('tab:7'), false);
  assert.equal(localReads, 1);
});

test('same-site URL changes preserve temporary volume, mute and EQ', async () => {
  const settings = { ...cloneDefaultSettings(), enabled: true, volume: 0.23, muted: true };
  settings.eq[125] = 7;
  const state = { tabId: tab.id, active: true, hostname: 'fixture.invalid', settings, rememberForSite: false };
  session.set('tab:7', state);
  const url = 'https://fixture.invalid/next?track=2#chapter';
  updated(tab.id, { url });
  await new Promise(setImmediate);
  assert.deepEqual(session.get('tab:7'), { ...state, url });
  assert.deepEqual(audioMessages, []);
  assert.equal(localReads, 0);
});

test('cross-site navigation still applies saved profiles and resets unknown sites', async () => {
  session.set('tab:7', { active: true, hostname: 'fixture.invalid', settings: { ...cloneDefaultSettings(), volume: 0.23 } });
  config.profiles['next.invalid'] = { volume: 0.42 };
  updated(tab.id, { url: 'https://next.invalid/watch' });
  await new Promise(setImmediate);
  assert.equal(session.get('tab:7').settings.volume, 0.42);
  assert.equal(session.get('tab:7').rememberForSite, true);
  updated(tab.id, { url: 'https://unknown.invalid/' });
  await new Promise(setImmediate);
  assert.equal(session.get('tab:7').settings.volume, 1);
  assert.equal(session.get('tab:7').rememberForSite, false);
  assert.deepEqual(audioMessages.map(({ type }) => type), ['AUDIO_REPLACE', 'AUDIO_REPLACE']);
});

test('ended audio clears the active flag and keeps the error available to the popup', async () => {
  session.set('tab:7', { active: true, settings: { ...cloneDefaultSettings(), enabled: true, volume: 0.23 } });
  assert.equal((await request('AUDIO_FAILED', { tabId: 7, error: 'Tab audio capture ended.' })).ok, true);
  const response = await request('GET_TAB_STATE');
  assert.equal(response.state.active, false);
  assert.equal(response.state.settings.enabled, false);
  assert.equal(response.state.settings.volume, 0.23);
  assert.equal(response.state.error, 'Tab audio capture ended.');
});

test('overlapping navigations finish with the latest hostname and matching audio settings', async () => {
  session.set('tab:7', { active: true, hostname: 'fixture.invalid', settings: cloneDefaultSettings() });
  config.profiles['next.invalid'] = { volume: 0.42 };
  config.profiles['fixture.invalid'] = { volume: 0.65 };
  let release;
  holdLocalRead = new Promise(resolve => { release = resolve; });
  updated(tab.id, { url: 'https://next.invalid/' });
  await new Promise(setImmediate);
  updated(tab.id, { url: 'https://ignored.invalid/' });
  updated(tab.id, { url: 'https://fixture.invalid/return' });
  holdLocalRead = null;
  release();
  await new Promise(setImmediate);
  const state = session.get('tab:7');
  assert.equal(state.hostname, 'fixture.invalid');
  assert.equal(state.url, 'https://fixture.invalid/return');
  assert.equal(state.settings.volume, 0.65);
  assert.deepEqual(audioMessages.map(message => message.settings.volume), [0.42, 0.65]);
});

test('removal and unsupported navigation cannot be undone by an older navigation', async () => {
  for (const close of [() => removed(tab.id), () => updated(tab.id, { url: 'chrome://settings/' })]) {
    session.set('tab:7', { active: true, hostname: 'fixture.invalid', settings: cloneDefaultSettings() });
    let release;
    holdLocalRead = new Promise(resolve => { release = resolve; });
    updated(tab.id, { url: 'https://next.invalid/' });
    await new Promise(setImmediate);
    close();
    holdLocalRead = null;
    release();
    await new Promise(setImmediate);
    assert.equal(session.has('tab:7'), false);
  }
});

test('site writes reject stale session hostnames without changing saved profiles', async () => {
  session.set('tab:7', { active: true, hostname: 'previous.invalid', rememberForSite: true, settings: cloneDefaultSettings() });
  for (const type of ['SET_SITE_MEMORY', 'PATCH_TAB_SETTINGS']) {
    const reply = await request(type, { enabled: true, patch: { volume: 0.42 } });
    assert.equal(reply.ok, false);
    assert.match(reply.error, /tab navigated/);
    assert.deepEqual(config.profiles, {});
  }
  assert.deepEqual(audioMessages, []);
});

test('current-site edits still persist remembered volume and can remove site memory', async () => {
  session.set('tab:7', { active: true, hostname: 'fixture.invalid', rememberForSite: true, settings: cloneDefaultSettings() });
  const patched = await request('PATCH_TAB_SETTINGS', { patch: { volume: 0.42 } });
  assert.equal(patched.ok, true, patched.error);
  assert.equal(config.profiles['fixture.invalid'].volume, 0.42);
  assert.equal((await request('SET_SITE_MEMORY', { enabled: false })).ok, true);
  assert.deepEqual(config.profiles, {});
  assert.equal(session.get('tab:7').rememberForSite, false);
});

test('legacy configs above import limits remain readable, usable and reducible', async () => {
  config.profiles = Object.fromEntries(Array.from({ length: 501 }, (_, index) => [`site${index}.invalid`, { volume: 0.42 }]));
  config.userPresets = Object.fromEntries(Array.from({ length: 501 }, (_, index) => [`Preset ${index}`, {}]));
  const longName = 'x'.repeat(254);
  config.userPresets[longName] = { volume: 0.63 };
  const options = await request('GET_OPTIONS_DATA');
  assert.equal(options.ok, true, options.error);
  assert.equal(Object.keys(options.config.profiles).length, 501);
  assert.equal(options.config.userPresets[longName].volume, 0.63);
  assert.equal((await request('EXPORT_SETTINGS')).ok, true);
  assert.equal((await request('GET_TAB_STATE')).ok, true);
  assert.equal((await request('START_TAB')).ok, true);
  assert.equal((await request('DELETE_SITE_PROFILE', { hostname: 'site0.invalid' })).ok, true);
  assert.equal(Object.keys(config.profiles).length, 500);
  assert.equal((await request('DELETE_USER_PRESET', { name: longName })).ok, true);
  assert.equal(Object.keys(config.userPresets).length, 501);
  assert.equal((await request('IMPORT_SETTINGS', { document: config })).ok, false);
  assert.equal(Object.keys(config.userPresets).length, 501);
});

test('an awaited popup patch cannot overwrite a newer navigation', async () => {
  session.set('tab:7', { active: true, hostname: 'fixture.invalid', settings: cloneDefaultSettings() });
  config.profiles['next.invalid'] = { volume: 0.42 };
  let release;
  holdAudio = { type: 'AUDIO_PATCH', promise: new Promise(resolve => { release = resolve; }) };
  const patched = request('PATCH_TAB_SETTINGS', { patch: { volume: 0.23 } });
  await new Promise(setImmediate);
  tab.url = 'https://next.invalid/';
  updated(tab.id, { url: tab.url });
  await new Promise(setImmediate);
  assert.deepEqual(audioMessages.map(message => message.type), ['AUDIO_PATCH']);
  release();
  assert.equal((await patched).ok, true);
  const response = await request('GET_TAB_STATE');
  assert.equal(response.state.hostname, 'next.invalid');
  assert.equal(response.state.settings.volume, 0.42);
  assert.deepEqual(audioMessages.map(message => message.type), ['AUDIO_PATCH', 'AUDIO_REPLACE']);
});

test('queued popup edits keep their originating hostname after navigation', async () => {
  for (const type of ['PATCH_TAB_SETTINGS', 'SET_SITE_MEMORY', 'APPLY_PRESET', 'START_TAB']) {
    tab.url = 'https://fixture.invalid/';
    session.set('tab:7', { active: true, hostname: 'fixture.invalid', settings: cloneDefaultSettings() });
    let release;
    holdLocalRead = new Promise(resolve => { release = resolve; });
    updated(tab.id, { url: 'https://next.invalid/' });
    await new Promise(setImmediate);
    const stale = request(type, { patch: { volume: 0.23 }, enabled: true, name: 'Bass Boost' });
    await new Promise(setImmediate);
    tab.url = 'https://next.invalid/';
    holdLocalRead = null;
    release();
    const reply = await stale;
    assert.equal(reply.ok, false, type);
    assert.match(reply.error, /tab navigated/);
    assert.equal(session.get('tab:7').hostname, 'next.invalid');
    assert.equal(session.get('tab:7').settings.volume, 1);
    assert.deepEqual(config.profiles, {});
  }
});

test('removal, stop and audio failure finish after an in-flight popup patch', async () => {
  for (const close of ['remove', 'STOP_TAB', 'AUDIO_FAILED']) {
    session.set('tab:7', { active: true, hostname: 'fixture.invalid', settings: cloneDefaultSettings() });
    let release;
    holdAudio = { type: 'AUDIO_PATCH', promise: new Promise(resolve => { release = resolve; }) };
    const patched = request('PATCH_TAB_SETTINGS', { patch: { volume: 0.23 } });
    await new Promise(setImmediate);
    const closed = close === 'remove' ? removed(tab.id) : request(close, { tabId: tab.id });
    await new Promise(setImmediate);
    release();
    assert.equal((await patched).ok, true);
    await closed;
    const response = await request('GET_TAB_STATE');
    assert.equal(response.state.active, false, close);
    if (close !== 'AUDIO_FAILED') assert.equal(session.has('tab:7'), false, close);
  }
});
