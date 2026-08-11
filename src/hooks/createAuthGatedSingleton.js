// createAuthGatedSingleton.js
//
// PERFORMANCE FIX: useIsFaculty/useIsProvider/useIsStaff each open a fresh
// onAuthStateChanged + one-or-two onSnapshot subscription(s) every time
// their component mounts. Because RequireStudentMode/RequireProvider/
// RequireFaculty/RequireStaff/RequireCR are placed INSIDE individual
// <Route> elements (see App.jsx) rather than wrapping the whole route
// tree once, React Router unmounts and remounts them on every single
// navigation — so these subscriptions were being torn down and
// re-established on every click, adding avoidable listener-churn +
// render-cascade latency on top of whatever Firestore itself takes to
// respond. (See PERF_AUDIT for the fuller writeup — the route tree
// itself is safer to leave as-is for now, so this fixes it at the hook
// level instead.)
//
// This factory creates ONE shared subscription per "kind" of check
// (faculty/provider/staff) for the lifetime of the page, no matter how
// many component instances mount/unmount. Each hook instance just
// subscribes to the singleton's current state and gets notified on
// change; the underlying Firestore listener is only created once, the
// first time any consumer needs it, and is only torn down if the app
// explicitly disposes it (never automatically on route change).
//
// `setup(onState)` should attach whatever onAuthStateChanged/onSnapshot
// listeners are needed and call onState(newState) whenever the answer
// changes. It must return an unsubscribe function (only ever called if
// disposeAuthGatedSingleton is explicitly invoked, e.g. on full sign-out
// cleanup elsewhere — normal component unmount never triggers it).
export function createAuthGatedSingleton(setup, initialState) {
  let state = initialState;
  let started = false;
  let teardown = () => {};
  const listeners = new Set();

  const ensureStarted = () => {
    if (started) return;
    started = true;
    teardown = setup((next) => {
      state = next;
      for (const fn of listeners) {
        try { fn(state); } catch { /* ignore listener errors */ }
      }
    });
  };

  const subscribe = (listener) => {
    ensureStarted();
    listeners.add(listener);
    // Deliver the current state immediately so a newly-mounted consumer
    // doesn't have to wait for the next Firestore event to catch up.
    listener(state);
    return () => {
      listeners.delete(listener);
    };
  };

  const getState = () => {
    ensureStarted();
    return state;
  };

  // Not called anywhere in normal app operation today — provided for
  // completeness/tests, and in case a future full-teardown path (e.g.
  // "wipe everything on explicit logout across all tabs") needs it.
  const dispose = () => {
    if (!started) return;
    started = false;
    listeners.clear();
    try { teardown(); } catch { /* ignore */ }
  };

  return { subscribe, getState, dispose };
}
