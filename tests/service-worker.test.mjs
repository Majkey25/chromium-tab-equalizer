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

globalThis.chrome = {
  storage: {
    local: {
      async get(key) { localReads += 1; return { [key]: config }; },
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
    async sendMessage(message) { audioMessages.push(message); return { ok: true }; }
  },
  offscreen: { async createDocument() {} },
  tabs: {
    async query() { return [tab]; },
    onRemoved: { addListener() {} },
    onUpdated: { addListener(value) { updated = value; } }
  }
};
await import('../extension/service-worker.js');

beforeEach(() => {
  session.clear();
  config = { schemaVersion: 1, profiles: {}, userPresets: {}, preferences: {} };
  localReads = 0;
  sessionReads = 0;
  audioMessages = [];
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
