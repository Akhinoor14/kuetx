import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getProfile } from '../store/store';
import { getGroupId } from '../lib/groupUtils';
import { subscribeMyRole } from '../lib/groupSync';
import { auth } from '../lib/firebase';

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
  const [status, setStatus] = useState(() => {
    try {
      // Only trust the cache as a provisional "allowed" — otherwise stay
      // in 'loading' rather than provisionally showing the denied screen,
      // since a wrong denial (even briefly) is worse than a beat of
      // "Checking CR access…" for someone who genuinely isn't CR/ACR.
      return sessionStorage.getItem(CACHE_KEY) === '1' ? 'allowed' : 'loading';
    } catch {
      return 'loading';
    }
  });

  useEffect(() => {
    if (!groupId || !auth.currentUser?.uid) {
      setStatus('denied');
      try { sessionStorage.setItem(CACHE_KEY, '0'); } catch { /* ignore */ }
      return;
    }
    const unsub = subscribeMyRole(groupId, auth.currentUser.uid, (role) => {
      const allowed = role === 'cr' || role === 'acr';
      setStatus(allowed ? 'allowed' : 'denied');
      try { sessionStorage.setItem(CACHE_KEY, allowed ? '1' : '0'); } catch { /* ignore */ }
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
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
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

  return children;
}
