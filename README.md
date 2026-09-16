# Chromium Tab Equalizer

[![CI](https://github.com/Majkey25/chromium-tab-equalizer/actions/workflows/ci.yml/badge.svg)](https://github.com/Majkey25/chromium-tab-equalizer/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/Majkey25/chromium-tab-equalizer)](https://github.com/Majkey25/chromium-tab-equalizer/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-green.svg)

A compact **per-tab audio equalizer** for Chromium browsers. Enable it only on the tab you want to change, tune the sound, close the popup, and the offscreen audio engine keeps processing that tab.

[![Download latest version](https://img.shields.io/badge/Download-latest%20version-2ea44f?style=for-the-badge&logo=github)](https://github.com/Majkey25/chromium-tab-equalizer/releases/latest)

## What it does

- Processes individual explicitly activated tabs instead of changing the whole browser or operating system.
- Master volume from **0% to 200%**, mute, bypass, and ±12 dB preamp.
- 10-band graphic EQ: **31 / 62 / 125 / 250 / 500 Hz / 1 / 2 / 4 / 8 / 16 kHz**, each ±12 dB.
- Balance, mono fold-down, compressor threshold/ratio, and a final safety limiter.
- Built-in Flat, Bass Boost, Treble Boost, Vocal, and Night presets.
- Save your own presets from the current tuned tab.
- Temporary per-tab settings by default. Enable **Remember for this site** to store a hostname profile locally.
- Manage site profiles and presets and import/export JSON from the options page.
- No accounts, ads, analytics, cloud service, or extension network requests.

## Chromium limitation

Chrome/Brave require an explicit user action before an extension can begin `tabCapture`. A remembered `youtube.com` profile therefore **cannot silently begin capturing a fresh tab after browser start**. Click **Enable** for that tab once; the saved profile is then applied automatically. Processing continues after the popup closes.

## Install in Chrome / Brave

1. Download the latest ZIP from [Releases](https://github.com/Majkey25/chromium-tab-equalizer/releases/latest).
2. Extract it to a permanent folder.
3. Open `chrome://extensions` or `brave://extensions`.
4. Enable **Developer mode**.
5. Select **Load unpacked** and choose the extracted folder containing `manifest.json`.
6. Open a normal website tab with audio, click the extension icon, then click **Enable**.

To update an unpacked installation, replace the extracted files and click **Reload** on the extension card.

## Permissions

| Permission | Why it is used |
| --- | --- |
| `tabCapture` | Capture only the tab the user explicitly enables. |
| `offscreen` | Keep the Web Audio graph alive after the popup closes. |
| `storage` | Store temporary tab state and optional local site/preset data. |
| `activeTab` | Operate on the tab the user explicitly invokes the extension for. |
| `tabs` | Detect URL/hostname changes and clean up state when an activated tab closes. |

There are **no host permissions** and no background network service.

## Saved-site behavior

Temporary changes live in `chrome.storage.session` and disappear with the browser session/tab. **Remember for this site** saves the sanitized profile by normalized hostname in `chrome.storage.local`. When an already captured tab navigates to a hostname with a saved profile, that profile replaces prior temporary values. Navigating to an unsaved hostname starts from Flat/default.

## Audio path

For each active tab:

`Tab capture -> preamp -> 10-band EQ -> compressor -> mono/stereo + balance -> master volume -> limiter -> output`

Bypass keeps the capture alive but routes the source around EQ/compressor processing through master volume and limiter. Disable stops the capture stream and tears down the tab graph.

## Privacy

The extension does not collect browsing history, page content, audio samples, analytics, identifiers, or telemetry. Saved settings stay in Chromium extension storage. Import/export happens only after an explicit local file action.

## Development

Requires Node.js 22+ and Python 3. Runtime has **zero dependencies**.

```sh
npm run check
npm run test:unit
```

The real-browser test loads the actual unpacked extension. Set `BROWSER_PATH` when Chromium is not available at a standard Linux path. On Windows this can point to Brave or a Chromium test binary.

```sh
BROWSER_PATH="/path/to/chromium" npm run test:browser
python3 scripts/package.py
```

A managed browser that blocks unpacked extensions cannot run the browser integration test; use an unmanaged Chromium/Brave profile or Chromium for Testing.

## Manual audio smoke test

Parameter and browser lifecycle tests do not prove audible output quality. Before the first stable release:

```sh
npm run smoke
```

The script serves a local stereo tone fixture and records a human PASS/FAIL result under `.reference/smoke.json`. Copy a verified PASS into `docs/smoke/v1.0.0.md` using the template in `docs/smoke/TEMPLATE.md` before tagging `v1.0.0`.

## Releases

`python3 scripts/package.py` creates a deterministic `dist/chromium-tab-equalizer-<version>.zip` and `SHA256SUMS.txt`. CI runs syntax checks, unit tests, the real unpacked-browser integration test, and packaging. A `v*` tag can publish a normal GitHub release only when the matching committed smoke record contains `Result: PASS`.