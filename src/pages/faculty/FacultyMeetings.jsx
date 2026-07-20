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
import { Calendar, CalendarClock, Check, Clock, History, MapPin, Pencil, Plus, Sparkles, Trash2, Video, X } from 'lucide-react';
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

function MeetingCard({ meeting, onEdit, onDelete, isToday }) {
  const meta = getMeetingTypeMeta(meeting.type);
  const Icon = Icons[meta.icon] || Calendar;
  const cardStyle = {
    '--meeting-color': meta.color,
    '--meeting-color-bg': `${meta.color}20`,
    '--meeting-color-border': `${meta.color}28`,
  };
  return (
    <div className={`meeting-card${isToday ? ' meeting-card-today' : ''}`} style={cardStyle}>
      <div className="meeting-card-top">
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minWidth: 0 }}>
          <div className="meeting-card-icon"><Icon size={20} /></div>
          <div style={{ minWidth: 0 }}>
            <div className="meeting-card-type">{meta.label}</div>
            <div className="meeting-card-title">{meeting.title}</div>
          </div>
        </div>
        <div className="meeting-card-actions">
          <button onClick={() => onEdit(meeting)} title="Edit"><Pencil size={13} /></button>
          <button onClick={() => onDelete(meeting)} title="Delete" style={{ color: 'var(--danger, #ef4444)' }}><Trash2 size={13} /></button>
        </div>
      </div>

      <div className="meeting-card-meta">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Calendar size={12} /> {formatDateLabel(meeting.date)}
        </span>
        {meeting.time && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Clock size={12} /> {formatTimeLabel(meeting.time)}
          </span>
        )}
        {meeting.location && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <MapPin size={12} /> {meeting.location}
          </span>
        )}
      </div>

      {meeting.notes && <div className="meeting-card-notes">{meeting.notes}</div>}

      {meeting.link && (
        <a href={meeting.link} target="_blank" rel="noreferrer" className="meeting-card-join">
          <Video size={14} /> Join Meeting
        </a>
      )}
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

  const { today, upcoming, past } = useMemo(() => {
    const list = meetings || [];
    const todayStrVal = todayStr();
    // Sort by date, then time (meetings with no time sort before timed
    // ones on the same date) — done client-side since the Firestore
    // subscription no longer applies a compound orderBy (see
    // facultyMeetingSync.js's subscribeMyMeetings for why).
    const byDateTime = (a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      const at = a.time || '';
      const bt = b.time || '';
      if (at !== bt) return at < bt ? -1 : 1;
      return 0;
    };
    const todayList = list.filter((m) => m.date === todayStrVal).sort(byDateTime);
    // "Latest first" for upcoming: soonest date/time at the top, so the
    // very next meeting is always the first card seen.
    const upcomingList = list.filter((m) => m.date > todayStrVal).sort(byDateTime);
    // Past meetings: most recently happened first (reverse chronological).
    const pastList = list.filter((m) => m.date < todayStrVal).sort(byDateTime).reverse();
    return { today: todayList, upcoming: upcomingList, past: pastList };
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
      <div className="page-container" style={{ padding: '20px 24px 40px' }}>
        <div className="hub-page-hero" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="hub-page-hero-icon">
              <Video size={20} color="var(--accent)" />
            </div>
            <h1 className="hub-page-hero-title">Meetings</h1>
          </div>
          <button
            onClick={openAdd}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, padding: '9px 16px', borderRadius: 10 }}
          >
            <Plus size={15} /> Add Meeting
          </button>
        </div>

        {loading && <div style={{ color: 'var(--muted)', fontSize: 13, padding: '20px 0' }}>Loading…</div>}

        {/* ── Add / Edit form — inline card, same field styling as
             FacultyProfile.jsx's edit-mode fields ── */}
        {showForm && (
          <div className="card" style={{
            marginBottom: 16, padding: 0, borderRadius: 16, overflow: 'hidden',
            border: `1.5px solid ${getMeetingTypeMeta(form.type).color}55`,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px', background: `${getMeetingTypeMeta(form.type).color}14`,
              borderBottom: `1px solid ${getMeetingTypeMeta(form.type).color}28`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 800, color: getMeetingTypeMeta(form.type).color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {(() => { const I = Icons[getMeetingTypeMeta(form.type).icon] || Calendar; return <I size={15} />; })()}
                {editingId ? 'Edit Meeting' : 'New Meeting'}
              </div>
              <button
                onClick={() => { setShowForm(false); setEditingId(null); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, display: 'flex' }}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'grid', gap: 12, padding: 18 }}>
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
                  <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Video size={11} /> Online link (optional — enables Join button)
                  </label>
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
                  {saving ? 'Saving…' : (<><Check size={15} /> {editingId ? 'Save Changes' : 'Add Meeting'}</>)}
                </button>
              </div>
            </div>
          </div>
        )}

        {!loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Today — its own section up top so today's meetings never get
                lost inside a longer Upcoming list. */}
            {today.length > 0 && (
              <div>
                <div className="meeting-today-banner">
                  <Sparkles size={14} /> Today · {today.length} meeting{today.length !== 1 ? 's' : ''}
                </div>
                <div className="meeting-grid">
                  {today.map((m) => <MeetingCard key={m.id} meeting={m} onEdit={openEdit} onDelete={handleDelete} isToday />)}
                </div>
              </div>
            )}

            {/* Upcoming */}
            <div className="card" style={{ padding: 16, borderRadius: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CalendarClock size={14} /> Upcoming
              </div>
              {upcoming.length === 0 ? (
                <div style={{ fontSize: 12.5, color: 'var(--muted)', textAlign: 'center', padding: '20px 0' }}>
                  No upcoming meetings. <button onClick={openAdd} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer', fontSize: 12.5 }}>Add one →</button>
                </div>
              ) : (
                <div className="meeting-grid">
                  {upcoming.map((m) => <MeetingCard key={m.id} meeting={m} onEdit={openEdit} onDelete={handleDelete} />)}
                </div>
              )}
            </div>

            {/* Past */}
            {past.length > 0 && (
              <div className="card" style={{ padding: 16, borderRadius: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <History size={14} /> Past
                </div>
                <div className="meeting-grid" style={{ opacity: 0.7 }}>
                  {past.slice(0, 12).map((m) => <MeetingCard key={m.id} meeting={m} onEdit={openEdit} onDelete={handleDelete} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
