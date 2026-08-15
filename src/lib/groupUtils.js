// groupUtils.js
//
// Single source of truth for turning a student's profile (batch + dept)
// into a Firestore-safe, canonical group id. Every file that needs a
// groupId MUST import this instead of building the string itself —
// otherwise a stray lowercase/whitespace difference silently splits one
// real class into two different Firestore paths.

/**
 * Canonicalize a batch/dept string so "cse", " CSE ", "Cse" all collapse
 * to the same value.
 */
export function canonicalize(value) {
  return String(value || '').trim().toUpperCase();
}

// ─── Multi-section departments ──────────────────────────────────────────
// The 4 depts with 120 seats/batch (CE, EEE, ME, CSE — confirmed against
// KUET's official seat-vacancy table) are administratively split into
// Section A / Section B (~60 students each) by the department itself.
// This is NOT encoded anywhere in the roll number (roll = batch + dept
// code + roll-in-dept only), so it cannot be auto-derived — it must be
// collected as an explicit profile.section field.
//
// Every other dept (any seat count — 30/40/60) runs as a single section,
// so its groupId is unaffected and stays exactly as before.
//
// Derived from DEPARTMENTS' `seats` field (store.js) rather than a second
// hardcoded list, so the two can never drift apart.
import { DEPARTMENTS, ROLL_DEPT_MAP } from '../store/store';

export const MULTI_SECTION_DEPTS = DEPARTMENTS
  .filter((d) => d.seats === 120)
  .map((d) => canonicalize(d.code));

export function isMultiSectionDept(deptCode) {
  return MULTI_SECTION_DEPTS.includes(canonicalize(deptCode));
}

// ─── Full dept+batch roll roster generation (Attendance Rebuild Phase A,
// see ATTENDANCE_REBUILD_PLAN.md) ────────────────────────────────────────
//
// store.js's ROLL_DEPT_MAP goes ONE way: 2-digit roll code -> dept code
// (used by getDeptCodeFromRoll to parse an existing roll). Here we need
// the reverse: given a dept code, what 2-digit code goes in a generated
// roll's positions 3-4. Built once from ROLL_DEPT_MAP so the two can
// never drift apart — if store.js's map ever changes, this picks it up
// automatically instead of needing a second hardcoded table.
const DEPT_TO_ROLL_DIGITS = Object.fromEntries(
  Object.entries(ROLL_DEPT_MAP).map(([digits, dept]) => [dept, digits]),
);

/**
 * '2K23' / '2k23' / '23' -> '23' (the 2-digit batch prefix used inside a
 * 7-digit roll). Mirrors extractBatchFromRoll's own format (store.js) in
 * reverse. Returns '' if the input doesn't resolve to exactly 2 digits.
 */
export function batchToRollPrefix(batch) {
  const b = canonicalize(batch).replace(/^2K/, ''); // '2K23' -> '23'
  return /^\d{2}$/.test(b) ? b : '';
}

/**
 * Generates every possible 7-digit roll number for a dept+batch(+section),
 * whether or not that roll currently has a real KUETx account — this is
 * what makes every seat show up in Attendance even for students who've
 * never opened the app (see ATTENDANCE_REBUILD_PLAN.md §3a).
 *
 * Roll shape (confirmed against store.js's getDeptCodeFromRoll /
 * extractBatchFromRoll, which parse it the other direction):
 *   [batch 2-digit][dept 2-digit][seat-in-dept 3-digit], e.g. 2313014.
 *
 * Multi-section depts (CE/EEE/ME/CSE, 120 seats) split cleanly 60/60 —
 * Section A = seat-in-dept 001-060, Section B = 061-120 (confirmed with
 * Akhinoor 2026-08-15, not guessed). `section` is REQUIRED for these 4
 * depts (pass 'A' or 'B'); pass null/omit for every other dept.
 *
 * `section: 'BOTH'` (or omitting section on a multi-section dept while
 * passing `includeBothSections: true`) returns the FULL 120-seat roster
 * with each entry tagged `section: 'A'|'B'` — used by the combined-
 * section Excel export (§4 item 1 in the plan: "excel download korle dui
 * section eksathe hoye download hobe").
 *
 * Returns [] (never throws) if dept/batch/section don't resolve — same
 * "incomplete profile, fall back gracefully" convention as getGroupId().
 */
