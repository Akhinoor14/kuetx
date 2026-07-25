import { useEffect, useState } from 'react';
import { Clock3, Send, UserX2 } from 'lucide-react';
import { auth } from '../lib/firebase';
import { getGroupLabel } from '../lib/groupUtils';
import {
  subscribeIsOwnMember, subscribeOwnJoinRequestStatus, subscribeMembers,
  requestToJoinGroup,
} from '../lib/groupSync';

/**
 * Profile.jsx dashboard card covering the states a student can be in
 * relative to their own class group, now that joining is request+approve
 * only (see groupSync.js "Join requests" section):
 *
 *   - not a member, no joinRequests doc at all  -> prompt to send one
 *     (this is a fallback UI only; in practice App.jsx's syncGroupMembership
 *     effect and ClassJoinIntro already auto-file one the moment a profile
 *     has a valid groupId, so this state should be rare/momentary)
 *   - not a member, pending joinRequests doc    -> "waiting for approval",
 *     naming the current CR/ACR if one exists so the student knows who to
 *     follow up with
 *   - not a member, rejected joinRequests doc   -> "request was declined",
 *     with a resubmit button (requestToJoinGroup already handles the
 *     resolved-status -> pending resubmission case)
 *   - already an approved member                -> renders nothing; this
 *     card only exists to cover the gap before approval
 *
 * Renders nothing if there's no groupId at all (incomplete profile) —
 * that's ProfileCompleteReminder/ProfileSetupModal's job, not this card's.
 */
export default function JoinStatusCard({ groupId, profile }) {
  const [isMember, setIsMember] = useState(null); // null = unknown yet
  const [joinStatus, setJoinStatus] = useState(null); // null | 'pending' | 'approved' | 'rejected'
  const [members, setMembers] = useState([]);
  const [resending, setResending] = useState(false);
  const [resendError, setResendError] = useState('');

  useEffect(() => {
    if (!groupId || !auth.currentUser?.uid) { setIsMember(null); setJoinStatus(null); return; }
    const unsubMember = subscribeIsOwnMember(groupId, auth.currentUser.uid, setIsMember);
    const unsubReq = subscribeOwnJoinRequestStatus(groupId, auth.currentUser.uid, (req) => setJoinStatus(req?.status || null));
    const unsubMembers = subscribeMembers(groupId, setMembers);
    return () => { unsubMember(); unsubReq(); unsubMembers(); };
  }, [groupId]);

  if (!groupId) return null;
  if (isMember === null) return null; // still loading — avoid a state flash
  if (isMember) return null; // already in, nothing to show here

  const crContacts = members.filter((m) => m.role === 'cr' || m.role === 'acr');

  const handleResend = async () => {
    setResending(true);
    setResendError('');
    try {
      await requestToJoinGroup(groupId, profile, String(profile?.kuetEmail || '').trim());
    } catch (e) {
      setResendError(e?.message || 'Could not send the request. Try again.');
    } finally {
      setResending(false);
    }
  };

  // No request on file yet (rare — see doc-comment above) — offer to send one.
  if (!joinStatus) {
    return (
      <div className="card" style={{
        padding: 14, marginBottom: 16, border: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
          <Send size={15} /> Join {getGroupLabel(profile)}
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
          You're not a member of your class group yet. Send a join request — your CR or ACR needs to approve it.
        </p>
        {resendError && <p style={{ fontSize: 12, color: 'var(--danger, #ef4444)', marginBottom: 8 }}>{resendError}</p>}
        <button className="btn btn-primary btn-sm" onClick={handleResend} disabled={resending}>
          {resending ? 'Sending…' : 'Send join request'}
        </button>
      </div>
    );
  }

  if (joinStatus === 'pending') {
    return (
      <div className="card" style={{
        padding: 14, marginBottom: 16, border: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
          <Clock3 size={15} /> Join request pending
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: crContacts.length ? 8 : 0 }}>
          Your request to join {getGroupLabel(profile)} has been sent and is waiting for your CR/ACR to review your
          name, roll, and KUET email. You'll see class content (roster, notices, routine) once it's approved —
          pending just means it hasn't been reviewed yet, not that it's been declined.
        </p>
        {crContacts.length > 0 && (
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>
            Current {crContacts.length > 1 ? 'CR/ACR' : (crContacts[0].role === 'cr' ? 'CR' : 'ACR')}:{' '}
            {crContacts.map((m) => m.name || m.roll).filter(Boolean).join(', ')}
          </p>
        )}
      </div>
    );
  }

  if (joinStatus === 'rejected') {
    return (
      <div className="card" style={{
        padding: 14, marginBottom: 16, border: '1px solid var(--warning, #f59e0b)',
        background: 'var(--warningBg, rgba(245,158,11,0.08))',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
          <UserX2 size={15} /> Join request declined
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
          Your CR/ACR declined your request to join {getGroupLabel(profile)}. Double check your roll and details,
          then you can send another request.
        </p>
        {resendError && <p style={{ fontSize: 12, color: 'var(--danger, #ef4444)', marginBottom: 8 }}>{resendError}</p>}
        <button className="btn btn-primary btn-sm" onClick={handleResend} disabled={resending}>
          {resending ? 'Sending…' : 'Send another request'}
        </button>
      </div>
    );
  }

  // status === 'approved' but subscribeIsOwnMember hasn't caught up yet
  // (both listeners fire independently) — momentary, render nothing.
  return null;
}
