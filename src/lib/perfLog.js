// perfLog.js
//
// Tiny console-timing helper, added purely so navigation lag can be
// measured page-by-page instead of guessed at. Every Require* guard
// (RequireStaff, RequireFaculty, RequireProvider, RequireStudentMode,
// RequireCR) and AdminEntryPoint now call start()/end() around their
// "checking access…" -> resolved transition, and NavRow/Sidebar log when
// a route click happens and when that route's lazy chunk finishes
// loading. Everything logs under the 'kuetx:perf' console group tag so
// it's easy to filter in devtools (type "kuetx:perf" in the console
// filter box).
//
// Safe to leave in production — it's just console.log with performance.now()
// timestamps, no behavior change, negligible cost. Remove later by
// deleting this file and the start()/end() call sites if no longer needed.

const marks = new Map();

/** Call when a timed operation begins. label should be unique per call
 * (e.g. `${guardName}:${path}`) so overlapping checks on different pages
 * don't clobber each other. */
export function perfStart(label) {
  marks.set(label, performance.now());
  console.log(`[kuetx:perf] ▶ ${label} — started`);
}

/** Call when the operation finishes. Logs elapsed ms since perfStart. */
export function perfEnd(label, extra = '') {
  const t0 = marks.get(label);
  const elapsed = t0 != null ? (performance.now() - t0).toFixed(1) : '?';
  marks.delete(label);
  console.log(`[kuetx:perf] ⏱ ${label} — ${elapsed}ms${extra ? ` (${extra})` : ''}`);
}

/** One-off instant log, no start/end pairing — for click/mount timestamps. */
export function perfMark(label) {
  console.log(`[kuetx:perf] • ${label} @ ${performance.now().toFixed(1)}ms`);
}
