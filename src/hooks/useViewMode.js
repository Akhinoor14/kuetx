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

export function useViewMode() {
  const { isFaculty, isFounderBypass, isResolved } = useIsFaculty();

  const [viewModePref, setViewModePref] = useState(() => {
    try { return localStorage.getItem(VIEW_MODE_KEY) || 'student'; } catch { return 'student'; }
  });

  useEffect(() => {
    try { localStorage.setItem(VIEW_MODE_KEY, viewModePref); } catch { /* ignore */ }
  }, [viewModePref]);

  // Stay in sync if the Founder flips the switch in another mounted
  // instance (e.g. desktop Sidebar + mobile BottomNav both present).
  useEffect(() => {
    const sync = () => {
      try { setViewModePref(localStorage.getItem(VIEW_MODE_KEY) || 'student'); } catch { /* ignore */ }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  // Founder's own choice is the only case that actually matters —
  // everyone else's viewMode is fully determined by their real,
  // server-verified role, computed fresh every render rather than trusted
  // from a possibly-stale localStorage value.
  const viewMode = isFounderBypass ? viewModePref : (isFaculty ? 'teacher' : 'student');
  const canSwitchView = isFounderBypass;

  return { viewMode, canSwitchView, viewModePref, setViewModePref, isResolved };
}
