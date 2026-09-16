import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const extensionPath = path.resolve('extension');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function exists(file) { try { await access(file); return true; } catch { return false; } }
async function browserPath() {
  const candidates = [process.env.BROWSER_PATH, '/usr/bin/chromium', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'].filter(Boolean);
  for (const candidate of candidates) if (await exists(candidate)) return candidate;
  throw new Error('Set BROWSER_PATH to a Chromium/Chrome executable.');
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function startXvfb() {
  const child = spawn('Xvfb', ['-displayfd', '1', '-screen', '0', '1280x1024x24', '-nolisten', 'tcp'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const displayNumber = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Xvfb did not allocate a display: ${stderr}`)), 3000);
    child.stdout.once('data', (chunk) => {
      clearTimeout(timer);
      resolve(String(chunk).trim().split(/\s+/)[0]);
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Xvfb exited early with code ${code}: ${stderr}`));
    });
  });
  return { process: child, display: `:${displayNumber}` };
}

async function waitForDevTools(port, child) {
  for (let i = 0; i < 150; i++) {
    if (child.exitCode !== null) throw new Error(`Chromium exited early with code ${child.exitCode}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return;
    } catch {}
    await sleep(50);
  }
  throw new Error('Chromium did not expose the DevTools endpoint.');
}

async function targets(port) {
  return fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
}

async function waitForServiceWorker(port) {
  for (let i = 0; i < 120; i++) {
    const list = await targets(port);
    const target = list.find((item) => item.type === 'service_worker' && item.url.includes('/service-worker.js'));
    if (target) return target;
    await sleep(50);
  }
  throw new Error('Extension service worker did not load.');
}

class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.events = new Map();
  }
  async open() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
      } else {
        for (const handler of this.events.get(message.method) ?? []) handler(message.params);
      }
    });
    return this;
  }
  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  on(method, handler) {
    const handlers = this.events.get(method) ?? [];
    handlers.push(handler);
    this.events.set(method, handlers);
  }
  close() { this.ws.close(); }
}

async function newPage(port, url) {
  const target = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' }).then((r) => r.json());
  const cdp = await new Cdp(target.webSocketDebuggerUrl).open();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  const errors = [];
  cdp.on('Runtime.exceptionThrown', (params) => errors.push(params.exceptionDetails.text || 'Runtime exception'));
  const loaded = new Promise((resolve) => cdp.on('Page.loadEventFired', resolve));
  await cdp.send('Page.navigate', { url });
  await Promise.race([loaded, sleep(3000)]);
  return { target, cdp, errors };
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

test('real unpacked extension loads and core pages talk to the service worker', { timeout: 20000 }, async () => {
  const profile = await mkdtemp(path.join(tmpdir(), 'tab-eq-chromium-'));
  const executable = await browserPath();
  const port = await freePort();
  const xvfbSession = await startXvfb();
  const xvfb = xvfbSession.process;
  const display = xvfbSession.display;
  if (xvfb) await sleep(250);
  const child = spawn(executable, [
    '--no-sandbox', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    `--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, 'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, DISPLAY: display } });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });

  let popup;
  let options;
  try {
    try { await waitForDevTools(port, child); } catch (error) { throw new Error(`${error.message}\nDISPLAY=${display} XVFB_EXIT=${xvfb?.exitCode}\n${stderr}`); }
    const worker = await waitForServiceWorker(port);
    const match = worker.url.match(/^chrome-extension:\/\/([^/]+)\//);
    assert.ok(match, `Could not derive extension ID from ${worker.url}`);
    const extensionId = match[1];

    popup = await newPage(port, `chrome-extension://${extensionId}/popup.html`);
    assert.equal(await evaluate(popup.cdp, 'document.querySelectorAll("[data-eq]").length'), 10);
    assert.equal(await evaluate(popup.cdp, 'document.body.scrollWidth <= 380'), true);
    const popupState = await evaluate(popup.cdp, 'chrome.runtime.sendMessage({type:"GET_TAB_STATE"})');
    assert.equal(popupState.ok, true);

    options = await newPage(port, `chrome-extension://${extensionId}/options.html`);
    const imported = await evaluate(options.cdp, `chrome.runtime.sendMessage({type:'IMPORT_SETTINGS', document:{schemaVersion:1,profiles:{'youtube.com':{volume:0.42}},userPresets:{Test:{volume:0.33}},preferences:{}}})`);
    assert.equal(imported.ok, true);
    const exported = await evaluate(options.cdp, `chrome.runtime.sendMessage({type:'EXPORT_SETTINGS'})`);
    assert.equal(exported.document.profiles['youtube.com'].volume, 0.42);
    assert.equal(exported.document.userPresets.Test.volume, 0.33);

    const popupTabId = await evaluate(popup.cdp, 'chrome.tabs.getCurrent().then(t => t.id)');
    await evaluate(options.cdp, `chrome.storage.session.set({'tab:${popupTabId}': {active:false, probe:true}})`);
    await popup.cdp.send('Page.close');
    popup.cdp.close();
    popup = null;
    for (let i = 0; i < 40; i++) {
      const left = await evaluate(options.cdp, `chrome.storage.session.get('tab:${popupTabId}').then(v => Boolean(v['tab:${popupTabId}']))`);
      if (!left) break;
      await sleep(50);
      if (i === 39) assert.fail('tabs.onRemoved did not clear the tab session key');
    }

    assert.deepEqual(options.errors, []);
    await evaluate(options.cdp, `chrome.runtime.sendMessage({type:'IMPORT_SETTINGS', document:{schemaVersion:1,profiles:{},userPresets:{},preferences:{}}})`);
  } finally {
    if (popup) popup.cdp.close();
    if (options) options.cdp.close();
    child.kill('SIGTERM');
    await Promise.race([new Promise((resolve) => child.once('exit', resolve)), sleep(2000)]);
    if (child.exitCode === null) child.kill('SIGKILL');
    if (xvfb) xvfb.kill('SIGTERM');
    await sleep(150);
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  }

  assert.equal(/Failed to load extension|Manifest file is missing or unreadable/i.test(stderr), false, stderr);
});
