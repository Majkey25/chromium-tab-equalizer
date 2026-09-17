# Security Policy

## Supported versions

Security fixes are applied to the latest stable release. Older unpacked copies should be updated before reporting a problem that may already be fixed.

## Reporting a vulnerability

Please do **not** publish exploit details in a public issue.

Preferred reporting path:

1. Use GitHub private vulnerability reporting for this repository when available.
2. If private reporting is unavailable, contact `@Majkey25` through GitHub and share only enough information to establish a private channel. Do not post sensitive reproduction details publicly.

A useful report includes:

- affected extension version
- browser and version
- exact reproduction steps
- security impact
- whether user interaction is required
- proof-of-concept details only through a private channel

## Security boundaries

Chromium Tab Equalizer intentionally:

- requests no host permissions
- has no telemetry or analytics
- has no backend or extension-origin network service
- processes captured audio locally in the browser
- stores settings only in Chromium extension storage unless the user explicitly exports them

Reports that show a bypass of these boundaries are especially important.

## Disclosure

Please allow reasonable time for validation and a fix before public disclosure. Valid reports will be acknowledged in release notes when appropriate and when the reporter agrees.
