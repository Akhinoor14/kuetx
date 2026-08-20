// landingStatsSync.js
//
// Backs the public landing page's "current user" hero stat card (see
// LandingPage.jsx's CampusHero) with a real, Admin-entered number instead
// of a hardcoded or auto-scraped one.
//
// Why manual instead of a live Firestore count: the signed-out landing
// page cannot safely run a getCountFromServer() over students/, faculty/,
// or providers/ — those collections are gated to isSignedIn() (or
// owner/Admin only, for students/) in firestore.rules, and opening them to
// public listing just to support a count would expose every account's
// full document to any visitor, not just a number. A small, Admin-typed
// aggregate doc avoids that entirely: the public doc holds nothing but a
// few counts, and the real per-person data stays exactly as locked down
// as it already is.
//
// Storage: config/landingStats — same "small Founder-editable singleton
// under config/{key}" shape as config/batches (see appConfigSync.js's
// header for that established pattern). firestore.rules special-cases
// this one config key with `allow read: if true` (every other config/*
// doc requires isSignedIn()), since this is the one config doc a
// signed-out visitor legitimately needs to read.
//
// Shape: { totalUsers: number, updatedAt: serverTimestamp }
// Admin/HeadOfOps sets totalUsers by hand from FounderBatchSettings.jsx's
// "Landing Page Stats" section, same place batch start dates are set —
// there is deliberately no auto-counting anywhere in this file.

import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

const LANDING_STATS_DOC = doc(db, 'config', 'landingStats');

/**
 * One-time fetch of the Admin-entered total user count. Returns null if
 * the doc hasn't been created yet or the read fails (e.g. rules not yet
 * deployed on an older environment) — callers should treat null as "hide
 * this stat" rather than showing a fake zero.
 */
export async function getLandingTotalUsers() {
  try {
    const snap = await getDoc(LANDING_STATS_DOC);
    if (snap.exists() && typeof snap.data().totalUsers === 'number') {
      return snap.data().totalUsers;
    }
  } catch {
    // Signed-out read failing (rules not deployed yet, offline, etc.) —
    // fall through to null so the landing page just omits the card.
  }
  return null;
}

/**
 * Live-subscribe to the Admin-entered total user count. Fires with null
 * until a real number is available, then again on every Admin edit.
 */
export function subscribeLandingTotalUsers(callback) {
  return onSnapshot(LANDING_STATS_DOC, (snap) => {
    if (snap.exists() && typeof snap.data().totalUsers === 'number') {
      callback(snap.data().totalUsers);
    } else {
      callback(null);
    }
  }, () => {
    callback(null);
  });
}

/**
 * Admin/HeadOfOps-only write — sets the total user count shown on the
 * landing page. firestore.rules enforces the role check server-side;
 * this function has no client-side role gate of its own (matches
 * setActiveBatches()/setBatchStartDate()'s pattern in appConfigSync.js).
 */
export async function setLandingTotalUsers(totalUsers) {
  const n = Number(totalUsers);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error('Total users must be a non-negative number.');
  }
  await setDoc(LANDING_STATS_DOC, { totalUsers: Math.round(n), updatedAt: serverTimestamp() }, { merge: true });
}

// ── Hero stat card overrides (4-card strip: real feature / QB total /
// publications / users) ─────────────────────────────────────────────
//
// Each card has a live default (feature count from
// landingFeatureInventory.js, QB total from the public Worker,
// publications from BASE_STATS, users from totalUsers above) but the
// Founder can override any card's number AND label by hand from
// FounderBatchSettings.jsx's "Landing Page Stats" panel — same doc,
// new `heroCardOverrides` map so the override is per-card and partial
// (an unset card just falls through to its live default).
//
// Shape: { heroCardOverrides: { [cardId]: { value: string, label: string } } }
// cardId is one of: 'features', 'qb', 'publications', 'users'.

const HERO_CARD_IDS = ['features', 'qb', 'publications', 'users'];

/**
 * One-time fetch of Founder-set overrides for the 4 hero stat cards.
 * Returns {} if nothing has been set yet or the read fails — callers
 * should treat a missing card as "use the live/default value".
 */
export async function getHeroCardOverrides() {
  try {
    const snap = await getDoc(LANDING_STATS_DOC);
    if (snap.exists() && snap.data().heroCardOverrides) {
      return snap.data().heroCardOverrides;
    }
  } catch {
    // fall through to {} below
  }
  return {};
}

/**
 * Live-subscribe to Founder-set hero card overrides. Fires with {}
 * until the doc exists / has no overrides, then again on every edit.
 */
export function subscribeHeroCardOverrides(callback) {
  return onSnapshot(LANDING_STATS_DOC, (snap) => {
    callback((snap.exists() && snap.data().heroCardOverrides) || {});
  }, () => {
    callback({});
  });
}

/**
 * Admin/HeadOfOps-only write — sets or clears one hero card's override.
 * Pass { value, label } to override both, or null to clear the override
 * and fall back to that card's live default.
 */
export async function setHeroCardOverride(cardId, override) {
  if (!HERO_CARD_IDS.includes(cardId)) {
    throw new Error(`Unknown hero card id: ${cardId}`);
  }
  const current = await getHeroCardOverrides();
  const next = { ...current };
  if (override == null) {
    delete next[cardId];
  } else {
    next[cardId] = {
      value: String(override.value ?? '').trim(),
      label: String(override.label ?? '').trim(),
    };
  }
  await setDoc(LANDING_STATS_DOC, { heroCardOverrides: next, updatedAt: serverTimestamp() }, { merge: true });
}
