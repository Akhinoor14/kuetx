// teacherRegistry.js
//
// Group-shared teacher ID registry — the fix for the "renaming a teacher
// breaks attendance history" class of bugs. Before this, every
// courseTeacherMap entry AND every attendance/marks/rotation key was built
// directly from the teacher's display name string
// (`${courseId}_${teacherName}`). That meant:
//   - Renaming a teacher (typo fix, "Dr." added, honorific change) silently
//     orphaned every attendance record keyed under the old spelling.
//   - Two CRs typing the same teacher's name slightly differently
//     (extra space, different capitalization) produced two different
//     attendance buckets for the same real person.
//
// The fix: teachers now have a stable, group-scoped ID (like any other
// Firestore-style record id — see uid() in store.js). `courseTeacherMap`
// stores IDs (`{ [courseId]: [teacherId, ...] }`) instead of name strings.
// A new `teacherRegistry` map (`{ [teacherId]: name }`) is the single
// source of truth for "what does this teacher go by right now" — rename a
// teacher by editing ONE registry entry, and every course/attendance
// record that references that ID picks up the new name automatically.
//
// Both live in the same groups/{groupId}/meta/plannerSettings doc,
// written via updatePlannerSettings (see groupSync.js) — no new Firestore
// path, no new write function, just two more fields on the existing doc.
//
// IMPORTANT — CourseTeacherDialog.jsx is the one deliberate exception:
// it stays free-text-name-based (see its own comments on why — the CR
// just knows the teacher's name and shouldn't have to think about IDs).
// The ID assignment happens one layer up, in whichever page's
// onSave/handleSaveTeachers wires the dialog to updatePlannerSettings —
// see resolveTeacherIdsForNames below, which is what those call sites use
// to turn the dialog's typed names into stable IDs before writing
// courseTeacherMap.

import { uid } from '../store/store';

/**
 * Normalize a teacher display name the same way CourseTeacherDialog and
 * Schedule.jsx already do: trim + collapse internal whitespace. This is
 * ONLY for comparing/deduping names when resolving to an ID — it is not
 * an honorific-guessing or spelling-correction step (see
 * CourseTeacherDialog's own comment on why that was removed). The
 * registry stores whatever the CR actually typed, normalized just enough
 * that "Dr. Ahmed Khan" and "Dr. Ahmed Khan " don't silently become two
 * different people.
 */
export function normalizeTeacherName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

/** Case-insensitive comparison key, used only for matching an existing
 * registry entry when resolving a typed name — never stored or displayed. */
function matchKey(name) {
  return normalizeTeacherName(name).toLowerCase();
}

/**
 * Given a plannerSettings.teacherRegistry map ({teacherId: name}) and a
 * list of typed/display names, return { registry, ids } where:
 *   - registry is the (possibly-extended) registry: existing entries are
 *     kept as-is (including their ID), any name with no case-insensitive
 *     match gets a freshly minted ID.
 *   - ids is the resolved teacherId array, same order as the input names.
 *
 * This is what a courseTeacherMap write site calls BEFORE writing —
 * see ClassSetup.jsx / ClassSetupModal.jsx / useClassManagementState.js's
 * onSave handlers for CourseTeacherDialog. Blank/whitespace-only names are
 * dropped (matches the dialog's own "at least one teacher required"
 * validation — this function doesn't re-validate, it just never mints an
 * ID for an empty string).
 *
 * BUGFIX — a deliberate rename used to mint a brand-new ID instead of
 * updating the existing one: CourseTeacherDialog.jsx is free-text and has
 * no notion of "this is teacherId X being edited" — it just shows the
 * course's current two name strings and lets the CR retype them. So a
 * genuine rename (typo fix, "Sir" -> "Ma'am") produces a name that no
 * longer case-insensitively matches the OLD spelling, and the old
 * name-matching logic below would treat that as a brand-new teacher,
 * minting a fresh ID and silently orphaning every attendance/marks record
 * still pointing at the old one — the exact bug this whole ID system was
 * built to prevent, just moved one layer up (from "renaming detaches
 * data" to "renaming mints a new detached id"). Fixed by accepting an
 * optional `existingIds` array — this course's CURRENT teacherId list,
 * same order/position as the `names` being saved (every call site already
 * has this via courseTeacherMap[courseId], since that's exactly what
 * seeds CourseTeacherDialog's `currentTeachers` prop in the first place).
 * When provided, a name at position i reuses existingIds[i] directly —
 * "whatever was in this slot before is still the same person, just
 * possibly retyped" — rather than searching the registry by spelling.
 * Only falls back to name-matching (mint-if-unmatched) for a position
 * with no existing id (a brand new second-teacher slot, or a first-time
 * assignment), which is exactly the case that was already correct before.
 */
