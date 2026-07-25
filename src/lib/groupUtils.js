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

/**
 * Derive the group id for a profile. Returns null if the profile doesn't
 * have enough info yet (dept/batch not set) — callers should treat null
 * as "group features are unavailable, fall back to personal-only mode".
 */
export function getGroupId(profile) {
  if (!profile) return null;
  const batch = canonicalize(profile.batch);
  const dept = canonicalize(profile.dept);
  if (!batch || !dept) return null;
  // Firestore doc ids can't contain '/', and we avoid whitespace so this
  // is safe as a single path segment.
  return `${batch}_${dept}`;
}

/**
 * Human-readable label for UI, e.g. "2K23 · CSE"
 */
export function getGroupLabel(profile) {
  if (!profile) return '';
  const batch = canonicalize(profile.batch);
  const dept = canonicalize(profile.dept);
  if (!batch || !dept) return '';
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