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
import {
  subscribeToSelfSubmittedPublications,
  deletePublication,
} from '../lib/facultyPublicationsSync';
import PublicationEditModal from './PublicationEditModal';
import { notify } from '../lib/notify';

export default function PendingPublicationsPanel() {
  const [subTab, setSubTab] = useState('pending'); // 'pending' | 'self'
  const [submissions, setSubmissions] = useState(null);
  const [busyId, setBusyId] = useState(null);

  // Self-published (recent) — audit-only feed, see facultyPublicationsSync.js.
  // These are already LIVE (instant-publish, no approval gate); this tab
  // exists so a Founder can spot-check content quality after the fact and
  // Edit/Delete if needed — deliberately NOT mixed into the approve/reject
  // list above, since approve/reject doesn't apply to already-live docs.
  const [selfPubs, setSelfPubs] = useState(null);
  const [editingPub, setEditingPub] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const unsub = subscribePendingPublicationSubmissions(
      setSubmissions,
      () => setSubmissions([])
    );
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = subscribeToSelfSubmittedPublications(
      setSelfPubs,
      () => setSelfPubs([])
    );
    return unsub;
  }, []);

  async function handleDeleteSelfPub(pubId) {
    if (deletingId) return;
    if (!window.confirm('এই publication টি মুছে ফেলতে চান? এটি এখনই লাইভ থেকে সরে যাবে।')) return;
    setDeletingId(pubId);
    try {
      await deletePublication(pubId);
      notify('Publication deleted.', 'success');
    } catch (err) {
      notify(err?.message || 'Could not delete.', 'error');
    } finally {
      setDeletingId(null);
    }
  }

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
  const selfLoading = selfPubs === null;
  const selfCount = selfPubs?.length || 0;

  return (
    <div className="card" style={{ padding: 16, borderRadius: 12 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button
          onClick={() => setSubTab('pending')}
          style={{
            padding: '6px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
            border: subTab === 'pending' ? 'none' : '1px solid var(--border)',
            background: subTab === 'pending' ? 'var(--accent)' : 'transparent',
            color: subTab === 'pending' ? '#fff' : 'var(--text)',
          }}
        >
          Pending review {!loading && count > 0 ? `(${count})` : ''}
        </button>
        <button
          onClick={() => setSubTab('self')}
          style={{
            padding: '6px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
            border: subTab === 'self' ? 'none' : '1px solid var(--border)',
            background: subTab === 'self' ? 'var(--accent)' : 'transparent',
            color: subTab === 'self' ? '#fff' : 'var(--text)',
          }}
        >
          সম্প্রতি নিজে প্রকাশিত {!selfLoading && selfCount > 0 ? `(${selfCount})` : ''}
        </button>
      </div>

      {subTab === 'pending' && (
      <>
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
      </>
      )}

      {subTab === 'self' && (
      <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Icons.BadgeCheck size={18} color="var(--accent)" />
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
          সম্প্রতি নিজে প্রকাশিত (Self-published, recent)
        </h3>
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
        এগুলো ইতিমধ্যে লাইভ — approve/reject করার দরকার নেই। কোনো এন্ট্রি ভুল বা spam মনে হলে Edit বা Delete করুন।
      </div>

      {selfLoading && <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</div>}
      {!selfLoading && selfCount === 0 && (
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>কোনো self-published publication নেই।</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(selfPubs || []).map((pub) => (
          <div key={pub.id} style={{ padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)' }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{pub.title}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
              {[pub.venue, pub.year].filter(Boolean).join(' · ')}
            </div>
            <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, marginTop: 4 }}>
              By: {pub.teacherName || pub.teacherEmail} ({pub.teacherEmail})
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                onClick={() => setEditingPub(pub)}
                style={{
                  flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent',
                  color: 'var(--text)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
                }}
              >
                Edit
              </button>
              <button
                onClick={() => handleDeleteSelfPub(pub.id)}
                disabled={deletingId === pub.id}
                style={{
                  flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', background: '#e03131',
                  color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: deletingId === pub.id ? 'default' : 'pointer',
                  opacity: deletingId === pub.id ? 0.7 : 1,
                }}
              >
                {deletingId === pub.id ? 'Working…' : 'Delete'}
              </button>
            </div>
          </div>
        ))}
      </div>
      </>
      )}

      {editingPub && (
        <PublicationEditModal
          teacherEmail={editingPub.teacherEmail}
          existing={editingPub}
          open={!!editingPub}
          onClose={() => setEditingPub(null)}
        />
      )}
    </div>
  );
}
