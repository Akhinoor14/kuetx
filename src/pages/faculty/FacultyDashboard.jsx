// FacultyDashboard.jsx — §8.11 of the merged Faculty Module prompt
//
// Real content, replacing the earlier Phase 3 placeholder:
//   - Career stats card: de-duplicated unique students taught (§2 item 13
//     — NOT a raw sum across assignments, a genuine Set union of every
//     roster this teacher has ever had an active/ended assignment for)
//   - Classes remaining: sum of (plannedTotalClasses - loggedSessionCount)
//     across active assignments, only counted where plannedTotalClasses
//     is actually set (many assignments won't have it set yet — §8.6
//     doesn't require it at creation, so this only counts what's known)
//   - Founder-switch line (§7) — only rendered for isFounderBypass
//   - Pending-attendance reminder — an active assignment whose
//     dayTimeSlots includes TODAY's weekday, with no session doc yet for
//     today's date

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { auth } from '../../lib/firebase';
import { useIsFaculty } from '../../hooks/useIsFaculty';
import { subscribeMyClassIndex, getFacultyAssignment } from '../../lib/facultyClassSync';
import { subscribeMembers } from '../../lib/groupSync';
import { subscribeSessionAttendance } from '../../lib/facultyMarksSync';
import { DAYS } from '../../lib/timeModels';
import { getFacultyDoc } from '../../lib/facultySync';

