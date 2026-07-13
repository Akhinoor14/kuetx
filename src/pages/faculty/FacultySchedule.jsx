// FacultySchedule.jsx
//
// A real weekly grid view, matching Schedule.jsx's visual language
// (sticky header, day-column highlight, time-column styling, colored class
// chips) — copied deliberately rather than imported, since Schedule.jsx
// itself is 2600+ lines of student-routine-editing logic (inline edit/
// delete, CR-only write guards, holiday/preview handling) that isn't safe
// to touch or partially import from. What's reused verbatim: the
// TIME_MODELS/DAYS data (lib/timeModels.js, itself a deliberate copy —
// see that file's header), the isSlotOverlap-based rowspan-merge
// approach (mirrored from Schedule.jsx's tableLayout logic so a Full
// Sessional block saved from Faculty Add Class renders as ONE spanning
// cell here too, instead of silently not appearing because its wide slot
// string doesn't exact-match any single TIME_MODELS period row), and the
// table's visual styling (colors, spacing, sticky header, selected-day/
// today highlight).
//
// What's still deliberately NOT reused: inline edit/delete affordances
// and CR-only write guards — this page is read-only by design (§8's
// route table doesn't ask for a teacher to edit their own schedule from
// this page — that's what "+ Add Class"/Edit Class in My Classes is
// for). A teacher can have at most one of their own dayTimeSlots entries
// per day+slot (no CR-style multi-student overlap to arbitrate), so this
// file's version of the merge logic doesn't need Schedule.jsx's
// multi-item-per-cell branching — one anchor entry per day+slot is
// always enough.
//
// Batch color: each placed chip is tinted by the class's batch via
// getBatchColor/getActiveBatches (same Founder-editable list + palette
// used in My Classes), so a teacher scanning the grid can visually group
// their own classes by cohort at a glance, same as My Classes' card
// grouping.

