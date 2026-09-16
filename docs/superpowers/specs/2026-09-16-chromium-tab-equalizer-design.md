# Chromium Tab Equalizer - Design Specification

Date: 2026-09-16
Owner: Majkey25
Status: proposed design, approved in chat pending written-spec review

## Goal

Build a public Manifest V3 Chromium extension for Chrome and Brave that processes audio for user-activated individual tabs rather than the whole browser or operating system. The extension must keep processing after the popup closes, support temporary per-tab settings and optional persistent per-site settings, and provide a restrained modern UI without decorative AI-generated styling.

## Product behavior

### Activation

Audio processing starts only after explicit user activation for a tab, because Chromium tab capture requires a user gesture. After activation, the captured tab audio continues through the extension's offscreen audio engine even when the popup closes. Closing the tab stops that tab's processing and discards its temporary state.

### Temporary tab state

Each captured tab can have independent volume, EQ, preamp, balance, mono, compressor, limiter, bypass, and selected preset values. Temporary state is stored in `chrome.storage.session` and is not restored after a browser restart.

### Persistent site state

The popup exposes `Remember for this site`. When enabled, the effective settings are stored by hostname in `chrome.storage.local`. When an already-captured tab navigates to another hostname, the service worker resolves and applies that hostname's saved profile if one exists; otherwise it keeps or resets according to the explicit navigation policy documented below.

Navigation policy: site profiles override temporary values when entering a hostname with a saved profile. Entering a hostname without a saved profile starts from Flat/default unless the user has made temporary changes after that navigation.

### Audio controls

Version 1.0 includes:

- processing on/off for the current tab
- master volume 0-200%
- mute
- bypass
- preamp
- 10-band graphic EQ at 31, 62, 125, 250, 500, 1k, 2k, 4k, 8k, and 16k Hz
- +/-12 dB per EQ band
- left/right balance
- mono fold-down
- compressor enable and core threshold/ratio controls
- limiter enabled by default as final protection against clipping
- reset to Flat
- built-in presets: Flat, Bass Boost, Treble Boost, Vocal, Night
- user presets
- site profile save/remove
- import/export settings JSON

No surround virtualization, convolution reverb, pitch shifting, playback speed, spectrum analyzer, cloud sync, telemetry, accounts, ads, or network service in v1.0.

## Architecture

### Manifest V3 service worker

Responsibilities:

- handles popup commands and browser lifecycle events
- requests tab capture stream IDs following explicit user activation
- creates the offscreen document when required
- tracks which tab IDs are actively processed
- resolves hostname profile vs temporary state
- forwards control changes to the offscreen document
- cleans up state on tab close
- reapplies site profiles when a captured tab navigates

The service worker does not own `AudioContext` objects because MV3 workers are suspendable.

### Offscreen audio document

One extension offscreen document owns all live audio resources. It maintains a map keyed by tab ID.

Each tab graph is:

`MediaStreamSource -> preamp GainNode -> 10 BiquadFilterNodes -> DynamicsCompressorNode (optional) -> stereo/balance stage -> master GainNode -> limiter/compressor safety stage -> AudioContext.destination`

Bypass reconnects source to the final output path without the EQ/compressor controls while preserving capture. Disable stops the stream and tears down that tab graph.

### Popup

The popup is a focused controller for the current active tab. It reads current runtime state through the service worker and writes changes immediately. The popup is not required to remain open for audio processing.

### Options page

The options page manages saved site profiles, user presets, import/export, and global defaults. It does not duplicate the full live mixer experience.

### Storage model

`chrome.storage.local`:

- schema version
- saved profiles keyed by normalized hostname
- user presets
- global preferences

`chrome.storage.session`:

- temporary settings keyed by tab ID
- runtime metadata needed to survive service worker suspension

Live streams and Web Audio nodes remain only in the offscreen document.

## UI design

The popup target width is approximately 360 px. Use system font stack, strong spacing hierarchy, compact controls, native-feeling toggles and sliders, and CSS custom properties for light/dark themes based on `prefers-color-scheme`.

