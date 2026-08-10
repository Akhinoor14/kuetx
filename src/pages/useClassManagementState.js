import { useEffect, useMemo, useState } from 'react';
import { store, uid, getProfile, getCurrentTermKey, getNextDateForWeekday, classOverrideSlotKey, isClassOff } from '../store/store';
import { getAllCourses } from '../store/curriculumStore';
import { getGroupId } from '../lib/groupUtils';
import {
  subscribeRoutine,
  subscribePlannerLogs,
  addPlannerLogEntry,
  deletePlannerLogEntry,
  subscribePlannerSettings,
  updatePlannerSettings,
  updateClassSetup,
  setSlotOverride,
  setDayOverride,
  setRecurringOff,
  clearRecurringOff,
  postGroupNotice,
} from '../lib/groupSync';
import { subscribeGroupTermStartDate, setGroupTermStartDate } from '../lib/termStartDateSync';
import {
  createDefaultCoursePlan,
  buildExportPayload,
  getCourseTeacherCountsFromSchedule,
  matchesTerm,
  normalizeTeacherList,
} from '../lib/plannerUtils';
import { resolveTeacherIdsForNames, resolveTeacherNames } from '../lib/teacherRegistry';
import { defaultCadenceForNewSlot, toggleDateOverride, shiftCadenceFrom, getEffectiveOccurrence } from '../lib/sessionalCadence';
import { setSessionalCadence, clearSessionalCadence } from '../lib/groupSync';

export const TERM_KEY_RE = /^Y\dT\d$/;
export const ROUTINE_DAY_DEFS = [
  { key: 'Sunday', label: 'Sun' },
  { key: 'Monday', label: 'Mon' },
  { key: 'Tuesday', label: 'Tue' },
  { key: 'Wednesday', label: 'Wed' },
  { key: 'Thursday', label: 'Thu' },
];
export const ROUTINE_DAY_KEYS = ROUTINE_DAY_DEFS.map(d => d.key);

/**
 * Shared state + handlers for the old ClassManagement.jsx (Routine +
 * Planner tabs). Extracted verbatim (no logic re-derived) so the new
 * independent Routine / Class Planner pages both stay backed by exactly
 * the same Firestore subscriptions and derived values as before the
 * split — only the JSX/tab-switch UI changed, not any underlying
 * behavior.
 */
