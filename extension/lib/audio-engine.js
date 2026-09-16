import { EQ_BANDS, sanitizeSettings } from './settings.js';

export function dbToGain(db) {
  return 10 ** (Number(db) / 20);
}

function safeDisconnect(node) {
  try { node.disconnect(); } catch { /* already disconnected */ }
}

export function createAudioGraph(context, source, initialSettings) {
  const preamp = context.createGain();
  const filters = EQ_BANDS.map((frequency) => {
    const filter = context.createBiquadFilter();
    filter.type = 'peaking';
    filter.frequency.value = frequency;
    filter.Q.value = 1;
    return filter;
  });
  const compressor = context.createDynamicsCompressor();
  const stereoGain = context.createGain();
  const splitter = context.createChannelSplitter(2);
  const leftGain = context.createGain();
  const rightGain = context.createGain();
  const monoMerger = context.createChannelMerger(2);
  const monoGain = context.createGain();
  const panner = context.createStereoPanner();
  const processedGain = context.createGain();
  const bypassGain = context.createGain();
  const master = context.createGain();
  const limiter = context.createDynamicsCompressor();

  source.connect(preamp);
  let cursor = preamp;
  for (const filter of filters) {
    cursor.connect(filter);
    cursor = filter;
  }
  cursor.connect(compressor);

  compressor.connect(stereoGain);
  stereoGain.connect(panner);

  compressor.connect(splitter);
  leftGain.gain.value = 0.5;
  rightGain.gain.value = 0.5;
  splitter.connect(leftGain, 0, 0);
  splitter.connect(rightGain, 1, 0);
  leftGain.connect(monoMerger, 0, 0);
  leftGain.connect(monoMerger, 0, 1);
  rightGain.connect(monoMerger, 0, 0);
  rightGain.connect(monoMerger, 0, 1);
  monoMerger.connect(monoGain);
  monoGain.connect(panner);

  panner.connect(processedGain);
  processedGain.connect(master);
  source.connect(bypassGain);
  bypassGain.connect(master);
  master.connect(limiter);
  limiter.connect(context.destination);

  const graph = {
    context,
    source,
    preamp,
    filters,
    compressor,
    stereoGain,
    splitter,
    leftGain,
    rightGain,
    monoMerger,
    monoGain,
    panner,
    processedGain,
    bypassGain,
    master,
    limiter,
    settings: null,
    apply(settings) {
      const clean = sanitizeSettings(settings);
      graph.settings = clean;
      preamp.gain.value = dbToGain(clean.preamp);
      filters.forEach((filter, index) => { filter.gain.value = clean.eq[EQ_BANDS[index]]; });

      compressor.threshold.value = clean.compressor.enabled ? clean.compressor.threshold : 0;
      compressor.knee.value = clean.compressor.enabled ? 12 : 0;
      compressor.ratio.value = clean.compressor.enabled ? clean.compressor.ratio : 1;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;

      stereoGain.gain.value = clean.mono ? 0 : 1;
      monoGain.gain.value = clean.mono ? 1 : 0;
      panner.pan.value = clean.balance;
      processedGain.gain.value = clean.bypass ? 0 : 1;
      bypassGain.gain.value = clean.bypass ? 1 : 0;
      master.gain.value = clean.muted ? 0 : clean.volume;

      limiter.threshold.value = clean.limiter ? -1 : 0;
      limiter.knee.value = 0;
      limiter.ratio.value = clean.limiter ? 20 : 1;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.1;
      return clean;
    },
    destroy() {
      for (const node of [source, preamp, ...filters, compressor, stereoGain, splitter, leftGain, rightGain,
        monoMerger, monoGain, panner, processedGain, bypassGain, master, limiter]) safeDisconnect(node);
    },
  };

  graph.apply(initialSettings);
  return graph;
}
