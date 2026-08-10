// lib/sessionalCadence.js
//
// Sessional/Lab (0.75 credit) alternating-week occurrence resolver — see
// TEACHER_ID_SESSIONAL_PROGRESS.md / IMPLEMENTATION_PROMPT.md Section 3
// for the full design writeup. Pure functions only, modeled directly on
// store.js's classOverrides/recurringOff/isClassOff() pattern: a single
// resolver function every caller goes through, sparse per-date overrides
// layered on top of a computed baseline rather than re-anchoring on every
// exception.
//
// Entry shape (one per slotKey, slotKey = classOverrideSlotKey(courseId,
// day, slot), same shape as store.js's isClassOff()):
//   {
//     mode: 'alternating' | 'weekly' | 'manual',
//     anchorDate: 'YYYY-MM-DD',   // first date this sessional actually runs
//     overrides: {
//       'YYYY-MM-DD': 'on' | 'off',
//     },
//     setBy, setAt,                // stamped by groupSync.js's writers, not
//                                   // read by anything in this module
//   }
//
// No entry at all for a slotKey means "runs every week" — today's existing
// behavior, unaffected — so every resolver below treats a missing/undefined
// entry as equivalent to mode: 'weekly'.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysBetween(fromDateKey, toDateKey) {
  const from = new Date(`${fromDateKey}T00:00:00`);
  const to = new Date(`${toDateKey}T00:00:00`);
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

// Baseline occurrence for a date, computed purely from mode + anchorDate —
// no overrides considered here (see getEffectiveOccurrence for the layered
// version every read-site actually calls).
//   - undefined/null entry, or mode 'weekly': every week, same as today's
//     existing default behavior.
//   - 'alternating': on iff the whole-week offset from anchorDate is even
//     (runs on anchorDate, then every 14 days from there).
//   - 'manual': no baseline occurrence at all — nothing happens unless an
//     override says so.
export function getBaselineOccurrence(entry, dateKey) {
  if (!entry || entry.mode === 'weekly') return 'on';

  if (entry.mode === 'manual') return 'off';

  if (entry.mode === 'alternating') {
    if (!entry.anchorDate) return 'on'; // misconfigured — fail open, same as no entry
    const diff = daysBetween(entry.anchorDate, dateKey);
    const weeks = Math.floor(diff / 7);
    // Before the anchor date, or not on the same weekday as the anchor,
    // there's no baseline occurrence to speak of for this slot on this
    // date — callers only ever check dateKey values that already match
    // the slot's own weekday (see classOverrideSlotKey/slotKey usage at
    // every call site), so this guard is a defensive fallback, not the
    // primary mechanism.
    if (diff < 0 || diff % 7 !== 0) return 'off';
    return weeks % 2 === 0 ? 'on' : 'off';
  }

  return 'on';
}

// Effective occurrence for a date = overrides[dateKey] if present,
// otherwise the computed baseline. This is the ONE function every read
// site (todayItems.js, Attendance.jsx's getScheduleCoursesForDate,
// useClassManagementState.js's getCadenceOccurrence) calls — same
// single-source-of-truth pattern as store.js's isClassOff().
export function getEffectiveOccurrence(entry, dateKey) {
  const override = entry?.overrides?.[dateKey];
  if (override === 'on' || override === 'off') return override;
  return getBaselineOccurrence(entry, dateKey);
}

// Convenience boolean wrapper — mirrors store.js's isClassOff() naming so
// callers that just need a yes/no don't have to string-compare 'off'
// themselves.
export function isSessionalOff(entry, dateKey) {
  return getEffectiveOccurrence(entry, dateKey) === 'off';
}

// Records a single ad-hoc exception (cancellation or make-up/extra
// session) without touching anchorDate or any other date's status.
// status: 'on' | 'off' | 'clear' ('clear' removes the override entirely,
// reverting that one date back to whatever the baseline says). Does not
// mutate the entry passed in — returns a new object, same convention as
// every other store.js override writer.
export function toggleDateOverride(entry, dateKey, status) {
  const base = entry || defaultCadenceForNewSlot(dateKey);
  const overrides = { ...(base.overrides || {}) };

  if (status === 'clear') {
    delete overrides[dateKey];
  } else if (status === 'on' || status === 'off') {
    overrides[dateKey] = status;
  }

  return { ...base, overrides };
}

// Deliberate "shift cadence from here" action — re-anchors the baseline
// for future dates only. Existing overrides (past AND future) are left
// untouched: a past override already recorded what actually happened on
// that date, and a future override (e.g. an already-planned make-up) was
// a deliberate exception that shouldn't silently vanish just because the
// underlying cadence moved. Does not mutate the entry passed in.
export function shiftCadenceFrom(entry, newAnchorDate) {
  const base = entry || defaultCadenceForNewSlot(newAnchorDate);
  return { ...base, mode: base.mode === 'manual' ? base.mode : 'alternating', anchorDate: newAnchorDate };
}

// Default entry staged when a CR first configures cadence for a slot that
// has none yet — the prompt's "zero extra CR configuration for the common
// case": alternating, anchored on the given date (typically the slot's
// next upcoming occurrence), no overrides yet.
export function defaultCadenceForNewSlot(anchorDate) {
  return {
    mode: 'alternating',
    anchorDate,
    overrides: {},
  };
}
