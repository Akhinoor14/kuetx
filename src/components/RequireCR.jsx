import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { getProfile } from '../store/store';
import { getGroupId } from '../lib/groupUtils';
import { subscribeMyRole } from '../lib/groupSync';
import { auth } from '../lib/firebase';
import ClassSetupModal from './ClassSetupModal';

// Deliberately a DIFFERENT key from Sidebar.jsx's 'kuetx:lastKnownIsRealCR'
// cache, even though both track the same underlying fact. They're fed by
// two independent Firestore listeners (subscribeMembers here vs
// subscribeMyRole in Sidebar.jsx) that can resolve at slightly different
// times — sharing one key let whichever listener settled last overwrite
// the other's cached value, which showed the "CR/ACR only" denied screen
// here for a beat right after a real CR/ACR opened /class-management, even
// though the sidebar (correctly, from its own cache) already showed the
// Class Rep link. Keeping the keys separate removes that cross-talk.
const CACHE_KEY = 'kuetx:lastKnownIsRealCR:requireCR';

/**
 * Blocks access to CR-only pages/tools unless the current user's REAL,
 * server-approved role in their class group is 'cr' or 'acr'.
 *
 * Deliberately does NOT use profile.isCR — that's just a self-ticked
 * checkbox in Profile Setup with zero verification behind it. Someone
 * could tick it and, before this guard existed, reach /class-management
 * or /ct-quiz-planning directly via URL even with no approval at all.
 * The only source of truth here is members/{uid}.role, which only ever
 * changes via a Campus Lead/Admin action (clApproveCRRequest,
 * clAppointCR, assignACR — see groupSync.js).
 */
export default function RequireCR({ children }) {
  const profile = getProfile();
  const groupId = getGroupId(profile);
  // SECURITY (cache scoped to groupId): the cached '1'/'0' answer is only
  // ever trusted when it was written FOR THIS SAME groupId — stored as
  // "<groupId>:<0|1>" rather than a flat 0/1, so a device that switches
  // to a different account (or the same account changes class/group)
  // never shows a stale cached CR/ACR answer that belonged to a
  // different group. useEffect below re-derives and re-caches the moment
  // groupId changes, same as before, this only changes what's trusted for
  // the FIRST synchronous render before that effect runs.
  const [status, setStatus] = useState(() => {
    try {
      // PERF FIX (repeated "Checking CR access…" flash on every
      // navigation): this used to only trust the cache when it said
      // '1' (allowed) — a cached '0' (denied) still fell through to
      // 'loading' every time, so any non-CR student re-visiting a
      // CR-only link (or the sidebar itself, if it ever renders one)
      // saw the loading flash before landing on 'denied' anyway. Since
      // this is a same-tab, same-session, groupId-scoped cache only (see
      // above), and subscribeMyRole below still fires on every mount and
      // corrects this if it's ever wrong, there's no correctness reason
      // to withhold the '0' case — the original "don't provisionally show
      // denied" caution was really about not showing a WRONG denial
      // before the real check ran, not about hiding a cached denial we
      // already verified this session for this exact group.
      if (!groupId) return 'loading';
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (!cached) return 'loading';
      const [cachedGroupId, cachedValue] = cached.split(':');
      if (cachedGroupId !== groupId) return 'loading'; // different group — never trust
      if (cachedValue === '1') return 'allowed';
      if (cachedValue === '0') return 'denied';
      return 'loading';
    } catch {
      return 'loading';
    }
  });

  useEffect(() => {
    if (!groupId || !auth.currentUser?.uid) {
      setStatus('denied');
      return;
    }
    const unsub = subscribeMyRole(groupId, auth.currentUser.uid, (role) => {
      const allowed = role === 'cr' || role === 'acr';
      setStatus(allowed ? 'allowed' : 'denied');
      try { sessionStorage.setItem(CACHE_KEY, `${groupId}:${allowed ? '1' : '0'}`); } catch { /* ignore */ }
    });
    return unsub;
  }, [groupId]);

  if (status === 'loading') {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
        Checking CR access…
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div style={{ padding: '48px 20px', textAlign: 'center', maxWidth: 420, margin: '0 auto' }}>
        <div style={{ marginBottom: 12 }}><Lock size={32} color="var(--muted)" /></div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          This page is only for CR/ACR members
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 20 }}>
          You can not use this tool unless you are the approved CR or ACR for your class, even if you have the link. To become CR, claim it from the Classmates page.
        </div>
        <Link to="/classmates" className="btn btn-primary btn-sm">Go to Classmates</Link>
      </div>
    );
  }

  return (
    <>
      {/* Mounted on EVERY CR-only route (this wrapper gates all of them),
          so wherever a CR/ACR first lands after approval, the mandatory
          setup popup finds them. Renders null itself once classSetup is
          complete — see ClassSetupModal's own early-return. */}
      <ClassSetupModal groupId={groupId} profile={profile} />
      {children}
    </>
  );
}