export function generateDeptRollRoster(dept, batch, section = null) {
  const deptCode = canonicalize(dept);
  const rollDigits = DEPT_TO_ROLL_DIGITS[deptCode];
  const batchPrefix = batchToRollPrefix(batch);
  if (!rollDigits || !batchPrefix) return [];

  const seatInfo = DEPARTMENTS.find((d) => canonicalize(d.code) === deptCode);
  if (!seatInfo) return [];
  const totalSeats = seatInfo.seats;

  const multiSection = isMultiSectionDept(deptCode);
  const wantBoth = multiSection && (canonicalize(section) === 'BOTH' || !section);

  const buildRange = (startSeat, endSeat, sectionTag) => {
    const rolls = [];
    for (let seat = startSeat; seat <= endSeat; seat++) {
      const roll = `${batchPrefix}${rollDigits}${String(seat).padStart(3, '0')}`;
      rolls.push(sectionTag ? { roll, section: sectionTag } : { roll, section: null });
    }
    return rolls;
  };

  if (!multiSection) {
    // Single-section dept — section arg is irrelevant, always full roster.
    return buildRange(1, totalSeats, null);
  }

  if (wantBoth) {
    const half = totalSeats / 2; // 120/2 = 60, confirmed clean split with Akhinoor
    return [...buildRange(1, half, 'A'), ...buildRange(half + 1, totalSeats, 'B')];
  }

  const sec = canonicalize(section);
  if (sec !== 'A' && sec !== 'B') return []; // multi-section dept needs a real section pick
  const half = totalSeats / 2;
  return sec === 'A' ? buildRange(1, half, 'A') : buildRange(half + 1, totalSeats, 'B');
}

/**
 * Derive the group id for a profile. Returns null if the profile doesn't
 * have enough info yet (dept/batch not set, or — for a multi-section
 * dept — section not set) — callers should treat null as "group features
 * are unavailable, fall back to personal-only mode".
 */
export function getGroupId(profile) {
  if (!profile) return null;
  const batch = canonicalize(profile.batch);
  const dept = canonicalize(profile.dept);
  if (!batch || !dept) return null;
  // Firestore doc ids can't contain '/', and we avoid whitespace so this
  // is safe as a single path segment.
  if (isMultiSectionDept(dept)) {
    const section = canonicalize(profile.section);
    if (!section) return null; // profile incomplete — section required
    return `${batch}_${dept}_${section}`;
  }
  return `${batch}_${dept}`;
}

/**
 * Human-readable label for UI, e.g. "2K23 · CSE" or "2K23 · CSE · Section A"
 */
export function getGroupLabel(profile) {
  if (!profile) return '';
  const batch = canonicalize(profile.batch);
  const dept = canonicalize(profile.dept);
  if (!batch || !dept) return '';
  if (isMultiSectionDept(dept)) {
    const section = canonicalize(profile.section);
    if (!section) return '';
    return `${batch} · ${dept} · Section ${section}`;
  }
  return `${batch} · ${dept}`;
}

/**
 * The identity payload stamped onto every group write (routine entry,
 * assignment entry, resource, notice, audit log row). Keeping this in one
 * place ensures "last updated by" always looks the same everywhere.
 */
export function getIdentityStamp(profile, uid) {
  return {
    uid,
    name: profile?.name || 'Unknown',
    roll: profile?.studentId || '',
  };
}

/**
 * Numeric-aware roll sort. Originally a local copy inside
 * FacultyClassDetail.jsx (Marks/Attendance tabs) — extracted here since
 * the Admin individual-student notice-targeting picker
 * (AdminDashboard.jsx's CommunicationView) is now a 2nd call site with the
 * exact same need (dept+batch member list, roll-number-sorted).
 *
 * A plain string sort puts "10" before "2" (lexicographic, not numeric)
 * and pushes any member with a blank/non-numeric roll out of place. This
 * sorts numerically wherever both sides parse as numbers, falls back to a
 * locale-aware string compare otherwise, and always pushes members with no
 * roll at all to the end (rather than letting '' sort first).
 */
export function sortByRoll(members) {
  const list = Array.isArray(members) ? members : [];
  return [...list].sort((a, b) => {
    const ra = String(a?.roll || '').trim();
    const rb = String(b?.roll || '').trim();
    if (!ra && !rb) return 0;
    if (!ra) return 1;
    if (!rb) return -1;
    const na = Number(ra);
    const nb = Number(rb);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return ra.localeCompare(rb, undefined, { numeric: true, sensitivity: 'base' });
  });
}