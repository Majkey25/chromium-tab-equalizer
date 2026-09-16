import {
  BUILT_IN_PRESETS,
  applyPreset,
  applyUserPreset,
  cloneDefaultSettings,
  sanitizeSettings,
  validateImportDocument,
} from './lib/settings.js';
import { normalizeHostname, resolveNavigationSettings } from './lib/profile-resolution.js';

const LOCAL_KEY = 'config';
const SESSION_PREFIX = 'tab:';
let offscreenPromise = null;

function sessionKey(tabId) {
  return `${SESSION_PREFIX}${tabId}`;
}

function isSupportedUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

async function readConfig() {
  const stored = await chrome.storage.local.get(LOCAL_KEY);
  const config = stored[LOCAL_KEY];
  if (!config || config.schemaVersion !== 1) {
    return { schemaVersion: 1, profiles: {}, userPresets: {}, preferences: {} };
  }
  return validateImportDocument(config);
}

async function writeConfig(config) {
  const clean = validateImportDocument(config);
  await chrome.storage.local.set({ [LOCAL_KEY]: clean });
  return clean;
}

async function readTabState(tabId) {
  return (await chrome.storage.session.get(sessionKey(tabId)))[sessionKey(tabId)] ?? null;
}

async function writeTabState(tabId, state) {
  await chrome.storage.session.set({ [sessionKey(tabId)]: state });
  return state;
}

async function clearTabState(tabId) {
  await chrome.storage.session.remove(sessionKey(tabId));
}

async function getActiveTab(sender) {
  if (sender?.tab?.id != null) return sender.tab;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab is available.');
  return tab;
}

async function ensureOffscreen() {
  const url = chrome.runtime.getURL('offscreen.html');
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [url],
  });
  if (contexts.length) return;
  if (!offscreenPromise) {
    offscreenPromise = chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['USER_MEDIA'],
      justification: 'Process explicitly captured tab audio with the Web Audio API.',
    }).finally(() => { offscreenPromise = null; });
  }
  await offscreenPromise;
}

async function sendOffscreen(message) {
  await ensureOffscreen();
  const response = await chrome.runtime.sendMessage({ ...message, target: 'offscreen' });
  if (!response?.ok) throw new Error(response?.error || 'Audio engine did not accept the request.');
  return response;
}

function mergeSettings(current, patch) {
  return sanitizeSettings({
    ...current,
    ...patch,
    eq: { ...current.eq, ...(patch?.eq ?? {}) },
    compressor: { ...current.compressor, ...(patch?.compressor ?? {}) },
  });
}

function inactiveState(tab, config, error = null) {
  let hostname = '';
  let settings = cloneDefaultSettings();
  let rememberForSite = false;
  if (isSupportedUrl(tab?.url)) {
    hostname = normalizeHostname(tab.url);
    if (config.profiles[hostname]) {
      settings = sanitizeSettings(config.profiles[hostname]);
      rememberForSite = true;
    }
  }
  settings.enabled = false;
  return { tabId: tab?.id ?? null, active: false, url: tab?.url ?? '', hostname, settings, rememberForSite, error };
}

async function getTabState(tab) {
  const config = await readConfig();
  const state = await readTabState(tab.id);
  return state ?? inactiveState(tab, config);
}

async function startTab(sender) {
  const tab = await getActiveTab(sender);
  if (!isSupportedUrl(tab.url)) throw new Error('This page cannot be captured. Open a normal http(s) tab.');

  const existing = await readTabState(tab.id);
  if (existing?.active) return existing;

  // Keep the capture grant as close as possible to the explicit popup click.
  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
  const config = await readConfig();
  const resolved = resolveNavigationSettings({ url: tab.url, profiles: config.profiles, temporaryAfterNavigation: null });
  const settings = sanitizeSettings({ ...resolved.settings, enabled: true });
  const state = {
    tabId: tab.id,
    active: true,
    url: tab.url,
    hostname: resolved.hostname,
    settings,
    rememberForSite: resolved.source === 'site',
    error: null,
  };

  try {
    await sendOffscreen({ type: 'AUDIO_START', tabId: tab.id, streamId, settings });
    return await writeTabState(tab.id, state);
  } catch (error) {
    await clearTabState(tab.id);
    throw new Error(`Could not start tab audio processing: ${error.message}`);
  }
}

async function stopTab(tabId) {
  try {
    const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
    if (contexts.length) await chrome.runtime.sendMessage({ target: 'offscreen', type: 'AUDIO_STOP', tabId });
  } catch {
    // Cleanup still continues even when the offscreen document is already gone.
  }
  await clearTabState(tabId);
}

async function patchTab(tab, patch) {
  const state = await readTabState(tab.id);
  if (!state?.active) throw new Error('Enable processing for this tab first.');
  const settings = mergeSettings(state.settings, patch);
  settings.enabled = true;
  const next = { ...state, settings, error: null };
  await sendOffscreen({ type: 'AUDIO_PATCH', tabId: tab.id, settings });
  await writeTabState(tab.id, next);

  if (next.rememberForSite && next.hostname) {
    const config = await readConfig();
    config.profiles[next.hostname] = settings;
    await writeConfig(config);
  }
  return next;
}

