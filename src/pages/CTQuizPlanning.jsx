import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, PlusCircle, ArrowLeft, ArrowRight, Trash, Info, Copy } from 'lucide-react';
import { store, uid, getProfile, getCurrentTermKey } from '../store/store';
import { getAllCourses } from '../store/curriculumStore';
import { notify } from '../lib/notify';
import { useTheme } from '../hooks/useTheme';
import CTPlannerCalendar from '../components/CTPlannerCalendar';
import EventModal from '../components/EventModal';
import { countWeeklyPressure, detectConflicts, generateSuggestions } from '../lib/smartAssist';
import { keyFor as utilKeyFor, countEventsInWeekOf as utilCountEventsInWeekOf } from '../lib/ctPlannerUtils';

function makeMonthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks = [];
  let week = new Array(7).fill(null);
  let day = 1;
  for (let i = 0; i < startDay; i++) week[i] = null;
  for (let i = startDay; i < 7; i++) {
    week[i] = day++;
  }
  weeks.push(week);
  while (day <= daysInMonth) {
    week = new Array(7).fill(null);
    for (let i = 0; i < 7 && day <= daysInMonth; i++) {
      week[i] = day++;
    }
    weeks.push(week);
  }
  return weeks;
}

function pressureLabel(count) {
  if (count >= 4) return { text: 'High', color: '#ef4444' };
  if (count >= 2) return { text: 'Medium', color: '#f59e0b' };
  return { text: 'Low', color: '#10b981' };
}