export function resolveTeacherIdsForNames(existingRegistry, names, existingIds = []) {
  const registry = { ...(existingRegistry || {}) };
  // Build a lookup from normalized-lowercase name -> existing id, so a
  // repeat of an already-known teacher (typed fresh into the dialog,
  // possibly with different capitalization/spacing, with no existingIds
  // slot to anchor to — e.g. a brand new course assignment reusing a
  // teacher already known from another course) reuses their ID instead of
  // minting a duplicate.
  const byMatchKey = new Map();
  Object.entries(registry).forEach(([id, name]) => {
    byMatchKey.set(matchKey(name), id);
  });

  const ids = [];
  (names || []).forEach((rawName, index) => {
    const name = normalizeTeacherName(rawName);
    if (!name) return;

    // Positional reuse first: this exact slot already pointed at a real
    // teacherId, so a retype here is a rename of THAT teacher, not a
    // lookup for a possibly-different one. This is what makes a
    // deliberate rename (new spelling, doesn't match the old one) still
    // land on the same id instead of minting a new one.
    const pinnedId = existingIds[index];
    if (pinnedId && Object.prototype.hasOwnProperty.call(registry, pinnedId)) {
      registry[pinnedId] = name;
      byMatchKey.set(matchKey(name), pinnedId);
      ids.push(pinnedId);
      return;
    }

    // No pinned id for this slot (new assignment, or existingIds not
    // provided by an older call site) — fall back to matching an existing
    // registry entry by spelling, same as before.
    const key = matchKey(name);
    let id = byMatchKey.get(key);
    if (!id) {
      id = uid();
      byMatchKey.set(key, id);
      registry[id] = name;
    } else {
      registry[id] = name;
    }
    ids.push(id);
  });

  return { registry, ids };
}

/**
 * Resolve an array of teacherIds to display names via the registry.
 * Unknown IDs (shouldn't normally happen, but a registry read racing a
 * write, or an ID from a since-deleted entry, is possible) fall back to
 * the raw ID string rather than silently dropping the entry — better to
 * show something a CR will notice looks wrong than to make a teacher
 * invisible from a roster.
 */
export function resolveTeacherNames(registry, teacherIds) {
  const reg = registry || {};
  return (teacherIds || []).map((id) => reg[id] || id).filter(Boolean);
}

/**
 * Resolve a single teacherId to a display name. Returns '' for a
 * falsy/missing id (vs. resolveTeacherNames, which is array-in/array-out
 * and used for roster-style displays).
 */
export function resolveTeacherName(registry, teacherId) {
  if (!teacherId) return '';
  return (registry || {})[teacherId] || teacherId;
}

/**
 * True once courseTeacherMap's values look like IDs (i.e. every id in
 * every course's list resolves in teacherRegistry) rather than raw name
 * strings. Used as the migration-complete guard — see
 * migrateCourseTeacherMapToIds below and its callers.
 *
 * An empty courseTeacherMap (new group, nothing assigned yet) counts as
 * "already migrated" — there's nothing to convert, and a brand new group
 * should never trip the legacy-name code path.
 */
export function isCourseTeacherMapMigrated(courseTeacherMap, teacherRegistry) {
  const map = courseTeacherMap || {};
  const registry = teacherRegistry || {};
  const courseIds = Object.keys(map);
  if (courseIds.length === 0) return true;
  return courseIds.every((courseId) => {
    const list = Array.isArray(map[courseId]) ? map[courseId] : [];
    if (list.length === 0) return true;
    return list.every((entry) => Object.prototype.hasOwnProperty.call(registry, entry));
  });
}

/**
 * One-time, idempotent conversion of a legacy name-keyed courseTeacherMap
 * into an ID-keyed one, minting (or reusing) teacherRegistry entries for
 * every distinct name encountered. Pure function — callers are
 * responsible for actually writing the result back via
 * updatePlannerSettings (see App.jsx's boot-time migration effect).
 *
 * Idempotent by construction: if courseTeacherMap is already ID-based
 * (isCourseTeacherMapMigrated is true), this is a no-op that returns the
 * inputs unchanged — safe to call on every plannerSettings snapshot
 * without needing an extra "already migrated" flag written anywhere.
 *
 * Returns null if nothing needs to change (already migrated, or nothing
 * to migrate), so callers can skip the write entirely in the common case.
 */
export function migrateCourseTeacherMapToIds(courseTeacherMap, teacherRegistry) {
  const map = courseTeacherMap || {};
  if (isCourseTeacherMapMigrated(map, teacherRegistry)) return null;

  let registry = { ...(teacherRegistry || {}) };
  const nextMap = {};
  let changed = false;

  Object.entries(map).forEach(([courseId, entry]) => {
    const list = Array.isArray(entry) ? entry : [];
    // Names already resolved (mixed state — shouldn't normally happen,
    // but a course whose list is already all-IDs should pass through
    // untouched rather than being re-resolved against itself).
    const alreadyIds = list.length > 0 && list.every((v) => Object.prototype.hasOwnProperty.call(registry, v));
    if (alreadyIds) {
      nextMap[courseId] = list;
      return;
    }
    const { registry: nextRegistry, ids } = resolveTeacherIdsForNames(registry, list);
    registry = nextRegistry;
    nextMap[courseId] = ids;
    changed = true;
  });

  if (!changed) return null;
  return { courseTeacherMap: nextMap, teacherRegistry: registry };
}
