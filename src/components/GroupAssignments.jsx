import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { getProfile } from '../store/store';
import { getGroupLabel } from '../lib/groupUtils';
import {
  subscribeAssignments, addAssignmentEntry, deleteAssignmentEntry,
} from '../lib/groupSync';
import LastUpdatedBy from './LastUpdatedBy';
import EditLogModal from './EditLogModal';

export default function GroupAssignments({ groupId, canEdit }) {
  const profile = getProfile();
  const [entries, setEntries] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: '', courseName: '', due: '' });
  // Phase D (CR_PERMISSION_AND_ROLL_UPGRADE_PLAN.md) — read-only, so not
  // gated on canEdit (auditLog's read rule is broader than its write side).
  const [showEditLog, setShowEditLog] = useState(false);

  useEffect(() => subscribeAssignments(groupId, setEntries), [groupId]);

  const mostRecent = entries?.length
    ? entries.reduce((a, b) => (a.updatedAt?.toMillis?.() > b.updatedAt?.toMillis?.() ? a : b))
    : null;

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    await addAssignmentEntry(groupId, profile, { ...form, status: 'pending' });
    setForm({ title: '', courseName: '', due: '' });
    setAdding(false);
  };

  const sorted = (entries || []).slice().sort((a, b) => (a.due || '').localeCompare(b.due || ''));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          Shared assignments for <strong>{getGroupLabel(profile)}</strong>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-sm btn-ghost" onClick={() => setShowEditLog(true)} title="See who changed what, and when">
            <History size={13} /> Edit Log
          </button>
          {canEdit && (
            <button className="btn btn-sm btn-primary" onClick={() => setAdding((v) => !v)}>
              {adding ? 'Cancel' : '+ Add assignment'}
            </button>
          )}
        </div>
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="card" style={{ padding: 12, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input placeholder="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            style={{ padding: '7px 9px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)' }} />
          <input placeholder="Course" value={form.courseName} onChange={(e) => setForm((f) => ({ ...f, courseName: e.target.value }))}
            style={{ padding: '7px 9px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)' }} />
          <input type="date" value={form.due} onChange={(e) => setForm((f) => ({ ...f, due: e.target.value }))}
            style={{ padding: '7px 9px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)' }} />
          <button type="submit" className="btn btn-primary btn-sm">Save</button>
        </form>
      )}

      {entries === null && <div style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</div>}
      {sorted.length === 0 && (
        <div className="card" style={{ padding: 16, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          {/* Role-agnostic wording (Aug 2026 CR permission expansion) —
              assignmentEntries is no longer CR/ACR-only (isRoutineEditor),
              so "Your CR hasn't..." is misleading for the non-editor case
              now (any verified member can add one). */}
          {canEdit ? 'No assignments yet — add the first one.' : 'No assignments yet.'}
        </div>
      )}
      {sorted.map((entry) => (
        <div key={entry.id} className="card" style={{ padding: 10, marginBottom: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{entry.title}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{entry.courseName} {entry.due ? `· due ${entry.due}` : ''}</div>
            </div>
            {canEdit && (
              <button className="btn btn-sm btn-secondary" onClick={() => deleteAssignmentEntry(groupId, entry.id, profile)}>Remove</button>
            )}
          </div>
        </div>
      ))}

      {mostRecent && <LastUpdatedBy meta={mostRecent.updatedBy} at={mostRecent.updatedAt} />}

      {showEditLog && (
        <EditLogModal groupId={groupId} onClose={() => setShowEditLog(false)} />
      )}
    </div>
  );
}
