import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getProfile } from '../store/store';
import { getGroupId } from '../lib/groupUtils';
import { subscribeMyRole } from '../lib/groupSync';
import { auth } from '../lib/firebase';

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
  const [status, setStatus] = useState('loading'); // loading | allowed | denied

  useEffect(() => {
    if (!groupId || !auth.currentUser?.uid) { setStatus('denied'); return; }
    const unsub = subscribeMyRole(groupId, auth.currentUser.uid, (role) => {
      setStatus(role === 'cr' || role === 'acr' ? 'allowed' : 'denied');
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
          এই পেজটা শুধু CR/ACR-দের জন্য
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 20 }}>
          তোমার class-এর অ্যাপ্রুভড CR/ACR না হলে এই টুল ব্যবহার করা যাবে না — লিংক থাকলেও না। CR হতে হলে Classmates পেজ থেকে claim করো।
        </div>
        <Link to="/classmates" className="btn btn-primary btn-sm">Classmates পেজে যাও</Link>
      </div>
    );
  }

  return children;
}
