import { cloneDefaultSettings, EQ_BANDS } from './lib/settings.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const elements = {
  hostname: $('#hostname'), status: $('#status'), error: $('#error'), power: $('#power'), mute: $('#mute'),
  volume: $('#volume'), volumeValue: $('#volume-value'), preamp: $('#preamp'), preampValue: $('#preamp-value'),
  balance: $('#balance'), balanceValue: $('#balance-value'), mono: $('#mono'), compressor: $('#compressor'),
  threshold: $('#threshold'), thresholdValue: $('#threshold-value'), ratio: $('#ratio'), ratioValue: $('#ratio-value'),
  limiter: $('#limiter'), remember: $('#remember'), rememberHost: $('#remember-host'), bypass: $('#bypass'), reset: $('#reset'),
  options: $('#options'), compressorControls: $('#compressor-controls'), userPreset: $('#user-preset'), savePreset: $('#save-preset'),
  savePresetForm: $('#save-preset-form'), presetName: $('#preset-name'),
};

let state = null;
let rendering = false;
let pendingPatch = null;
let patchFrame = null;
let userPresets = {};

async function request(type, data = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...data });
  if (!response?.ok) throw new Error(response?.error || 'Extension request failed.');
  return response;
}

function renderUserPresets() {
  const current = elements.userPreset.value;
  elements.userPreset.replaceChildren(new Option('Custom presets', ''));
  for (const name of Object.keys(userPresets).sort((a, b) => a.localeCompare(b))) elements.userPreset.append(new Option(name, name));
  if (userPresets[current]) elements.userPreset.value = current;
}

async function refreshUserPresets() {
  const response = await request('GET_OPTIONS_DATA');
  userPresets = response.config.userPresets ?? {};
  renderUserPresets();
}

function showError(message = '') {
  elements.error.hidden = !message;
  elements.error.textContent = message;
}

function setControlsDisabled(disabled) {
  for (const control of $$('input, button[data-preset], #mute, #bypass, #reset, [data-reset-section]')) control.disabled = disabled;
  elements.power.disabled = false;
  elements.options.disabled = false;
  elements.remember.disabled = disabled;
}

function formatDb(value) {
  const number = Number(value);
  return `${number > 0 ? '+' : ''}${number.toFixed(number % 1 ? 1 : 0)} dB`;
}

function render(next) {
  state = next;
  rendering = true;
  showError(next.error || '');
  elements.hostname.textContent = next.hostname || 'Current tab';
  elements.rememberHost.textContent = next.hostname || '';
  elements.status.textContent = next.active ? 'Audio processing active for this tab.' : 'Not active for this tab.';
  elements.power.textContent = next.active ? 'Disable' : 'Enable';
  elements.power.setAttribute('aria-pressed', String(next.active));

  const s = next.settings;
  elements.volume.value = Math.round(s.volume * 100);
  elements.volumeValue.value = `${Math.round(s.volume * 100)}%`;
  elements.preamp.value = s.preamp;
  elements.preampValue.value = formatDb(s.preamp);
  elements.balance.value = Math.round(s.balance * 100);
  elements.balanceValue.value = s.balance === 0 ? 'Center' : `${Math.abs(Math.round(s.balance * 100))}% ${s.balance < 0 ? 'L' : 'R'}`;
  elements.mono.checked = s.mono;
  elements.compressor.checked = s.compressor.enabled;
  elements.threshold.value = s.compressor.threshold;
  elements.thresholdValue.value = formatDb(s.compressor.threshold);
  elements.ratio.value = s.compressor.ratio;
  elements.ratioValue.value = `${s.compressor.ratio}:1`;
  elements.limiter.checked = s.limiter;
  elements.mute.setAttribute('aria-pressed', String(s.muted));
  elements.bypass.setAttribute('aria-pressed', String(s.bypass));
  elements.remember.checked = next.rememberForSite;
  elements.compressorControls.hidden = !s.compressor.enabled;
  for (const hz of EQ_BANDS) {
    const input = $(`[data-eq="${hz}"]`);
    input.value = s.eq[hz];
    input.title = formatDb(s.eq[hz]);
  }
  for (const button of $$('[data-preset]')) button.setAttribute('aria-pressed', String(button.dataset.preset === s.preset));
  setControlsDisabled(!next.active);
  rendering = false;
}

function resetSection(section) {
  const defaults = cloneDefaultSettings();
  const resetters = {
    level: () => schedulePatch({ volume: defaults.volume, preamp: defaults.preamp, muted: defaults.muted, preset: 'Custom' }),
    eq: () => schedulePatch({ eq: { ...defaults.eq }, preset: defaults.preset }),
    advanced: () => schedulePatch({ balance: defaults.balance, mono: defaults.mono, compressor: { ...defaults.compressor }, limiter: defaults.limiter, preset: 'Custom' }),
  };
  resetters[section]?.();
}

