// FacultyMeetings.jsx
//
// New page — faculty previously had no way to keep track of meetings
// (department meetings, viva boards, online class links, student
// consultations) anywhere in the app. This is a private per-faculty list
// (faculty/{uid}/meetings — see facultyMeetingSync.js), NOT tied to any
// class/group, so a teacher can log anything meeting-shaped in one place.
//
// Visual language matches the rest of the faculty shell: hub-page-bg +
// hub-page-hero header, `Section`-style cards, and the same list-with-
// colored-left-bar pattern used for Today's Classes on FacultySchedule.jsx
// / the student Attendance.jsx "Today's Classes" strip.

import { useEffect, useMemo, useState } from 'react';
import * as Icons from 'lucide-react';
import { auth } from '../../lib/firebase';
import {
  subscribeMyMeetings, createMeeting, updateMeeting, deleteMeeting,
  MEETING_TYPES, getMeetingTypeMeta,
} from '../../lib/facultyMeetingSync';
import { notify } from '../../lib/notify';

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)',
  background: 'var(--bg)', color: 'var(--text)', fontSize: 13.5, outline: 'none', boxSizing: 'border-box',
  height: 42, fontFamily: 'inherit',
};
const textareaStyle = { ...inputStyle, height: 72, padding: '10px 12px', resize: 'vertical' };
const labelStyle = {
  fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6, display: 'block',
  textTransform: 'uppercase', letterSpacing: '0.04em',
};

const todayStr = () => new Date().toISOString().slice(0, 10);

const emptyForm = { title: '', type: 'class', date: todayStr(), time: '', location: '', link: '', notes: '' };

function formatDateLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  const today = todayStr();
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);
  if (dateStr === today) return 'Today';
  if (dateStr === tomorrowStr) return 'Tomorrow';
  return d.toLocaleDateString('en-BD', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatTimeLabel(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function MeetingRow({ meeting, onEdit, onDelete }) {
  const meta = getMeetingTypeMeta(meeting.type);
  const Icon = Icons[meta.icon] || Icons.Calendar;
  return (
    <div style={{
      display: 'flex', gap: 12, padding: '12px 14px', borderRadius: 12,
      background: `${meta.color}0c`, border: `1px solid ${meta.color}28`, alignItems: 'flex-start',
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 10, background: `${meta.color}20`, color: meta.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
      }}>
        <Icon size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)' }}>{meeting.title}</div>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <button onClick={() => onEdit(meeting)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}>
              <Icons.Pencil size={13} />
            </button>
            <button onClick={() => onDelete(meeting)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger, #ef4444)', padding: 4 }}>
              <Icons.Trash2 size={13} />
            </button>
          </div>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <span style={{ fontWeight: 700, color: meta.color }}>{meta.label}</span>
          <span>· {formatDateLabel(meeting.date)}{meeting.time ? ` · ${formatTimeLabel(meeting.time)}` : ''}</span>
          {meeting.location && <span>· {meeting.location}</span>}
        </div>
        {meeting.link && (
          <a href={meeting.link} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: meta.color, marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontWeight: 700 }}>
            <Icons.Link size={11} /> Join / Open link
          </a>
        )}
        {meeting.notes && <div style={{ fontSize: 12, color: 'var(--text)', marginTop: 4, opacity: 0.8 }}>{meeting.notes}</div>}
      </div>
    </div>
  );
}

