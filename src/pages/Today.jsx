import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sunrise, Plus, Clock3, GraduationCap, ListTodo, Pencil, Trash2, X, CalendarOff } from 'lucide-react';
import Modal from '../components/Modal';
import { store, getProfile, getLocalDateKey, saveTodayPlan, deleteTodayPlan, FULL_WEEK_DAYS } from '../store/store';
import { buildTodayItems, groupByPartOfDay } from '../lib/todayItems';
import { notify } from '../lib/notify';
import { confirmDialog } from '../lib/dialog';

const DAY_SHORT = { Sunday: 'Sun', Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat' };

const KIND_META = {
  class:      { color: '#F59E0B', label: 'Class' },
  tuition:    { color: '#DC2626', label: 'Tuition' },
  todo:       { color: '#3B82F6', label: 'To-do' },
  assignment: { color: '#8B5CF6', label: 'Assignment' },
};

const EMPTY_TUITION_FORM = { title: '', subject: '', time: '', days: [], note: '' };
const EMPTY_TODO_FORM = { title: '', date: getLocalDateKey(), time: '', note: '' };

function DayChips({ selected, onToggle }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {FULL_WEEK_DAYS.map((day) => {
        const active = selected.includes(day);
        return (
          <button
            key={day}
            type="button"
            onClick={() => onToggle(day)}
            className="btn day-chip"
            style={{
              padding: '6px 11px', fontSize: 12, fontWeight: 600, borderRadius: 8,
              border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
              background: active ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'var(--card)',
              color: active ? 'var(--accent)' : 'var(--text)',
            }}
          >
            {DAY_SHORT[day]}
          </button>
        );
      })}
    </div>
  );
}

function TimelineRow({ item, now, onEdit, onDelete }) {
  const meta = KIND_META[item.kind] || { color: 'var(--muted)', label: '' };
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const isPast = item.minutes !== null && item.minutes < nowMinutes - 30; // ~class length grace
  const isCurrent = item.minutes !== null && item.minutes <= nowMinutes && !isPast;

  const content = (
    <div
      className="card"
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', marginBottom: 8,
        opacity: isPast ? 0.55 : 1,
        border: isCurrent ? '1.5px solid var(--accent)' : '1px solid var(--border)',
        background: isCurrent ? 'color-mix(in srgb, var(--accent) 6%, var(--card))' : 'var(--card)',
      }}
    >
      <span style={{ width: 4, alignSelf: 'stretch', borderRadius: 4, background: meta.color, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 13.5 }}>{item.title}</span>
          {isCurrent && <span className="tag tag-green" style={{ fontSize: 10 }}>Now</span>}
          {isPast && <span style={{ fontSize: 11, color: 'var(--success)' }}>✓</span>}
        </div>
        {item.sub && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{item.sub}</div>}
      </div>
      {item.time && (
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
          {item.time.split('-')[0].trim()}
        </div>
      )}
      {item.editable && (
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button className="btn btn-ghost" style={{ padding: 6 }} onClick={() => onEdit(item)} title="Edit">
            <Pencil size={13} />
          </button>
          <button className="btn btn-ghost" style={{ padding: 6, color: 'var(--danger)' }} onClick={() => onDelete(item)} title="Delete">
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  );

  return item.link ? <Link to={item.link} style={{ textDecoration: 'none', color: 'inherit' }}>{content}</Link> : content;
}

