// QBReviewQueue.jsx
//
// Review queue for pending question-bank upload requests. Two modes:
//   - dept={deptCode}: Senior Campus Lead's own-dept queue
//     (subscribeQBUploadRequestsForDept) — used in StaffDashboard.jsx's
//     Senior Campus Lead tab, one instance per dept they lead.
//   - dept={null} (all=true): Founder/Head of Ops fallback view, every
//     pending request system-wide regardless of dept — same universal
//     fallback shape as AdminAllGroupsSection/HeadOfOpsSection elsewhere
//     in this codebase (a dept whose SCL post is vacant should never
//     leave uploads stuck with no one able to act on them).
//
// Batch uploads: multiple requests just show up as separate rows here —
// there's no separate "batch" UI, each file the CL submitted is its own
// row, reviewed/approved independently. This matches how CR/leave
// requests already work everywhere else in this file.

import { useState } from 'react';
import { subscribeQBUploadRequestsForDept, subscribeAllQBUploadRequests, approveQBUpload, rejectQBUpload } from '../lib/qbUploadRequests';
import { useEffect } from 'react';

export default function QBReviewQueue({ dept, all = false }) {
  const [requests, setRequests] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState('');
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    const sub = all
      ? subscribeAllQBUploadRequests(setRequests)
      : subscribeQBUploadRequestsForDept(dept, setRequests);
    return sub;
  }, [dept, all]);

  if (requests === null) return <div style={{ fontSize: 12, color: 'var(--muted)' }}>Loading…</div>;
  if (requests.length === 0) return <div style={{ fontSize: 12, color: 'var(--muted)' }}>No pending uploads.</div>;

  const handleApprove = async (r) => {
    setBusyId(r.id);
    setErr('');
    try {
      await approveQBUpload(r.id);
    } catch (e) {
      setErr(e?.message || 'Approve failed — the file may already exist under that name.');
    } finally {
      setBusyId(null);
    }
  };

  const openReject = (r) => { setRejectingId(r.id); setRejectReason(''); };

  const confirmReject = async (r) => {
    setBusyId(r.id);
    setErr('');
    try {
      await rejectQBUpload(r.id, rejectReason.trim());
      setRejectingId(null);
    } catch (e) {
      setErr(e?.message || 'Reject failed — try again.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      {err && <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 8 }}>{err}</div>}
      {requests.map((r) => (
        <div key={r.id} className="card" style={{ padding: 10, marginBottom: 6 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0, wordBreak: 'break-word' }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>
                {r.dept} · {r.term} · {r.courseCode}{r.courseTitle ? ` — ${r.courseTitle}` : ''}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{r.label}.pdf ({Math.round((r.fileSize || 0) / 1024)} KB)</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                {r.uploaderName || 'Unknown'}{r.uploaderRoll ? ` (${r.uploaderRoll})` : ''} · {r.groupId || r.batch || 'no group'}
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <button className="btn btn-sm btn-primary" onClick={() => handleApprove(r)} disabled={busyId === r.id}>
                {busyId === r.id ? 'Working…' : 'Approve'}
              </button>
              <button className="btn btn-sm btn-secondary" onClick={() => openReject(r)} disabled={busyId === r.id}>Reject</button>
            </div>
          </div>

          {rejectingId === r.id && (
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <input
                placeholder="Reason (optional)"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                style={{ flex: '1 1 200px', minWidth: 0, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)', fontSize: 12 }}
              />
              <button className="btn btn-sm btn-secondary" onClick={() => confirmReject(r)} disabled={busyId === r.id}>Confirm reject</button>
              <button className="btn btn-sm" onClick={() => setRejectingId(null)}>Cancel</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
