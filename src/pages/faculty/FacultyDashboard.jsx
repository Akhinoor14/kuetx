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
import { getShortTitle } from '../../lib/facultyTitle';
import * as noticeApi from '../../lib/noticeUtils';

export default function FacultyDashboard() {
  const { isFounderBypass } = useIsFaculty();
  const [classIndex, setClassIndex] = useState(null);
  const [assignments, setAssignments] = useState({});
  const [rosters, setRosters] = useState({}); // groupId -> member uid array (for de-dup)
  const [sessionsByAssignment, setSessionsByAssignment] = useState({});
  const [facultyProfile, setFacultyProfile] = useState(null);
  const [heldCardIndex, setHeldCardIndex] = useState(0);
  const [sentNotices, setSentNotices] = useState([]);
  const [alertsExpanded, setAlertsExpanded] = useState(false);
  const [classesViewMode, setClassesViewMode] = useState('grid');
  // Blue Tick — same verification signal used to gate Add Class/Broadcast
  // elsewhere (FacultyClasses.jsx, FacultyNoticeBroadcast.jsx): Founder
  // bypass always counts as verified, otherwise a real verifiedAt timestamp
  // on the faculty doc is required.
  const isVerified = isFounderBypass || !!facultyProfile?.verifiedAt;

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

  // Sent-notice history — same multi-group subscribe-and-merge pattern as
  // the sidebar's Broadcast Notice page (FacultyNoticeBroadcast.jsx):
  // subscribe to groups/{groupId}/notices for every DISTINCT group this
  // faculty currently teaches, filtered to 'from: Teacher' (their own
  // posts only, via subscribeAllNotices(..., 'faculty')), then merge +
  // de-dupe + sort newest-first. Shown on the dashboard so a teacher can
  // see at a glance what they've broadcast recently without opening the
  // dedicated Notices page.
  useEffect(() => {
    const distinctGroups = [...new Map((classIndex || []).filter((c) => c.status === 'active').map((c) => [c.groupId, c])).values()];
    if (!distinctGroups.length) { setSentNotices([]); return; }
    const perGroup = {};
    const unsubs = distinctGroups.map((c) =>
      noticeApi.subscribeAllNotices({}, c.groupId, (list) => {
        perGroup[c.groupId] = list;
        const merged = Object.values(perGroup).flat();
        const seen = new Set();
        const deduped = [];
        for (const n of merged) {
          if (seen.has(n.id)) continue;
          seen.add(n.id);
          deduped.push(n);
        }
        deduped.sort((a, b) => b.createdAt - a.createdAt);
        setSentNotices(deduped);
      }, 'faculty'),
    );
    return () => unsubs.forEach((u) => u());
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
  const shortTitle = getShortTitle(facultyProfile?.title);

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
      label: a ? `${c.batch?.toUpperCase()} ${c.dept} — ${a.courseCode}` : c.courseCode,
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
                  {shortTitle && (
                    <span style={{
                      fontSize: 'clamp(14px, 3vw, 18px)',
                      fontWeight: 700,
                      fontStyle: 'italic',
                      letterSpacing: '0',
                      color: 'var(--accent)',
                      whiteSpace: 'nowrap',
                    }}>
                      {shortTitle}
                    </span>
                  )}
                  <span style={{
                    fontFamily: "'Space Grotesk', 'Sora', 'Hind Siliguri', system-ui, sans-serif",
                    background: 'linear-gradient(120deg, var(--text) 55%, var(--accent) 130%)',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    color: 'transparent',
                  }}>{facultyDisplayName || 'Faculty'}</span>
                  {isVerified && (
                    <Icons.BadgeCheck
                      size={20}
                      color="#3b82f6"
                      fill="#3b82f6"
                      strokeWidth={0}
                      style={{ flexShrink: 0, alignSelf: 'center' }}
                      title="Blue Tick verified faculty"
                    />
                  )}
                </h1>
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
          {rotatingHeldCard()}
          {statCard('CalendarCheck', 'This Week', scheduledThisWeek > 0 ? `${heldThisWeek}/${scheduledThisWeek}` : '—', scheduledThisWeek > 0 ? 'Classes held, across all courses' : 'No classes scheduled', '#F59E0B')}
        </div>

        {/* ── Today's Classes + Alerts & Notices — side by side (same
             reasoning as the old Today's/My Classes pairing: two usually-
             short cards side by side reads better than each stretching
             full-width with empty space). My Classes moved to its own
             full-width row below, since a 4-class list needs more room
             than a half-width column comfortably gives it. ── */}
        <div className="dashboard-home-columns" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 12, marginBottom: 12, alignItems: 'stretch' }}>

        <div className="card" style={{ padding: '14px 16px', borderRadius: 14, margin: 0, height: '100%', minHeight: 260, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icons.CalendarClock size={13} /> Today's Classes
            </div>
            <Link to="/faculty/schedule" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none', fontWeight: 700 }}>Full schedule →</Link>
          </div>
          {todaysClasses.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              {todaysClasses.map((c, idx) => (
                <Link
                  key={`${c.assignmentId}-${idx}`}
                  to={`/faculty/classes/${c.assignmentId}?groupId=${encodeURIComponent(c.groupId)}`}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div
                    className="today-class-row"
                    style={{
                      display: 'flex', gap: 12, padding: '11px 14px', borderRadius: 12, alignItems: 'center',
                      background: 'linear-gradient(135deg, rgba(59,130,246,0.09), rgba(59,130,246,0.03))',
                      border: '1px solid rgba(59,130,246,0.16)',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
                    }}
                  >
                    <div style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      minWidth: 52, flexShrink: 0, padding: '6px 4px', borderRadius: 9,
                      background: 'rgba(59,130,246,0.12)',
                    }}>
                      <div style={{ fontWeight: 800, fontSize: 11, color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.02em', lineHeight: 1.2, textAlign: 'center' }}>
                        {String(c.slot).replace(/\s+break\s*$/i, '')}
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.batch?.toUpperCase()} {c.dept}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, fontWeight: 600 }}>{c.courseCode} — {c.courseTitle}</div>
                    </div>
                    <Icons.ChevronRight size={16} color="rgba(59,130,246,0.5)" style={{ flexShrink: 0 }} />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12.5, color: 'var(--muted)', textAlign: 'center', padding: '18px 0', display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Icons.CalendarOff size={20} color="var(--muted)" style={{ opacity: 0.5 }} />
              No scheduled classes today
            </div>
          )}
        </div>

        {/* Alerts & Notices — unifies two things that used to live in
            separate places: the "Attendance pending" reminder (was its
            own standalone block below the two-column row) and this
            teacher's own sent-notice history (previously only visible on
            the dedicated Broadcast Notice page). Combined feed, newest
            first, capped to 3 rows by default with "See more" to expand
            the rest — since between pending-attendance alerts and a
            term's worth of sent notices, showing everything at once
            would make this card taller than Today's Classes/My Classes
            almost every time. */}
        <div className="card" style={{ padding: '14px 16px', borderRadius: 14, margin: 0, height: '100%', minHeight: 260, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icons.Bell size={13} /> Alerts &amp; Notices
            </div>
            <Link to="/faculty/notices" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none', fontWeight: 700 }}>Broadcast →</Link>
          </div>
          {(() => {
            const pendingItems = pendingToday.map((c) => ({
              kind: 'pending',
              key: `pending-${c.assignmentId}`,
              c,
            }));
            const noticeItems = sentNotices.map((n) => ({
              kind: 'notice',
              key: `notice-${n.id}`,
              n,
            }));
            const allItems = [...pendingItems, ...noticeItems];
            const visibleItems = alertsExpanded ? allItems : allItems.slice(0, 3);

            if (allItems.length === 0) {
              return (
                <div style={{ fontSize: 12.5, color: 'var(--muted)', textAlign: 'center', padding: '18px 0', display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Icons.BellOff size={20} color="var(--muted)" style={{ opacity: 0.5 }} />
                  No alerts or sent notices yet
                </div>
              );
            }

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                {visibleItems.map((item) => {
                  if (item.kind === 'pending') {
                    const c = item.c;
                    return (
                      <Link
                        key={item.key}
                        to={`/faculty/classes/${c.assignmentId}?groupId=${encodeURIComponent(c.groupId)}`}
                        style={{ textDecoration: 'none' }}
                      >
                        <div style={{ padding: '9px 12px', borderRadius: 10, background: 'var(--dangerBg, rgba(217,119,6,0.08))', border: '1px solid color-mix(in srgb, #d97706 28%, var(--border))', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Icons.AlertTriangle size={14} color="#d97706" style={{ flexShrink: 0 }} />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#d97706' }}>Attendance pending</div>
                            <div style={{ fontSize: 11, color: '#d97706', opacity: 0.85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {c.batch?.toUpperCase()} {c.dept} — {c.courseCode} · Take attendance →
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  }
                  const n = item.n;
                  return (
                    <div key={item.key} style={{ padding: '9px 12px', borderRadius: 10, background: 'rgba(var(--accentRGB), 0.04)', border: '1px solid rgba(var(--accentRGB), 0.10)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <Icons.Send size={13} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title || 'Notice'}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.body}</div>
                      </div>
                      {n.targetType === 'cr_only' && (
                        <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--muted)', flexShrink: 0, padding: '2px 6px', borderRadius: 999, background: 'rgba(var(--accentRGB), 0.08)' }}>CR only</span>
                      )}
                    </div>
                  );
                })}
                {allItems.length > 3 && (
                  <button
                    onClick={() => setAlertsExpanded((v) => !v)}
                    style={{ marginTop: 2, padding: '6px 0', border: 'none', background: 'transparent', color: 'var(--accent)', fontWeight: 700, fontSize: 11.5, cursor: 'pointer', textAlign: 'center' }}
                  >
                    {alertsExpanded ? 'Show less ↑' : `See more (${allItems.length - 3}) ↓`}
                  </button>
                )}
              </div>
            );
          })()}
        </div>

        </div>
        {/* ── end dashboard-home-columns ── */}

        {/* My Classes — moved to its own full-width row below Today's
            Classes/Alerts, since a card listing every active class (each
            with its own weekly day-strip + progress bar) reads much
            better with the full page width than squeezed into one half
            of the row above. viewMode lets the teacher pick whichever
            reads better for them: a single-column list (more detail per
            row, best on narrow/mobile screens) or a multi-column grid
            (denser overview, better once there's real desktop width and
            more than a couple of classes to scan). Defaults to grid on
            wider screens via CSS auto-fit; the toggle just forces a
            single column when picked, since auto-fit's own "grid" mode
            already collapses to one column on narrow screens by itself. */}
        <div className="card dashboard-roadmap" style={{ padding: '18px 18px 16px', border: '1px solid rgba(var(--accentRGB), 0.10)', background: 'linear-gradient(180deg, rgba(var(--accentRGB), 0.04), var(--surfaceGlassStrong))', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--muted)' }}>My Classes</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{activeAssignments.length} active class{activeAssignments.length !== 1 ? 'es' : ''} this term</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {activeAssignments.length > 1 && (
                <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  <button
                    onClick={() => setClassesViewMode('list')}
                    title="Single column"
                    style={{ padding: '5px 8px', border: 'none', cursor: 'pointer', background: classesViewMode === 'list' ? 'var(--accent)' : 'transparent', color: classesViewMode === 'list' ? '#fff' : 'var(--muted)', display: 'flex', alignItems: 'center' }}
                  >
                    <Icons.List size={13} />
                  </button>
                  <button
                    onClick={() => setClassesViewMode('grid')}
                    title="Grid columns"
                    style={{ padding: '5px 8px', border: 'none', cursor: 'pointer', background: classesViewMode === 'grid' ? 'var(--accent)' : 'transparent', color: classesViewMode === 'grid' ? '#fff' : 'var(--muted)', display: 'flex', alignItems: 'center' }}
                  >
                    <Icons.LayoutGrid size={13} />
                  </button>
                </div>
              )}
              <Link to="/faculty/classes" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>All classes →</Link>
            </div>
          </div>
          {activeAssignments.length > 0 ? (
            <div style={{ display: 'grid', gap: 8, gridTemplateColumns: classesViewMode === 'grid' ? 'repeat(auto-fit, minmax(280px, 1fr))' : '1fr' }}>
              {activeAssignments.map((c) => {
                const a = assignments[c.assignmentId];
                const logged = (sessionsByAssignment[c.assignmentId] || []).length;
                const planned = a?.plannedTotalClasses;
                const pct = planned ? Math.min(100, Math.round((logged / planned) * 100)) : null;
                const classDays = new Set((a?.dayTimeSlots || []).map((s) => s.day));
                return (
                  <Link
                    key={c.assignmentId}
                    to={`/faculty/classes/${c.assignmentId}?groupId=${encodeURIComponent(c.groupId)}`}
                    style={{ textDecoration: 'none', color: 'var(--text)' }}
                  >
                    <div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(var(--accentRGB), 0.04)', border: '1px solid rgba(var(--accentRGB), 0.10)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 800 }}>{c.batch?.toUpperCase()} {c.dept} — {c.courseCode}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                          {planned ? `${logged}/${planned} classes` : `${logged} logged`}
                        </div>
                      </div>

                      {/* Weekly day-strip — which weekdays this course runs on,
                          so this card shows something the stat cards above
                          don't: the actual class-week pattern at a glance. */}
                      <div style={{ display: 'flex', gap: 4, marginBottom: pct !== null ? 8 : 0 }}>
                        {DAYS.map((d) => {
                          const on = classDays.has(d);
                          return (
                            <div
                              key={d}
                              title={d}
                              style={{
                                flex: 1, textAlign: 'center', fontSize: 9.5, fontWeight: 800, padding: '4px 0', borderRadius: 6,
                                color: on ? '#fff' : 'var(--muted)',
                                background: on ? 'linear-gradient(135deg, #3B82F6, #10B981)' : 'rgba(var(--accentRGB), 0.06)',
                                opacity: on ? 1 : 0.55,
                              }}
                            >
                              {d.slice(0, 2)}
                            </div>
                          );
                        })}
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
          ) : (
            <div style={{ fontSize: 12.5, color: 'var(--muted)', textAlign: 'center', padding: '18px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Icons.BookOpen size={20} color="var(--muted)" style={{ opacity: 0.5 }} />
              No active classes yet
            </div>
          )}
        </div>

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
