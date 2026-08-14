// StudentDemoDashboard.jsx — Phase C of DEMO_MODE_FULL_PLAN_PROMPT.md.
//
// Renders inside LandingPage's mockup/full-screen area when the visitor
// selects the Student role card. Reuses the two shared components
// extracted in Phase B (StatCard, AttendanceHero) with demoWorld.js's
// static data — same components the real signed-in Dashboard/Attendance
// pages use, zero duplicated JSX for those two pieces.
//
// ⚠️ Real Sidebar.jsx/BottomNav.jsx NOT reused here — see this file's
// Phase C Findings in the plan-prompt for why. Both call auth.currentUser,
// getProfile() (the REAL local store, not demo data), and hooks
// (useViewMode/useIsStaff/useIsProvider) that read localStorage/Firestore
// directly; there is no isDemoMode prop today for either component, and
// building one safely is real work (verifying every branch behaves for a
// signed-out visitor with no real profile) that hasn't been done yet.
// Forcing the real nav in here today risked either a crash or, worse,
// silently reading a stale real session left in this browser's
// localStorage from a previous sign-in on the same device. This file uses
// a small purpose-built nav strip instead — visually distinct enough not
// to be mistaken for the real app's chrome, per owner instruction to keep
// the demo visitor's real experience 100% safe over matching the plan's
// original nav-reuse instruction to the letter.
import { GraduationCap, CalendarCheck, ClipboardList, BookOpen, Store, Bell, ChevronRight, CalendarDays } from 'lucide-react';
import StatCard from './shared/StatCard';
import AttendanceHero from './shared/AttendanceHero';
import { DEMO_WORLD_STUDENT } from '../data/demoWorld';

// Phase C (session 7) — demo-only grade summary, mirrors Marks.jsx's
// CourseListRow output shape ({ currentTotal, currentGrade, hasAnyEntry })
// WITHOUT calling the real getCourseSummary()/computeEffectiveAttendance()
// chain, which reads store.js directly (see this file's Phase C Findings
// in the plan-prompt, point 4 — CourseListRow was found impure for
// exactly this reason, so it isn't reused here). hall+ctTeacher1+
// ctTeacher2 out of 300 total, same numbers demoWorld.js's marks object
// already carries — not inventing a different total.
function demoGradeFromMarks(m) {
  if (!m) return { total: 0, hasAnyEntry: false };
  const total = (m.hall || 0) + (m.ctTeacher1 || 0) + (m.ctTeacher2 || 0);
  return { total, hasAnyEntry: total > 0 };
}

