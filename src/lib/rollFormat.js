// rollFormat.js
//
// Single source of truth for student roll-number validation/parsing.
// KUET now issues two roll formats:
//   - 7-digit (legacy):  batch(2) + dept(2) + seat(3)      e.g. 2313014
//   - 8-digit (current): '5' + batch(2) + dept(2) + seat(3) e.g. 52513014
//
// Confirmed with Akhinoor (Aug 2026): the 8-digit format is just a
// leading '5' prepended to an otherwise-normal 7-digit roll. Strip the
// leading 5, and the remaining 7 digits parse with the EXACT same
// batch/dept/seat logic as before. Both formats coexist permanently —
// this is not a migration, students keep whichever format KUET issued
// them. Scope is student rolls only; faculty IDs are untouched.
//
// Every file that validates/parses a roll number MUST import from here
// instead of hardcoding /^\d{7}$/ — that hardcoding is exactly what
// broke sign-up for 8-digit students in the first place.

const SEVEN_DIGIT_RE = /^\d{7}$/;
const EIGHT_DIGIT_RE = /^5\d{7}$/;

/**
 * True if `roll` is a valid 7-digit (legacy) or 8-digit (current,
 * leading '5') KUET student roll. Whitespace-trimmed before checking.
 */
export function isValidRoll(roll) {
  const r = String(roll || '').trim();
  return SEVEN_DIGIT_RE.test(r) || EIGHT_DIGIT_RE.test(r);
}

/**
 * Trim/normalize a roll string. Does NOT strip the leading '5' — that's
 * a parsing concern (see parseRoll/toSevenDigitCore), not a storage
 * concern. The roll is stored and displayed exactly as the student
 * entered/was issued it (7 or 8 digits, as-is).
 */
export function normalizeRoll(roll) {
  return String(roll || '').trim();
}

/**
 * Returns the underlying 7-digit "core" used for batch/dept/seat
 * parsing — the 8-digit format's leading '5' is stripped, a 7-digit
 * roll is returned unchanged. Returns '' if `roll` isn't a valid roll
 * in either format.
 */
export function toSevenDigitCore(roll) {
  const r = normalizeRoll(roll);
  if (SEVEN_DIGIT_RE.test(r)) return r;
  if (EIGHT_DIGIT_RE.test(r)) return r.slice(1);
  return '';
}

/**
 * Parses a roll (7 or 8 digit) into { batch, deptDigits, seat, format }.
 * batch/deptDigits/seat are 2/2/3-digit strings (NOT dept codes — use
 * store.js's ROLL_DEPT_MAP to resolve deptDigits -> dept code, same as
 * before). format is '7' or '8'. Returns null if invalid.
 */
export function parseRoll(roll) {
  const r = normalizeRoll(roll);
  const core = toSevenDigitCore(r);
  if (!core) return null;
  return {
    batch: core.slice(0, 2),
    deptDigits: core.slice(2, 4),
    seat: core.slice(4, 7),
    format: r.length === 8 ? '8' : '7',
  };
}

/**
 * Short roll for display in identity stamps / edit logs — last 3 digits
 * (the seat number), same meaning in both formats since the seat digits
 * are always the last 3 regardless of 7 vs 8 digit length.
 */
export function shortRoll(roll) {
  const r = normalizeRoll(roll);
  return r ? r.slice(-3) : '';
}
