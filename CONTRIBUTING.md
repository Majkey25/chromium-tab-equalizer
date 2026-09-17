# Contributing

Thanks for helping improve Chromium Tab Equalizer.

## Before you start

- Search existing issues and pull requests first.
- Keep changes focused. Avoid unrelated refactors in the same PR.
- For bugs, include the browser, browser version, extension version, affected site, reproduction steps, and console errors when available.
- For user-facing behavior changes, explain the expected behavior before implementation.

## Local setup

Requirements:

- Node.js 22+
- Python 3
- Chrome, Chromium, Brave, or Chromium for Testing for browser integration tests

Run the fast checks:

```sh
npm run check
npm run test:unit
```

Run the real unpacked-extension browser test:

```sh
BROWSER_PATH="/path/to/chromium" npm run test:browser
```

Build a deterministic release package:

```sh
python3 scripts/package.py
```

## Pull requests

A good PR should:

- solve one clear problem
- include or update regression coverage when behavior changes
- preserve the minimal-permission/privacy model
- avoid new runtime dependencies unless they are clearly justified
- keep README or other documentation in sync with user-visible changes
- pass CI before merge

Use concise commit messages that describe the change rather than the implementation process.

## Testing expectations

For logic changes, add a failing regression test first when practical, then implement the fix and verify the full relevant test suite.

For audio-path changes, automated tests are necessary but not sufficient to judge audible quality. Include a manual smoke result when the change can alter audible behavior.

For UI changes, verify both light and dark color schemes and keyboard focus states where relevant.

## Scope

This project intentionally targets Chromium MV3 browsers and avoids telemetry, accounts, cloud services, and broad host permissions. Changes that weaken those boundaries need strong justification.

## Code of conduct

Participation in this project is covered by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
