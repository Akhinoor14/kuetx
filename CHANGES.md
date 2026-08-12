# KUETx Splash — What Changed

## New files
- `public/splash/scene-1-gate.webp` (38KB) — Main Gate, graded dusk/moody
- `public/splash/scene-2-statue.webp` (85KB) — Liberation War statue, golden hour
- `public/splash/scene-3-sign.webp` (264KB) — "KUET" sign at dusk, lamp glow
  (all three: real photos, cropped/color-graded, WebP, ~387KB total)

## Modified files
- `index.html` — added `#kx-splash` cinematic sequence (real photos, ~6s,
  sessionStorage-gated to show once per session, prefers-reduced-motion
  fallback, hard 7s timeout). Sits above the existing `#app-shell-skeleton`,
  does not touch the service-worker registration script.
- `public/sw.js` — added the 3 splash images to `STATIC_ASSETS` for offline
  precache, bumped `CACHE_NAME` to `kuetx-v4.2.6`.
- `src/version.js` — `APP_VERSION` → `4.2.6`
- `public/manifest.json` — `"version"` → `4.2.6`
- `package.json` — `"version"` → `4.2.6`
- `src/App.jsx` — `PageLoadingFallback` (route-transition spinner, separate
  from the cold-start splash) changed from bare "Loading…" text to a small
  three-dot pulse in brand green. Still inline in App.jsx per the existing
  comment/constraint.

## Verified
- `npm run build` succeeds, no errors
- Splash assets present in `dist/splash/`, served with 200 status
- Full 3-photo + logo sequence renders correctly end-to-end in the real
  built app (not just an isolated preview)
- sessionStorage gating confirmed: shows on first load, does not reshow on
  reload within the same tab session
- prefers-reduced-motion fallback confirmed: photo sequence skipped, logo
  shown once, splash removed by ~2.1s instead of ~6.9s

## Known limitation / not tested here
- This sandbox has no real Firebase credentials (only `.env.example`), so
  the actual React app crashes on auth init after the splash hides — that's
  an environment limitation unrelated to the splash work, not a bug I
  introduced. On the real deployment (with real `.env` values) this won't
  happen.
- Not tested on real mobile hardware/network — only Chromium headless at a
  390×844 viewport locally.

## Design choices worth flagging
- The Main Gate shot is a tight crop on the arch's upper structure, not the
  full base-to-base width — the source photo is 750×450 (landscape) and a
  portrait mobile splash genuinely cannot fit the whole gate at a legible
  size without either a lot of dead sky or a much smaller/less impactful
  gate. I chose "smaller frame, bigger/bolder gate" over "whole gate, tiny."
  Worth a second look on a real device.
- Sequence order (Gate → Statue → Sign → Logo) — Gate first per the brief's
  explicit "primary landmark" instruction, Statue in the golden-hour
  emotional-peak middle slot, Sign as the "brand reveal" beat right before
  the logo since it literally contains the letters K-U-E-T.