async function setSiteMemory(tab, enabled) {
  const state = await readTabState(tab.id);
  if (!state?.active || !state.hostname) throw new Error('Enable processing on a normal website first.');
  const config = await readConfig();
  if (enabled) config.profiles[state.hostname] = sanitizeSettings(state.settings);
  else delete config.profiles[state.hostname];
  await writeConfig(config);
  const next = { ...state, rememberForSite: Boolean(enabled) };
  await writeTabState(tab.id, next);
  return next;
}

async function applyNamedPreset(tab, name) {
  const state = await readTabState(tab.id);
  if (!state?.active) throw new Error('Enable processing for this tab first.');
  const config = await readConfig();
  let settings;
  if (name in BUILT_IN_PRESETS) {
    settings = applyPreset(name, state.settings);
  } else if (config.userPresets[name]) {
    settings = applyUserPreset(name, config.userPresets[name], state.settings);
  } else {
    throw new Error(`Preset not found: ${name}`);
  }
  return patchTab(tab, settings);
}

async function saveUserPreset(name, settings) {
  const cleanName = String(name ?? '').trim().slice(0, 80);
  if (!cleanName) throw new Error('Preset name is required.');
  if (cleanName in BUILT_IN_PRESETS) throw new Error('Choose a name different from a built-in preset.');
  const config = await readConfig();
  const snapshot = sanitizeSettings(settings);
  snapshot.enabled = false;
  snapshot.muted = false;
  snapshot.bypass = false;
  snapshot.preset = cleanName;
  config.userPresets[cleanName] = snapshot;
  await writeConfig(config);
  return config;
}

async function handleMessage(message, sender) {
  if (!message || message.target === 'offscreen') return undefined;
  if (message.type === 'AUDIO_FAILED') {
    const tabId = Number(message.tabId);
    const previous = await readTabState(tabId);
    if (previous) {
      const settings = sanitizeSettings({ ...previous.settings, enabled: false });
      await writeTabState(tabId, { ...previous, active: false, settings, error: String(message.error || 'Audio processing stopped.') });
    }
    return { ok: true };
  }

  const tab = ['GET_TAB_STATE', 'START_TAB', 'PATCH_TAB_SETTINGS', 'SET_SITE_MEMORY', 'APPLY_PRESET', 'STOP_TAB']
    .includes(message.type) ? await getActiveTab(sender) : null;

  switch (message.type) {
    case 'GET_TAB_STATE':
      return { ok: true, state: await getTabState(tab) };
    case 'START_TAB':
      return { ok: true, state: await startTab(sender) };
    case 'STOP_TAB':
      await stopTab(tab.id);
      return { ok: true, state: await getTabState(tab) };
    case 'PATCH_TAB_SETTINGS':
      return { ok: true, state: await patchTab(tab, message.patch ?? {}) };
    case 'SET_SITE_MEMORY':
      return { ok: true, state: await setSiteMemory(tab, Boolean(message.enabled)) };
    case 'APPLY_PRESET':
      return { ok: true, state: await applyNamedPreset(tab, String(message.name ?? '')) };
    case 'GET_OPTIONS_DATA':
      return { ok: true, config: await readConfig() };
    case 'SAVE_USER_PRESET':
      return { ok: true, config: await saveUserPreset(message.name, message.settings) };
    case 'DELETE_USER_PRESET': { const config = await readConfig(); delete config.userPresets[String(message.name ?? '')]; return { ok: true, config: await writeConfig(config) }; }
    case 'DELETE_SITE_PROFILE': { const config = await readConfig(); delete config.profiles[String(message.hostname ?? '')]; return { ok: true, config: await writeConfig(config) }; }
    case 'IMPORT_SETTINGS':
      return { ok: true, config: await writeConfig(validateImportDocument(message.document)) };
    case 'EXPORT_SETTINGS':
      return { ok: true, document: await readConfig() };
    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.target === 'offscreen') return false;
  handleMessage(message, sender)
    .then((response) => { if (response !== undefined) sendResponse(response); })
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  stopTab(tabId).catch(() => {});
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!changeInfo.url) return;
  (async () => {
    const state = await readTabState(tabId);
    if (!state?.active) return;
    if (!isSupportedUrl(changeInfo.url)) {
      await stopTab(tabId);
      return;
    }
    const config = await readConfig();
    const resolved = resolveNavigationSettings({ url: changeInfo.url, profiles: config.profiles, temporaryAfterNavigation: null });
    const settings = sanitizeSettings({ ...resolved.settings, enabled: true });
    const next = {
      ...state,
      url: changeInfo.url,
      hostname: resolved.hostname,
      settings,
      rememberForSite: resolved.source === 'site',
      error: null,
    };
    try {
      await sendOffscreen({ type: 'AUDIO_REPLACE', tabId, settings });
      await writeTabState(tabId, next);
    } catch (error) {
      settings.enabled = false;
      await writeTabState(tabId, { ...next, active: false, settings, error: `Audio processing stopped: ${error.message}` });
    }
  })().catch(() => {});
});
