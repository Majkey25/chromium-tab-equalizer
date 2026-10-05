# Privacy and use of Chromium Tab Equalizer

Updated 5 October 2026. Developer: Matěj Teplý, publishing as Majkey / Majkey25. Contact: [majkeylab@gmail.com](mailto:majkeylab@gmail.com).

## Data processed on your device

After you click Enable, the extension captures that tab's audio and processes it through Web Audio to apply your settings. Audio is not recorded or sent to the developer. The extension reads the current tab URL to identify its hostname, select saved site settings, and clean up state when tabs change or close. It does not build a browsing-history database.

Temporary tab settings stay in browser session storage. Optional site hostnames, audio profiles, custom preset names, and preferences stay in `chrome.storage.local`, without account sync. JSON import/export reads or writes a file only when you choose that action. An exported file contains saved hostnames and settings; share it only when you intend to disclose them.

The extension has no analytics, advertising SDK, telemetry, account, remote code, or automatic network requests. Data is used only for the audio controls described above, never for advertising, sale, or profiling.

## Retention and deletion

Disable processing to stop that tab's audio capture. Closing the tab or browser ends its temporary state. Open Saved settings to delete individual profiles/presets or use Clear saved data. Removing the extension removes its browser-managed extension data. Exported files and any system backups are separate copies; delete those yourself if no longer needed. The developer has no server copy of your audio or settings to retrieve or delete.

## Cookies, support, and external links

The extension sets no cookies and needs no tracking-consent banner. Opening repository, support, or privacy links contacts GitHub under [GitHub's privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement). GitHub receives normal connection information, including your IP address. Email support receives the address and content you choose to send; do not include private audio or browsing data. Contact the email above about support-message access or deletion. Messages are kept only as needed to address the request or meet legal obligations.

## Price, license, and limitations

This release is free, with no purchases, subscriptions, hidden fees, or marketing emails. There is no payment to refund. The [MIT license](LICENSE) governs use and redistribution without limiting mandatory consumer rights. This is an independent project, not a Google or Brave product. Audio gain can increase volume; use appropriate listening levels. No children's account or age/profile data is requested. Privacy changes will be recorded in this repository.
