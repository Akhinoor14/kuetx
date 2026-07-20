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
  TIME_MODELS, DAYS, isSlotOverlap, getBatchColor, sortBatches,
} from '../../lib/timeModels';
import { getActiveBatches } from '../../lib/appConfigSync';
import { subscribeMyClassIndex, getFacultyAssignment } from '../../lib/facultyClassSync';
// Reuse the exact same Add Class flow "My Classes" uses (dept -> batch ->
// term -> course -> day/slot), rather than building a second one here. A
// grid click can only ever pre-fill day+slot — dept/batch/term/course still
// need picking, since (unlike the student routine) the same day+slot is
// legitimately reused across many different batches/depts for one teacher
// — so this is a head start into the real form, not a true one-step
// quick-add like the student Schedule.jsx grid has.
import { AddClassModal } from '../faculty/FacultyClasses';
import { useIsFaculty } from '../../hooks/useIsFaculty';

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
  // { day, slot } of the empty cell that was clicked, or null when the Add
  // Class modal is closed. Only ever set for empty cells (see the td
  // onClick below) — clicking an already-occupied cell does nothing here,
  // since editing an existing class is My Classes' job, not this page's.
  const [addAt, setAddAt] = useState(null);
  // Mobile "Full Screen" landscape view — same pattern as student
  // Schedule.jsx's fullScreenOpen, added here since this page previously
  // had no escape hatch from the cramped 5-day-wide table on phones.
  const [fullScreenOpen, setFullScreenOpen] = useState(false);
  // Small "gear" popover for choosing the time model (50min / other) —
  // previously every model was its own always-visible button sitting in
  // the page header permanently, which crowded the header on every visit
  // even though 50-minute IS the default/most-used model and switching is
  // a rare action. Tucked behind one compact toggle instead; closes on
  // an outside click or after picking a model.
  const [modelMenuOpen, setModelMenuOpen] = useState(false);

  // Hide the fixed bottom-nav while the rotated fullscreen timetable is
  // open — see matching effect in Schedule.jsx for details.
  useEffect(() => {
    if (fullScreenOpen) {
      document.body.classList.add('schedule-fullscreen-active');
    } else {
      document.body.classList.remove('schedule-fullscreen-active');
    }
    return () => document.body.classList.remove('schedule-fullscreen-active');
  }, [fullScreenOpen]);
  // Same Blue Tick gate as My Classes' own "+ Add Class" button — this
  // grid's empty-cell click opens the exact same AddClassModal, so it
  // needs the same guard (create write is server-gated on
  // isVerifiedFaculty regardless, but the UI should say so clearly
  // instead of clicking through into a form that will fail on submit).
  const { isFounderBypass, facultyProfile } = useIsFaculty();
  const isVerified = isFounderBypass || !!facultyProfile?.verifiedAt;
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
    // Sorted ascending by batch year (2k22 -> 2k23 -> ...) so the Add Class
    // batch dropdown shows smaller/older batches first. getBatchColor() is
    // always called with this same sorted array, so colors stay consistent.
    getActiveBatches().then((list) => setBatches(sortBatches(list)));
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

  const renderGrid = (opts = {}) => (
    <div
      className={`timetable-grid${opts.fullView ? ' full-view' : ''}`}
      style={{ overflowX: opts.fullView ? 'hidden' : 'auto', WebkitOverflowScrolling: 'touch' }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: opts.fullView ? 14 : 13 }}>
        <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
          <tr>
            <th className="time-col" style={{ padding: '7px 8px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', minWidth: opts.fullView ? 0 : 100, textAlign: 'left', fontSize: 12 }}>
              Time
            </th>
            {DAYS.map((d) => (
              <th key={d} className={`timetable-day-col${d === selectedDay ? ' selected-day' : ''}`} style={{ padding: 0, borderBottom: '1px solid var(--border)', background: 'var(--surface)', minWidth: opts.fullView ? 0 : 140 }}>
                <button
                  onClick={() => setSelectedDay(d)}
                  style={{
                    width: '100%', padding: '8px 10px', border: 'none', background: 'transparent', cursor: 'pointer',
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
                  padding: '6px 8px', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)',
                  fontWeight: 700, fontSize: 11.5, color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace',
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
                  const isEmptyCell = !breakSlot && anchored.length === 0;

                  return (
                    <td
                      key={d}
                      className={`timetable-day-col${d === selectedDay ? ' selected-day' : ''}`}
                      rowSpan={rowSpan > 1 ? rowSpan : undefined}
                      onClick={isEmptyCell && isVerified ? () => setAddAt({ day: d, slot }) : undefined}
                      title={
                        isEmptyCell
                          ? (isVerified ? 'Add a class in this slot' : 'Blue Tick verification needed before you can add a class')
                          : undefined
                      }
                      style={{
                        padding: 4, borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)',
                        verticalAlign: 'top', minHeight: 44, overflow: 'hidden',
                        cursor: isEmptyCell ? (isVerified ? 'pointer' : 'not-allowed') : 'default',
                        background: breakSlot ? 'rgba(239,68,68,0.08)' : d === selectedDay ? 'rgba(59,130,246,0.035)' : 'transparent',
                      }}
                    >
                      {isEmptyCell && (
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          height: '100%', minHeight: 26, opacity: 0.28,
                        }}>
                          <Icons.Plus size={14} />
                        </div>
                      )}
                      {anchored.map(({ entry, rowSpan: rs }) => {
                        const color = getBatchColor(entry.batch, batches);
                        return (
                          <div key={entry.assignmentId} style={{
                            padding: '6px 7px', borderRadius: 10, fontSize: 11.5, lineHeight: 1.3, marginBottom: 3,
                            // The td's own rowSpan attribute (set above) is what actually
                            // makes this cell visually span multiple periods — no height
                            // trick needed on the inner chip itself.
                            height: rs > 1 ? '100%' : undefined,
                            background: `linear-gradient(180deg, ${color.bg}, ${color.bg})`,
                            border: `1px solid ${color.border}`, color: 'var(--text)',
                            // BUGFIX: in fullscreen (6 columns: Time + 5 days sharing a
                            // rotated viewport's width) a squeezed column's batch/dept/
                            // course text had no clamp or overflow containment at all —
                            // long text wrapped past the chip's own box and visually
                            // bled into neighboring rows/columns, reading as "data
                            // overwriting the next cell". Clamped + word-break here so
                            // a narrow column shows fewer lines instead of overflowing.
                            overflow: 'hidden', maxWidth: '100%', boxSizing: 'border-box', wordBreak: 'break-word',
                          }}>
                            <div style={{ fontWeight: 700, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{entry.batch?.toUpperCase()} {entry.dept}</div>
                            <div style={{ fontSize: 11, color: color.text, fontWeight: 700, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{entry.courseCode}</div>
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
  );

  return (
    <div className="hub-page-bg" style={{ minHeight: '100vh' }}>
      <div className="faculty-schedule-page page-container" style={{ padding: '20px 24px 40px' }}>
        <div className="hub-page-hero faculty-schedule-hero" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="hub-page-hero-icon">
              <Icons.Clock size={20} color="var(--accent)" />
            </div>
            <h1 className="hub-page-hero-title">My Schedule</h1>
          </div>
          {/* Compact settings toggle — replaces the old always-visible row
              of one button per time model. 50-minute stays the default;
              this is only for the rare case a teacher needs a different
              model. */}
          <div style={{ position: 'relative' }}>
            <button
              className="btn btn-ghost"
              onClick={() => setModelMenuOpen((v) => !v)}
              aria-label="Schedule settings"
              title="Schedule settings"
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 11px',
                border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)',
                color: 'var(--text)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Icons.Settings2 size={14} />
              <span>{activeTemplate.name}</span>
            </button>
            {modelMenuOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setModelMenuOpen(false)} />
                <div style={{
                  position: 'absolute', top: '110%', right: 0, zIndex: 41,
                  background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10,
                  padding: 6, minWidth: 140, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  display: 'flex', flexDirection: 'column', gap: 4,
                }}>
                  {Object.values(TIME_MODELS).map((m) => (
                    <button
                      key={m.id}
                      onClick={() => { setModelId(m.id); setModelMenuOpen(false); }}
                      style={{
                        textAlign: 'left', fontSize: 12, padding: '7px 9px', borderRadius: 7, border: 'none',
                        background: modelId === m.id ? 'rgba(59,130,246,0.1)' : 'transparent',
                        color: modelId === m.id ? 'var(--accent)' : 'var(--text)',
                        fontWeight: modelId === m.id ? 700 : 500, cursor: 'pointer',
                      }}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {loading && <div style={{ color: 'var(--muted)', fontSize: 13, padding: '20px 0' }}>Loading…</div>}

        {/* ── Today's Classes — list on top, same pattern as the student
             Attendance.jsx "Today's Classes" strip: colored left-accent
             rows, slot time first, course + batch/dept below. ── */}
        {!loading && (
          <div className="card faculty-schedule-today-card" style={{ marginTop: 10, marginBottom: 12, padding: '12px 14px', borderRadius: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icons.CalendarClock size={13} /> Today's Classes
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                {new Date().toLocaleDateString('en-BD', { weekday: 'short', day: 'numeric', month: 'short' })}
              </div>
            </div>
            {todaysClasses.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {todaysClasses.map((c, idx) => {
                  const color = getBatchColor(c.batch, batches);
                  return (
                    <div key={`${c.assignmentId}-${idx}`} style={{
                      display: 'flex', gap: 10, padding: '7px 10px', borderRadius: 10, alignItems: 'center',
                      background: `linear-gradient(180deg, ${color.bg}, ${color.bg})`,
                      border: `1px solid ${color.border}`,
                    }}>
                      <div style={{ fontWeight: 900, fontSize: 11.5, color: color.text, minWidth: 46, flexShrink: 0, fontFamily: 'JetBrains Mono, monospace' }}>
                        {slotPreview(c.slot)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.batch?.toUpperCase()} {c.dept}</div>
                        <div style={{ fontSize: 11, color: color.text, marginTop: 1, fontWeight: 700 }}>{c.courseCode} — {c.courseTitle}</div>
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

        {/* Mobile-only day switcher — the CSS (.timetable-grid:not(.full-view)
            .timetable-day-col { display: none }, .selected-day shown) hides
            every day column except the selected one on narrow screens, so
            without a way to change selectedDay a teacher on mobile would be
            stuck looking at whichever day happened to be selected on load.
            Hidden on desktop (see .mobile-preview-controls in index.css). */}
        {!loading && (
          <div className="mobile-preview-controls">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {DAYS.map((day) => (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className="btn day-chip"
                  title={day}
                  style={{
                    padding: '5px 10px', fontSize: 12, fontWeight: 600, borderRadius: 8,
                    border: selectedDay === day ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: selectedDay === day ? 'rgba(59,130,246,0.08)' : 'var(--card)',
                    color: selectedDay === day ? 'var(--accent)' : 'var(--text)',
                  }}
                >
                  {formatDayShort(day)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Full Screen sits right above the grid it controls, instead of
            up in the page header — compact icon-only button on mobile
            (label shows on wider screens via .fs-label CSS), tucked to
            the right just before the table so it reads as "a control for
            what's below" rather than a header-level action. */}
        {!loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
            <button
              className="btn btn-ghost mobile-fullscreen-btn"
              onClick={() => setFullScreenOpen(true)}
              aria-label="Open schedule full screen"
              title="Full screen"
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '5px 9px',
                border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)',
                fontSize: 11.5, fontWeight: 600, color: 'var(--text)', cursor: 'pointer',
              }}
            >
              <span className="fs-icon" aria-hidden style={{ display: 'inline-block', lineHeight: 0 }}>⤢</span>
              <span className="fs-label">Full Screen</span>
            </button>
          </div>
        )}

        {!loading && renderGrid()}

        {!loading && Object.keys(assignments).length === 0 && (
          <div style={{ marginTop: 16, padding: 24, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--muted)', fontSize: 13.5, textAlign: 'center' }}>
            No scheduled classes yet — add a class from "My Classes" to see it here.
          </div>
        )}
      </div>

      {fullScreenOpen && (
        <div className="fullscreen-overlay" onClick={() => setFullScreenOpen(false)}>
          <div className="fullscreen-content fullscreen-rotated" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Schedule Full View</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Tap an empty slot to add a class.</div>
              </div>
              <button className="btn btn-ghost" onClick={() => setFullScreenOpen(false)}>Close</button>
            </div>
            {renderGrid({ fullView: true })}
          </div>
        </div>
      )}

      {addAt && (
        <AddClassModal
          initialDay={addAt.day}
          initialSlot={addAt.slot}
          batches={batches}
          onClose={() => setAddAt(null)}
          onCreated={() => setAddAt(null)}
        />
      )}
    </div>
  );
}
