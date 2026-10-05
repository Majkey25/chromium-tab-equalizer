import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { cloneDefaultSettings } from '../extension/lib/settings.js';

const tab = { id: 7, url: 'https://fixture.invalid/' };
const session = new Map();
let config;
let localReads;
let sessionReads;
let listener;

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
    async getContexts() { return []; }
  },
  tabs: {
    async query() { return [tab]; },
    onRemoved: { addListener() {} },
    onUpdated: { addListener() {} }
  }
};
await import('../extension/service-worker.js');

beforeEach(() => {
  session.clear();
  config = { schemaVersion: 1, profiles: {}, userPresets: {}, preferences: {} };
  localReads = 0;
  sessionReads = 0;
});

function request(type) {
  return new Promise(resolve => listener({ type }, {}, resolve));
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
