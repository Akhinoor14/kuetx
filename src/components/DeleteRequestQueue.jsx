// DeleteRequestQueue.jsx
//
// Review queue for pending Question Bank delete requests. Founder/Head
// of Ops only (see deleteRequests.js / firestore.rules — no SCL fallback
// here, unlike QBReviewQueue's upload approvals). One card per request,
// each showing the FULL key/path per item (not just filename) so there's
// no ambiguity about which exact file is about to be removed — this was
// an explicit requirement. Per-item checkboxes (default checked) let a
// batch be partially approved/rejected in one action.

import { useState, useEffect } from 'react';
import { subscribePendingDeleteRequests, approveDeleteRequestItems, rejectDeleteRequestItems } from '../lib/deleteRequests';

export default function DeleteRequestQueue() {
  const [requests, setRequests] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState('');
  const [checkedByRequest, setCheckedByRequest] = useState({}); // { [requestId]: Set<key> }

  useEffect(() => subscribePendingDeleteRequests(setRequests), []);

  if (requests === null) return <div style={{ fontSize: 12, color: 'var(--muted)' }}>Loading…</div>;
  if (requests.length === 0) return <div style={{ fontSize: 12, color: 'var(--muted)' }}>No pending delete requests.</div>;

  const pendingItems = (r) => r.items.filter((i) => i.status === 'pending');

  const checkedFor = (r) => checkedByRequest[r.id] || new Set(pendingItems(r).map((i) => i.key));

  const toggleItem = (r, key) => {
    setCheckedByRequest((prev) => {
      const current = new Set(prev[r.id] || pendingItems(r).map((i) => i.key));
      if (current.has(key)) current.delete(key); else current.add(key);
      return { ...prev, [r.id]: current };
    });
  };

  const handleApprove = async (r) => {
    const keys = [...checkedFor(r)];
    if (keys.length === 0) return;
    setBusyId(r.id);
    setErr('');
    try {
      await approveDeleteRequestItems(r.id, keys);
    } catch (e) {
      setErr(e?.message || 'Delete failed — try again.');
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (r) => {
    const keys = [...checkedFor(r)];
    if (keys.length === 0) return;
    setBusyId(r.id);
    setErr('');
    try {
      await rejectDeleteRequestItems(r.id, keys);
    } catch (e) {
      setErr(e?.message || 'Reject failed — try again.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      {err && <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 8 }}>{err}</div>}
      {requests.map((r) => {
        const items = pendingItems(r);
        const checked = checkedFor(r);
        return (
          <div key={r.id} className="card" style={{ padding: 10, marginBottom: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
              Requested by {r.groupId} ({r.dept}) — {items.length} file{items.length === 1 ? '' : 's'} pending
            </div>

            {items.map((item) => (
              <label key={item.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={checked.has(item.key)}
                  onChange={() => toggleItem(r, item.key)}
                  style={{ marginTop: 3 }}
                />
                <span style={{ fontSize: 12, minWidth: 0, wordBreak: 'break-all' }}>{item.key}</span>
              </label>
            ))}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              <button className="btn btn-sm btn-primary" onClick={() => handleApprove(r)} disabled={busyId === r.id || checked.size === 0}>
                {busyId === r.id ? 'Working…' : `Approve selected (${checked.size})`}
              </button>
              <button className="btn btn-sm btn-secondary" onClick={() => handleReject(r)} disabled={busyId === r.id || checked.size === 0}>
                Reject selected
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
