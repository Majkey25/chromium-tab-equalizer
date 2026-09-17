# Changelog

## 1.0.1 - 2026-09-17

- Refreshed the extension branding with a cleaner minimalist transparent SVG icon used across the popup and settings page.
- Added section-level reset actions for Level, Equalizer, and Advanced controls while keeping the global Reset all control.

## 1.0.0 - release candidate

- Added explicit per-tab audio capture for Chrome and Brave using Manifest V3 `tabCapture` and an offscreen Web Audio engine.
- Added independent 0-200% volume, mute, bypass, ±12 dB preamp, 10-band EQ, balance, mono, compressor, and safety limiter controls.
- Added Flat, Bass Boost, Treble Boost, Vocal, and Night presets plus user presets.
- Added temporary per-tab state and optional per-hostname saved profiles.
- Added saved-profile and preset management plus validated JSON import/export.
- Added compact keyboard-accessible light/dark popup and options UI without telemetry or network services.
- Added deterministic ZIP packaging, SHA-256 checksums, unit tests, real unpacked-Chromium integration checks, and a mandatory manual audio smoke-test gate before the stable GitHub release.
