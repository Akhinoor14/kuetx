// AttendanceHero.jsx — shared presentational component.
//
// Extracted from Attendance.jsx by DEMO_MODE_FULL_PLAN_PROMPT.md Phase B
// (student slice). Verified pure before the move (see plan-prompt Phase B
// Findings): takes courses/logs/schedule/settings/combinedMode/
// combinedData/teacherRegistry as props only, no store.get()/Firestore
// calls inside the component itself or in any helper it depends on. Used
// as-is by the real Attendance.jsx AND by the student demo dashboard
// (Phase C) with demo-data props — same component, two data sources, zero
// duplicated JSX.
//
// This is a straight move of the previous BLOCKED approach's lesson (see
// plan-prompt "Phase 2.3 BLOCKED" finding): unlike the old Option A (whole
// PAGE reuse via props, which failed because Dashboard/Schedule/Attendance
// read from store.js in a dozen scattered places and open inline Firestore
// subscriptions), this moves only an already-isolated, already-pure
// sub-component. No page-level data-flow is being changed.
import { useMemo, useRef, useState, useEffect } from 'react';
import { BookOpen } from 'lucide-react';
import {
  isAutoFull, getTeachersForCourse, getEffectiveForCourse, getFullCourseMarks,
  classesUntilDrop, classesNeededForNextSlab, getCurrentSlab, getHint,
  attColor, attBg, attBorder, getDisplayCourseName,
} from './attendanceHeroHelpers';

// Local to this component (was local to Attendance.jsx too) — reads only
// document.documentElement's class list, no store/Firestore involvement.
function useDark() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

export default function AttendanceHero({ courses, logs, schedule, settings, combinedMode, combinedData, teacherRegistry }) {
  const dark = useDark();
  const theory = (courses || []).filter(c => !isAutoFull(c.type));

  // Stable initial order — computed once, never re-sorted on data change
  const stableOrder = useRef(null);

  const stats = useMemo(() => {
    const computed = theory.map(c => {
      let totalHeld = 0, totalAttended = 0;
      if (combinedMode) {
        const teachers = getTeachersForCourse(settings, schedule, c.id, teacherRegistry);
        const ts = teachers.length ? teachers : [''];
        ts.forEach(t => {
          const key = `${c.id}_${t || ''}`;
          totalHeld += Number(combinedData[key]?.held || 0);
          totalAttended += Number(combinedData[key]?.attended || 0);
        });
      } else {
        const s = getEffectiveForCourse(c.id, logs);
        totalHeld = s.held; totalAttended = s.attended;
      }
      const pct = totalHeld > 0 ? Math.round((totalAttended / totalHeld) * 100) : null;
      const canMiss = pct !== null ? classesUntilDrop(totalAttended, totalHeld, pct) : null;
      const needNext = pct !== null && pct < 90 ? classesNeededForNextSlab(totalAttended, totalHeld, pct) : null;
      return {
        c, pct, totalHeld, totalAttended,
        fullMarks: getFullCourseMarks(pct),
        canMiss, needNext,
        slab: getCurrentSlab(pct),
        hint: getHint(pct, canMiss, needNext),
      };
    });

    if (!stableOrder.current) {
      const sorted = computed.slice().sort((a, b) => {
        const r = p => p === null ? 3 : p < 60 ? 0 : p < 75 ? 1 : 2;
        return r(a.pct) - r(b.pct);
      });
      stableOrder.current = sorted.map(s => s.c.id);
      return sorted;
    }

    const map = new Map(computed.map(s => [s.c.id, s]));
    return stableOrder.current.map(id => map.get(id)).filter(Boolean);
  }, [theory, combinedMode, combinedData, logs, schedule, settings]);

  if (!theory.length) return (
    <div className="card" style={{ padding: '16px', textAlign: 'center', color: 'var(--muted)', marginBottom: 14 }}>
      <BookOpen size={24} strokeWidth={1.5} style={{ margin: '0 auto 6px', opacity: 0.35 }} />
      <div style={{ fontWeight: 700, fontSize: 13 }}>No active theory courses</div>
    </div>
  );

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Live Attendance</div>
        <div style={{ fontSize: 10, color: 'var(--muted)' }}>{combinedMode ? 'Manual entry' : 'Daily Log'} · {theory.length} courses</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
        {stats.map(({ c, pct, totalHeld, totalAttended, slab, hint }) => {
          const col = attColor(pct);
          const hasData = totalHeld > 0;
          const hintCol = hint?.type === 'danger' ? 'var(--danger)' : hint?.type === 'warn' ? 'var(--warning)' : hint?.type === 'good' ? 'var(--success)' : hint?.type === 'info' ? 'var(--accent)' : 'var(--muted)';

          return (
            <div
              key={c.id}
              title={getDisplayCourseName(c)}
              style={{
                background: dark ? 'rgba(255,255,255,0.02)' : '#fff',
                border: `1px solid ${attBorder(pct, dark)}`,
                borderRadius: 12,
                padding: '10px 12px',
                display: 'flex', flexDirection: 'column', gap: 6,
                boxShadow: dark ? 'none' : '0 1px 2px rgba(0,0,0,0.03)',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <div style={{ fontWeight: 800, fontSize: 13.5, letterSpacing: '0.01em', lineHeight: 1.2 }}>
                  {c.code}
                </div>
                {hasData ? (
                  <div style={{
                    flexShrink: 0, minWidth: 40, height: 22, borderRadius: 999,
                    background: attBg(pct, dark), border: `1px solid ${col}`,
                    color: col,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: 12, lineHeight: 1, paddingInline: 7,
                  }}>
                    {pct}<span style={{ fontSize: 8, fontWeight: 700, marginLeft: 1 }}>%</span>
                  </div>
                ) : (
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>—</div>
                )}
              </div>

              <div style={{ height: 4, background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                {hasData && (
                  <div style={{ height: '100%', borderRadius: 99, width: `${Math.min(100, pct)}%`, background: col, transition: 'width 0.5s ease' }} />
                )}
              </div>

              <div style={{ fontSize: 10.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                {hasData ? (
                  <>
                    <span style={{ color: 'var(--muted)' }}>{totalAttended}/{totalHeld} classes</span>
                    <span style={{ color: col, fontWeight: 700 }}>{slab?.label}</span>
                  </>
                ) : (
                  <span style={{ color: 'var(--muted)' }}>No data yet</span>
                )}
              </div>

              {hint && (
                <div style={{ fontSize: 10.5, color: hintCol, fontWeight: 700, lineHeight: 1.2 }}>{hint.text}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
