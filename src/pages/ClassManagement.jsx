import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy } from 'lucide-react';
import { store, getProfile } from '../store/store';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

const DEFAULT_SETTINGS = {
  messageFormat: 'whatsapp',
};

const parseTimeToMinutes = (value) => {
  let cleanValue = String(value || '').trim().replace(/\s+break\s*$/i, '').trim();
  const match = cleanValue.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === 'PM' && hours !== 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

const parseSlotRange = (slot) => {
  const match = String(slot || '').match(/^(.+?)\s*-\s*(.+)$/);
  if (!match) return null;
  const start = parseTimeToMinutes(match[1]);
  const end = parseTimeToMinutes(match[2]);
  if (start === null || end === null || end <= start) return null;
  return { start, end };
};

const slotSortValue = (slot) => {
  const range = parseSlotRange(slot);
  return range ? range.start * 1000 + range.end : Number.MAX_SAFE_INTEGER;
};

const getSlotCatalog = (schedule) => {
  const unique = new Map();
  (schedule || []).forEach(item => {
    const key = String(item.slot || '').trim();
    if (key) unique.set(key, key);
  });
  return [...unique.values()].sort((a, b) => slotSortValue(a) - slotSortValue(b) || a.localeCompare(b));
};

const isSlotOverlap = (a, b) => {
  const rangeA = parseSlotRange(a);
  const rangeB = parseSlotRange(b);
  if (!rangeA || !rangeB) return String(a || '').trim() === String(b || '').trim();
  return rangeA.start < rangeB.end && rangeB.start < rangeA.end;
};

const formatDayShort = (day) => day.slice(0, 3);

const isLongSessionalSlot = (slot) => {
  const range = parseSlotRange(slot);
  if (!range) return false;
  return (range.end - range.start) >= 120;
};

const normalizeTeacherName = (value) => {
  const clean = String(value || '').trim().replace(/\s+/g, ' ');
  if (!clean) return '';
  return /\bsir\.?$/i.test(clean) ? clean.replace(/\.$/, '') : `${clean} Sir`;
};

const normalizeScheduleEntries = (entries) => {
  const seen = new Set();
  return (entries || []).map(item => ({
    ...item,
    teacherName: normalizeTeacherName(item.teacherName),
    displayName: String(item.displayName || '').trim(),
  })).filter(item => {
    const key = [item.day, item.slot, item.courseId, item.teacherName || '', item.type || '', item.room || '', item.note || ''].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const buildDailyText = (day, classes, getCourse, messageFormat = 'whatsapp') => {
  const lines = [];
  const getClassShareLabel = (item) => {
    const course = getCourse(item.courseId);
    return item.displayName || course?.name || course?.code || 'Unknown Course';
  };

  if (messageFormat === 'whatsapp') {
    lines.push(`*_📅 Schedule for ${day}_*`);
    lines.push('');

    if (classes.length) {
      const sortedClasses = classes.slice().sort((a, b) => a.slot.localeCompare(b.slot));
      sortedClasses.forEach((item, idx) => {
        const cleanSlot = String(item.slot).replace(/\s+break\s*$/i, '').trim();
        const classLabel = item.type === 'Sessional' ? getClassShareLabel(item) : (item.teacherName || 'Teacher not set');
        lines.push(`${idx + 1}. *${cleanSlot}* — _${classLabel}_`);
      });
    }
  } else {
    lines.push(`Schedule for ${day}`);
    lines.push('');
    if (classes.length) {
      classes.slice().sort((a, b) => a.slot.localeCompare(b.slot)).forEach((item, idx) => {
        const cleanSlot = String(item.slot).replace(/\s+break\s*$/i, '').trim();
        const course = getCourse(item.courseId);
        lines.push(`${idx + 1}. ${cleanSlot} - ${item.displayName || course?.name || course?.code || 'Unknown Course'}`);
      });
    }
  }

  return lines.join('\n').trim();
};

const buildRoutineBackupPayload = (schedule, scheduleSettings, assignments, teachers) => ({
  version: 1,
  type: 'kuetx-routine-backup',
  exportedAt: new Date().toISOString(),
  data: {
    schedule: normalizeScheduleEntries(schedule),
    scheduleSettings: scheduleSettings || DEFAULT_SETTINGS,
    examOverrides: store.get('examOverrides') || {},
    assignments: assignments || [],
    teachers: teachers || [],
  },
});

export default function ClassManagement() {
  const profile = getProfile();
  const [schedule, setSchedule] = useState(() => normalizeScheduleEntries(store.get('schedule') || []));
  const [settings, setSettings] = useState(() => ({ ...DEFAULT_SETTINGS, ...(store.get('scheduleSettings') || {}) }));
  const [assignments, setAssignments] = useState(() => store.get('assignments') || []);
  const [teachers, setTeachers] = useState(() => store.get('teachers') || []);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedDay, setSelectedDay] = useState(() => {
    for (const day of DAYS) {
      if (schedule.some(item => item.day === day)) return day;
    }
    return 'Sunday';
  });
  const [fullScreenOpen, setFullScreenOpen] = useState(false);

  const getCourse = (id) => {
    const allCourses = store.get('courses') || [];
    return allCourses.find(course => course.id === id);
  };

  const tableSlots = useMemo(() => {
    const slots = getSlotCatalog(schedule).filter(slot => !isLongSessionalSlot(slot));
    return slots.length ? slots : getSlotCatalog(schedule);
  }, [schedule]);

  const tableLayout = useMemo(() => {
    const starts = {};
    const covered = {};

    DAYS.forEach(day => {
      starts[day] = {};
      covered[day] = new Set();
    });

    schedule.forEach(item => {
      if (!starts[item.day]) return;

      const overlappingSlots = tableSlots.filter(slot => !String(slot).toLowerCase().includes('break') && isSlotOverlap(slot, item.slot));
      const firstSlot = overlappingSlots[0] || tableSlots.find(slot => String(slot).trim() === String(item.slot).trim());
      if (!firstSlot) return;

      if (!starts[item.day][firstSlot]) starts[item.day][firstSlot] = [];
      const rowSpan = Math.max(1, overlappingSlots.length || 1);
      starts[item.day][firstSlot].push({ item, rowSpan });

      overlappingSlots.slice(1).forEach(slot => covered[item.day].add(slot));
    });

    return { starts, covered };
  }, [schedule, tableSlots]);

  const selectedClasses = useMemo(() => schedule.filter(item => item.day === selectedDay), [schedule, selectedDay]);
  const selectedScheduleText = useMemo(
    () => buildDailyText(selectedDay, selectedClasses, getCourse, 'whatsapp'),
    [selectedDay, selectedClasses]
  );

  const renderTimetable = (opts = {}) => {
    const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: opts.large ? 15 : 13 };
    return (
      <div className={`timetable-grid${opts.fullView ? ' full-view' : ''}`} style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
            <tr>
              <th className="time-col" style={{ padding: '12px 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', minWidth: 110, textAlign: 'left' }}>Time</th>
              {DAYS.map(d => (
                <th key={d} className={`timetable-day-col${d === selectedDay ? ' selected-day' : ''}`} style={{ padding: 0, borderBottom: '1px solid var(--border)', background: 'var(--surface)', minWidth: 160 }}>
                  <button
                    onClick={() => setSelectedDay(d)}
                    style={{
                      width: '100%',
                      padding: '12px 12px',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      fontWeight: d === selectedDay ? 700 : 500,
                      color: d === selectedDay ? 'var(--accent)' : 'var(--text)',
                    }}
                  >
                    {formatDayShort(d)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableSlots.map(p => {
              const breakSlot = String(p).toLowerCase().includes('break');
              return (
                <tr key={p}>
                  <td style={{ padding: '12px 12px', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', fontWeight: 700, fontSize: 13, color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap', background: breakSlot ? 'rgba(239,68,68,0.08)' : 'var(--bg)' }}>{String(p).replace(/\s+break\s*$/i, '').trim().replace(/^(.+)-(.+)$/, '$1 → $2')}</td>
                  {DAYS.map(d => {
                    if (tableLayout.covered[d]?.has(p)) return null;
                    const entries = tableLayout.starts[d]?.[p] || [];
                    const dayItems = entries.map(entry => entry.item);
                    const rowSpan = entries.length === 1 ? entries[0].rowSpan : 1;
                    const isEmptyCell = dayItems.length === 0;
                    return (
                      <td
                        key={d}
                        rowSpan={rowSpan > 1 ? rowSpan : undefined}
                        className={`timetable-day-col${d === selectedDay ? ' selected-day' : ''}`}
                        title={isEmptyCell ? 'Routine preview' : undefined}
                        style={{
                          padding: '6px',
                          borderBottom: '1px solid var(--border)',
                          borderRight: '1px solid var(--border)',
                          verticalAlign: 'top',
                          minHeight: 54,
                          background: breakSlot ? 'rgba(239,68,68,0.08)' : d === selectedDay ? 'rgba(59,130,246,0.035)' : 'transparent',
                          cursor: 'default',
                        }}
                      >
                        {dayItems.map(s => {
                          const c = getCourse(s.courseId);
                          const isSessional = /sessional|lab/i.test(String(s.type || ''));
                          return (
                            <div
                              key={s.id}
                              style={{
                                padding: '8px 9px',
                                borderRadius: 11,
                                fontSize: 12,
                                lineHeight: 1.35,
                                marginBottom: 4,
                                background: isSessional
                                  ? 'linear-gradient(180deg, rgba(34,197,94,0.12), rgba(34,197,94,0.08))'
                                  : 'linear-gradient(180deg, rgba(59,130,246,0.12), rgba(59,130,246,0.08))',
                                border: isSessional
                                  ? '1px solid rgba(34,197,94,0.25)'
                                  : '1px solid rgba(59,130,246,0.18)',
                                color: 'var(--text)',
                                position: 'relative',
                                userSelect: 'none',
                              }}
                            >
                              <div style={{ fontWeight: 800, fontSize: 12, lineHeight: 1.35, letterSpacing: '0.01em', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', flex: 1 }}>
                                {s.displayName || c?.code || c?.name || '?'}
                              </div>
                              {!isSessional && (
                                <div style={{ fontSize: 11, fontWeight: 600, marginTop: 4, color: 'var(--text)', opacity: 0.95, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                  Teacher: {s.teacherName || 'Not set'}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const handleCopySchedule = async () => {
    try {
      await navigator.clipboard.writeText(selectedScheduleText);
      setCopied(true);
      setMessage(`Copied WhatsApp schedule for ${selectedDay}.`);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      alert('Copy failed: ' + (e && e.message ? e.message : String(e)));
    }
  };

  const handleExportRoutine = () => {
    const payload = buildRoutineBackupPayload(schedule, settings, assignments, teachers);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kuetx-routine-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage('Routine backup exported successfully.');
  };

  return (
    <div className="page-enter page-container" style={{ maxWidth: 1120 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0 }}>Class Management</h2>
          <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
            Profile: {profile.name || '—'} {profile.isCR ? '· Class Rep' : ''}
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 999 }}>
          Under construction
        </div>
      </div>

      {message && (
        <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 10, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.18)', color: 'var(--text)', fontSize: 13 }}>
          {message}
        </div>
      )}

      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ padding: 18, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 12 }}>Quick Routine Tools</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={handleCopySchedule}
              style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(37,211,102,0.35)', background: 'linear-gradient(180deg, rgba(37,211,102,0.16), rgba(37,211,102,0.10))', color: 'var(--text)', fontWeight: 800 }}
            >
              {copied ? 'Copied ✓' : 'Copy WhatsApp'}
            </button>
            <button
              onClick={handleExportRoutine}
              style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontWeight: 700 }}
            >
              Export Routine
            </button>
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Timetable Grid</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>Same routine view as Schedule, tuned for CR use.</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: 'var(--muted)' }}>
              {schedule.length > 0 && (
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{schedule.length} saved slot{schedule.length === 1 ? '' : 's'}</div>
              )}
              <button className="btn btn-ghost mobile-fullscreen-btn" onClick={() => setFullScreenOpen(true)} aria-label="Open timetable full screen">
                <span className="fs-icon" aria-hidden style={{ display: 'inline-block', lineHeight: 0 }}>⤢</span>
                <span className="fs-label" style={{ marginLeft: 8, fontWeight: 700 }}>Full</span>
              </button>
            </div>
          </div>

          <div className="mobile-preview-controls">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <span className="tag tag-blue">Selected · {selectedDay}</span>
              <span className="tag tag-green">WhatsApp ready</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {DAYS.map(day => (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className="btn"
                  style={{
                    padding: '8px 12px',
                    border: selectedDay === day ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: selectedDay === day ? 'rgba(59,130,246,0.08)' : 'var(--card)',
                  }}
                >
                  {day}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {selectedClasses.length === 0 ? 'No classes added yet.' : `${selectedClasses.length} class${selectedClasses.length === 1 ? '' : 'es'} selected`}
              </div>
              <button className="btn btn-ghost" onClick={handleCopySchedule}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 999, background: 'rgba(37,211,102,0.18)' }}>
                  <Copy size={12} />
                </span>
                <span style={{ marginLeft: 8, fontWeight: 700 }}>Copy WhatsApp</span>
              </button>
            </div>
          </div>

          {renderTimetable()}
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ padding: 18, borderRadius: 18, border: '1px solid rgba(59,130,246,0.20)', background: 'linear-gradient(180deg, rgba(59,130,246,0.08), rgba(59,130,246,0.03))', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 999, border: '1px solid rgba(59,130,246,0.22)', background: 'rgba(59,130,246,0.10)', color: 'var(--text)', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />
              Under Construction
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 8, letterSpacing: '-0.02em' }}>
              This is the temporary CR workspace
            </div>
            <div style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.75, maxWidth: 720, margin: '0 auto' }}>
              The routine sharing tools above are ready now. The full class management suite will grow here step by step, so the workspace stays focused and easy to use.
            </div>
            <div style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 800 }}>
              ETA: Under construction
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div style={{ padding: 14, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Planned</div>
              <div style={{ color: 'var(--text)', fontWeight: 700, marginBottom: 8 }}>Class roster & attendance management</div>
              <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>Monitor class presence and keep CR-level attendance records in one place.</div>
            </div>
            <div style={{ padding: 14, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Planned</div>
              <div style={{ color: 'var(--text)', fontWeight: 700, marginBottom: 8 }}>Programme management</div>
              <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>Handle course allocations, sections, and class-level planning.</div>
            </div>
            <div style={{ padding: 14, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Planned</div>
              <div style={{ color: 'var(--text)', fontWeight: 700, marginBottom: 8 }}>Meeting management & minutes</div>
              <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>Keep meeting notes, action items, and follow-ups organized for the class.</div>
            </div>
          </div>

          <div style={{ padding: 14, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
            <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.75 }}>
              Need a feature? <Link to="/about#developer" style={{ color: 'var(--accent)', fontWeight: 800, textDecoration: 'none' }}>Jump to Developer Info</Link> and contact the developer directly from there, then mention "Class Management" in your message.
            </div>
          </div>
        </div>
      </div>

      {fullScreenOpen && (
        <div className="fullscreen-overlay" onClick={() => setFullScreenOpen(false)}>
          <div className="fullscreen-content fullscreen-rotated" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Timetable Full View</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Same routine grid, full screen.</div>
              </div>
              <button className="btn btn-ghost" onClick={() => setFullScreenOpen(false)}>Close</button>
            </div>
            {renderTimetable({ large: true, fullView: true })}
          </div>
        </div>
      )}
    </div>
  );
}
