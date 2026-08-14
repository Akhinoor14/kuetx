// FacultyDemoDashboard.jsx — Phase D (D.2–D.6) of DEMO_MODE_FULL_PLAN_PROMPT.md.
//
// ⚠️ Course-correction from the plan-prompt's original D.2–D.4 framing:
// the original plan described D.2/D.3/D.4 as "make NoticesTab/ScheduleTab/
// QuestionBankTab props-driven". Reading those three components in full
// (FacultyClassDetail.jsx) this session showed they're deeply Firestore-
// coupled — live subscriptions (noticeApi.subscribeAllNotices), real
// writes (postFacultyNotice, deleteNoticeSoft), auth.currentUser reads —
// not presentational components with a store dependency bolted on top.
// That's the SAME situation Phase C hit and already resolved for the
// student side (see StudentDemoDashboard.jsx's own file-header note:
// "real pages too deeply coupled to Firestore singletons for data
// injection"), and the precedent set there was a hand-built, purely
// presentational demo dashboard, not a converted real component. This
// file follows that exact precedent for faculty, rather than re-opening
// the harder (and here, riskier — these components send real notices)
// props-injection path Phase C already tried and moved away from.
//
// StatCard is reused as-is (same pure shared component the real
// FacultyDashboard-style pages use) with DEMO_WORLD_FACULTY props — same
// zero-duplicated-JSX pattern as the student side. MeetingCard was NOT
// reused here even though Phase D.5 confirmed it pure/movable, because it
// lives as a non-exported local function inside FacultyMeetings.jsx —
// extracting it to src/components/shared/ so it could be imported here is
// out of scope for this pass (would be its own verifiable step, not
// bundled silently into D.2). The meeting list below is a small
// intentionally-simplified static rendering instead, matching the
// "simple static list" precedent StudentDemoDashboard.jsx already set for
// its own Notice feed preview.
import { Users, CalendarClock, Bell, ClipboardList, FileQuestion } from 'lucide-react';
import StatCard from './shared/StatCard';
import { DEMO_WORLD_FACULTY } from '../data/demoWorld';

export default function FacultyDemoDashboard() {
  const { profile, classes, notices, questionBank, meetings } = DEMO_WORLD_FACULTY;

  const totalStudents = classes.reduce((sum, c) => sum + (c.studentCount || 0), 0);

  return (
    <div style={{ minHeight: '100%', background: 'var(--bg)' }}>
      {/* Purpose-built demo nav strip — mirrors StudentDemoDashboard.jsx's
          own strip exactly (same reasoning: real Sidebar/BottomNav read
          auth.currentUser / real local store, unsafe to reuse here for a
          signed-out visitor). */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.7rem 1rem', borderBottom: '1px dashed var(--border)',
        background: 'rgba(var(--accentRGB), 0.04)',
      }}>
        <Users size={16} style={{ color: 'var(--accent)' }} />
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)' }}>
          {profile.name} · {profile.designation}
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
            label="Classes"
            value={classes.length}
            sub="এই টার্মে"
            color="#2563eb"
            icon={Users}
          />
          <StatCard
            label="Students"
            value={totalStudents}
            sub="মোট"
            color="#16a34a"
            icon={ClipboardList}
          />
          <StatCard
            label="Meetings"
            value={meetings.length}
            sub="আসন্ন"
            color="#d97706"
            icon={CalendarClock}
          />
        </div>

        {/* Classes list — simple static list, same precedent as
            StudentDemoDashboard.jsx's Notice feed preview (not extracted
            from a real component this pass). */}
        <div className="card" style={{ padding: '12px 14px', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
            <Users size={14} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>
              My Classes
            </span>
          </div>
          {classes.map((c) => (
            <div key={c.id} style={{ padding: '0.4rem 0', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)' }}>
                {c.courseCode} · {c.courseName}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                {c.section} section · {c.batch} · {c.studentCount} students
              </div>
            </div>
          ))}
        </div>

        {/* Notice feed preview — mirrors student side's card exactly */}
        <div className="card" style={{ padding: '12px 14px', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
            <Bell size={14} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>
              Sent Notices
            </span>
          </div>
          {notices.slice(0, 2).map((n) => (
            <div key={n.id} style={{ padding: '0.4rem 0', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)' }}>{n.title}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{n.body}</div>
            </div>
          ))}
        </div>

        {/* Question Bank preview — same static-list precedent */}
        <div className="card" style={{ padding: '12px 14px', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
            <FileQuestion size={14} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>
              Question Bank
            </span>
          </div>
          {questionBank.map((q) => (
            <div key={q.id} style={{ padding: '0.4rem 0', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)' }}>{q.title}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{q.type} · {q.year}</div>
            </div>
          ))}
        </div>

        {/* Meetings preview — small static rendering, NOT the real
            MeetingCard (see file header note on why it wasn't extracted
            this pass) */}
        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
            <CalendarClock size={14} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>
              Upcoming Meetings
            </span>
          </div>
          {meetings.slice(0, 3).map((m) => (
            <div key={m.id} style={{ padding: '0.4rem 0', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)' }}>{m.title}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                {m.date}{m.time ? ` · ${m.time}` : ''}{m.location ? ` · ${m.location}` : ''}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