Avoid gradients, glassmorphism, glow, oversized rounded cards, decorative illustrations, fake analytics, emoji labels, or nested cards. Controls use small radii, visible keyboard focus, semantic labels, and concise copy.

Primary hierarchy:

1. header with current hostname and processing switch/status
2. master volume
3. 10-band EQ
4. preset row
5. compact secondary controls
6. `Remember for this site`
7. Bypass and Reset

Advanced compressor controls may live in a native `<details>` section to keep the default view concise.

## Permissions

Request the smallest practical MV3 permission set. Expected permissions are `tabCapture`, `offscreen`, `storage`, and `activeTab`; `tabs` is included only if required for navigation/hostname lifecycle behavior after implementation tests prove it necessary. No broad host permission is requested unless Chromium APIs require it for a specific verified feature.

## Safety and failure behavior

- Never process a tab before explicit user activation.
- If capture fails, leave the tab's normal browser audio untouched and show a concise actionable error.
- If the offscreen document or audio graph fails, stop capture rather than silently muting the tab.
- Validate imported JSON against the settings schema before persisting it.
- Clamp all gain, EQ, compressor, and balance values to documented ranges.
- Tear down audio graphs on tab close and on explicit disable.
- Do not collect browsing history, content, audio samples, or analytics.

## Testing strategy

### Unit tests

Test profile resolution, hostname normalization, schema migration/validation, value clamping, preset application, navigation policy, and message contracts.

### Browser integration tests

Load the real unpacked extension in Chromium with Playwright. Verify popup state, persistent vs temporary settings, multiple independent tabs, service-worker suspension/reconnection, offscreen document creation, navigation between hostnames, saved profile application, teardown, and UI accessibility basics.

Where automated tab capture is blocked by browser user-gesture constraints, keep those tests as explicit manual/integration checks rather than faking successful capture.

### Audio graph tests

Test graph creation using controlled generated audio where browser automation permits it. Verify node parameters and routing for Flat, EQ changes, bypass, mono, balance, compressor, limiter, and master volume. Do not claim audible quality from parameter-only tests; perform a real-browser manual smoke test before the first stable release.

## Repository and release design

Target repository: `Majkey25/chromium-tab-equalizer`, public, MIT licensed.

Repository includes:

- `extension/` runtime source
- `tests/`
- `scripts/package.py`
- `.github/workflows/ci.yml`
- `.github/release-notes.md`
- `README.md`
- `CHANGELOG.md`
- `LICENSE`
- this design under `docs/superpowers/specs/`

README includes CI, latest release, MIT, and Manifest V3 badges plus a prominent latest-release download link and Chrome/Brave unpacked installation steps.

CI runs syntax/static checks, unit tests, real Chromium integration tests where possible, and deterministic packaging. A release workflow creates a normal GitHub release only after checks pass, publishes a ZIP and `SHA256SUMS.txt`, and never marks an unverified build as stable.

Initial public stable release is `v1.0.0` only after real Chromium capture/output smoke testing succeeds.

## Known Chromium constraint

Saved site profiles cannot cause arbitrary tabs to begin capture automatically after a fresh browser start without an explicit user gesture. Persistence means settings are remembered and automatically applied once that tab has been explicitly activated for processing.

## Acceptance criteria

- Chrome/Brave MV3 extension loads without errors.
- User can explicitly activate processing for one tab without altering unrelated tabs.
- Processing continues after the popup closes.
- Two captured tabs can have different settings simultaneously.
- Temporary tab settings disappear with the tab/browser session as specified.
- Site settings persist by hostname and apply predictably on captured-tab navigation.
- All listed v1.0 audio controls update the live graph.
- Disable restores normal tab behavior and releases capture resources.
- UI is keyboard-accessible, light/dark aware, compact, and free of decorative AI-slop patterns.
- No telemetry or network dependency.
- CI and packaging pass.
- Stable GitHub release is published only after a real Chromium smoke test is recorded.
