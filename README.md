<p align="center">
  <img src="extension/icons/icon128.png" width="96" height="96" alt="Chromium Tab Equalizer icon">
</p>

<h1 align="center">Chromium Tab Equalizer</h1>

<p align="center">
  A privacy-first per-tab audio equalizer for Chrome, Chromium, and Brave.
  Tune one tab without changing the rest of your browser or system audio.
</p>

<p align="center">
  <a href="https://github.com/Majkey25/chromium-tab-equalizer/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Majkey25/chromium-tab-equalizer/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://github.com/Majkey25/chromium-tab-equalizer/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/Majkey25/chromium-tab-equalizer"></a>
  <a href="https://github.com/Majkey25/chromium-tab-equalizer/releases"><img alt="Downloads" src="https://img.shields.io/github/downloads/Majkey25/chromium-tab-equalizer/total"></a>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-blue.svg"></a>
  <img alt="Manifest V3" src="https://img.shields.io/badge/Manifest-V3-green.svg">
</p>

<p align="center">
  <a href="https://github.com/Majkey25/chromium-tab-equalizer/releases/latest"><img alt="Download latest version" src="https://img.shields.io/badge/Download-latest%20version-2ea44f?style=for-the-badge&logo=github"></a>
</p>

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#install">Install</a> ·
  <a href="#permissions">Permissions</a> ·
  <a href="#development">Development</a> ·
  <a href="CHANGELOG.md">Changelog</a> ·
  <a href="SUPPORT.md">Support</a> ·
  <a href="SECURITY.md">Security</a>
</p>

## Features

- Per-tab processing instead of changing the whole browser or operating system.
- Master volume from **0% to 200%**, mute, bypass, and ±12 dB preamp.
- 10-band graphic EQ: **31 / 62 / 125 / 250 / 500 Hz / 1 / 2 / 4 / 8 / 16 kHz**, each ±12 dB.
- Balance, mono fold-down, compressor threshold/ratio, and a final safety limiter.
- Built-in Flat, Bass Boost, Treble Boost, Vocal, and Night presets.
- Section-level reset buttons for Level, Equalizer, and Advanced controls, plus **Reset all**.
- Save custom presets from the current tuned tab.
- Temporary per-tab settings by default with optional **Remember for this site** profiles.
- Manage site profiles and presets and import/export JSON from the options page.
- Processing continues after the popup closes through an offscreen Web Audio engine.
- No accounts, ads, analytics, telemetry, cloud service, or extension network requests.

## Compatibility

| Browser | Status | Notes |
| --- | --- | --- |
| Chrome / Chromium | Supported | CI loads the real unpacked MV3 extension in Chromium for Testing. |
| Brave | Supported | Uses Chromium extension APIs; install through `brave://extensions`. |
| Edge and other Chromium browsers | Best effort | May work when the required MV3 APIs are available, but are not part of the release test matrix. |
| Firefox / Safari | Not supported | This project targets Chromium MV3 APIs. |

## Chromium limitation

Chrome and Brave require an explicit user action before an extension can begin `tabCapture`. A remembered site profile therefore cannot silently begin capturing a fresh tab after browser start. Click **Enable** for that tab once; the saved profile is then applied automatically. Processing continues after the popup closes.

## Install

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

```text
Tab capture -> preamp -> 10-band EQ -> compressor -> mono/stereo + balance -> master volume -> limiter -> output
```

Bypass keeps the capture alive but routes the source around EQ/compressor processing through master volume and limiter. Disable stops the capture stream and tears down the tab graph.

For a higher-level implementation overview, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Privacy

The extension does not collect browsing history, page content, audio samples, analytics, identifiers, or telemetry. Saved settings stay in Chromium extension storage. Import/export happens only after an explicit local file action.

See [SECURITY.md](SECURITY.md) for vulnerability reporting.

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

### Manual audio smoke test

Automated tests verify the extension lifecycle, controls, and real unpacked-Chromium loading, but they cannot judge audible quality. For local listening verification:

```sh
npm run smoke
```

The smoke helper serves a local stereo tone fixture and records a local PASS/FAIL result under `.reference/smoke.json`. It is an additional listening check, not a release blocker.

## Releases

`python3 scripts/package.py` creates a deterministic `dist/chromium-tab-equalizer-<version>.zip` and `SHA256SUMS.txt`. Every push to `main` runs static checks, unit tests, a real unpacked-Chromium integration test, and packaging. After those checks pass, CI publishes the stable `v<manifest version>` GitHub Release if that version does not already exist.

Release assets include the installable ZIP and SHA-256 checksums.

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Please use the repository issue forms for reproducible bugs and focused feature requests.

## Support

For installation help, known limitations, and what to include in a bug report, see [SUPPORT.md](SUPPORT.md).

## License

[MIT](LICENSE) © Matěj Teplý / Majkey25
