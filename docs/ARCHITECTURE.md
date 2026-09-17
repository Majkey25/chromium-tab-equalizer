# Architecture

Chromium Tab Equalizer is a Manifest V3 extension that keeps audio processing isolated to explicitly activated tabs.

## Components

### Service worker

`extension/service-worker.js`

Responsibilities:

- coordinates tab activation and shutdown
- obtains tab-capture stream IDs after explicit user action
- owns high-level per-tab state and navigation cleanup
- communicates with the offscreen audio engine
- loads and persists site/preset configuration

The service worker does not process audio directly.

### Offscreen audio engine

`extension/offscreen.html` and `extension/offscreen.js`

Responsibilities:

- consumes captured tab media streams
- owns the long-lived `AudioContext`
- creates one processing graph per active tab
- keeps processing alive after the popup closes
- tears graphs down when capture stops or a tab is removed

### Popup

`extension/popup.html`, `popup.css`, and `popup.js`

The popup is a controller, not the audio engine. It reads the active-tab state, sends setting changes, applies presets, and controls enable/disable, mute, bypass, resets, and site memory.

Closing the popup does not stop processing.

### Options page

`extension/options.html`, `options.css`, and `options.js`

Provides management for saved site profiles, custom presets, and local JSON import/export.

## Audio graph

Each active tab uses a graph conceptually equivalent to:

```text
MediaStreamAudioSource
  -> preamp
  -> 10-band EQ
  -> compressor
  -> mono/stereo + balance
  -> master volume
  -> limiter
  -> AudioContext destination
```

Bypass preserves the captured stream while routing around EQ/compressor processing. Disable stops capture and destroys the tab graph.

## State model

### Temporary tab state

Stored in `chrome.storage.session` so changes are temporary by default and can survive service-worker suspension within the browser session.

### Persistent configuration

Stored in `chrome.storage.local` only when the user explicitly saves a site profile or custom preset.

No project-controlled server receives settings or audio.

## Privacy and permissions

The extension intentionally has no host permissions. It operates on tabs through explicit extension activation and Chromium capture APIs rather than injecting broad page scripts.

The extension has no telemetry, analytics, user accounts, cloud sync service, or backend API.

## Release validation

The repository CI runs:

1. static checks
2. unit tests
3. a real unpacked-extension Chromium integration test
4. deterministic packaging
5. artifact upload

On successful pushes to `main`, the workflow publishes a stable GitHub Release when the manifest version does not already have one.
