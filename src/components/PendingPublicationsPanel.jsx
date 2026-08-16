// PendingPublicationsPanel.jsx
//
// Founder/Admin review panel for community-submitted publications (see
// pendingPublicationsSync.js). Built as a STANDALONE, self-contained
// component (not wired into AdminDashboard.jsx's <Section> layout in
// this pass) so it can be dropped into that file's existing tab
// structure with minimal risk — see the handoff doc for exactly where.
//
// Usage inside AdminDashboard.jsx, next to the existing
// "Manual Verify"/approvals sections:
//   import PendingPublicationsPanel from '../components/PendingPublicationsPanel';
//   ...
//   <PendingPublicationsPanel />
//
// It manages its own subscription/loading/error state — no props
// required — matching how AdminDashboard.jsx's own Section blocks are
// mostly self-contained already.

import { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import {
  subscribePendingPublicationSubmissions,
  approvePublicationSubmission,
  rejectPublicationSubmission,
} from '../lib/pendingPublicationsSync';
import { notify } from '../lib/notify';

export default function PendingPublicationsPanel() {
  const [submissions, setSubmissions] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    const unsub = subscribePendingPublicationSubmissions(
      setSubmissions,
      () => setSubmissions([])
    );
    return unsub;
  }, []);

  async function handleApprove(submission) {
    if (busyId) return;
    setBusyId(submission.id);
    try {
      await approvePublicationSubmission(submission);
      notify('Publication approved and published.', 'success');
    } catch (err) {
      notify(err?.message || 'Could not approve.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(submissionId) {
    if (busyId) return;
    setBusyId(submissionId);
    try {
      await rejectPublicationSubmission(submissionId);
      notify('Submission rejected.', 'success');
    } catch (err) {
      notify(err?.message || 'Could not reject.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  const loading = submissions === null;
  const count = submissions?.length || 0;

  return (
    <div className="card" style={{ padding: 16, borderRadius: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Icons.BookMarked size={18} color="var(--accent)" />
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
          Pending publication submissions
        </h3>
        {!loading && count > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 800, color: '#fff', background: 'var(--accent)',
            borderRadius: 999, padding: '2px 8px', marginLeft: 4,
          }}>
            {count}
          </span>
        )}
      </div>

      {loading && <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</div>}
      {!loading && count === 0 && (
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>No pending submissions.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(submissions || []).map((sub) => (
          <div key={sub.id} style={{ padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)' }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{sub.title}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
              {[sub.venue, sub.year].filter(Boolean).join(' · ')}
            </div>
            <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, marginTop: 4 }}>
              For: {sub.teacherName || sub.teacherEmail} ({sub.teacherEmail})
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>
              Submitted by {sub.submittedBy?.displayName || sub.submittedBy?.email || 'unknown user'}
              {sub.submittedBy?.email && sub.teacherEmail
                && sub.submittedBy.email.trim().toLowerCase() === sub.teacherEmail.trim().toLowerCase()
                ? ' (self-submitted — the teacher added their own publication)' : ''}
            </div>
            {sub.link && (
              <a
                href={sub.link}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 11.5, color: 'var(--accent)', fontWeight: 600, marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <Icons.ExternalLink size={11} /> Check link
              </a>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                onClick={() => handleApprove(sub)}
                disabled={busyId === sub.id}
                style={{
                  flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', background: '#2f9e44',
                  color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: busyId === sub.id ? 'default' : 'pointer',
                  opacity: busyId === sub.id ? 0.7 : 1,
                }}
              >
                {busyId === sub.id ? 'Working…' : 'Approve'}
              </button>
              <button
                onClick={() => handleReject(sub.id)}
                disabled={busyId === sub.id}
                style={{
                  flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent',
                  color: 'var(--text)', fontWeight: 700, fontSize: 12.5, cursor: busyId === sub.id ? 'default' : 'pointer',
                }}
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
