// FacultySchedule.jsx
//
// A real weekly grid view, matching Schedule.jsx's visual language
// (sticky header, day-column highlight, time-column styling, colored class
// chips) — copied deliberately rather than imported, since Schedule.jsx
// itself is 2600+ lines of student-routine-editing logic (rowspan/overlap
// merging for lab sessionals, inline edit/delete, CR-only write guards)
// that isn't safe to touch or partially import from. What's reused
// verbatim: the TIME_MODELS/DAYS data (lib/timeModels.js, itself a
// deliberate copy — see that file's header) and the table's visual
// styling (colors, spacing, sticky header, selected-day/today highlight).
// What's deliberately NOT reused: rowspan/lab-merging logic, since a
// teacher's own schedule here only ever needs to place each of THEIR
// classes in its one slot — no merged multi-period cells, no CR editing
// affordances. This is read-only by design (§8's route table doesn't ask
// for a teacher to edit their own schedule from this page — that's what
// "+ Add Class"/Edit Class in My Classes is for).

import { useEffect, useMemo, useState } from 'react';
import * as Icons from 'lucide-react';
import { auth } from '../../lib/firebase';
import { TIME_MODELS, DAYS } from '../../lib/timeModels';
import { subscribeMyClassIndex, getFacultyAssignment } from '../../lib/facultyClassSync';

const formatDayShort = (day) => day.slice(0, 3);

function slotPreview(slot) {
  const cleanSlot = String(slot).replace(/\s+break\s*$/i, '').trim();
  const match = cleanSlot.match(/^(.+)-(.+)$/);
  if (!match) return cleanSlot;
  return `${match[1]} → ${match[2]}`;
}

const isBreakSlot = (slot) => String(slot).toLowerCase().includes('break');

export default function FacultySchedule() {
  const [classIndex, setClassIndex] = useState(null); // null = loading
  const [assignments, setAssignments] = useState({}); // assignmentId -> full doc
  const [modelId, setModelId] = useState('50min');
  const [selectedDay, setSelectedDay] = useState(() => {
    const todayIndex = new Date().getDay();
    return DAYS[todayIndex] || 'Sunday';
  });

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setClassIndex([]); return; }
    return subscribeMyClassIndex(uid, setClassIndex);
  }, []);

  useEffect(() => {
    if (!classIndex) return;
    let cancelled = false;
    const active = classIndex.filter((c) => c.status === 'active');
    Promise.all(active.map((c) => getFacultyAssignment(c.groupId, c.assignmentId).then((a) => [c.assignmentId, a])))
      .then((pairs) => {
        if (cancelled) return;
        setAssignments(Object.fromEntries(pairs));
      });
    return () => { cancelled = true; };
  }, [classIndex]);

  const activeTemplate = TIME_MODELS[modelId] || TIME_MODELS['50min'];
  const slotList = activeTemplate.slots;

  // Flatten every active assignment's dayTimeSlots into placed entries —
  // no rowspan/merge logic needed since each teacher-owned slot is its own
  // independent cell (unlike the student CR-routine grid, which merges
  // multi-period lab sessionals into one spanning cell).
  const placedByDaySlot = useMemo(() => {
    const map = {};
    DAYS.forEach((d) => { map[d] = {}; });
    Object.entries(assignments).forEach(([assignmentId, a]) => {
      if (!a) return;
      (a.dayTimeSlots || []).forEach((dts) => {
        if (!map[dts.day]) return;
        const key = dts.slot;
        if (!map[dts.day][key]) map[dts.day][key] = [];
        map[dts.day][key].push({ assignmentId, courseCode: a.courseCode, courseTitle: a.courseTitle, dept: a.dept, batch: a.batch });
      });
    });
    return map;
  }, [assignments]);

  const today = DAYS[new Date().getDay()] || 'Sunday';
  const loading = classIndex === null;

  return (
    <div className="hub-page-bg" style={{ minHeight: '100vh' }}>
      <div style={{ padding: '20px 24px 40px', maxWidth: 1040, margin: '0 auto' }}>
        <div className="hub-page-hero" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="hub-page-hero-icon">
              <Icons.Clock size={20} color="var(--accent)" />
            </div>
            <h1 className="hub-page-hero-title">My Schedule</h1>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {Object.values(TIME_MODELS).map((m) => (
              <button
                key={m.id}
                onClick={() => setModelId(m.id)}
                className="btn btn-sm"
                style={{
                  fontSize: 11.5, padding: '5px 10px',
                  border: modelId === m.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: modelId === m.id ? 'rgba(59,130,246,0.08)' : 'var(--card)',
                  color: 'var(--text)', borderRadius: 7, cursor: 'pointer',
                }}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>

        {loading && <div style={{ color: 'var(--muted)', fontSize: 13, padding: '20px 0' }}>Loading…</div>}

        {!loading && (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr>
                  <th style={{ padding: '10px 10px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', minWidth: 100, textAlign: 'left', fontSize: 12 }}>
                    Time
                  </th>
                  {DAYS.map((d) => (
                    <th key={d} style={{ padding: 0, borderBottom: '1px solid var(--border)', background: 'var(--surface)', minWidth: 140 }}>
                      <button
                        onClick={() => setSelectedDay(d)}
                        style={{
                          width: '100%', padding: '12px 12px', border: 'none', background: 'transparent', cursor: 'pointer',
                          fontWeight: d === selectedDay || d === today ? 700 : 500,
                          color: d === selectedDay || d === today ? 'var(--accent)' : 'var(--text)',
                        }}
                      >
                        {formatDayShort(d)}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slotList.map((slot) => {
                  const breakSlot = isBreakSlot(slot);
                  return (
                    <tr key={slot}>
                      <td style={{
                        padding: '10px 10px', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)',
                        fontWeight: 700, fontSize: 12, color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace',
                        whiteSpace: 'nowrap', background: breakSlot ? 'rgba(239,68,68,0.08)' : 'var(--bg)',
                      }}>
                        {slotPreview(slot)}
                      </td>
                      {DAYS.map((d) => {
                        const entries = placedByDaySlot[d]?.[slot] || [];
                        return (
                          <td key={d} style={{
                            padding: 6, borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)',
                            verticalAlign: 'top', minHeight: 64,
                            background: breakSlot ? 'rgba(239,68,68,0.08)' : d === selectedDay ? 'rgba(59,130,246,0.035)' : 'transparent',
                          }}>
                            {entries.map((e) => (
                              <div key={e.assignmentId} style={{
                                padding: '8px 9px', borderRadius: 11, fontSize: 12, lineHeight: 1.35, marginBottom: 4,
                                background: 'linear-gradient(180deg, rgba(59,130,246,0.12), rgba(59,130,246,0.08))',
                                border: '1px solid rgba(59,130,246,0.18)', color: 'var(--text)',
                              }}>
                                <div style={{ fontWeight: 700 }}>{e.courseCode}</div>
                                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{e.batch?.toUpperCase()} {e.dept}</div>
                              </div>
                            ))}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && Object.keys(assignments).length === 0 && (
          <div style={{ marginTop: 16, padding: 24, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--muted)', fontSize: 13.5, textAlign: 'center' }}>
            No scheduled classes yet — add a class from "My Classes" to see it here.
          </div>
        )}
      </div>
    </div>
  );
}