export default function CTQuizPlanning() {
  const { themeId } = useTheme();
  const isDark = themeId === 'dark';
  const today = new Date();
  const profile = getProfile();
  const currentTermKey = getCurrentTermKey(profile);
  const allCourses = useMemo(() => getAllCourses(profile), [profile]);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(today.getDate());

  // Use existing schedule + settings storage
  const [settings, setSettings] = useState(() => store.get('scheduleSettings') || {});
  const [schedule, setSchedule] = useState(() => Array.isArray(store.get('schedule')) ? store.get('schedule') : []);
  
  const assignments = useMemo(() => store.get('assignments') || [], []);

  const dragItemRef = useRef(null);
  const underConstruction = true;

  const featureCards = [
    {
      title: 'Calendar-first planning',
      items: ['Tap dates to add CTs or quizzes', 'Drag, move, and manage events visually'],
    },
    {
      title: 'Smart schedule sense',
      items: ['Holiday conflict checks', 'Pressure and overlap warnings'],
    },
    {
      title: 'Auto term sync',
      items: ['Current term courses and teacher info', 'No repeated manual entry'],
    },
    {
      title: 'Share-ready copy',
      items: ['Daily and weekly WhatsApp-ready text', 'Fast planning exports'],
    },
  ];

  useEffect(() => {
    // sync local state when store updates elsewhere
    const onUpdate = () => {
      setSettings(store.get('scheduleSettings') || {});
      setSchedule(Array.isArray(store.get('schedule')) ? store.get('schedule') : []);
    };
    window.addEventListener('kuetx:store-updated', onUpdate);
    return () => window.removeEventListener('kuetx:store-updated', onUpdate);
  }, []);

  // holiday dates are stored in scheduleSettings as an array of date keys (e.g. '2026-08-12')
  const holidayDates = Array.isArray(settings?.holidayDates) ? settings.holidayDates : [];

  const monthMatrix = useMemo(() => makeMonthMatrix(viewYear, viewMonth), [viewYear, viewMonth]);

  const selKey = utilKeyFor(viewYear, viewMonth, selectedDay);

  // Build events map from existing `schedule` entries (reusing schedule storage)
  const events = useMemo(() => {
    const map = {};
    (schedule || []).forEach(entry => {
      if (!entry || !entry.eventType) return; // only keep CT/Quiz events
      if (entry.eventType !== 'CT' && entry.eventType !== 'Quiz') return;
      const dateKey = (entry.date || '').slice(0,10);
      if (!dateKey) return;
      map[dateKey] = map[dateKey] || [];
      map[dateKey].push(entry);
    });
    return map;
  }, [schedule]);

  const dayEvents = events[selKey] || [];

  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState({ type: 'CT', courseId: '', title: '', teacher: '', room: '', building: '', startTime: '', endTime: '', ctNumber: '', note: '' });
  const [editingId, setEditingId] = useState(null);
  const [plannerMode, setPlannerMode] = useState(() => store.get('ctPlannerMode') || '3CT');


  function addEvent({ courseId, title, type, duration = 60, startTime = '', endTime = '', room = '', building = '', teacher = '' }) {
    const dateIso = selKey; // YYYY-MM-DD
    const entry = {
      id: uid(),
      eventType: type, // 'CT' or 'Quiz'
      courseId: courseId || '',
      title: title || '',
      date: dateIso,
      startTime: startTime || '',
      endTime: endTime || '',
      room: room || '',
      building: building || '',
      teacherName: teacher || '',
      duration: Number(duration) || 60,
      note: '',
      createdAt: new Date().toISOString(),
    };
    const next = [...(schedule || []), entry];
    setSchedule(next);
    try { store.set('schedule', next); } catch (e) {}
  }

  function openModalForDate(dateIso, existing = null) {
    setEditingId(existing?.id || null);
    setModalData({
      date: dateIso,
      type: existing?.eventType || 'CT',
      courseId: existing?.courseId || '',
      courseCode: existing?.courseCode || '',
      title: existing?.title || '',
      teacher: existing?.teacherName || existing?.teacher || '',
      room: existing?.room || '',
      building: existing?.building || '',
      startTime: existing?.startTime || '',
      endTime: existing?.endTime || '',
      ctNumber: existing?.ctNumber || '',
      note: existing?.note || ''
    });
    setSelectedDay(new Date(dateIso).getDate());
    setModalOpen(true);
  }

  function saveModal() {
    const payload = { ...modalData };
    if (editingId) {
      // update
      const next = (schedule || []).map(s => s.id === editingId ? { ...s, title: payload.title, eventType: payload.type, courseId: payload.courseId, teacherName: payload.teacher, room: payload.room, building: payload.building, startTime: payload.startTime, endTime: payload.endTime, ctNumber: payload.ctNumber } : s);
      setSchedule(next); store.set('schedule', next);
      setEditingId(null);
      notify('Event updated', 'info');
    } else {
      addEvent({ courseId: payload.courseId, title: payload.title, type: payload.type, duration: 60, startTime: payload.startTime, endTime: payload.endTime, room: payload.room, building: payload.building, teacher: payload.teacher });
      notify('Event added', 'success');
    }
    setModalOpen(false);
  }

  function cancelModal() {
    setModalOpen(false);
    setEditingId(null);
  }

  function removeEvent(id) {
    const next = (schedule || []).filter(e => e.id !== id);
    setSchedule(next);
    try { store.set('schedule', next); } catch (e) {}
    notify('Event removed', 'warn');
  }

  useEffect(() => {
    store.set('ctPlannerMode', plannerMode);
  }, [plannerMode]);

  function countEventsInWeekOf(day) {
    return utilCountEventsInWeekOf(viewYear, viewMonth, day, events, assignments);
  }

  const pressure = pressureLabel(countEventsInWeekOf(selectedDay));

  function findEventById(id) {
    return (schedule || []).find(s => s.id === id) || null;
  }

  function handleDropToDate(targetDay) {
    const id = dragItemRef.current;
    if (!id) return;
    const ev = findEventById(id);
    if (!ev) return;
    const targetIso = (() => { const dt = new Date(viewYear, viewMonth, targetDay); return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`; })();
    if (holidayDates.includes(targetIso)) {
      window.alert('Cannot move event to a holiday date.');
      dragItemRef.current = null;
      return;
    }
    const next = (schedule || []).map(s => s.id === id ? { ...s, date: targetIso } : s);
    setSchedule(next); store.set('schedule', next);
    dragItemRef.current = null;
  }

  // FullCalendar handlers
  function onFcDateClick(dateStr) {
    if (holidayDates.includes(dateStr)) { notify('Cannot schedule on a holiday', 'warn'); return; }
    openModalForDate(dateStr, null);
  }

  function onFcEventClick(ev) {
    openModalForDate(ev.date, ev);
  }

  function onFcEventDrop(id, newIso) {
    if (holidayDates.includes(newIso)) { notify('Cannot move to holiday', 'warn'); return; }
    const next = (schedule || []).map(s => s.id === id ? { ...s, date: newIso } : s);
    setSchedule(next); store.set('schedule', next);
    notify('Event moved', 'info');
  }

  function formatEventForCopy(ev) {
    const date = ev.date ? new Date(ev.date) : null;
    const dateLabel = date ? date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : 'Unknown';
    const parts = [];
    parts.push(`${ev.eventType} - ${ev.title}`);
    parts.push(`Date: ${dateLabel}`);
    if (ev.startTime) parts.push(`Time: ${ev.startTime}${ev.endTime ? ' - ' + ev.endTime : ''}`);
    if (ev.building || ev.room) parts.push(`Room: ${ev.building ? ev.building + ' - ' : ''}${ev.room || ''}`);
    if (ev.teacherName) parts.push(`Teacher: ${ev.teacherName}`);
    if (ev.note) parts.push(`Notes: ${ev.note}`);
    return parts.join('\n');
  }

  function buildSingleEventCopy(ev) {
    return `CT Planner\n\n${formatEventForCopy(ev)}`;
  }

  function buildDailyCopy(dateIso) {
    const list = events[dateIso] || [];
    if (!list.length) return `CT Planner - ${dateIso}\n\nNo events.`;
    const lines = [`CT Planner - ${new Date(dateIso).toDateString()}`, ''];
    list.forEach(ev => lines.push(formatEventForCopy(ev), ''));
    return lines.join('\n');
  }

  function buildWeeklyCopy(centerDay) {
    const start = new Date(viewYear, viewMonth, centerDay - 3);
    const lines = ['CT Planner — Weekly', ''];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const list = events[key] || [];
      lines.push(d.toDateString());
      if (!list.length) lines.push('  No events');
      list.forEach(ev => lines.push('  ' + ev.eventType + ' — ' + ev.title + ' (' + (ev.startTime || 'TBA') + ')'));
      lines.push('');
    }
    return lines.join('\n');
  }

  if (underConstruction) {
    return (
      <div className="page-container content-page-bg" style={{ width: '100%', margin: '28px auto', padding: 20, minHeight: 'calc(100vh - 120px)' }}>
        <div style={{ display: 'grid', gap: 24 }}>
          <section style={{ overflow: 'hidden', borderRadius: 28, padding: '36px 28px', background: `linear-gradient(135deg, var(--accent), var(--accent2))`, color: 'white', boxShadow: '0 30px 80px rgba(15,23,42,0.15)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
              <div style={{ width: 68, height: 68, borderRadius: 20, background: 'rgba(255,255,255,0.16)', display: 'grid', placeItems: 'center' }}>
                <CalendarIcon size={34} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.85 }}>Under construction</div>
                <h1 style={{ margin: '12px 0 10px', fontSize: 36, lineHeight: 1.02, letterSpacing: '-0.025em' }}>CT & Quiz Planner</h1>
                <p style={{ margin: 0, maxWidth: 760, fontSize: 16, lineHeight: 1.8, color: 'rgba(255,255,255,0.92)' }}>
                  A focused planning workspace for CRs is being built here. The preview shows the direction while the final experience is polished.
                </p>
              </div>
            </div>
          </section>

          <section style={{ display: 'grid', gap: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: `var(--accent)` }} />
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>What the planner will do</div>
            </div>

            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
              {featureCards.map(card => (
                <div key={card.title} style={{ padding: 20, borderRadius: 22, background: `var(--card)`, border: `1px solid var(--border)`, boxShadow: '0 18px 34px rgba(15,23,42,0.06)' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12, color: 'var(--text)' }}>{card.title}</div>
                  <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--muted)', fontSize: 14, lineHeight: 1.8 }}>
                    {card.items.map(item => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section style={{ display: 'grid', gap: 12, padding: 24, borderRadius: 24, background: `var(--card)`, border: `1px solid var(--border)`, boxShadow: '0 20px 40px rgba(15,23,42,0.06)' }}>
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>Why this page looks like this</div>
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14, lineHeight: 1.8 }}>
                The planner is still under development, so the current screen shows a polished preview instead of unfinished content.
              </p>
            </div>
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <div style={{ padding: 16, borderRadius: 18, background: `var(--surface)`, border: `1px solid var(--border)` }}>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6, color: 'var(--text)' }}>Clean presentation</div>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>Short, clear sections with bold headings.</div>
              </div>
              <div style={{ padding: 16, borderRadius: 18, background: `var(--surface)`, border: `1px solid var(--border)` }}>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6, color: 'var(--text)' }}>Minimal text</div>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>Only the key planner ideas are shown here.</div>
              </div>
              <div style={{ padding: 16, borderRadius: 18, background: `var(--surface)`, border: `1px solid var(--border)` }}>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6, color: 'var(--text)' }}>Preview mode</div>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>The real planner will replace this page later.</div>
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container content-page-bg" style={{ width: '100%', margin: '28px auto', padding: 20 }}>
      <div className="content-page-hero" style={{ marginBottom: 16, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div className="content-page-hero-icon">
            <CalendarIcon size={18} color="var(--accent)" />
          </div>
          <div>
            <h1 className="content-page-hero-title">CT & Quiz Planner</h1>
            <p className="content-page-hero-subtitle">A lightweight demo planner — click a date to view or add events. Smart hints will show below.</p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Demo Mode</div>
        </div>
      </div>

      <div className="ct-planner-layout">
        <div style={{ background: 'var(--card)', borderRadius: 12, padding: 14, border: `1px solid var(--border)` }}>
          <CTPlannerCalendar schedule={schedule} viewDate={new Date(viewYear, viewMonth, 1)} onDateClick={onFcDateClick} onEventClick={onFcEventClick} onEventDrop={onFcEventDrop} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={() => { setViewMonth(m => m - 1); if (viewMonth === 0) setViewYear(y => y - 1); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><ArrowLeft size={18} /></button>
              <div style={{ fontWeight: 700 }}>{new Date(viewYear, viewMonth).toLocaleString(undefined, { month: 'long', year: 'numeric' })}</div>
              <button onClick={() => { setViewMonth(m => m + 1); if (viewMonth === 11) setViewYear(y => y + 1); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><ArrowRight size={18} /></button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Holidays highlighted in orange</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, textAlign: 'center', marginBottom: 8 }}>
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <div key={d} style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>{d}</div>
            ))}
          </div>

          <div>
            {monthMatrix.map((week, wi) => (
              <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
                {week.map((d, i) => {
                  const key = d ? utilKeyFor(viewYear, viewMonth, d) : null;
                  const isHoliday = key && holidayDates.includes(key);
                  const hasEvents = key && events[key] && events[key].length > 0;
                  const isSelected = d === selectedDay && viewMonth === today.getMonth() && viewYear === today.getFullYear();
                  return (
                    <button key={i} onClick={() => {
                      if (!d) return;
                      const k = utilKeyFor(viewYear, viewMonth, d);
                      if (holidayDates.includes(k)) {
                        window.alert('Selected date is a holiday. CTs cannot be scheduled on holidays.');
                        return;
                      }
                      setSelectedDay(d);
                    }} onDragOver={(e) => e.preventDefault()} onDrop={() => handleDropToDate(d)} disabled={!d} style={{
                      minHeight: 72,
                      borderRadius: 10,
                      border: isSelected ? '2px solid #7c3aed' : '1px solid rgba(15,23,42,0.06)',
                      background: isSelected ? 'linear-gradient(90deg, rgba(124,58,237,0.06), rgba(6,182,212,0.03))' : 'white',
                      padding: 8,
                      cursor: d ? 'pointer' : 'default'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 700 }}>{d || ''}</div>
                        {isHoliday && <div style={{ fontSize: 11, color: '#fb923c', fontWeight: 700 }}>Holiday</div>}
                      </div>
                      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>{hasEvents ? `${events[key].length} event(s)` : ''}</div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <aside style={{ background: 'white', borderRadius: 12, padding: 14, border: '1px solid rgba(15, 23, 42, 0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Selected Date</div>
              <div style={{ fontWeight: 800 }}>{new Date(viewYear, viewMonth, selectedDay).toDateString()}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: pressure.color, fontWeight: 800 }}>{pressure.text} Pressure</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{countEventsInWeekOf(selectedDay)} events in 7-day window</div>
            </div>
          </div>

          <EventModal open={modalOpen} data={modalData} courses={allCourses} teachersMap={settings?.courseTeacherMap || {}} onChange={(d)=>setModalData(d)} onSave={(d)=>{
            // save via saveModal handler
            setModalData(d); saveModal();
          }} onCancel={() => cancelModal()} />

          <div style={{ maxWidth: 1100, margin: '12px auto', padding: 8 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Smart Assist Suggestions</div>
            <div style={{ background: 'white', padding: 12, borderRadius: 8, border: '1px solid rgba(15,23,42,0.06)' }}>
              {(generateSuggestions(schedule, assignments, selKey, settings) || []).map((s, i) => <div key={i} style={{ marginBottom: 6 }}>{s}</div>)}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Planner Mode</div>
            <select value={plannerMode} onChange={e => setPlannerMode(e.target.value)} style={{ marginLeft: 8 }}>
              <option value="3CT">3 CT Mode</option>
              <option value="4CT">4 CT Mode</option>
            </select>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 700 }}>CT Progress</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              {(() => {
                // global CT progress summary: count total CTs scheduled vs expected per course
                const expected = plannerMode === '4CT' ? 4 : 3;
                const counts = {};
                (schedule || []).forEach(s => { if (s.eventType === 'CT' && s.courseId) counts[s.courseId] = (counts[s.courseId] || 0) + 1; });
                const totalCourses = allCourses.filter(c => (c.year && c.term && getCurrentTermKey(profile) && (c.year && c.term))).length || allCourses.length;
                const totalScheduled = Object.values(counts).reduce((a,b)=>a+b,0);
                return `${totalScheduled} scheduled CT(s) · default target ${expected} per course`;
              })()}
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 700 }}>Events</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{ display: 'flex', gap: 6, alignItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: '#6366f1' }} onClick={() => openModalForDate(selKey)}><PlusCircle size={16} />Add</button>
                <button style={{ display: 'flex', gap: 6, alignItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer' }} onClick={() => { const text = buildDailyCopy(selKey); navigator.clipboard?.writeText(text); window.open(`https://wa.me/?text=${encodeURIComponent(text)}`); }}>Copy Day</button>
                <button style={{ display: 'flex', gap: 6, alignItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer' }} onClick={() => { const text = buildWeeklyCopy(selectedDay); navigator.clipboard?.writeText(text); window.open(`https://wa.me/?text=${encodeURIComponent(text)}`); }}>Copy Week</button>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
                {dayEvents.length === 0 && <div style={{ color: 'var(--muted)' }}>No events for this date.</div>}
              {dayEvents.map(ev => (
                <div key={ev.id} draggable onDragStart={(e) => { dragItemRef.current = ev.id; e.dataTransfer.setData('text/plain', ev.id); }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: 8, padding: 8, background: 'linear-gradient(90deg, rgba(99,102,241,0.03), rgba(6,182,212,0.02))', cursor: 'grab' }}>
                  <div onDoubleClick={() => openModalForDate(ev.date, ev)} style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800 }}>{ev.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{ev.eventType} · {ev.duration} mins · {ev.room ? ev.room + (ev.building ? ' · ' + ev.building : '') : ''}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button onClick={() => {
                      const text = buildSingleEventCopy(ev);
                      navigator.clipboard?.writeText(text);
                      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
                    }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#25D366' }}><Copy size={16} /></button>
                    <button onClick={() => removeEvent(ev.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 14, padding: 10, borderRadius: 8, background: 'linear-gradient(180deg, rgba(99,102,241,0.04), rgba(6,182,212,0.02))', fontSize: 13 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Info size={16} /><div style={{ fontWeight: 700 }}>Smart Suggestion</div></div>
            <div style={{ marginTop: 8, color: 'var(--muted)' }}>
              {pressure.text === 'High' && <div>High scheduling pressure detected. Consider moving one event to another week or expanding scheduling windows.</div>}
              {pressure.text === 'Medium' && <div>Medium pressure — spacing of at least 3 days between CTs is recommended.</div>}
              {pressure.text === 'Low' && <div>Low pressure — schedule freely, but keep at least 2 days spacing for fairness.</div>}
            </div>
          </div>
        </aside>
      </div>
      
    </div>
  );
}
