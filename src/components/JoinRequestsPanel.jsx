import { useEffect, useState } from 'react';
import { UserPlus, Check, X } from 'lucide-react';
import { subscribeJoinRequests, approveJoinRequest, rejectJoinRequest } from '../lib/groupSync';
import { confirmDialog } from '../lib/dialog';

/**
 * Review students asking to join this class — CR/ACR, or (as of the
 * ClassRoster.jsx fix) the class's own Campus Lead, that dept's Senior
 * Campus Lead, Head of Ops, or Founder, all scoped by firestore.rules'
 * isCLFor(groupId)/isSCLForGroup(groupId)/isHeadOfOps()/isAdmin() on the
 * joinRequests/members write rules. This is the ONLY place a plain
 * member's access is granted now — approving a request here is what
 * actually creates their groups/{groupId}/members doc (see
 * approveJoinRequest in groupSync.js). There is no OTP/email link step
 * anywhere in this flow; the reviewer looking at the name, roll, and
 * self-typed contact email IS the verification.
 *
 * suggestedJoinMatch (computed when the request was submitted) is shown
 * as a badge purely as a hint — a mismatch doesn't block approval, it
 * just tells the reviewer "double-check this one before approving".
 */
export default function JoinRequestsPanel({ groupId }) {
  const [requests, setRequests] = useState(null); // null = loading
  const [busyId, setBusyId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!groupId) return;
    setRequests(null);
    return subscribeJoinRequests(groupId, setRequests);
  }, [groupId]);

  const handleApprove = async (uid) => {
    setBusyId(uid);
    setErrorMsg('');
    try {
      await approveJoinRequest(groupId, uid);
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to approve this request.');
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (uid) => {
    if (!(await confirmDialog('Reject this join request? They can send a new one later.'))) return;
    setBusyId(uid);
    setErrorMsg('');
    try {
      await rejectJoinRequest(groupId, uid);
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to reject this request.');
    } finally {
      setBusyId(null);
    }
  };

  if (!groupId) return null;

  return (
    <div className="card" style={{ padding: 14, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <UserPlus size={16} color="var(--accent)" />
        <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Join requests</h2>
        {Array.isArray(requests) && requests.length > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 700, color: 'var(--accent)',
            background: 'rgba(59,130,246,0.12)', borderRadius: 999, padding: '1px 8px',
          }}>
            {requests.length}
          </span>
        )}
      </div>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.5 }}>
        New students wait here until you approve them — check the name, roll, and KUET email look right before adding someone to your class.
      </p>

      {requests === null && (
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>Loading…</div>
      )}

      {Array.isArray(requests) && requests.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>No pending join requests.</div>
      )}

      {errorMsg && (
        <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 8 }}>{errorMsg}</div>
      )}

      {Array.isArray(requests) && requests.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {requests.map((r) => {
            const looksRight = r.batchMatches && r.rollInRange;
            return (
              <div
                key={r.id}
                style={{
                  display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)',
                  background: 'var(--surface)',
                }}
              >
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{r.name || 'Unnamed'}</span>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>· {r.roll || '—'}</span>
                    <span
                      title={looksRight ? 'Roll matches this class\u2019s batch & department' : 'Roll does not look like it belongs to this class — double-check before approving'}
                      style={{
                        fontSize: 10.5, fontWeight: 700, borderRadius: 999, padding: '1px 7px',
                        color: looksRight ? 'var(--success)' : 'var(--danger)',
                        background: looksRight ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                      }}
                    >
                      {looksRight ? 'Roll matches' : 'Check roll'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, wordBreak: 'break-all' }}>
                    KUET Email: {r.contactEmail || '\u2014'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', minWidth: 152 }}>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => handleApprove(r.id)}
                    disabled={busyId === r.id}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <Check size={13} /> {busyId === r.id ? 'Approving…' : 'Approve'}
                  </button>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => handleReject(r.id)}
                    disabled={busyId === r.id}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <X size={13} /> Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