export default function StudentDemoDashboard() {
  const {
    profile, courses, attendanceCombined, scheduleSettings, marks, notices, activeBooking, schedulePreview,
  } = DEMO_WORLD_STUDENT;

  // Same shape AttendanceHero/getEffectiveForCourse would read from real
  // per-day logs — combinedMode=true means AttendanceHero reads
  // attendanceCombined directly instead, so an empty logs object here is
  // correct and unused, not a bug.
  const emptyLogs = {};

  // Overall attendance average across demo courses — a plain average of
  // the per-course pct values, purely for the top stat tile (mirrors the
  // kind of summary StatCard shows on the real Dashboard). Iterates
  // attendanceCombined's own values directly rather than reconstructing
  // `${courseId}_${teacherName}` keys here — demoWorld.js now derives a
  // different teacher name per course (see its Phase D reconciliation
  // note), so re-deriving that mapping in this file too would be a second
  // place to keep in sync and a second place to get wrong.
  const combinedEntries = Object.values(attendanceCombined);
  const avgAttendance = Math.round(
    combinedEntries.reduce((sum, a) => {
      const pct = a.held > 0 ? (a.attended / a.held) * 100 : 0;
      return sum + pct;
    }, 0) / combinedEntries.length
  );

  const totalMarksEntries = Object.keys(marks).length;

  return (
    <div style={{ minHeight: '100%', background: 'var(--bg)' }}>
      {/* Purpose-built demo nav strip — deliberately NOT the real
          Sidebar/BottomNav, see file header comment. */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.7rem 1rem', borderBottom: '1px dashed var(--border)',
        background: 'rgba(var(--accentRGB), 0.04)',
      }}>
        <GraduationCap size={16} style={{ color: 'var(--accent)' }} />
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)' }}>
          {profile.name} · {profile.dept} {profile.batch}
        </span>
        <span style={{
          marginLeft: 'auto', fontSize: '0.68rem', fontWeight: 700,
          color: 'var(--muted)', padding: '0.2rem 0.5rem', borderRadius: '999px',
          border: '1px solid var(--border)',
        }}>
          Preview — read only
        </span>
      </div>

      <div style={{ padding: '1rem' }}>
        {/* Stat tiles — real StatCard component, demo props */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: '0.6rem', marginBottom: '1rem',
        }}>
          <StatCard
            label="Attendance"
            value={`${avgAttendance}%`}
            sub="সব কোর্স গড়"
            color="#16a34a"
            icon={CalendarCheck}
          />
          <StatCard
            label="Courses"
            value={courses.length}
            sub="এই টার্মে"
            color="#2563eb"
            icon={BookOpen}
          />
          <StatCard
            label="Marks Entries"
            value={totalMarksEntries}
            sub="ট্র্যাক করা"
            color="#d97706"
            icon={ClipboardList}
          />
        </div>

        {/* Live Attendance hero — real AttendanceHero component, demo props */}
        <AttendanceHero
          courses={courses}
          logs={emptyLogs}
          schedule={[]}
          settings={scheduleSettings}
          combinedMode={true}
          combinedData={attendanceCombined}
          teacherRegistry={null}
        />

        {/* Marks list — Phase C (session 7). Demo-only presentational row,
            NOT the real Marks.jsx CourseListRow (that component calls
            getCourseSummary() -> computeEffectiveAttendance(), both
            store.js-coupled — see this file's Phase C Findings, point 4).
            Same visual language (code/name + grade% or "Not started"),
            using demoGradeFromMarks() above instead. No onClick/onOpen —
            read-only per Phase C's write-trigger-hide requirement. */}
        <div className="card" style={{ padding: '12px 14px', marginTop: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
            <ClipboardList size={14} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>
              Marks
            </span>
          </div>
          {courses.map((c) => {
            const { total, hasAnyEntry } = demoGradeFromMarks(marks[c.id]);
            const pct = hasAnyEntry ? Math.round((total / 300) * 100) : null;
            return (
              <div key={c.id} style={{ padding: '0.4rem 0', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)' }}>{c.code}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{c.name}</div>
                </div>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: hasAnyEntry ? 'var(--accent)' : 'var(--muted)' }}>
                  {hasAnyEntry ? `${pct}%` : 'Not started'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Schedule preview — Phase C (session 7). Reads GUEST_SCHEDULE
            (day-grouped, nested slots) directly — this is exactly the
            shape it was already built for (old /guest/* pages used it
            the same way), no reshaping needed here unlike
            attendanceCombined's AttendanceHero mismatch. Shows today's
            slots only, or the first day with any slots as a fallback
            preview if "today" has none in this fixed demo week. */}
        <div className="card" style={{ padding: '12px 14px', marginTop: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
            <CalendarDays size={14} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>
              Schedule
            </span>
          </div>
          {(() => {
            const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
            const day = schedulePreview.find((d) => d.day === todayName) || schedulePreview[0];
            if (!day || !day.slots?.length) return null;
            return (
              <>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', marginBottom: '0.3rem' }}>
                  {day.day}
                </div>
                {day.slots.map((s, i) => {
                  const course = courses.find((c) => c.id === s.courseId);
                  return (
                    <div key={i} style={{ padding: '0.4rem 0', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)' }}>{course?.code || s.courseId}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{s.room}</div>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600 }}>{s.time}</span>
                    </div>
                  );
                })}
              </>
            );
          })()}
        </div>

        {/* Notice feed preview — simple static list, not extracted from a
            real component this pass (Phase C scope note: full Notice
            feed/Schedule preview/Shop order preview wiring still open,
            see Findings). */}
        <div className="card" style={{ padding: '12px 14px', marginTop: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
            <Bell size={14} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>
              Class Notices
            </span>
          </div>
          {notices.slice(0, 2).map((n) => (
            <div key={n.id} style={{ padding: '0.4rem 0', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)' }}>{n.title}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{n.body}</div>
            </div>
          ))}
        </div>

        {/* Phase F cross-role link: this booking is the SAME
            demo-booking-1 doc shown in the Provider demo's Bookings
            queue (linked by studentId, see demoWorld.js's Phase F
            patch comment) — not a separately invented number, so the
            student and provider demos tell one consistent story. */}
        {activeBooking ? (
          <div className="card" style={{ padding: '12px 14px', marginTop: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
              <Store size={14} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>
                My Bookings
              </span>
            </div>
            <div style={{ padding: '0.4rem 0', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)' }}>
                {activeBooking.offeringLabel} · Noor Saloon
              </div>
              <span style={{
                fontSize: '0.68rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '999px',
                color: '#d97706', background: 'rgba(217,119,6,0.1)',
              }}>
                Pending
              </span>
            </div>
          </div>
        ) : (
          <div style={{
            marginTop: '0.75rem', padding: '0.6rem 0.8rem', borderRadius: '10px',
            background: 'rgba(var(--accentRGB), 0.06)', fontSize: '0.75rem',
            color: 'var(--muted)', textAlign: 'center',
          }}>
            <Store size={12} style={{ verticalAlign: '-2px', marginRight: '0.3rem' }} />
            Campus Services ও Shop Orders — সাইন আপ করলে দেখা যাবে
          </div>
        )}
      </div>
    </div>
  );
}