function schedulePatch(patch) {
  if (rendering || !state?.active) return;
  pendingPatch = {
    ...(pendingPatch ?? {}),
    ...patch,
    eq: { ...(pendingPatch?.eq ?? {}), ...(patch.eq ?? {}) },
    compressor: { ...(pendingPatch?.compressor ?? {}), ...(patch.compressor ?? {}) },
  };
  if (patchFrame != null) return;
  patchFrame = requestAnimationFrame(async () => {
    const outgoing = pendingPatch;
    pendingPatch = null;
    patchFrame = null;
    try {
      const response = await request('PATCH_TAB_SETTINGS', { patch: outgoing });
      render(response.state);
    } catch (error) {
      showError(error.message);
    }
  });
}

elements.power.addEventListener('click', async () => {
  showError();
  elements.power.disabled = true;
  try {
    const response = await request(state?.active ? 'STOP_TAB' : 'START_TAB');
    render(response.state);
  } catch (error) {
    showError(error.message);
  } finally {
    elements.power.disabled = false;
  }
});

elements.volume.addEventListener('input', () => {
  elements.volumeValue.value = `${elements.volume.value}%`;
  schedulePatch({ volume: Number(elements.volume.value) / 100, preset: 'Custom' });
});
elements.preamp.addEventListener('input', () => {
  elements.preampValue.value = formatDb(elements.preamp.value);
  schedulePatch({ preamp: Number(elements.preamp.value), preset: 'Custom' });
});
elements.balance.addEventListener('input', () => {
  const value = Number(elements.balance.value) / 100;
  elements.balanceValue.value = value === 0 ? 'Center' : `${Math.abs(Math.round(value * 100))}% ${value < 0 ? 'L' : 'R'}`;
  schedulePatch({ balance: value, preset: 'Custom' });
});
for (const input of $$('[data-eq]')) input.addEventListener('input', () => {
  input.title = formatDb(input.value);
  schedulePatch({ eq: { [input.dataset.eq]: Number(input.value) }, preset: 'Custom' });
});
elements.mono.addEventListener('change', () => schedulePatch({ mono: elements.mono.checked, preset: 'Custom' }));
elements.compressor.addEventListener('change', () => {
  elements.compressorControls.hidden = !elements.compressor.checked;
  schedulePatch({ compressor: { enabled: elements.compressor.checked }, preset: 'Custom' });
});
elements.threshold.addEventListener('input', () => {
  elements.thresholdValue.value = formatDb(elements.threshold.value);
  schedulePatch({ compressor: { threshold: Number(elements.threshold.value) }, preset: 'Custom' });
});
elements.ratio.addEventListener('input', () => {
  elements.ratioValue.value = `${elements.ratio.value}:1`;
  schedulePatch({ compressor: { ratio: Number(elements.ratio.value) }, preset: 'Custom' });
});
elements.limiter.addEventListener('change', () => schedulePatch({ limiter: elements.limiter.checked, preset: 'Custom' }));
elements.mute.addEventListener('click', () => schedulePatch({ muted: !state.settings.muted }));
elements.bypass.addEventListener('click', () => schedulePatch({ bypass: !state.settings.bypass }));

for (const button of $$('[data-preset]')) button.addEventListener('click', async () => {
  try { render((await request('APPLY_PRESET', { name: button.dataset.preset })).state); }
  catch (error) { showError(error.message); }
});

for (const button of $$('[data-reset-section]')) button.addEventListener('click', (event) => {
  event.preventDefault();
  resetSection(button.dataset.resetSection);
});

elements.remember.addEventListener('change', async () => {
  try { render((await request('SET_SITE_MEMORY', { enabled: elements.remember.checked })).state); }
  catch (error) { showError(error.message); }
});

elements.reset.addEventListener('click', () => {
  const defaults = cloneDefaultSettings();
  defaults.enabled = true;
  schedulePatch(defaults);
});

elements.userPreset.addEventListener('change', async () => {
  if (!elements.userPreset.value) return;
  try { render((await request('APPLY_PRESET', { name: elements.userPreset.value })).state); }
  catch (error) { showError(error.message); }
  finally { elements.userPreset.value = ''; }
});

elements.savePreset.addEventListener('click', () => {
  elements.savePresetForm.hidden = false;
  elements.presetName.focus();
});
elements.savePresetForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = elements.presetName.value.trim();
  if (!name || !state?.active) return;
  try {
    const response = await request('SAVE_USER_PRESET', { name, settings: state.settings });
    userPresets = response.config.userPresets ?? {};
    renderUserPresets();
    elements.presetName.value = '';
    elements.savePresetForm.hidden = true;
  } catch (error) { showError(error.message); }
});

elements.options.addEventListener('click', () => chrome.runtime.openOptionsPage());

Promise.all([request('GET_TAB_STATE'), refreshUserPresets()])
  .then(([response]) => render(response.state))
  .catch((error) => {
    const defaults = cloneDefaultSettings();
    render({ active: false, hostname: '', rememberForSite: false, settings: defaults, error: error.message });
  });
