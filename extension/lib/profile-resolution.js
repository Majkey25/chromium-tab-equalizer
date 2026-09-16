import { cloneDefaultSettings, sanitizeSettings } from './settings.js';

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function normalizeHostname(value) {
  const text = String(value ?? '').trim();
  let hostname;
  if (text.includes('://')) {
    if (!isHttpUrl(text)) throw new TypeError('Only http(s) URLs are supported');
    hostname = new URL(text).hostname;
  } else {
    hostname = text;
  }
  hostname = hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  if (!hostname || hostname.includes('/') || hostname.includes(':')) throw new TypeError('Invalid http hostname');
  return hostname;
}

export function resolveNavigationSettings({ url, profiles = {}, temporaryAfterNavigation = null }) {
  const hostname = normalizeHostname(url);
  if (profiles && typeof profiles === 'object' && !Array.isArray(profiles) && profiles[hostname]) {
    return { hostname, source: 'site', settings: sanitizeSettings(profiles[hostname]) };
  }
  if (
    temporaryAfterNavigation &&
    temporaryAfterNavigation.hostname === hostname &&
    temporaryAfterNavigation.settings
  ) {
    return { hostname, source: 'temporary', settings: sanitizeSettings(temporaryAfterNavigation.settings) };
  }
  return { hostname, source: 'default', settings: cloneDefaultSettings() };
}
