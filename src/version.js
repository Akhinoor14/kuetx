// src/version.js
//
// SINGLE SOURCE OF TRUTH for the app's version number.
// Bump ONLY this file on every release — everything else (Footer, Sidebar,
// Settings, manifest.json, package.json, and the service worker's cache
// name) should read from here so they can never drift out of sync again.
//
// NOTE: the service worker (public/sw.js) runs in a separate scope and
// can't import this file directly, so its CACHE_NAME must be bumped by
// hand alongside APP_VERSION below — keep the two numbers identical.

export const APP_VERSION = '4.1.4';

// Short display form used in compact UI (Footer, Sidebar): "4.1.0" -> "4.1"
export const APP_VERSION_SHORT = APP_VERSION.split('.').slice(0, 2).join('.');