export function useClassManagementState() {
  const profile = getProfile();
  const allCourses = useMemo(() => getAllCourses(profile), [profile]);
  const currentTermKey = getCurrentTermKey(profile);
  const currentTermCourses = useMemo(
    () => allCourses.filter(course => matchesTerm(course, currentTermKey)),
    [allCourses, currentTermKey],
  );

  const groupId = useMemo(() => getGroupId(profile), [profile.dept, profile.batch]);

  const [groupTermStartDate, setGroupTermStartDateState] = useState(null);
  const [termDateDraft, setTermDateDraft] = useState('');
  const [termDateSaving, setTermDateSaving] = useState(false);
  const [termDateError, setTermDateError] = useState('');
  useEffect(() => {
    if (!groupId) { setGroupTermStartDateState(null); return; }
    return subscribeGroupTermStartDate(groupId, (date) => {
      setGroupTermStartDateState(date);
      setTermDateDraft((prev) => (prev ? prev : date || ''));
    });
  }, [groupId]);
  const handleSaveTermStartDate = async () => {
    if (!groupId || !termDateDraft) return;
    setTermDateSaving(true);
    setTermDateError('');
    try {
      // BUGFIX (term start date inconsistency): this only used to write
      // deptBatchConfig (via setGroupTermStartDate) — the doc Schedule.jsx
      // reads from. But the mandatory ClassSetupModal popup and the
      // /class-setup page both read/write a SEPARATE doc, classSetup
      // (groups/{groupId}/meta/classSetup) — see ClassSetupModal.jsx's
      // handleSaveDates for the matching fix on that side. Without this,
      // a CR setting the date from here (Class Routine) would update the
      // schedule page correctly but leave classSetup.termStartDate
      // untouched, so the mandatory popup's "fill in dates" step could
      // still show empty/stale even though the date genuinely was set —
      // and /class-setup's own form would show the old value too. Updating
      // classSetup here is best-effort (own try/catch) so a failure here
      // never blocks the deptBatchConfig save that Schedule.jsx actually
      // depends on for the case that matters most.
      await setGroupTermStartDate(groupId, termDateDraft);
      try {
        await updateClassSetup(groupId, profile, { termStartDate: termDateDraft });
      } catch (syncErr) {
        console.error('[useClassManagementState] classSetup termStartDate sync failed:', syncErr);
      }
    } catch (err) {
      setTermDateError(err?.message || 'Could not save. Try again.');
    } finally {
      setTermDateSaving(false);
    }
  };

  const [groupRoutine, setGroupRoutine] = useState([]);
  useEffect(() => {
    if (!groupId) { setGroupRoutine([]); return; }
    return subscribeRoutine(groupId, (entries) => {
      setGroupRoutine((entries || []).map((e) => ({
        id: e.id,
        day: e.day || 'Sunday',
        slot: e.slot || '',
        courseId: e.courseId || '',
        teacherName: e.teacherName || '',
        displayName: e.displayName || e.courseCode || e.courseName || '',
        room: e.room || '',
        note: e.note || '',
        type: e.type || 'Theory',
      })));
    });
  }, [groupId]);

  const [schedule, setSchedule] = useState(() => store.get('schedule') || []);
  const [settings, setSettings] = useState(() => store.get('scheduleSettings') || {});
  const [plannerState, setPlannerState] = useState(() => store.get('classManagementPlans') || {});

  const [groupPlannerLogs, setGroupPlannerLogs] = useState([]);
  useEffect(() => {
    if (!groupId) { setGroupPlannerLogs([]); return; }
    return subscribePlannerLogs(groupId, (entries) => setGroupPlannerLogs(entries || []));
  }, [groupId]);

  const [groupPlannerSettings, setGroupPlannerSettings] = useState(null);
  useEffect(() => {
    if (!groupId) { setGroupPlannerSettings(null); return; }
    return subscribePlannerSettings(groupId, (data) => setGroupPlannerSettings(data || {}));
  }, [groupId]);

  // In group mode, courseTeacherMap holds teacherIds (see
  // teacherRegistry.js) — rawCourseTeacherMapIds is that ID-based shape,
  // used only by the write path (handleCourseTeacherDialogSave below).
  // Local (non-group) mode never had this problem (single device, no
  // multi-CR collision to guard against) and stays name-based as-is.
  const rawCourseTeacherMapIds = groupId
    ? (groupPlannerSettings?.courseTeacherMap || {})
    : (settings?.courseTeacherMap || {});
  const teacherRegistry = groupPlannerSettings?.teacherRegistry || {};
  // Name-resolved version for every display/logging consumer below
  // (course rows, quickLogClass's logged teacherName, assignedTeacherCount
  // badge, plan-seeding) — everything here reads names, never ids.
  const effectiveCourseTeacherMap = groupId
    ? Object.fromEntries(
        Object.entries(rawCourseTeacherMapIds).map(([courseId, ids]) => [
          courseId,
          resolveTeacherNames(teacherRegistry, ids),
        ]),
      )
    : rawCourseTeacherMapIds;
  const effectivePlannerPlans = groupId
    ? (groupPlannerSettings?.plans || {})
    : null;

  const [selectedRoutineDay, setSelectedRoutineDay] = useState(() => {
    const todayKey = ROUTINE_DAY_KEYS[new Date().getDay()];
    return todayKey || 'Sunday';
  });
  const [viewMode, setViewMode] = useState('automatic');
  const [courseTeacherDialogState, setCourseTeacherDialogState] = useState({ open: false, courseId: '' });
  const [detailState, setDetailState] = useState({ open: false, courseId: '' });
  const [resetState, setResetState] = useState({ open: false, course: null, count: 0 });

  const getInitials = (name) => {
    if (!name) return '';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  };

  const isTermScopedPlanner = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    return Object.keys(value).some(key => TERM_KEY_RE.test(key));
  };

  const getCurrentTermPlans = (state) => {
    if (!state || typeof state !== 'object') return {};
    if (isTermScopedPlanner(state)) return state[currentTermKey] || {};
    return state;
  };

  const localCurrentTermPlans = useMemo(() => getCurrentTermPlans(plannerState), [plannerState, currentTermKey]);
  const currentTermPlans = groupId ? effectivePlannerPlans : localCurrentTermPlans;
  const courseMap = useMemo(() => new Map(allCourses.map(course => [course.id, course])), [allCourses]);

  const currentTermScheduleEntries = useMemo(() => {
    const currentCourseIds = new Set(currentTermCourses.map(course => course.id));
    return (groupId ? groupRoutine : (schedule || [])).filter(entry => currentCourseIds.has(entry.courseId));
  }, [groupId, groupRoutine, schedule, currentTermCourses]);

  const routineEntriesByDay = useMemo(() => {
    const next = ROUTINE_DAY_KEYS.reduce((acc, day) => ({ ...acc, [day]: [] }), {});
    currentTermScheduleEntries.forEach(entry => {
      if (!next[entry.day]) return;
      next[entry.day].push(entry);
    });
    ROUTINE_DAY_KEYS.forEach(day => {
      next[day] = next[day].slice().sort((a, b) => String(a.slot || '').localeCompare(String(b.slot || '')));
    });
    return next;
  }, [currentTermScheduleEntries]);

  const selectedRoutineEntries = routineEntriesByDay[selectedRoutineDay] || [];
  const selectedRoutineLabel = ROUTINE_DAY_DEFS.find(d => d.key === selectedRoutineDay)?.key || selectedRoutineDay;

  // ── Class on/off toggle (CR-only) ──────────────────────────────────────
  // The Routine page shows a weekly TEMPLATE (day-of-week, no calendar
  // date). A prior version of this feature auto-guessed "the next upcoming
  // date matching this weekday" and committed the toggle to it immediately
  // — this had a real ambiguity gap (this week vs next week? and no way to
  // express "suspend every week from now on" without re-toggling every
  // single week). Fixed design: opening the toggle panel for a card/day
  // only stages a DRAFT (date pre-filled with the same "next upcoming"
  // suggestion as before, but editable, plus an explicit single-date vs
  // recurring mode choice) — nothing is written until the CR presses
  // Confirm. See store.js's isClassOff() for the read-side precedence and
  // groupSync.js's setSlotOverride/setDayOverride/setRecurringOff for the
  // write side.
  const classOverrides = groupId
    ? (groupPlannerSettings?.scheduleFields?.classOverrides || {})
    : {};
  const recurringOff = groupId
    ? (groupPlannerSettings?.scheduleFields?.recurringOff || {})
    : {};
  const [overrideBusyKey, setOverrideBusyKey] = useState(null);
  // draft shape: { kind: 'slot'|'day', entry?, date, mode: 'single'|'recurring', reason }
  const [overrideDraft, setOverrideDraft] = useState(null);

  const isSlotOff = (entry, dateKey = getNextDateForWeekday(entry.day)) => {
    const key = classOverrideSlotKey(entry.courseId, entry.day, entry.slot);
    const forDate = classOverrides[dateKey];
    if (forDate?.dayOff) return true;
    const status = forDate?.slots?.[key]?.status;
    if (status === 'on') return false;
    if (status === 'off') return true;
    const recurring = recurringOff[key];
    return !!(recurring?.from && dateKey >= recurring.from);
  };
  const isSlotRecurringOff = (entry) => !!recurringOff[classOverrideSlotKey(entry.courseId, entry.day, entry.slot)];
  const isSelectedDayOff = !!classOverrides[getNextDateForWeekday(selectedRoutineDay)]?.dayOff;

  // Opens the confirm panel for one class card — does NOT write anything
  // yet. Pre-fills the date with the same "next occurrence" suggestion the
  // old version silently committed to, but now the CR sees and can change
  // it before anything is saved.
  function openSlotOverrideDraft(entry) {
    const slotKey = classOverrideSlotKey(entry.courseId, entry.day, entry.slot);
    const recurring = recurringOff[slotKey];
    setOverrideDraft({
      kind: 'slot',
      entry,
      slotKey,
      date: getNextDateForWeekday(entry.day),
      mode: 'single',
      reason: '',
      // if this slot already has a recurring suspension, opening the
      // panel is for TURNING IT BACK ON, not staging a new off-draft
      turningOffRecurring: !!recurring,
    });
  }

  function openDayOverrideDraft() {
    setOverrideDraft({
      kind: 'day',
      date: getNextDateForWeekday(selectedRoutineDay),
      reason: '',
      turningOn: isSelectedDayOff,
    });
  }

  function updateOverrideDraft(patch) {
    setOverrideDraft((d) => (d ? { ...d, ...patch } : d));
  }

  function cancelOverrideDraft() {
    setOverrideDraft(null);
  }

  // Commits whatever is currently staged in overrideDraft. This is the
  // ONLY place a write actually happens — everything above just edits
  // local draft state.
  async function confirmOverrideDraft() {
    if (!groupId || !overrideDraft) return;
    const draft = overrideDraft;

    if (draft.kind === 'day') {
      const busyId = `day:${draft.date}`;
      setOverrideBusyKey(busyId);
      try {
        const turningOn = draft.turningOn;
        await setDayOverride(groupId, profile, { dateKey: draft.date, on: turningOn, reason: draft.reason || null });
        const dateLabel = new Date(draft.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        await postGroupNotice(groupId, profile, turningOn
          ? { title: 'Classes back on', body: `✅ ${dateLabel}-এর সব ক্লাস আবার চালু — আগের 'বন্ধ' নোটিশ বাতিল।`, priority: 'normal' }
          : { title: 'All classes off', body: `⚠️ ${dateLabel}-এ সব ক্লাস বন্ধ — CR মার্ক করেছে।${draft.reason ? ` কারণ: ${draft.reason}` : ''}`, priority: 'urgent' });
      } catch (e) {
        console.error('[ClassRoutine] confirmOverrideDraft (day) failed:', e);
      } finally {
        setOverrideBusyKey(null);
        setOverrideDraft(null);
      }
      return;
    }

    // kind === 'slot'
    const { entry, slotKey, date, mode, reason, turningOffRecurring } = draft;
    const course = courseMap.get(entry.courseId);
    const label = entry.displayName || course?.code || course?.name || 'Class';
    const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const busyId = `slot:${slotKey}`;
    setOverrideBusyKey(busyId);
    try {
      if (turningOffRecurring) {
        // This slot already has an ongoing recurring suspension — this
        // panel's action is turning it back on entirely, not staging a
        // new off-draft.
        await clearRecurringOff(groupId, profile, { slotKey });
        await postGroupNotice(groupId, profile, {
          title: 'Weekly suspension lifted',
          body: `✅ ${label} আবার প্রতি সপ্তাহে চালু হবে — আগের 'প্রতি সপ্তাহে বন্ধ' অবস্থা বাতিল।`,
          priority: 'normal',
        });
      } else if (mode === 'recurring') {
        await setRecurringOff(groupId, profile, { slotKey, fromDateKey: date, reason: reason || null });
        await postGroupNotice(groupId, profile, {
          title: 'Class suspended (weekly)',
          body: `⚠️ ${label} — ${dateLabel} থেকে প্রতি সপ্তাহে বন্ধ থাকবে, পরবর্তী নির্দেশ না দেওয়া পর্যন্ত।${reason ? ` কারণ: ${reason}` : ''}`,
          priority: 'urgent',
        });
      } else if (isSlotOff(entry, date)) {
        // Currently off for this exact date → confirm turns it back on.
        // BUGFIX: this used to always call setSlotOverride({mode:'clear'})
        // here, on the assumption that "off" always meant a per-date 'off'
        // entry existed to clear. But isSlotOff() also returns true when
        // there's NO per-date entry at all and the slot is off purely
        // because of an active recurringOff (see isSlotOff's precedence
        // above: per-date status wins, then falls through to recurring).
        // In that case 'clear' deletes a non-existent per-date entry —
        // a no-op — and the recurring suspension stays in force, so the
        // slot silently remains off after the CR just "turned it on".
        // Fix: check whether a per-date status is what's actually driving
        // the off state for THIS date. If so, clear it as before. If the
        // off state is coming from recurringOff instead, write an
        // explicit per-date 'on' exception (mode: 'on') rather than
        // clearing — this punches a single-date make-up through the
        // ongoing suspension without touching (or lifting) the recurring
        // suspension itself, exactly per isClassOff()'s documented
        // precedence in store.js (per-date 'on' beats recurringOff).
        const perDateStatus = classOverrides[date]?.slots?.[slotKey]?.status;
        const clearingPerDateEntry = perDateStatus === 'off';
        await setSlotOverride(groupId, profile, {
          dateKey: date, slotKey, mode: clearingPerDateEntry ? 'clear' : 'on', reason: reason || null,
        });
        await postGroupNotice(groupId, profile, {
          title: 'Class back on', body: `✅ ${label} (${dateLabel}) আসলে হবে — আগের 'বন্ধ' নোটিশ বাতিল।`, priority: 'normal',
        });
      } else {
        await setSlotOverride(groupId, profile, { dateKey: date, slotKey, mode: 'off', reason: reason || null });
        await postGroupNotice(groupId, profile, {
          title: 'Class off', body: `⚠️ ${label} (${dateLabel}) হবে না — CR মার্ক করেছে।${reason ? ` কারণ: ${reason}` : ''}`, priority: 'urgent',
        });
      }
    } catch (e) {
      console.error('[ClassRoutine] confirmOverrideDraft (slot) failed:', e);
    } finally {
      setOverrideBusyKey(null);
      setOverrideDraft(null);
    }
  }
  // ── Sessional/Lab alternating-week cadence (CR-only) ─────────────────
  // See src/lib/sessionalCadence.js for the full data-model writeup.
  // Deliberately kept as a small, separate panel — not merged into the
  // on/off toggle above — because it's a genuinely different concept: the
  // toggle above is "was this specific date cancelled/suspended", while
  // this is "what recurring pattern does this slot follow at all" (every
  // week / alternating / fully manual). A Sessional slot can have both an
  // active cadence AND a one-off cancellation on top of it — the two
  // systems compose (see getEffectiveOccurrence + isClassOff both being
  // checked independently in todayItems.js/Attendance.jsx).
  const isSessionalType = (type) => /sessional|lab/i.test(String(type || ''));
  const sessionalCadence = groupId
    ? (groupPlannerSettings?.scheduleFields?.sessionalCadence || {})
    : {};
  const [cadenceBusyKey, setCadenceBusyKey] = useState(null);
  // draft shape: { slotKey, entry, courseId, day, slot, label }
  const [cadenceDraft, setCadenceDraft] = useState(null);

  const getCadenceEntry = (entry) => sessionalCadence[classOverrideSlotKey(entry.courseId, entry.day, entry.slot)] || null;

  // Whether a slot HAS a cadence configured at all — used by the UI to
  // decide "show a Configure button" vs "show the existing cadence +
  // Edit/Toggle-date/Shift actions". A Sessional slot with no entry here
  // still runs every week (today's default, unaffected) until the CR
  // deliberately opts it into alternating/manual mode.
  const hasCadenceConfigured = (entry) => !!getCadenceEntry(entry);

  // Opens the cadence panel for one Sessional/Lab class card. If the slot
  // has no cadence entry yet, stages the default alternating-anchored-on-
  // next-occurrence entry (prompt's "zero extra CR configuration for the
  // common case") — nothing is written until confirmCadenceDraft.
  function openCadenceDraft(entry) {
    if (!isSessionalType(entry.type)) return;
    const slotKey = classOverrideSlotKey(entry.courseId, entry.day, entry.slot);
    const existing = getCadenceEntry(entry);
    const course = courseMap.get(entry.courseId);
    const label = entry.displayName || course?.code || course?.name || 'Class';
    setCadenceDraft({
      slotKey,
      entry: existing || defaultCadenceForNewSlot(getNextDateForWeekday(entry.day)),
      courseId: entry.courseId,
      day: entry.day,
      slot: entry.slot,
      label,
    });
  }

  function updateCadenceDraft(patch) {
    setCadenceDraft((d) => (d ? { ...d, entry: { ...d.entry, ...patch } } : d));
  }

  function cancelCadenceDraft() {
    setCadenceDraft(null);
  }

  // Commits the currently staged cadence entry (mode/anchorDate change,
  // typically from the "Configure"/"Edit cadence" panel). Per-date
  // toggles and shift-from actions below write immediately instead —
  // they're single, explicit, already-confirmed actions with their own
  // action button in the UI (a date-picker "Cancel this date" / "Shift
  // from here" flow), not a multi-field form needing a review step.
  async function confirmCadenceDraft() {
    if (!groupId || !cadenceDraft) return;
    const { slotKey, entry, label } = cadenceDraft;
    setCadenceBusyKey(slotKey);
    try {
      await setSessionalCadence(groupId, profile, { slotKey, nextEntry: entry });
      await postGroupNotice(groupId, profile, {
        title: 'Sessional cadence set',
        body: `📆 ${label} — এখন থেকে ${entry.mode === 'alternating' ? 'এক সপ্তাহ পর পর' : entry.mode === 'weekly' ? 'প্রতি সপ্তাহে' : 'ম্যানুয়ালি'} শিডিউল হবে (শুরু: ${entry.anchorDate}).`,
        priority: 'normal',
      });
    } catch (e) {
      console.error('[ClassRoutine] confirmCadenceDraft failed:', e);
    } finally {
      setCadenceBusyKey(null);
      setCadenceDraft(null);
    }
  }

  // Removes a slot's cadence entry entirely — back to "runs every week",
  // the default for any slot with no cadence configured.
  async function removeCadence(entry) {
    if (!groupId) return;
    const slotKey = classOverrideSlotKey(entry.courseId, entry.day, entry.slot);
    setCadenceBusyKey(slotKey);
    try {
      await clearSessionalCadence(groupId, profile, { slotKey });
    } catch (e) {
      console.error('[ClassRoutine] removeCadence failed:', e);
    } finally {
      setCadenceBusyKey(null);
    }
  }

  // One-off cancellation / make-up toggle for a single date — the
  // prompt's "cancel a single occurrence" / "extra make-up session"
  // acceptance criteria. status is 'on' | 'off' | 'clear'.
  async function toggleCadenceDate(entry, dateKey, status) {
    if (!groupId) return;
    const slotKey = classOverrideSlotKey(entry.courseId, entry.day, entry.slot);
    const current = getCadenceEntry(entry) || defaultCadenceForNewSlot(dateKey);
    const nextEntry = toggleDateOverride(current, dateKey, status);
    setCadenceBusyKey(slotKey);
    try {
      await setSessionalCadence(groupId, profile, { slotKey, nextEntry });
    } catch (e) {
      console.error('[ClassRoutine] toggleCadenceDate failed:', e);
    } finally {
      setCadenceBusyKey(null);
    }
  }

  // Deliberate "shift cadence from here" action (prompt's design goal #1
  // — real-world gaps drift). Re-anchors the slot's baseline for future
  // dates only; existing overrides (past and future) are left untouched
  // by shiftCadenceFrom itself, per its own doc comment in
  // sessionalCadence.js. Callers should confirm with the CR before
  // calling this — this function itself performs the write unconditionally.
  async function shiftCadence(entry, newAnchorDate) {
    if (!groupId) return;
    const slotKey = classOverrideSlotKey(entry.courseId, entry.day, entry.slot);
    const current = getCadenceEntry(entry) || defaultCadenceForNewSlot(newAnchorDate);
    const nextEntry = shiftCadenceFrom(current, newAnchorDate);
    setCadenceBusyKey(slotKey);
    try {
      await setSessionalCadence(groupId, profile, { slotKey, nextEntry });
      const course = courseMap.get(entry.courseId);
      const label = entry.displayName || course?.code || course?.name || 'Class';
      const dateLabel = new Date(newAnchorDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      await postGroupNotice(groupId, profile, {
        title: 'Sessional cadence shifted',
        body: `📆 ${label} — ${dateLabel} থেকে নতুন সাইকেল শুরু হবে (আগের তারিখগুলো অপরিবর্তিত থাকবে)।`,
        priority: 'normal',
      });
    } catch (e) {
      console.error('[ClassRoutine] shiftCadence failed:', e);
    } finally {
      setCadenceBusyKey(null);
    }
  }

  // Convenience readout for the UI — whether a given date currently
  // resolves 'on'/'off' for a slot, so a settings panel can show "this
  // week: ON/OFF" without duplicating sessionalCadence.js's own logic.
  const getCadenceOccurrence = (entry, dateKey) => getEffectiveOccurrence(getCadenceEntry(entry), dateKey);

  const assignedTeacherCount = useMemo(() => {
    const teacherNames = new Set();
    currentTermCourses.forEach(course => {
      const teachers = currentTermPlans?.[course.id]?.teachers || effectiveCourseTeacherMap?.[course.id] || [];
      (teachers || []).forEach(teacher => {
        if (teacher) teacherNames.add(teacher);
      });
    });
    return teacherNames.size;
  }, [currentTermCourses, currentTermPlans, effectiveCourseTeacherMap]);
  const currentTermScheduledCourseCount = useMemo(() => {
    return new Set(currentTermScheduleEntries.map(entry => entry.courseId)).size;
  }, [currentTermScheduleEntries]);

  useEffect(() => {
    if (selectedRoutineEntries.length > 0) return;
    const firstDayWithEntries = ROUTINE_DAY_KEYS.find(day => (routineEntriesByDay[day] || []).length > 0);
    if (firstDayWithEntries && firstDayWithEntries !== selectedRoutineDay) {
      setSelectedRoutineDay(firstDayWithEntries);
    }
  }, [routineEntriesByDay, selectedRoutineDay, selectedRoutineEntries.length]);

  const formatRoutineSlot = (value) => String(value || '').replace(/\s+break\s*$/i, '').trim();

  const buildRoutineCopyText = (day, entries) => {
    if (!entries.length) {
      return `Routine for ${day}\n\nNo classes added yet.`;
    }

    const lines = [`*_📅 Routine for ${day}_*`, ''];

    entries.forEach((entry, index) => {
      const course = courseMap.get(entry.courseId);
      const courseLabel = entry.displayName || course?.code || course?.name || 'Unknown Course';
      const teacherLabel = entry.teacherName || 'Teacher not set';
      lines.push(`${index + 1}. *${formatRoutineSlot(entry.slot)}* — _${courseLabel} · ${teacherLabel}_`);
    });

    return lines.join('\n');
  };

  const refreshFromStore = () => {
    setSchedule(store.get('schedule') || []);
    setSettings(store.get('scheduleSettings') || {});
    setPlannerState(store.get('classManagementPlans') || {});
  };

  useEffect(() => {
    store.set('schedule', schedule);
  }, [schedule]);

  useEffect(() => {
    store.set('scheduleSettings', settings);
  }, [settings]);

  useEffect(() => {
    store.set('classManagementPlans', plannerState);
  }, [plannerState]);

  useEffect(() => {
    store.set('classManagementPlannerMode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    const handleStoreUpdate = () => refreshFromStore();
    window.addEventListener('kuetx:store-updated', handleStoreUpdate);
    return () => window.removeEventListener('kuetx:store-updated', handleStoreUpdate);
  }, []);

  useEffect(() => {
    if (!currentTermKey || groupId) return;

    setPlannerState(prev => {
      const baseState = prev && typeof prev === 'object' ? prev : {};
      const nextState = isTermScopedPlanner(baseState) ? { ...baseState } : { [currentTermKey]: { ...baseState } };
      const currentPlans = { ...(nextState[currentTermKey] || {}) };
      const teacherMap = settings?.courseTeacherMap || {};
      let changed = false;

      currentTermCourses.forEach(course => {
        const existing = currentPlans[course.id];
        const defaultTeachers = normalizeTeacherList(existing?.teachers?.length ? existing.teachers : teacherMap[course.id] || []);
        const defaultPlan = createDefaultCoursePlan({ course, termKey: currentTermKey, teachers: defaultTeachers });
        const nextPlan = {
          ...defaultPlan,
          ...existing,
          teachers: defaultTeachers,
          plannedTotalClasses: existing?.plannedTotalClasses || defaultPlan.plannedTotalClasses,
          perWeekTarget: existing?.perWeekTarget || defaultPlan.perWeekTarget,
        };

        if (!existing || JSON.stringify(existing) !== JSON.stringify(nextPlan)) {
          currentPlans[course.id] = nextPlan;
          changed = true;
        }
      });

      if (!changed) return baseState;
      return { ...nextState, [currentTermKey]: currentPlans };
    });
  }, [currentTermCourses, currentTermKey, settings?.courseTeacherMap, groupId]);

  useEffect(() => {
    if (!currentTermKey || !groupId || groupPlannerSettings === null) return;

    const existingPlans = groupPlannerSettings?.plans || {};
    const teacherMap = groupPlannerSettings?.courseTeacherMap || {};
    const nextPlans = { ...existingPlans };
    let changed = false;

    currentTermCourses.forEach(course => {
      const existing = existingPlans[course.id];
      const defaultTeachers = normalizeTeacherList(existing?.teachers?.length ? existing.teachers : teacherMap[course.id] || []);
      const defaultPlan = createDefaultCoursePlan({ course, termKey: currentTermKey, teachers: defaultTeachers });
      const nextPlan = {
        ...defaultPlan,
        ...existing,
        teachers: defaultTeachers,
        plannedTotalClasses: existing?.plannedTotalClasses || defaultPlan.plannedTotalClasses,
        perWeekTarget: existing?.perWeekTarget || defaultPlan.perWeekTarget,
      };

      if (!existing || JSON.stringify(existing) !== JSON.stringify(nextPlan)) {
        nextPlans[course.id] = nextPlan;
        changed = true;
      }
    });

    if (!changed) return;
    updatePlannerSettings(groupId, profile, { plans: nextPlans }).catch((e) => console.error('[ClassManagement] plan default-fill failed:', e));
  }, [currentTermCourses, currentTermKey, groupId, groupPlannerSettings, profile]);

  const plannerRows = useMemo(() => {
    const manualLogs = groupId ? groupPlannerLogs : (schedule || []);
    return currentTermCourses.map(course => {
      const plan = currentTermPlans[course.id] || createDefaultCoursePlan({ course, termKey: currentTermKey, teachers: effectiveCourseTeacherMap?.[course.id] || [] });
      const fallbackTeachers = Array.from(new Set((groupId ? groupRoutine : (schedule || [])).filter(e => e.courseId === course.id).map(e => String(e.teacherName || '').trim()).filter(Boolean)));
      const planTeachers = (Array.isArray(plan?.teachers) && plan.teachers.length) ? plan.teachers : (effectiveCourseTeacherMap?.[course.id] || fallbackTeachers || []);
      const teacherCounts = viewMode === 'manual'
        ? getCourseTeacherCountsFromSchedule(manualLogs, course.id)
        : getCourseTeacherCountsFromSchedule(currentTermScheduleEntries, course.id);
      const totalLogged = viewMode === 'manual'
        ? manualLogs.filter(entry => entry.courseId === course.id).length
        : currentTermScheduleEntries.filter(entry => entry.courseId === course.id).length;
      return {
        course,
        plan: { ...plan, teachers: normalizeTeacherList(planTeachers) },
        teacherCounts,
        totalLogged,
      };
    });
  }, [currentTermCourses, currentTermPlans, currentTermKey, schedule, effectiveCourseTeacherMap, groupId, groupPlannerLogs, viewMode, currentTermScheduleEntries]);

  const updateCurrentTermPlan = (courseId, updater) => {
    if (groupId) {
      const existingPlans = groupPlannerSettings?.plans || {};
      const currentPlan = existingPlans[courseId] || null;
      const nextPlan = updater(currentPlan);
      if (!nextPlan) return;
      updatePlannerSettings(groupId, profile, { plans: { ...existingPlans, [courseId]: nextPlan } })
        .catch((e) => console.error('[ClassManagement] updateCurrentTermPlan failed:', e));
      return;
    }

    setPlannerState(prev => {
      const baseState = prev && typeof prev === 'object' ? prev : {};
      const nextState = isTermScopedPlanner(baseState) ? { ...baseState } : { [currentTermKey]: { ...baseState } };
      const currentPlans = { ...(nextState[currentTermKey] || {}) };
      const currentPlan = currentPlans[courseId] || null;
      const nextPlan = updater(currentPlan);
      if (!nextPlan) return baseState;
      currentPlans[courseId] = nextPlan;
      return { ...nextState, [currentTermKey]: currentPlans };
    });
  };

  const openCourseDetails = (courseId) => setDetailState({ open: true, courseId });
  const closeCourseDetails = () => setDetailState({ open: false, courseId: '' });

  const formatDateTime = (iso) => {
    if (!iso) return 'Unknown';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const removeLogEntry = (logId) => {
    if (groupId) {
      deletePlannerLogEntry(groupId, logId, profile).catch((e) => console.error('[ClassManagement] removeLogEntry failed:', e));
      return;
    }
    setSchedule(prev => (prev || []).filter(entry => entry.id !== logId));
  };

  const quickLogClass = (course, teacherName = '') => {
    if (!course?.id) return;

    const getTeachersFromSchedule = (courseId) => {
      return Array.from(new Set((groupId ? groupRoutine : (schedule || [])).filter(e => e.courseId === courseId).map(e => String(e.teacherName || '').trim()).filter(Boolean)));
    };

    const assignedTeachers = normalizeTeacherList((effectiveCourseTeacherMap || {})[course.id] || getTeachersFromSchedule(course.id) || []);
    const isTheory = String(course.type || 'Theory').toLowerCase() === 'theory';

    if (isTheory && assignedTeachers.length === 0) {
      openTeacherDialog(course.id);
      return;
    }

    const selectedTeacher = String(teacherName || assignedTeachers[0] || '').trim();
    const entry = {
      courseId: course.id,
      displayName: course.code,
      type: course.type || 'Theory',
      teacherName: selectedTeacher,
      loggedAt: new Date().toISOString(),
      day: 'Manual',
      slot: 'Manual',
      note: 'Logged manually',
    };

    if (groupId) {
      addPlannerLogEntry(groupId, profile, entry).catch((e) => console.error('[ClassManagement] quickLogClass failed:', e));
      return;
    }

    setSchedule(prev => [...(prev || []), { ...entry, id: uid() }]);
  };

  const copyRoutineForSelectedDay = async () => {
    const text = buildRoutineCopyText(selectedRoutineDay, selectedRoutineEntries);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // no-op
    }
  };

  const exportRoutineBackup = () => {
    const payload = {
      type: 'kuetx-routine-backup',
      exportedAt: new Date().toISOString(),
      data: buildExportPayload({
        termKey: currentTermKey,
        plannerState: groupId ? { [currentTermKey]: currentTermPlans } : plannerState,
        settings: groupId ? { ...(settings || {}), courseTeacherMap: effectiveCourseTeacherMap } : settings,
        schedule: groupId ? groupPlannerLogs : schedule,
      }),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const _td = new Date();
    link.download = `kuetx-routine-backup-${_td.getFullYear()}-${String(_td.getMonth() + 1).padStart(2, '0')}-${String(_td.getDate()).padStart(2, '0')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const resetPlan = (course) => {
    if (!course?.id) return;
    const manualLogs = groupId ? groupPlannerLogs : (schedule || []);
    const existingLogs = manualLogs.filter(entry => entry.courseId === course.id).length;
    const timer = setTimeout(() => setResetState(prev => ({ ...(prev || {}), open: false, timer: null })), 9000);
    setResetState({ open: true, course, count: existingLogs, timer });
  };

  const confirmResetPlan = (shouldRemoveLogs = true) => {
    const { course } = resetState;
    if (!course?.id) {
      if (resetState.timer) clearTimeout(resetState.timer);
      setResetState({ open: false, course: null, count: 0, timer: null });
      return;
    }

    if (shouldRemoveLogs) {
      if (groupId) {
        groupPlannerLogs
          .filter(entry => entry.courseId === course.id)
          .forEach(entry => deletePlannerLogEntry(groupId, entry.id, profile).catch((e) => console.error('[ClassManagement] resetPlan log delete failed:', e)));
      } else {
        setSchedule(prev => (prev || []).filter(entry => entry.courseId !== course.id));
      }
    }

    updateCurrentTermPlan(course.id, () => createDefaultCoursePlan({ course, termKey: currentTermKey, teachers: effectiveCourseTeacherMap?.[course.id] || [] }));
    if (resetState.timer) clearTimeout(resetState.timer);
    setResetState({ open: false, course: null, count: 0, timer: null });
  };

  const cancelResetPlan = () => {
    if (resetState?.timer) clearTimeout(resetState.timer);
    setResetState({ open: false, course: null, count: 0, timer: null });
  };

  const openTeacherDialog = (courseId) => setCourseTeacherDialogState({ open: true, courseId });
  const openCourseTeacherDialog = openTeacherDialog;
  const handleCourseTeacherDialogClose = () => setCourseTeacherDialogState({ open: false, courseId: '' });
  const handleCourseTeacherDialogSave = (teachersList) => {
    const courseId = courseTeacherDialogState.courseId;
    if (!courseId) return;
    const normalizedTeachers = normalizeTeacherList(teachersList);

    if (groupId) {
      // CourseTeacherDialog stays free-text/name-based by design —
      // resolve the typed names to stable teacherIds before writing.
      // See teacherRegistry.js. Pass existing ids so a same-slot retype
      // renames in place instead of minting a new id.
      const existingIds = Array.isArray(groupPlannerSettings?.courseTeacherMap?.[courseId])
        ? groupPlannerSettings.courseTeacherMap[courseId]
        : [];
      const { registry: nextRegistry, ids } = resolveTeacherIdsForNames(teacherRegistry, normalizedTeachers, existingIds);
      const nextMap = { ...(groupPlannerSettings?.courseTeacherMap || {}) };
      nextMap[courseId] = ids;
      updatePlannerSettings(groupId, profile, { courseTeacherMap: nextMap, teacherRegistry: nextRegistry })
        .catch((e) => console.error('[ClassManagement] courseTeacherMap save failed:', e));
    } else {
      const next = { ...(settings.courseTeacherMap || {}) };
      next[courseId] = normalizedTeachers;
      setSettings({ ...(settings || {}), courseTeacherMap: next });
    }

    // plan.teachers is a separate, display-only cache of names (never used
    // as an attendance/marks key) — keeps storing names regardless of
    // group/local mode.
    updateCurrentTermPlan(courseId, (currentPlan) => ({
      ...currentPlan,
      teachers: normalizedTeachers,
    }));
    handleCourseTeacherDialogClose();
  };

  return {
    profile, allCourses, currentTermKey, currentTermCourses, groupId,
    groupTermStartDate, termDateDraft, setTermDateDraft, termDateSaving, termDateError, setTermDateError, handleSaveTermStartDate,
    groupRoutine, schedule, setSchedule, settings, setSettings, plannerState, setPlannerState,
    groupPlannerLogs, groupPlannerSettings, effectiveCourseTeacherMap, effectivePlannerPlans,
    selectedRoutineDay, setSelectedRoutineDay, viewMode, setViewMode,
    courseTeacherDialogState, setCourseTeacherDialogState, detailState, setDetailState, resetState, setResetState,
    getInitials, currentTermPlans, courseMap, currentTermScheduleEntries, routineEntriesByDay,
    selectedRoutineEntries, selectedRoutineLabel, assignedTeacherCount, currentTermScheduledCourseCount,
    formatRoutineSlot, buildRoutineCopyText, plannerRows, updateCurrentTermPlan,
    openCourseDetails, closeCourseDetails, formatDateTime, removeLogEntry, quickLogClass,
    copyRoutineForSelectedDay, exportRoutineBackup, resetPlan, confirmResetPlan, cancelResetPlan,
    openTeacherDialog, openCourseTeacherDialog, handleCourseTeacherDialogClose, handleCourseTeacherDialogSave,
    isSlotOff, isSlotRecurringOff, isSelectedDayOff, overrideBusyKey, overrideDraft,
    openSlotOverrideDraft, openDayOverrideDraft, updateOverrideDraft, cancelOverrideDraft, confirmOverrideDraft,
    isSessionalType, hasCadenceConfigured, getCadenceEntry, getCadenceOccurrence,
    cadenceBusyKey, cadenceDraft, openCadenceDraft, updateCadenceDraft, cancelCadenceDraft, confirmCadenceDraft,
    removeCadence, toggleCadenceDate, shiftCadence,
  };
}
