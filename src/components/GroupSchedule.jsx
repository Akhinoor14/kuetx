import { useEffect, useState } from 'react';
import { getProfile } from '../store/store';
import { auth } from '../lib/firebase';
import { getGroupLabel } from '../lib/groupUtils';
import {
  subscribeRoutine, addRoutineEntry, updateRoutineEntry, deleteRoutineEntry, restoreRoutineEntry,
} from '../lib/groupSync';
import LastUpdatedBy from './LastUpdatedBy';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

/**
 * Renders the shared class routine once a group has an active CR. Members
 * who aren't the CR/ACR/Campus Lead (or the group's temporary "no CR"
 * fallback) see a read-only grid; Firestore rules are the real
 * enforcement — `canEdit` here only controls whether edit controls render.
 */
export default function GroupSchedule({ groupId, canEdit }) {
  const profile = getProfile();
  const [entries, setEntries] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ day: 'Sunday', time: '', courseName: '', teacherName: '' });

  useEffect(() => subscribeRoutine(groupId, setEntries), [groupId]);

  const mostRecent = entries?.length
    ? entries.reduce((a, b) => (a.updatedAt?.toMillis?.() > b.updatedAt?.toMillis?.() ? a : b))
    : null;

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.time.trim() || !form.courseName.trim()) return;
    await addRoutineEntry(groupId, profile, { ...form });
    setForm({ day: 'Sunday', time: '', courseName: '', teacherName: '' });
    setAdding(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          Shared routine for <strong>{getGroupLabel(profile)}</strong>
        </div>
        {canEdit && (
          <button className="btn btn-sm btn-primary" onClick={() => setAdding((v) => !v)}>
            {adding ? 'Cancel' : '+ Add class'}
          </button>
        )}
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="card" style={{ padding: 12, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <select value={form.day} onChange={(e) => setForm((f) => ({ ...f, day: e.target.value }))}
            style={{ padding: '7px 9px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)' }}>
            {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <input placeholder="Time (e.g. 9:00 AM-9:50 AM)" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
            style={{ padding: '7px 9px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)' }} />
          <input placeholder="Course" value={form.courseName} onChange={(e) => setForm((f) => ({ ...f, courseName: e.target.value }))}
            style={{ padding: '7px 9px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)' }} />
          <input placeholder="Teacher (optional)" value={form.teacherName} onChange={(e) => setForm((f) => ({ ...f, teacherName: e.target.value }))}
            style={{ padding: '7px 9px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)' }} />
          <button type="submit" className="btn btn-primary btn-sm">Save</button>
        </form>
      )}

      {entries === null && <div style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</div>}
      {entries?.length === 0 && (
        <div className="card" style={{ padding: 16, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          {canEdit ? 'No classes added yet — add the first one.' : "Your CR hasn't added any classes yet."}
        </div>
      )}

      {DAYS.map((day) => {
        const dayEntries = (entries || []).filter((e) => e.day === day).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
        if (dayEntries.length === 0) return null;
        return (
          <div key={day} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{day}</div>
            {dayEntries.map((entry) => (
              <div key={entry.id} className="card" style={{ padding: 10, marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{entry.courseName}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{entry.time} {entry.teacherName ? `· ${entry.teacherName}` : ''}</div>
                  </div>
                  {canEdit && (
                    <button className="btn btn-sm btn-secondary" onClick={() => deleteRoutineEntry(groupId, entry.id, profile)}>Remove</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      })}

      {mostRecent && <LastUpdatedBy meta={mostRecent.updatedBy} at={mostRecent.updatedAt} />}
    </div>
  );
}
