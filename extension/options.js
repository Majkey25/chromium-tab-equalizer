const $ = (selector) => document.querySelector(selector);
const profilesEl = $('#profiles');
const presetsEl = $('#presets');
const profileCount = $('#profile-count');
const presetCount = $('#preset-count');
const messageEl = $('#message');
const errorEl = $('#error');
const importFile = $('#import-file');
let config = { schemaVersion: 1, profiles: {}, userPresets: {}, preferences: {} };

async function request(type, data = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...data });
  if (!response?.ok) throw new Error(response?.error || 'Extension request failed.');
  return response;
}

function setMessage(message = '', error = '') {
  messageEl.textContent = message;
  errorEl.textContent = error;
  errorEl.hidden = !error;
}

function summary(settings) {
  const volume = Math.round((settings.volume ?? 1) * 100);
  return `${settings.preset || 'Custom'} · ${volume}% volume`;
}

function row(title, subtitle, onDelete) {
  const wrapper = document.createElement('div');
  wrapper.className = 'row';
  const text = document.createElement('div');
  const strong = document.createElement('strong');
  strong.textContent = title;
  const small = document.createElement('span');
  small.textContent = subtitle;
  text.append(strong, small);
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Delete';
  button.addEventListener('click', onDelete);
  wrapper.append(text, button);
  return wrapper;
}

function render() {
  profilesEl.replaceChildren();
  presetsEl.replaceChildren();
  const profiles = Object.entries(config.profiles).sort(([a], [b]) => a.localeCompare(b));
  const presets = Object.entries(config.userPresets).sort(([a], [b]) => a.localeCompare(b));
  profileCount.textContent = String(profiles.length);
  presetCount.textContent = String(presets.length);

  if (!profiles.length) {
    const p = document.createElement('p'); p.className = 'empty'; p.textContent = 'No saved site profiles.'; profilesEl.append(p);
  } else {
    for (const [hostname, settings] of profiles) {
      profilesEl.append(row(hostname, summary(settings), async () => {
        try { config = (await request('DELETE_SITE_PROFILE', { hostname })).config; render(); setMessage(`Removed ${hostname}.`); }
        catch (error) { setMessage('', error.message); }
      }));
    }
  }

  if (!presets.length) {
    const p = document.createElement('p'); p.className = 'empty'; p.textContent = 'No custom presets yet.'; presetsEl.append(p);
  } else {
    for (const [name, settings] of presets) {
      presetsEl.append(row(name, summary(settings), async () => {
        try { config = (await request('DELETE_USER_PRESET', { name })).config; render(); setMessage(`Removed preset ${name}.`); }
        catch (error) { setMessage('', error.message); }
      }));
    }
  }
}

$('#export').addEventListener('click', async () => {
  try {
    const documentData = (await request('EXPORT_SETTINGS')).document;
    const blob = new Blob([`${JSON.stringify(documentData, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'chromium-tab-equalizer-settings.json';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    setMessage('Export created.');
  } catch (error) { setMessage('', error.message); }
});

$('#import-button').addEventListener('click', () => importFile.click());
importFile.addEventListener('change', async () => {
  const [file] = importFile.files;
  importFile.value = '';
  if (!file) return;
  try {
    const documentData = JSON.parse(await file.text());
    if (!confirm('Replace all saved site profiles and custom presets with this file?')) return;
    config = (await request('IMPORT_SETTINGS', { document: documentData })).config;
    render();
    setMessage('Settings imported.');
  } catch (error) { setMessage('', `Import failed: ${error.message}`); }
});

$('#clear-all').addEventListener('click', async () => {
  if (!confirm('Delete all saved site profiles and custom presets?')) return;
  try {
    config = (await request('IMPORT_SETTINGS', { document: { schemaVersion: 1, profiles: {}, userPresets: {}, preferences: {} } })).config;
    render();
    setMessage('Saved data cleared.');
  } catch (error) { setMessage('', error.message); }
});

request('GET_OPTIONS_DATA')
  .then((response) => { config = response.config; render(); })
  .catch((error) => setMessage('', error.message));
