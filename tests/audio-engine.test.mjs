import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudioGraph, dbToGain } from '../extension/lib/audio-engine.js';
import { sanitizeSettings } from '../extension/lib/settings.js';

class Param { constructor(value = 0) { this.value = value; } }
class Node {
  constructor(kind) { this.kind = kind; this.connections = []; }
  connect(target, output = 0, input = 0) { this.connections.push({ target, output, input }); return target; }
  disconnect() { this.connections = []; }
}
class Gain extends Node { constructor() { super('gain'); this.gain = new Param(1); } }
class Filter extends Node { constructor() { super('filter'); this.type = ''; this.frequency = new Param(); this.Q = new Param(); this.gain = new Param(); } }
class Compressor extends Node {
  constructor() { super('compressor'); this.threshold = new Param(-24); this.knee = new Param(30); this.ratio = new Param(12); this.attack = new Param(0.003); this.release = new Param(0.25); }
}
class Panner extends Node { constructor() { super('panner'); this.pan = new Param(0); } }
class Context {
  constructor() { this.destination = new Node('destination'); }
  createGain() { return new Gain(); }
  createBiquadFilter() { return new Filter(); }
  createDynamicsCompressor() { return new Compressor(); }
  createStereoPanner() { return new Panner(); }
  createChannelSplitter() { return new Node('splitter'); }
  createChannelMerger() { return new Node('merger'); }
}

test('converts decibels to linear gain', () => {
  assert.ok(Math.abs(dbToGain(6) - 1.9952623149688795) < 1e-12);
  assert.equal(dbToGain(0), 1);
});

test('creates ten exact peaking filters and applies settings', () => {
  const context = new Context();
  const source = new Node('source');
  const settings = sanitizeSettings({
    preamp: 6,
    volume: 1.5,
    balance: -0.5,
    mono: true,
    bypass: false,
    eq: { 62: 4 },
    compressor: { enabled: true, threshold: -30, ratio: 6 },
    limiter: true,
  });
  const graph = createAudioGraph(context, source, settings);

  assert.equal(graph.filters.length, 10);
  assert.deepEqual(graph.filters.map((node) => node.frequency.value), [31,62,125,250,500,1000,2000,4000,8000,16000]);
  assert.ok(graph.filters.every((node) => node.type === 'peaking' && node.Q.value === 1));
  assert.equal(graph.filters[1].gain.value, 4);
  assert.ok(Math.abs(graph.preamp.gain.value - dbToGain(6)) < 1e-12);
  assert.equal(graph.master.gain.value, 1.5);
  assert.equal(graph.panner.pan.value, -0.5);
  assert.equal(graph.stereoGain.gain.value, 0);
  assert.equal(graph.monoGain.gain.value, 1);
  assert.equal(graph.compressor.threshold.value, -30);
  assert.equal(graph.compressor.ratio.value, 6);
  assert.equal(graph.limiter.threshold.value, -1);
  assert.equal(graph.limiter.ratio.value, 20);
});

test('bypass switches to direct source path while retaining master and limiter', () => {
  const context = new Context();
  const source = new Node('source');
  const graph = createAudioGraph(context, source, sanitizeSettings({ bypass: true, muted: true, limiter: false }));
  assert.equal(graph.processedGain.gain.value, 0);
  assert.equal(graph.bypassGain.gain.value, 1);
  assert.equal(graph.master.gain.value, 0);
  assert.equal(graph.limiter.ratio.value, 1);
  assert.equal(graph.limiter.threshold.value, 0);
});

test('apply updates graph in place', () => {
  const graph = createAudioGraph(new Context(), new Node('source'), sanitizeSettings({}));
  graph.apply(sanitizeSettings({ volume: 0.4, eq: { 1000: -5 }, compressor: { enabled: false }, mono: false, bypass: false }));
  assert.equal(graph.master.gain.value, 0.4);
  assert.equal(graph.filters[5].gain.value, -5);
  assert.equal(graph.compressor.ratio.value, 1);
  assert.equal(graph.stereoGain.gain.value, 1);
  assert.equal(graph.monoGain.gain.value, 0);
});
