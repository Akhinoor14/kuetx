// useModuleUsageTracker.js
//
// Firestore-backed sibling to usePageTracker.js (which is local-only,
// per-device, and feeds the small on-device "recently visited" list).
// This one logs module-level route visits to activity/{uid}/moduleUsage
// (see activityTracking.js) so the Founder/SCL Analytics dashboard can
// show feature adoption ("% of active users who used Question Bank this
// week") across the whole user base, not just this device.
//
// Deliberately separate from usePageTracker: that one is unauthenticated-
// safe, fires on every path including ones we don't want counted toward
// adoption (Settings, About); this one only fires for routes that map to
// a real module (moduleForPath returns null for anything else) and only
// once per module per mount of a given path (route re-renders on the
// same path — e.g. a param changing on /faculty/classes/:id — don't
// re-log; see the ref guard below).

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { moduleForPath } from '../lib/moduleMap';
import { logModuleUsage } from '../lib/activityTracking';

export function useModuleUsageTracker() {
  const location = useLocation();
  const lastLoggedModule = useRef(null);

  useEffect(() => {
    const moduleKey = moduleForPath(location.pathname);
    if (!moduleKey) return;
    if (moduleKey === lastLoggedModule.current) return;
    lastLoggedModule.current = moduleKey;
    logModuleUsage(moduleKey);
  }, [location.pathname]);
}
