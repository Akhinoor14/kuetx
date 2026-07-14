// RequestDeleteButton.jsx
//
// Campus Lead panel for requesting removal of live Question Bank papers
// in their own dept. A CL can never delete a live public paper directly
// (see deleteRequests.js / firestore.rules) — this only submits a
// deleteRequests/{id} doc for Founder/Head of Ops to review. Lives inside
// StaffDashboard's CampusLeadBlock, right next to the upload form for
// the same group.

import { useState, useMemo } from 'react';
import { useQuestionBankData } from '../hooks/useQuestionBankData';
import { submitDeleteRequest } from '../lib/deleteRequests';
import { notify } from '../lib/notify';

export default function RequestDeleteButton({ groupId, dept }) {
  const { tree, loading } = useQuestionBankData();
  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  // Flatten this dept's tree into a single list of {key, dept, term,
  // courseCode, label} rows for selection — same shape deleteRequests.js
  // expects per item.
  const papers = useMemo(() => {
    const deptTree = tree?.[dept] || {};
    const rows = [];
    for (const term of Object.keys(deptTree)) {
      for (const courseCode of Object.keys(deptTree[term])) {
        for (const p of deptTree[term][courseCode]) {
          rows.push({ key: p.key, dept, term, courseCode, label: p.label });
        }
      }
    }
    return rows;
  }, [tree, dept]);

  if (loading) return <div style={{ fontSize: 12, color: 'var(--muted)' }}>Loading papers…</div>;
  if (papers.length === 0) return <div style={{ fontSize: 12, color: 'var(--muted)' }}>No live papers for this department yet.</div>;

  const toggle = (key) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const submit = async () => {
    setSubmitting(true);
    setErr('');
    try {
      const items = papers.filter((p) => selectedKeys.has(p.key));
      await submitDeleteRequest({ groupId, dept }, items);
      setSelectedKeys(new Set());
      setConfirming(false);
      notify(`Delete request submitted for ${items.length} file(s) — awaiting Founder approval.`, 'success');
    } catch (e) {
      setErr(e?.message || 'Failed to submit delete request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {err && <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 8 }}>{err}</div>}
      {papers.map((p) => (
        <label key={p.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0', cursor: 'pointer' }}>
          <input type="checkbox" checked={selectedKeys.has(p.key)} onChange={() => toggle(p.key)} style={{ marginTop: 3 }} />
          <span style={{ fontSize: 12, minWidth: 0, wordBreak: 'break-word' }}>{p.term} · {p.courseCode} · {p.label}</span>
        </label>
      ))}

      {selectedKeys.size > 0 && (
        <div style={{ marginTop: 8 }}>
          {!confirming ? (
            <button className="btn btn-sm btn-secondary" onClick={() => setConfirming(true)}>
              Request Delete ({selectedKeys.size})
            </button>
          ) : (
            <div>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
                You're requesting deletion of {selectedKeys.size} file(s). This won't delete them
                immediately — Founder approval is required.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <button className="btn btn-sm btn-primary" onClick={submit} disabled={submitting}>
                  {submitting ? 'Submitting…' : 'Confirm request'}
                </button>
                <button className="btn btn-sm" onClick={() => setConfirming(false)} disabled={submitting}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