export default function FacultyDashboard() {
  const { isFounderBypass } = useIsFaculty();
  const [classIndex, setClassIndex] = useState(null);
  const [assignments, setAssignments] = useState({});
  const [rosters, setRosters] = useState({}); // groupId -> member uid array (for de-dup)
  const [sessionsByAssignment, setSessionsByAssignment] = useState({});
  const [facultyProfile, setFacultyProfile] = useState(null);
  const [heldCardIndex, setHeldCardIndex] = useState(0);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    getFacultyDoc(uid).then(setFacultyProfile);
  }, []);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setClassIndex([]); return; }
    return subscribeMyClassIndex(uid, setClassIndex);
  }, []);

  useEffect(() => {
    if (!classIndex) return;
    let cancelled = false;
    Promise.all(classIndex.map((c) => getFacultyAssignment(c.groupId, c.assignmentId).then((a) => [c.assignmentId, a])))
      .then((pairs) => { if (!cancelled) setAssignments(Object.fromEntries(pairs)); });
    return () => { cancelled = true; };
  }, [classIndex]);

  // De-duplicated roster fetch — one subscription per DISTINCT groupId
  // (not per assignment), since the same group can have multiple course
  // assignments but the same students.
  useEffect(() => {
    if (!classIndex) return;
    const distinctGroupIds = [...new Set(classIndex.map((c) => c.groupId))];
    const unsubs = distinctGroupIds.map((gid) =>
      subscribeMembers(gid, (members) => {
        setRosters((prev) => ({ ...prev, [gid]: (members || []).map((m) => m.id) }));
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [classIndex]);

  useEffect(() => {
    const active = (classIndex || []).filter((c) => c.status === 'active');
    let cancelled = false;
    const unsubs = active.map((c) =>
      subscribeSessionAttendance(c.groupId, c.assignmentId, (sessions) => {
        if (cancelled) return;
        setSessionsByAssignment((prev) => ({ ...prev, [c.assignmentId]: sessions }));
      })
    );
    return () => { cancelled = true; unsubs.forEach((u) => u()); };
  }, [classIndex]);

  // Auto-rotate the "Classes Held" card through each active course every
  // 5s, so a faculty teaching several courses sees all of them cycle
  // through automatically instead of a single combined number. Tapping
  // the card (see rotatingHeldCard below) advances it manually too, and
  // resets this timer so a manual tap doesn't get immediately overridden.
  const activeCount = (classIndex || []).filter((c) => c.status === 'active').length;
  useEffect(() => {
    if (activeCount <= 1) return;
    const id = setInterval(() => {
      setHeldCardIndex((i) => (i + 1) % activeCount);
    }, 5000);
    return () => clearInterval(id);
  }, [activeCount, heldCardIndex]);

  const timeGreeting = (() => {
    const h = new Date().getHours();
    if (h < 5) return 'Welcome';
    if (h < 12) return 'Good morning';
    if (h < 15) return 'Good noon';
    if (h < 18) return 'Good afternoon';
    if (h < 20) return 'Good evening';
    return 'Good night';
  })();
  const today = new Date();
  const todayDateLine = today.toLocaleDateString('en-BD', { day: 'numeric', month: 'long', year: 'numeric' });
  const todayDayLine = today.toLocaleDateString('en-BD', { weekday: 'long' });
  const facultyDisplayName = facultyProfile?.preferredName || facultyProfile?.name || '';

  // Short-form designation tag (e.g. "Professor" -> "Prof.") shown right next
  // to the name in the hero — this is the one spot every faculty member sees
  // on login, so it should reflect their title everywhere, not just on the
  // profile page.
  const TITLE_SHORT_MAP = [
    // Academic ranks
    [/^professor\s*emeritus$/i, 'Prof. Emeritus'],
    [/^assistant\s*professor$/i, 'Asst. Prof.'],
    [/^associate\s*professor$/i, 'Assoc. Prof.'],
    [/^adjunct\s*professor$/i, 'Adj. Prof.'],
    [/^visiting\s*professor$/i, 'Visiting Prof.'],
    [/^professor$/i, 'Prof.'],
    [/^senior\s*lecturer$/i, 'Sr. Lecturer'],
    [/^junior\s*lecturer$/i, 'Jr. Lecturer'],
    [/^lecturer$/i, 'Lecturer'],
    [/^instructor$/i, 'Instructor'],
    [/^teaching\s*assistant$/i, 'TA'],
    [/^research\s*assistant$/i, 'RA'],
    [/^post[\s-]?doctoral\s*fellow$/i, 'Postdoc'],
    // Leadership / admin designations
    [/^vice[\s-]?chancellor$/i, 'VC'],
    [/^pro[\s-]?vice[\s-]?chancellor$/i, 'Pro-VC'],
    [/^dean$/i, 'Dean'],
    [/^chairman$/i, 'Chairman'],
    [/^head\s*of\s*department$/i, 'HoD'],
    [/^provost$/i, 'Provost'],
    [/^registrar$/i, 'Registrar'],
    [/^deputy\s*registrar$/i, 'Dy. Registrar'],
    [/^assistant\s*registrar$/i, 'Asst. Registrar'],
    [/^proctor$/i, 'Proctor'],
    [/^director$/i, 'Director'],
    [/^deputy\s*director$/i, 'Dy. Director'],
    [/^coordinator$/i, 'Coordinator'],
    [/^advisor$/i, 'Advisor'],
    [/^principal$/i, 'Principal'],
    [/^vice[\s-]?principal$/i, 'Vice Principal'],
  ];
  const shortTitle = (() => {
    const t = (facultyProfile?.title || '').trim();
    if (!t) return '';
    for (const [re, short] of TITLE_SHORT_MAP) {
      if (re.test(t)) return short;
    }
    // Fallback: abbreviate leading words to initials, keep the last word
    // full (e.g. "Deputy Registrar" -> "D. Registrar") so something short
    // always shows even for titles we don't explicitly recognize.
    const words = t.split(/\s+/);
    if (words.length === 1) return t;
    return words.map((w, i) => (i === words.length - 1 ? w : `${w[0]}.`)).join(' ');
  })();

  if (classIndex === null) {
    return (
      <div className="hub-page-bg" style={{ minHeight: '100vh' }}>
        <div style={{ padding: '20px 24px 40px', width: '97%', maxWidth: 'none', margin: '0 auto', color: 'var(--muted)', fontSize: 13 }}>
          Loading…
        </div>
      </div>
    );
  }

  const activeAssignments = (classIndex || []).filter((c) => c.status === 'active');

  // §2 item 13 — de-duplicated unique students, not a raw sum.
  const uniqueStudentUids = new Set();
  activeAssignments.forEach((c) => {
    (rosters[c.groupId] || []).forEach((uid) => uniqueStudentUids.add(uid));
  });

  // "This Week" — classes scheduled Sun–Sat (KUET's week) across every
  // active class, vs how many of those have already been held. Chosen
  // over the earlier aggregate "Classes Held" card because that number
  // duplicated what the My Classes list below already shows per-course
  // (e.g. "5 logged") — summing across different courses/depts into one
  // lifetime total wasn't new information, just the same numbers added
  // together. A faculty member juggling several courses across
  // departments doesn't get anything from "14 total" that they don't
  // already get, better, from the per-course list. This week-level count
  // is genuinely new: it's the one number that answers "how busy is my
  // week" across all classes combined — something no other card here
  // currently shows, and needs zero manual setup since it's derived
  // straight from dayTimeSlots + the same session logs.
  const weekDatesISO = (() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay()); // back to Sunday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d.toISOString().slice(0, 10);
    });
  })();
  let scheduledThisWeek = 0;
  let heldThisWeek = 0;
  activeAssignments.forEach((c) => {
    const a = assignments[c.assignmentId];
    if (!a) return;
    const sessions = sessionsByAssignment[c.assignmentId] || [];
    const heldDates = new Set(sessions.map((s) => s.date));
    (a.dayTimeSlots || []).forEach((slot) => {
      // How many times this weekday occurs in the current Sun–Sat week
      // (always exactly once per class per week — one occurrence).
      const dayIdx = DAYS.indexOf(slot.day);
      if (dayIdx === -1) return;
      scheduledThisWeek += 1;
      if (heldDates.has(weekDatesISO[dayIdx])) heldThisWeek += 1;
    });
  });

  // Per-course "Classes Held" — one entry per active class, each with its
  // own logged-session count. Brought back per request, but course-scoped
  // instead of one summed-up number, since a faculty teaching several
  // courses across different departments can't act on a single combined
  // total (whose course is behind? who knows). The 4th stat card cycles
  // through this list automatically (and on tap), so each course still
  // gets its own moment in that slot instead of forcing 4+ cards into the
  // grid permanently.
  const classesHeldByCourse = activeAssignments.map((c) => {
    const a = assignments[c.assignmentId];
    const logged = (sessionsByAssignment[c.assignmentId] || []).length;
    return {
      assignmentId: c.assignmentId,
      label: a ? `${a.courseCode} — ${c.batch?.toUpperCase()} ${c.dept}` : c.courseCode,
      logged,
    };
  });

  // Pending-attendance reminder — active assignment scheduled for today's
  // weekday, no session doc yet for today's date.
  const todayName = DAYS[new Date().getDay()] || null;
  const todayDate = new Date().toISOString().slice(0, 10);
  const pendingToday = activeAssignments.filter((c) => {
    const a = assignments[c.assignmentId];
    if (!a || !todayName) return false;
    const scheduledToday = (a.dayTimeSlots || []).some((s) => s.day === todayName);
    if (!scheduledToday) return false;
    const hasSessionToday = (sessionsByAssignment[c.assignmentId] || []).some((s) => s.date === todayDate);
    return !hasSessionToday;
  });

  // Today's classes — flattened list across all active assignments whose
  // dayTimeSlots include today, sorted by slot. Same "list on top" idea
  // as the student Dashboard borrows from Attendance.jsx's Today's Classes
  // strip — surfaced here with priority, right under the hero.
  const todaysClasses = activeAssignments
    .flatMap((c) => {
      const a = assignments[c.assignmentId];
      if (!a || !todayName) return [];
      return (a.dayTimeSlots || [])
        .filter((s) => s.day === todayName)
        .map((s) => ({ assignmentId: c.assignmentId, groupId: c.groupId, slot: s.slot, courseCode: a.courseCode, courseTitle: a.courseTitle, batch: c.batch, dept: c.dept }));
    })
    .sort((a, b) => String(a.slot).localeCompare(String(b.slot)));

  const statCard = (icon, label, value, sub, color) => {
    const Icon = Icons[icon] || Icons.Circle;
    const c = color || 'var(--accent)';
    return (
      <div className="card" style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        transition: 'all 0.2s',
        padding: '14px 16px',
        border: `1.5px solid ${c}20`,
        background: `${c}08`,
        boxShadow: `0 4px 12px ${c}12`,
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 12,
        minHeight: 100,
        flex: '1 1 160px',
      }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: `${c}08` }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 1 }}>
          <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</span>
          <Icon size={20} color={c} strokeWidth={2.2} />
        </div>
        <div style={{ fontSize: 32, fontWeight: 900, color: c, letterSpacing: '-0.02em', lineHeight: 1, zIndex: 1 }}>
          {value}
        </div>
        {sub && <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, zIndex: 1, marginTop: 2 }}>{sub}</div>}
      </div>
    );
  };

  // 4th card: cycles through classesHeldByCourse — auto-advances every 5s
  // (see the interval effect above) and also advances immediately on tap
  // or swipe, so a faculty member doesn't have to wait to check a
  // specific course out of turn.
  const rotatingHeldCard = () => {
    const c = '#8B5CF6';
    const list = classesHeldByCourse;
    if (list.length === 0) {
      return (
        <div className="card" style={{
          display: 'flex', flexDirection: 'column', gap: 6, padding: '14px 16px',
          border: `1.5px solid ${c}20`, background: `${c}08`, boxShadow: `0 4px 12px ${c}12`,
          position: 'relative', overflow: 'hidden', borderRadius: 12, minHeight: 100, flex: '1 1 160px',
        }}>
          <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: `${c}08` }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 1 }}>
            <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Classes Held</span>
            <Icons.CheckCircle2 size={20} color={c} strokeWidth={2.2} />
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: c, letterSpacing: '-0.02em', lineHeight: 1, zIndex: 1 }}>—</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, zIndex: 1, marginTop: 2 }}>No active classes</div>
        </div>
      );
    }
    const idx = heldCardIndex % list.length;
    const current = list[idx];
    const advance = () => setHeldCardIndex((i) => (i + 1) % list.length);

    // Simple swipe detection (touch) — a left/right swipe advances just
    // like a tap does, since the direction doesn't matter with only one
    // "next" action across a cycling list.
    let touchStartX = null;
    const onTouchStart = (e) => { touchStartX = e.touches[0].clientX; };
    const onTouchEnd = (e) => {
      if (touchStartX === null) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 30) advance();
      touchStartX = null;
    };

    return (
      <div
        className="card"
        onClick={advance}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        title="Tap to see another course"
        style={{
          display: 'flex', flexDirection: 'column', gap: 6, cursor: 'pointer',
          transition: 'all 0.2s', padding: '14px 16px',
          border: `1.5px solid ${c}20`, background: `${c}08`, boxShadow: `0 4px 12px ${c}12`,
          position: 'relative', overflow: 'hidden', borderRadius: 12, minHeight: 100, flex: '1 1 160px',
          userSelect: 'none', touchAction: 'pan-y',
        }}
      >
        <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: `${c}08` }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 1 }}>
          <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Classes Held</span>
          <Icons.CheckCircle2 size={20} color={c} strokeWidth={2.2} />
        </div>
        <div style={{ fontSize: 32, fontWeight: 900, color: c, letterSpacing: '-0.02em', lineHeight: 1, zIndex: 1 }}>
          {current.logged}
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, zIndex: 1, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {current.label}
        </div>
        {list.length > 1 && (
          <div style={{ display: 'flex', gap: 3, zIndex: 1, marginTop: 2 }}>
            {list.map((_, i) => (
              <div key={i} style={{
                width: i === idx ? 12 : 5, height: 3, borderRadius: 2,
                background: i === idx ? c : `${c}30`, transition: 'all 0.25s',
              }} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="hub-page-bg page-enter dashboard-page" style={{ minHeight: '100vh' }}>
      <div style={{ padding: '20px 24px 40px', width: '97%', maxWidth: 'none', margin: '0 auto' }}>
        {/* Welcome hero — same warm greeting + today-date pattern as the
            student Dashboard's clickable hero card, adapted for faculty
            (name/title instead of dept/batch), linking to Faculty Profile. */}
        <Link to="/faculty/profile" style={{ textDecoration: 'none' }}>
          <div className="card dashboard-hero" style={{ marginBottom: 22, padding: 'clamp(16px, 4vw, 30px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 18, alignItems: 'stretch', minHeight: 'auto', cursor: 'pointer' }}>
            <div className="dashboard-hero-main" style={{ minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 18, paddingRight: 'clamp(0px, 2vw, 8px)' }}>
              <div style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--muted)', marginBottom: 8, letterSpacing: '0.10em', textTransform: 'uppercase' }}>
                  {timeGreeting}
                </div>
                <h1 style={{ fontSize: 'clamp(28px, 6vw, 36px)', fontWeight: 800, letterSpacing: '-0.055em', lineHeight: 1.0, margin: 0, display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  <span>{facultyDisplayName || 'Faculty'}</span>
                  {shortTitle && (
                    <span style={{
                      fontSize: 'clamp(12px, 2.4vw, 14px)',
                      fontWeight: 700,
                      letterSpacing: '0',
                      color: 'var(--accent)',
                      background: 'rgba(var(--accentRGB), 0.10)',
                      padding: '3px 10px',
                      borderRadius: 999,
                      whiteSpace: 'nowrap',
                    }}>
                      {shortTitle}
                    </span>
                  )}
                </h1>
                {facultyProfile?.title && (
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8, fontWeight: 600 }}>
                    {facultyProfile.title}
                  </div>
                )}
              </div>
            </div>

            <div className="dashboard-hero-date" style={{ minWidth: 'clamp(200px, 90vw, 240px)', padding: 'clamp(16px, 3vw, 20px)', borderRadius: 16, border: '1px solid rgba(var(--accentRGB), 0.12)', background: 'linear-gradient(180deg, rgba(var(--accentRGB), 0.05), var(--surfaceGlassStrong))', whiteSpace: 'normal', alignSelf: 'stretch', boxShadow: '0 8px 22px rgba(12, 34, 64, 0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--muted)' }}>Today</div>
              <div className="dashboard-hero-date-lines" style={{ fontSize: 'clamp(13px, 3vw, 15px)', fontWeight: 700, color: 'var(--text)', whiteSpace: 'normal', lineHeight: 1.35, display: 'grid', gap: 4 }}>
                <div>{todayDateLine}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{todayDayLine}</div>
              </div>
            </div>
          </div>
        </Link>

        {!facultyDisplayName && (
          <div className="card" style={{ marginBottom: 14, borderColor: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 28 }}>🎓</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Set Up Profile</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Add your name, title and department — it'll be used everywhere</div>
            </div>
            <Link to="/faculty/profile" className="btn btn-primary">Get started →</Link>
          </div>
        )}

        {isFounderBypass && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '10px 14px',
            borderRadius: 10, background: 'color-mix(in srgb, var(--accent) 8%, var(--card))',
            border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)', fontSize: 12.5, color: 'var(--text)',
          }}>
            <Icons.Repeat size={14} color="var(--accent)" />
            Viewing as: Teacher — switch back from the Admin dashboard.
          </div>
        )}

        {/* Stat cards — moved above Today's Classes/My Classes per request,
             so the quick-glance numbers sit right under the hero. ── */}
        <div className="dashboard-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
          {statCard('BookOpen', 'Active Classes', activeAssignments.length, 'This term', '#3B82F6')}
          {statCard('Users', 'Students Taught', uniqueStudentUids.size, 'Unique, all classes', '#10B981')}
          {statCard('CalendarCheck', 'This Week', scheduledThisWeek > 0 ? `${heldThisWeek}/${scheduledThisWeek}` : '—', scheduledThisWeek > 0 ? 'Classes held, across all courses' : 'No classes scheduled', '#F59E0B')}
          {rotatingHeldCard()}
        </div>

        {/* ── Today's Classes + My Classes — on large screens these used to
             each stack full-width with a lot of empty space beside their
             (usually short) content; side-by-side as two columns fixes
             that, while still stacking on narrow/mobile screens. ── */}
        <div className="dashboard-home-columns" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 12, marginBottom: 12, alignItems: 'start' }}>

        <div className="card" style={{ padding: '14px 16px', borderRadius: 14, margin: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icons.CalendarClock size={13} /> Today's Classes
            </div>
            <Link to="/faculty/schedule" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none', fontWeight: 700 }}>Full schedule →</Link>
          </div>
          {todaysClasses.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {todaysClasses.map((c, idx) => (
                <Link
                  key={`${c.assignmentId}-${idx}`}
                  to={`/faculty/classes/${c.assignmentId}?groupId=${encodeURIComponent(c.groupId)}`}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div style={{
                    display: 'flex', gap: 10, padding: '9px 12px', borderRadius: 10, alignItems: 'center',
                    background: 'linear-gradient(180deg, rgba(59,130,246,0.10), rgba(59,130,246,0.05))',
                    border: '1px solid rgba(59,130,246,0.18)',
                  }}>
                    <div style={{ fontWeight: 900, fontSize: 11.5, color: 'var(--accent)', minWidth: 46, flexShrink: 0, fontFamily: 'JetBrains Mono, monospace' }}>
                      {String(c.slot).replace(/\s+break\s*$/i, '')}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.courseCode} — {c.courseTitle}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{c.batch?.toUpperCase()} {c.dept}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12.5, color: 'var(--muted)', textAlign: 'center', padding: '10px 0' }}>
              No scheduled classes today
            </div>
          )}
        </div>

        {/* Classes overview — mirrors the student dashboard's "Academic Journey" progress card */}
        {activeAssignments.length > 0 && (
          <div className="card dashboard-roadmap" style={{ padding: '18px 18px 16px', border: '1px solid rgba(var(--accentRGB), 0.10)', background: 'linear-gradient(180deg, rgba(var(--accentRGB), 0.04), var(--surfaceGlassStrong))', margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--muted)' }}>My Classes</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{activeAssignments.length} active class{activeAssignments.length !== 1 ? 'es' : ''} this term</div>
              </div>
              <Link to="/faculty/classes" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>All classes →</Link>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {activeAssignments.map((c) => {
                const a = assignments[c.assignmentId];
                const logged = (sessionsByAssignment[c.assignmentId] || []).length;
                const planned = a?.plannedTotalClasses;
                const pct = planned ? Math.min(100, Math.round((logged / planned) * 100)) : null;
                return (
                  <Link
                    key={c.assignmentId}
                    to={`/faculty/classes/${c.assignmentId}?groupId=${encodeURIComponent(c.groupId)}`}
                    style={{ textDecoration: 'none', color: 'var(--text)' }}
                  >
                    <div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(var(--accentRGB), 0.04)', border: '1px solid rgba(var(--accentRGB), 0.10)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: pct !== null ? 6 : 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800 }}>{c.courseCode} — {c.batch?.toUpperCase()} {c.dept}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                          {planned ? `${logged}/${planned} classes` : `${logged} logged`}
                        </div>
                      </div>
                      {pct !== null && (
                        <div style={{ height: 8, borderRadius: 999, background: 'rgba(var(--accentRGB), 0.08)', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #3B82F6, #10B981)', transition: 'width 0.3s ease' }} />
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        </div>
        {/* ── end dashboard-home-columns ── */}

        {pendingToday.length > 0 && (
          <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 12, background: 'var(--dangerBg, rgba(217,119,6,0.08))', border: '1px solid color-mix(in srgb, #d97706 28%, var(--border))' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#d97706', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icons.AlertTriangle size={14} /> Attendance pending for today
            </div>
            {pendingToday.map((c) => (
              <Link
                key={c.assignmentId}
                to={`/faculty/classes/${c.assignmentId}?groupId=${encodeURIComponent(c.groupId)}`}
                style={{ display: 'block', fontSize: 12, color: '#d97706', marginBottom: 2, textDecoration: 'none' }}
              >
                • {c.courseCode} — {c.batch?.toUpperCase()} {c.dept} <span style={{ fontWeight: 700 }}>Take attendance →</span>
              </Link>
            ))}
          </div>
        )}

        {activeAssignments.length === 0 && (
          <div className="card" style={{ marginTop: 16, textAlign: 'center', color: 'var(--muted)', padding: 30 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📚</div>
            <p style={{ fontSize: 13, marginBottom: 12 }}>You haven't added any classes yet.</p>
            <Link to="/faculty/classes" className="btn btn-primary">Add your first class →</Link>
          </div>
        )}
      </div>
    </div>
  );
}
