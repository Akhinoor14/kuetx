// useCRPendingCount.js
//
// CR/ACR's own "something needs my attention" number — mirrors
// useAdminPendingCount.js but for the Class Rep sidebar hub row, which
// is a completely separate button/dashboard from Founder/Campus Lead
// (see nav.js's 'Class Rep' section, hubPath '/class-rep', vs the
// 'Admin' section's hubPath '/team' — two different hubs, two different
// people in general, so this stays its own hook rather than folding into
// useAdminPendingCount).
//
// What counts as CR-actionable right now: pending join requests for
// their own class's roster — the only approve/reject queue a CR/ACR
// works from today (see JoinRequestsPanel.jsx, surfaced on the Roster
// tab of ClassRoster.jsx). If another CR-actionable queue is added later
// (e.g. a future swap-request flow), add its subscription here the same
// way, gated the same way, rather than creating a third hook.
//
// Gated behind isRealCR — never fires for a non-CR account. groupId is
// resolved the same way Sidebar.jsx already does for canSeeCrBoard.

import { useEffect, useState } from 'react';
import { getProfile } from '../store/store';
import { getGroupId } from '../lib/groupUtils';
import { subscribeJoinRequests } from '../lib/groupSync';

export function useCRPendingCount(isRealCR) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isRealCR) { setCount(0); return; }
    const profile = getProfile() || {};
    const groupId = getGroupId(profile);
    if (!groupId) return;
    return subscribeJoinRequests(groupId, (reqs) => setCount((reqs || []).length));
  }, [isRealCR]);

  return count;
}
