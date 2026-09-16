Chromium Tab Equalizer v1.0.0 is the first stable release of the per-tab Chrome/Brave audio processor.

It includes independent tab activation, 0-200% volume, preamp, a 10-band ±12 dB EQ, balance, mono, compressor, limiter, bypass, built-in and custom presets, optional per-site profiles, and local JSON backup/restore.

Audio processing runs in an MV3 offscreen document, so it continues after the popup closes. New tabs still require an explicit Enable click because Chromium does not permit silent `tabCapture` startup.

Download the ZIP below, extract it, and load the folder with **Load unpacked** in `chrome://extensions` or `brave://extensions`. `SHA256SUMS.txt` contains the release checksum.