export default function Today() {
  const profile = getProfile();
  const [now, setNow] = useState(() => new Date());
  const [plansVersion, setPlansVersion] = useState(0); // bump to re-read today_plans after add/edit/delete

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onUpdate = () => setPlansVersion((v) => v + 1);
    window.addEventListener('kuetx:store-updated', onUpdate);
    return () => window.removeEventListener('kuetx:store-updated', onUpdate);
  }, []);

  const { items, isHoliday, todayKey } = useMemo(
    () => buildTodayItems(profile, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile.dept, profile.currentTermKey, now.getMinutes(), plansVersion]
  );
  const groups = useMemo(() => groupByPartOfDay(items, now), [items, now]);

  // Upcoming: future one-time to-dos only (recurring tuition is "always
  // there on its day", so it doesn't belong in a look-ahead list).
  const upcoming = useMemo(() => {
    const plans = store.get('today_plans') || [];
    return plans
      .filter((p) => p.type === 'todo' && p.date && p.date > todayKey)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayKey, plansVersion]);

  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState(null); // 'tuition' | 'todo'
  const [tuitionForm, setTuitionForm] = useState(EMPTY_TUITION_FORM);
  const [todoForm, setTodoForm] = useState(EMPTY_TODO_FORM);
  const [editingId, setEditingId] = useState(null);

  const closeModal = () => {
    setAddOpen(false); setAddType(null); setEditingId(null);
    setTuitionForm(EMPTY_TUITION_FORM); setTodoForm(EMPTY_TODO_FORM);
  };

  const openEdit = (item) => {
    setEditingId(item.planId);
    if (item.kind === 'tuition') {
      const plan = (store.get('today_plans') || []).find((p) => p.id === item.planId);
      if (!plan) return;
      setTuitionForm({ title: plan.title || '', subject: plan.subject || '', time: plan.time || '', days: plan.days || [], note: plan.note || '' });
      setAddType('tuition');
    } else {
      const plan = (store.get('today_plans') || []).find((p) => p.id === item.planId);
      if (!plan) return;
      setTodoForm({ title: plan.title || '', date: plan.date || todayKey, time: plan.time || '', note: plan.note || '' });
      setAddType('todo');
    }
    setAddOpen(true);
  };

  const handleDelete = async (item) => {
    if (!(await confirmDialog({ title: `Delete this ${KIND_META[item.kind]?.label || 'item'}?`, tone: 'danger', confirmLabel: 'Delete' }))) return;
    deleteTodayPlan(item.planId);
    setPlansVersion((v) => v + 1);
    notify('Removed', 'success');
  };

  const toggleTuitionDay = (day) => {
    setTuitionForm((f) => ({ ...f, days: f.days.includes(day) ? f.days.filter((d) => d !== day) : [...f.days, day] }));
  };

  const saveTuition = () => {
    if (!tuitionForm.title.trim()) { notify('Add a student/title name', 'error'); return; }
    if (tuitionForm.days.length === 0) { notify('Select at least one day', 'error'); return; }
    saveTodayPlan({ id: editingId, type: 'tuition', title: tuitionForm.title.trim(), subject: tuitionForm.subject.trim(), time: tuitionForm.time, days: tuitionForm.days, note: tuitionForm.note.trim() });
    setPlansVersion((v) => v + 1);
    notify(editingId ? 'Tuition updated' : 'Tuition added — repeats every week', 'success');
    closeModal();
  };

  const saveTodo = () => {
    if (!todoForm.title.trim()) { notify('Add a title', 'error'); return; }
    if (!todoForm.date) { notify('Pick a date', 'error'); return; }
    saveTodayPlan({ id: editingId, type: 'todo', title: todoForm.title.trim(), date: todoForm.date, time: todoForm.time, note: todoForm.note.trim() });
    setPlansVersion((v) => v + 1);
    notify(editingId ? 'Plan updated' : 'Plan added', 'success');
    closeModal();
  };

  const todayDateLabel = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const isEmpty = items.length === 0;

  return (
    <div className="page-enter page-container content-page-bg">
      {/* Hero */}
      <div className="content-page-hero">
        <div className="content-page-hero-main">
          <div className="content-page-hero-head">
            <div className="content-page-hero-icon"><Sunrise size={18} /></div>
            <h1 className="content-page-hero-title">Today · {todayDateLabel}</h1>
          </div>
          <p className="content-page-hero-subtitle">Your day, at a glance</p>
        </div>
        <div className="content-page-hero-actions">
          <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
            <Plus size={13} /> <span className="btn-txt">Add</span>
          </button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 16, fontSize: 11, color: 'var(--muted)' }}>
        {Object.entries(KIND_META).map(([k, m]) => (
          <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: m.color }} /> {m.label}
          </span>
        ))}
      </div>

      {isHoliday && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '9px 13px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 12.5, color: 'var(--muted)' }}>
          <CalendarOff size={14} /> No classes today — it's a holiday.
        </div>
      )}

      {/* Timeline */}
      {isEmpty ? (
        <div className="card" style={{ textAlign: 'center', padding: '32px 20px', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Nothing scheduled today</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 14 }}>Enjoy the free time, or add a plan.</div>
          <button className="btn btn-primary" onClick={() => setAddOpen(true)}><Plus size={13} /> Add</button>
        </div>
      ) : (
        ['Morning', 'Afternoon', 'Evening'].map((part) => (
          groups[part].length > 0 && (
            <div key={part} style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{part}</div>
              {groups[part].map((item) => (
                <TimelineRow key={item.id} item={item} now={now} onEdit={openEdit} onDelete={handleDelete} />
              ))}
            </div>
          )
        ))
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Upcoming</div>
          {upcoming.map((p) => (
            <div
              key={p.id}
              className="card"
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', marginBottom: 8, cursor: 'pointer' }}
              onClick={() => openEdit({ kind: 'todo', planId: p.id })}
            >
              <span style={{ width: 4, alignSelf: 'stretch', borderRadius: 4, background: KIND_META.todo.color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{p.title}</span>
                {p.note && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{p.note}</div>}
              </div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                {new Date(`${p.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                {p.time ? ` · ${p.time}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit modal */}
      {addOpen && (
        <Modal onClose={closeModal} overlayStyle={{ padding: 12 }} contentStyle={{ width: '100%', maxWidth: 480, borderRadius: 20, padding: 0, background: 'transparent', maxHeight: 'calc(100vh - 24px)', overflow: 'auto' }}>
          <div className="card" style={{ marginBottom: 0, borderRadius: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{editingId ? 'Edit' : 'Add to Today'}</div>
              <button className="btn btn-ghost" style={{ padding: 6 }} onClick={closeModal}><X size={15} /></button>
            </div>

            {!addType && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button className="card" disabled style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, textAlign: 'left', cursor: 'not-allowed', opacity: 0.5 }}>
                  <Clock3 size={18} color={KIND_META.class.color} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>Class</div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Auto-synced from your Schedule</div>
                  </div>
                </button>
                <button className="card" onClick={() => setAddType('tuition')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, textAlign: 'left', cursor: 'pointer', border: 'none', width: '100%' }}>
                  <GraduationCap size={18} color={KIND_META.tuition.color} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>Tuition (repeats weekly)</div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Set it up once — shows up every matching day</div>
                  </div>
                </button>
                <button className="card" onClick={() => setAddType('todo')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, textAlign: 'left', cursor: 'pointer', border: 'none', width: '100%' }}>
                  <ListTodo size={18} color={KIND_META.todo.color} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>One-time plan</div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Something for today, or any future date</div>
                  </div>
                </button>
              </div>
            )}

            {addType === 'tuition' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="form-field">
                  <label>Student name</label>
                  <input value={tuitionForm.title} onChange={(e) => setTuitionForm((f) => ({ ...f, title: e.target.value }))} placeholder="Rahim" />
                </div>
                <div className="form-field">
                  <label>Subject (optional)</label>
                  <input value={tuitionForm.subject} onChange={(e) => setTuitionForm((f) => ({ ...f, subject: e.target.value }))} placeholder="Physics" />
                </div>
                <div className="form-field">
                  <label>Time</label>
                  <input type="time" value={tuitionForm.time} onChange={(e) => setTuitionForm((f) => ({ ...f, time: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label>Repeats on</label>
                  <DayChips selected={tuitionForm.days} onToggle={toggleTuitionDay} />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setAddType(null)}>Back</button>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveTuition}>{editingId ? 'Save' : 'Add tuition'}</button>
                </div>
              </div>
            )}

            {addType === 'todo' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="form-field">
                  <label>Title</label>
                  <input value={todoForm.title} onChange={(e) => setTodoForm((f) => ({ ...f, title: e.target.value }))} placeholder="Submit project proposal" />
                </div>
                <div className="form-field">
                  <label>Date</label>
                  <input type="date" value={todoForm.date} onChange={(e) => setTodoForm((f) => ({ ...f, date: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label>Time (optional)</label>
                  <input type="time" value={todoForm.time} onChange={(e) => setTodoForm((f) => ({ ...f, time: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label>Note (optional)</label>
                  <input value={todoForm.note} onChange={(e) => setTodoForm((f) => ({ ...f, note: e.target.value }))} placeholder="Any details" />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setAddType(null)}>Back</button>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveTodo}>{editingId ? 'Save' : 'Add plan'}</button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
