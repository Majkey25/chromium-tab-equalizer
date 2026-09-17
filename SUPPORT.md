# Support

## Installation

Use the latest stable ZIP from the [Releases](https://github.com/Majkey25/chromium-tab-equalizer/releases/latest) page, extract it, then load the folder containing `manifest.json` from `chrome://extensions` or `brave://extensions` with Developer mode enabled.

## Before opening a bug

Please check:

- you are running the latest release
- the extension was reloaded after replacing files
- the target tab contains normal playable audio
- you clicked **Enable** for that tab
- the browser supports the required Chromium MV3 APIs

## Good bug reports

Use the repository bug-report form and include:

- browser and exact version
- extension version
- affected website/URL when safe to share
- exact reproduction steps
- expected behavior
- actual behavior
- console/service-worker errors if available
- whether the problem reproduces after a clean extension reload

For audio-quality issues, describe the input source and which controls change the problem. A short screen recording can help for UI/state problems, but do not upload private audio or browsing data.

## Supported scope

The project supports Chrome/Chromium and Brave first. Other Chromium browsers are best effort. Firefox and Safari are outside the current scope.

This project does not provide support for bypassing website access controls, DRM, subscriptions, or browser security restrictions.

## Security issues

Do not use a public support issue for vulnerabilities. Follow [SECURITY.md](SECURITY.md).