import { useEffect, useMemo, useState } from 'react';
import * as Icons from 'lucide-react';
import { auth } from '../../lib/firebase';
import {
  TIME_MODELS, DAYS, isSlotOverlap, getBatchColor,
} from '../../lib/timeModels';
import { getActiveBatches } from '../../lib/appConfigSync';
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
  // Founder-editable active batch list — same source as My Classes/Add
  // Class, so batch color assignment stays consistent app-wide. One-time
  // fetch is enough here (unlike Founder settings itself, this page
  // doesn't need live updates mid-session for a reorder to reflect).
  const [batches, setBatches] = useState([]);
  const [selectedDay, setSelectedDay] = useState(() => {
    // BUGFIX: DAYS only covers the 5 teaching days (Sun-Thu) — Friday is
    // KUET's weekly holiday and Saturday isn't a class day either. Raw
    // new Date().getDay() returns 0-6, so on a real Friday (5) or
    // Saturday (6) this used to silently fall through to the `|| 'Sunday'`
    // fallback — harmless for selectedDay itself, but worth being
    // explicit about here since a naive read of `DAYS[todayIndex]` looks
    // like it should always work and quietly doesn't two days a week.
    const todayIndex = new Date().getDay();
    return DAYS[todayIndex] || DAYS[0];
  });

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setClassIndex([]); return; }
    return subscribeMyClassIndex(uid, setClassIndex);
  }, []);

  useEffect(() => {
    getActiveBatches().then(setBatches);
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

  // Every active assignment's dayTimeSlots, flattened to one entry per
  // placed item — kept separate from the anchor/rowspan layout below so
  // "Today's Classes" (a flat list, no grid geometry needed) doesn't have
  // to unpack rowSpan wrapper objects just to read a slot string.
  const flatEntries = useMemo(() => {
    const out = [];
    Object.entries(assignments).forEach(([assignmentId, a]) => {
      if (!a) return;
      (a.dayTimeSlots || []).forEach((dts) => {
        out.push({
          assignmentId, day: dts.day, slot: dts.slot,
          courseCode: a.courseCode, courseTitle: a.courseTitle, dept: a.dept, batch: a.batch,
        });
      });
    });
    return out;
  }, [assignments]);

  // Anchor + rowSpan layout — mirrors Schedule.jsx's tableLayout so a
  // Full Sessional block (one wide slot string like "8:00 AM-10:30 AM",
  // saved when a teacher picks "Full sessional block" in Add Class)
  // lands on ONE anchor row and spans the periods it overlaps, instead of
  // needing an exact string match against a single TIME_MODELS period
  // (which it will never have, since it's 3 periods wide). A plain
  // single-period class still works the same way: its own slot IS the
  // exact-match period, overlappingSlots is just that one row, rowSpan
  // is 1 — behaviorally identical to the old flat lookup for the common
  // case, so no visual regression for ordinary classes.
  //
  // Unlike Schedule.jsx's version, no multi-item-per-cell grouping is
  // needed here: a teacher's own dayTimeSlots can't have two of THEIR
  // classes double-booked into the same day+slot (that's a save-time
  // conflict Add Class already guards against), so at most one entry
  // anchors to any given day+slot.
  const tableLayout = useMemo(() => {
    const starts = {};
    const covered = {};
    DAYS.forEach((day) => {
      starts[day] = {};
      covered[day] = new Set();
    });

    flatEntries.forEach((entry) => {
      if (!starts[entry.day]) return;

      const overlappingSlots = slotList.filter(
        (s) => !isBreakSlot(s) && isSlotOverlap(s, entry.slot),
      );
      const exactMatch = overlappingSlots.find((s) => s === entry.slot);
      const firstSlot = exactMatch || overlappingSlots[0];
      if (!firstSlot) return; // no period in the current time model overlaps this slot at all

      const slotsFromFirst = exactMatch
        ? overlappingSlots.slice(overlappingSlots.indexOf(exactMatch))
        : overlappingSlots;
      const rowSpan = Math.max(1, slotsFromFirst.length || 1);

      if (!starts[entry.day][firstSlot]) starts[entry.day][firstSlot] = [];
      starts[entry.day][firstSlot].push({ entry, rowSpan });
      slotsFromFirst.slice(1).forEach((s) => covered[entry.day].add(s));
    });

    return { starts, covered };
  }, [flatEntries, slotList]);

  const today = DAYS[new Date().getDay()] || 'Sunday';
  const loading = classIndex === null;

  // Today's classes — flat, sorted list, same "list on top" pattern as
  // the student Attendance.jsx "Today's Classes" strip. Built straight
  // from flatEntries (not the grid layout) since a flat list has no need
  // for anchor/rowspan geometry.
  const todaysClasses = useMemo(() => {
    return flatEntries
      .filter((e) => e.day === today && !isBreakSlot(e.slot))
      .sort((a, b) => a.slot.localeCompare(b.slot));
  }, [flatEntries, today]);

  return (
    <div className="hub-page-bg" style={{ minHeight: '100vh' }}>
      <div style={{ padding: '20px 24px 40px', width: '97%', maxWidth: 'none', margin: '0 auto' }}>
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

        {/* ── Today's Classes — list on top, same pattern as the student
             Attendance.jsx "Today's Classes" strip: colored left-accent
             rows, slot time first, course + batch/dept below. ── */}
        {!loading && (
          <div className="card" style={{ marginTop: 16, marginBottom: 16, padding: '14px 16px', borderRadius: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icons.CalendarClock size={13} /> Today's Classes
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                {new Date().toLocaleDateString('en-BD', { weekday: 'short', day: 'numeric', month: 'short' })}
              </div>
            </div>
            {todaysClasses.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {todaysClasses.map((c, idx) => {
                  const color = getBatchColor(c.batch, batches);
                  return (
                    <div key={`${c.assignmentId}-${idx}`} style={{
                      display: 'flex', gap: 10, padding: '9px 12px', borderRadius: 10, alignItems: 'center',
                      background: `linear-gradient(180deg, ${color.bg}, ${color.bg})`,
                      border: `1px solid ${color.border}`,
                    }}>
                      <div style={{ fontWeight: 900, fontSize: 11.5, color: color.text, minWidth: 46, flexShrink: 0, fontFamily: 'JetBrains Mono, monospace' }}>
                        {slotPreview(c.slot)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.courseCode} — {c.courseTitle}</div>
                        <div style={{ fontSize: 11, color: color.text, marginTop: 1, fontWeight: 700 }}>{c.batch?.toUpperCase()} {c.dept}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: 'var(--muted)', textAlign: 'center', padding: '10px 0' }}>
                No scheduled classes today{today === 'Friday' ? ' — enjoy the weekly holiday 🎉' : ''}
              </div>
            )}
          </div>
        )}

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
                        // A slot covered by an earlier anchor's rowSpan (e.g.
                        // periods 2 and 3 of a Full Sessional block anchored
                        // at period 1) renders NO <td> at all for this row —
                        // the anchor cell's rowSpan already occupies that
                        // table position. Emitting a <td> here too would
                        // break the row's column count.
                        if (!breakSlot && tableLayout.covered[d]?.has(slot)) return null;

                        const anchored = tableLayout.starts[d]?.[slot] || [];
                        // At most one anchor per day+slot (see comment above
                        // tableLayout) — a teacher's own classes can't double
                        // book the same day+slot — but .map stays defensive
                        // rather than assuming exactly one.
                        const rowSpan = anchored.length ? anchored[0].rowSpan : 1;

                        return (
                          <td
                            key={d}
                            rowSpan={rowSpan > 1 ? rowSpan : undefined}
                            style={{
                              padding: 6, borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)',
                              verticalAlign: 'top', minHeight: 64,
                              background: breakSlot ? 'rgba(239,68,68,0.08)' : d === selectedDay ? 'rgba(59,130,246,0.035)' : 'transparent',
                            }}
                          >
                            {anchored.map(({ entry, rowSpan: rs }) => {
                              const color = getBatchColor(entry.batch, batches);
                              return (
                                <div key={entry.assignmentId} style={{
                                  padding: '8px 9px', borderRadius: 11, fontSize: 12, lineHeight: 1.35, marginBottom: 4,
                                  // The td's own rowSpan attribute (set above) is what actually
                                  // makes this cell visually span multiple periods — no height
                                  // trick needed on the inner chip itself.
                                  height: rs > 1 ? '100%' : undefined,
                                  background: `linear-gradient(180deg, ${color.bg}, ${color.bg})`,
                                  border: `1px solid ${color.border}`, color: 'var(--text)',
                                }}>
                                  <div style={{ fontWeight: 700 }}>{entry.courseCode}</div>
                                  <div style={{ fontSize: 11, color: color.text, fontWeight: 700 }}>{entry.batch?.toUpperCase()} {entry.dept}</div>
                                  {rs > 1 && (
                                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                                      <Icons.Layers size={10} /> Full sessional block
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
