# Changelog

## 1.0.5 - 2026-10-05

- Skip loading unrelated saved profiles when returning an existing active tab state.
- Add message-path coverage for active state, inactive fallback, configuration validation, and stopping a tab.
- In ten matched lab runs with 500 synthetic profiles, active-state retrieval median fell from 17.4 to 0.65 ms. This does not measure audio capture startup or listening quality.

## 1.0.4 - 2026-10-05

- Add privacy, local-data deletion, and free-use information, linked from Saved settings and included in releases.
- Clarify local audio and hostname processing in the README.

## 1.0.3

- Fixed built-in preset switching so a newly selected preset fully replaces EQ, preamp, and compressor values from the previous preset.
- Fixed Flat so it reliably clears preset-controlled audio changes while preserving live controls such as volume, mute, bypass, balance, mono, and limiter.
- Added regression coverage for switching between Bass Boost, Treble Boost, Night, and Flat.

## 1.0.2

- Replaced the framed toolbar icon with a frameless transparent five-fader design and regenerated all browser icon sizes.
- Added a high-contrast active Mute state with a red fill, speaker-off glyph, and explicit Muted label.
- Preserved the v1.0.1 section reset controls and existing audio behavior.

## 1.0.1

- Refreshed the extension branding and added section-level reset actions for Level, Equalizer, and Advanced controls while keeping the global Reset all control.

## 1.0.0 - release candidate

- Added explicit per-tab audio capture for Chrome and Brave using Manifest V3 `tabCapture` and an offscreen Web Audio engine.
- Added independent 0-200% volume, mute, bypass, ±12 dB preamp, 10-band EQ, balance, mono, compressor, and safety limiter controls.
- Added Flat, Bass Boost, Treble Boost, Vocal, and Night presets plus user presets.
- Added temporary per-tab state and optional per-hostname saved profiles.
- Added saved-profile and preset management plus validated JSON import/export.
- Added compact keyboard-accessible light/dark popup and options UI without telemetry or network services.
- Added deterministic ZIP packaging, SHA-256 checksums, unit tests, real unpacked-Chromium integration checks, and a mandatory manual audio smoke-test gate before the stable GitHub release.
