import { createAudioGraph } from './lib/audio-engine.js';
import { sanitizeSettings } from './lib/settings.js';

const graphs = new Map();
let audioContext = null;

async function ensureContext() {
  if (!audioContext || audioContext.state === 'closed') audioContext = new AudioContext();
  if (audioContext.state === 'suspended') await audioContext.resume();
  return audioContext;
}

async function destroyGraph(tabId) {
  const record = graphs.get(tabId);
  if (!record) return;
  graphs.delete(tabId);
  for (const track of record.stream.getTracks()) {
    track.onended = null;
    track.stop();
  }
  record.graph.destroy();
  if (graphs.size === 0 && audioContext && audioContext.state !== 'closed') {
    const context = audioContext;
    audioContext = null;
    await context.close();
  }
}

async function startGraph({ tabId, streamId, settings }) {
  await destroyGraph(tabId);
  const context = await ensureContext();
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId,
      },
    },
    video: false,
  });
  const source = context.createMediaStreamSource(stream);
  const graph = createAudioGraph(context, source, sanitizeSettings(settings));
  const record = { stream, graph };
  graphs.set(tabId, record);
  for (const track of stream.getTracks()) {
    track.onended = () => { destroyGraph(tabId).catch(() => {}); };
  }
}

async function handleMessage(message) {
  const tabId = Number(message.tabId);
  if (!Number.isInteger(tabId)) throw new Error('Invalid tab ID.');
  switch (message.type) {
    case 'AUDIO_START':
      if (!message.streamId) throw new Error('Missing tab capture stream ID.');
      await startGraph({ tabId, streamId: message.streamId, settings: message.settings });
      break;
    case 'AUDIO_PATCH':
    case 'AUDIO_REPLACE': {
      const record = graphs.get(tabId);
      if (!record) throw new Error('No live audio graph exists for this tab.');
      record.graph.apply(sanitizeSettings(message.settings));
      break;
    }
    case 'AUDIO_STOP':
      await destroyGraph(tabId);
      break;
    default:
      throw new Error(`Unknown audio message: ${message.type}`);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== 'offscreen') return false;
  handleMessage(message)
    .then(() => sendResponse({ ok: true }))
    .catch(async (error) => {
      const tabId = Number(message.tabId);
      if (Number.isInteger(tabId)) await destroyGraph(tabId).catch(() => {});
      chrome.runtime.sendMessage({ type: 'AUDIO_FAILED', tabId, error: error.message }).catch(() => {});
      sendResponse({ ok: false, error: error.message });
    });
  return true;
});
