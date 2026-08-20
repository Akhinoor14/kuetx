// EditLogModal.jsx — Phase D of CR_PERMISSION_AND_ROLL_UPGRADE_PLAN.md.
//
// Read-only viewer for groups/{groupId}/auditLog (already written by
// groupSync.js's _writeAuditLog on every routine/assignment/teacher-
// profile create/edit/delete/restore, and already exposed via
// subscribeAuditLog). Shows who did what and when; there is no before/
// after snapshot in the schema (noted as a known gap in the plan — a
// diff view would need the write-side to start storing snapshots,
// which is out of scope here).
//
// Usage: <EditLogModal groupId={groupId} onClose={() => setShowLog(false)} />
// Render conditionally (only when open) like the project's other modals
// (EventModal, ClassSetupModal, etc.) rather than passing an `open` prop.

import { useEffect, useState } from 'react';
import { X, History } from 'lucide-react';
import Modal from './Modal';
import { subscribeAuditLog } from '../lib/groupSync';

const ACTION_LABEL = {
  create: 'added',
  edit: 'edited',
  delete: 'removed',
  restore: 'restored',
  'clear-for-term-change': 'cleared (term change)',
};

const COLLECTION_LABEL = {
  routineEntries: 'a class in Schedule',
  assignmentEntries: 'an assignment',
  teacherProfiles: 'a teacher profile',
};

function formatWhen(ts) {
  if (!ts) return 'just now';
  const date = typeof ts?.toDate === 'function' ? ts.toDate() : new Date(ts);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function describeEntry(entry) {
  const action = ACTION_LABEL[entry.action] || entry.action || 'changed';
  const what = COLLECTION_LABEL[entry.collection] || entry.collection || 'an item';
  return `${action} ${what}`;
}

export default function EditLogModal({ groupId, onClose }) {
  const [entries, setEntries] = useState(null); // null = loading

  useEffect(() => {
    if (!groupId) return undefined;
    setEntries(null);
    return subscribeAuditLog(groupId, setEntries);
  }, [groupId]);

  const sorted = (entries || []).slice().sort((a, b) => {
    const am = a.at?.toMillis?.() ?? 0;
    const bm = b.at?.toMillis?.() ?? 0;
    return bm - am;
  });

  return (
    <Modal
      onClose={onClose}
      contentStyle={{
        width: 480,
        maxWidth: '100%',
        borderRadius: 14,
        padding: 0,
        maxHeight: '82vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <History size={16} color="var(--accent)" />
          <div style={{ fontWeight: 800, fontSize: 14 }}>Edit Log</div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', padding: 4 }}
        >
          <X size={18} />
        </button>
      </div>

      <div style={{ padding: '10px 16px 4px', fontSize: 12, color: 'var(--muted)' }}>
        Recent changes to this group's schedule, assignments, and teacher info — most recent first.
      </div>

      <div style={{ overflowY: 'auto', padding: '4px 16px 16px', flex: 1 }}>
        {entries === null && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Loading…</div>
        )}

        {entries !== null && sorted.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            No edits recorded yet.
          </div>
        )}

        {sorted.map((entry) => (
          <div
            key={entry.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              padding: '10px 0',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div style={{ fontSize: 13 }}>
              <strong style={{ color: 'var(--text)' }}>{entry.by?.name || 'Unknown'}</strong>
              {entry.by?.shortRoll ? <span style={{ color: 'var(--muted)' }}> ({entry.by.shortRoll})</span> : null}
              <span style={{ color: 'var(--muted)' }}> {describeEntry(entry)}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{formatWhen(entry.at)}</div>
          </div>
        ))}

        {/* Known gap (see plan §Phase D): entries show who/what/when only —
            no before/after values, since auditLog docs don't store a
            snapshot of the changed data. */}
      </div>
    </Modal>
  );
}