export default function FacultyMeetings() {
  const [meetings, setMeetings] = useState(null); // null = loading
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setMeetings([]); return; }
    return subscribeMyMeetings(uid, setMeetings);
  }, []);

  const { upcoming, past } = useMemo(() => {
    const list = meetings || [];
    const today = todayStr();
    const upcoming = list.filter((m) => m.date >= today);
    const past = list.filter((m) => m.date < today).slice().reverse();
    return { upcoming, past };
  }, [meetings]);

  const openAdd = () => { setForm(emptyForm); setEditingId(null); setShowForm(true); };
  const openEdit = (m) => {
    setForm({ title: m.title || '', type: m.type || 'other', date: m.date || todayStr(), time: m.time || '', location: m.location || '', link: m.link || '', notes: m.notes || '' });
    setEditingId(m.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setSaving(true);
    try {
      if (editingId) {
        await updateMeeting(uid, editingId, form);
        notify('Meeting updated.', 'success');
      } else {
        await createMeeting(uid, form);
        notify('Meeting added.', 'success');
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
    } catch (e) {
      notify(e.message || 'Could not save meeting.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (m) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    if (!window.confirm(`Delete "${m.title}"?`)) return;
    try {
      await deleteMeeting(uid, m.id);
      notify('Meeting deleted.', 'success');
    } catch (e) {
      notify(e.message || 'Could not delete meeting.', 'error');
    }
  };

  const loading = meetings === null;

  return (
    <div className="hub-page-bg page-enter dashboard-page" style={{ minHeight: '100vh' }}>
      <div style={{ padding: '20px 24px 40px', width: '97%', maxWidth: 'none', margin: '0 auto' }}>
        <div className="hub-page-hero" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="hub-page-hero-icon">
              <Icons.Video size={20} color="var(--accent)" />
            </div>
            <h1 className="hub-page-hero-title">Meetings</h1>
          </div>
          <button
            onClick={openAdd}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, padding: '9px 16px', borderRadius: 10 }}
          >
            <Icons.Plus size={15} /> Add Meeting
          </button>
        </div>

        {loading && <div style={{ color: 'var(--muted)', fontSize: 13, padding: '20px 0' }}>Loading…</div>}

        {/* ── Add / Edit form — inline card, same field styling as
             FacultyProfile.jsx's edit-mode fields ── */}
        {showForm && (
          <div className="card" style={{ marginBottom: 16, padding: 18, borderRadius: 16, border: '1.5px solid var(--accent)' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
              {editingId ? 'Edit Meeting' : 'New Meeting'}
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={labelStyle}>Title</label>
                <input style={inputStyle} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. CSE-2201 Online Class" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Type</label>
                  <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                    {MEETING_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Date</label>
                  <input type="date" style={inputStyle} value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Time (optional)</label>
                  <input type="time" style={inputStyle} value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Location (optional)</label>
                  <input style={inputStyle} value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="e.g. Seminar Room 2 / Google Meet" />
                </div>
                <div>
                  <label style={labelStyle}>Link (optional)</label>
                  <input style={inputStyle} value={form.link} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))} placeholder="https://meet.google.com/..." />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Notes (optional)</label>
                <textarea style={textareaStyle} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Agenda, attendees, anything to remember…" />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  onClick={() => { setShowForm(false); setEditingId(null); }}
                  style={{ flex: '0 0 auto', padding: '11px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{ flex: 1, padding: '11px 16px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {saving ? 'Saving…' : (<><Icons.Check size={15} /> {editingId ? 'Save Changes' : 'Add Meeting'}</>)}
                </button>
              </div>
            </div>
          </div>
        )}

        {!loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Upcoming */}
            <div className="card" style={{ padding: 16, borderRadius: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icons.CalendarClock size={14} /> Upcoming
              </div>
              {upcoming.length === 0 ? (
                <div style={{ fontSize: 12.5, color: 'var(--muted)', textAlign: 'center', padding: '20px 0' }}>
                  No upcoming meetings. <button onClick={openAdd} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer', fontSize: 12.5 }}>Add one →</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {upcoming.map((m) => <MeetingRow key={m.id} meeting={m} onEdit={openEdit} onDelete={handleDelete} />)}
                </div>
              )}
            </div>

            {/* Past */}
            {past.length > 0 && (
              <div className="card" style={{ padding: 16, borderRadius: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icons.History size={14} /> Past
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: 0.7 }}>
                  {past.slice(0, 10).map((m) => <MeetingRow key={m.id} meeting={m} onEdit={openEdit} onDelete={handleDelete} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
