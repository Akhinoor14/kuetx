// useViewMode.js
//
// Single source of truth for "should this render the student shell or the
// faculty shell", used by Sidebar.jsx and BottomNav.jsx (and anything else
// that needs to know). Extracted out of both components because they used
// to each duplicate this derivation inline — which is exactly how the
// isRealFaculty/isFaculty naming bug happened (one copy got the field name
// wrong, the other didn't, and they silently drifted out of sync). Now
// there is exactly one place this logic can go wrong, and exactly one
// place to fix it.
//
//   - A real, verified faculty account (isFaculty from useIsFaculty) is
//     ALWAYS 'teacher' — no switch shown, nothing to toggle.
//   - A real student account is ALWAYS 'student' — same, no switch.
//   - Only the Founder (isFounderBypass) gets a visible switch, because
//     they're the only account that legitimately has both shells
//     available at once. Toggling it doesn't touch Firestore at all, just
//     flips which nav config + hub routes render. The preference is
//     device-local (localStorage), never account data.

import { useEffect, useState } from 'react';
import { useIsFaculty } from './useIsFaculty';

const VIEW_MODE_KEY = 'kuetx:viewMode';
// Same-tab counterpart to the browser's native 'storage' event, which only
// fires in OTHER tabs/windows — never the tab that made the change. Every
// writer of VIEW_MODE_KEY (this hook's own setViewModePref, plus
// AdminDashboard's FounderViewSwitchCard) dispatches this after writing, so
// every mounted useViewMode() instance (desktop Sidebar + mobile BottomNav
// at once) re-reads and re-renders immediately — no manual refresh needed.
const VIEW_MODE_EVENT = 'kuetx:viewModeChanged';

export function setViewMode(next) {
  try { localStorage.setItem(VIEW_MODE_KEY, next); } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent(VIEW_MODE_EVENT, { detail: next })); } catch { /* ignore */ }
}

export function useViewMode() {
  const { isFaculty, isFounderBypass, isResolved } = useIsFaculty();

  const [viewModePref, setViewModePrefState] = useState(() => {
    try { return localStorage.getItem(VIEW_MODE_KEY) || 'student'; } catch { return 'student'; }
  });

  const setViewModePref = (next) => {
    setViewModePrefState(next);
    setViewMode(next);
  };

  // Stay in sync with any writer — same-tab (via the custom event above)
  // or another mounted instance in a different tab/window (native
  // 'storage' event, browser-provided, cross-tab only).
  useEffect(() => {
    const syncFromEvent = (e) => setViewModePrefState(e.detail);
    const syncFromStorage = () => {
      try { setViewModePrefState(localStorage.getItem(VIEW_MODE_KEY) || 'student'); } catch { /* ignore */ }
    };
    window.addEventListener(VIEW_MODE_EVENT, syncFromEvent);
    window.addEventListener('storage', syncFromStorage);
    return () => {
      window.removeEventListener(VIEW_MODE_EVENT, syncFromEvent);
      window.removeEventListener('storage', syncFromStorage);
    };
  }, []);

  // Founder's own choice is the only case that actually matters —
  // everyone else's viewMode is fully determined by their real,
  // server-verified role, computed fresh every render rather than trusted
  // from a possibly-stale localStorage value.
  const viewMode = isFounderBypass ? viewModePref : (isFaculty ? 'teacher' : 'student');
  const canSwitchView = isFounderBypass;

  return { viewMode, canSwitchView, viewModePref, setViewModePref, isResolved };
}
