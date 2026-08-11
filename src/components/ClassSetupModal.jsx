import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, CheckCircle2, Circle, X } from 'lucide-react';
import Modal from './Modal';
import { subscribeClassSetup, updateClassSetup, subscribeRoutine, subscribePlannerSettings, updatePlannerSettings, isClassSetupComplete } from '../lib/groupSync';
import { setGroupCurrentTermKey, setGroupTermStartDate } from '../lib/termStartDateSync';
import { getCoursesForTerm } from '../store/curriculumStore';
import { store } from '../store/store';
import ClassSetupTermCourses from './ClassSetupTermCourses';
import { resolveTeacherIdsForNames } from '../lib/teacherRegistry';

/**
 * "Class Setup" popup shown to a CR/ACR on their FIRST visit to any
 * CR-only page after being approved (see RequireCR.jsx, which mounts
 * this). This is the single dedicated place all the "the CR is supposed
 * to provide this for the whole class" data gets collected — previously
 * scattered across deptBatchConfig.termStartDate (synced) and a
 * per-student, never-synced local roadmapConfig, with nothing enforcing
 * any of it actually got filled in.
 *
 * Everything here writes to ONE group-wide doc (groups/{groupId}/meta/
 * classSetup) so every class member reads the same values, and a CR can
 * always come back later via the dedicated /class-setup page to edit —
 * this modal and that page share the same read/write functions, so
 * there's no separate "edit copy" to keep in sync.
 *
 * Deliberately does NOT collect the CR's own mobile number here — that's
 * already mandatory at CR-claim time (see ClaimCRCard.jsx) before this
 * modal is ever reached, so it isn't repeated.
 *
 * DISMISSIBLE, WITH A DAILY REMINDER (changed from fully non-skippable):
 * this used to have closeOnOverlayClick={false} and no close button at
 * all — the only way out was finishing every step, in this modal, right
 * now. That's a hard trap for anything that isn't a same-session,
 * few-taps task: if a CR is mid-way through something else, doesn't have
 * the routine finalized yet, or the flow reaches a step (like routine)
 * where the actual work happens on a DIFFERENT page, there was no way to
 * back out and come back later — only the specific escape hatches each
 * step happened to offer (and the routine step's wasn't even clearly
 * labeled as one, see the routine-step copy below). A modal with no
 * close button is only reasonable for something genuinely instant;
 * multi-step, cross-page setup isn't that. Now: an explicit X always
 * closes it, dismissal is remembered per-day (not permanently — an
 * incomplete class setup is still genuinely blocking for the whole
 * class's Dashboard/Schedule/alerts, so it should keep resurfacing, just
 * not trap the CR in the moment), and it re-shows once per calendar day
 * until setup is actually complete.
 */
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const DISMISS_KEY = 'classSetupModalDismissedOn';

export default function ClassSetupModal({ groupId, profile, onDone }) {
  const [classSetup, setClassSetup] = useState(null);
  const [routineCount, setRoutineCount] = useState(null);
  const [teacherMap, setTeacherMap] = useState(null);
  const [teacherRegistry, setTeacherRegistry] = useState({});
  const [form, setForm] = useState({ termStartDate: '', classEndDate: '', prepLeaveEndDate: '', postExamEndDate: '', examCount: 5 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [termSaving, setTermSaving] = useState(false);
  const [termError, setTermError] = useState('');
  // Re-read on every mount (fresh page load / nav) rather than once ever,
  // so "dismissed today" genuinely expires the next calendar day without
  // needing a page refresh mid-session to notice the date rolled over.
  const [dismissedToday, setDismissedToday] = useState(
    () => store.get(DISMISS_KEY) === todayStr()
  );

  useEffect(() => {
    if (!groupId) return;
    const unsubSetup = subscribeClassSetup(groupId, (data) => {
      setClassSetup(data);
      setForm((f) => ({
        termStartDate: data?.termStartDate || f.termStartDate,
        classEndDate: data?.classEndDate || f.classEndDate,
        prepLeaveEndDate: data?.prepLeaveEndDate || f.prepLeaveEndDate,
        postExamEndDate: data?.postExamEndDate || f.postExamEndDate,
        examCount: data?.examCount || f.examCount || 5,
      }));
    });
    const unsubRoutine = subscribeRoutine(groupId, (entries) => setRoutineCount((entries || []).length));
    const unsubPlanner = subscribePlannerSettings(groupId, (data) => {
      setTeacherMap(data?.courseTeacherMap || {});
      setTeacherRegistry(data?.teacherRegistry || {});
    });
    return () => { unsubSetup(); unsubRoutine(); unsubPlanner(); };
  }, [groupId]);

  // Still loading the three sources — don't flash "incomplete" before we
  // actually know.
  if (classSetup === null || routineCount === null || teacherMap === null) return null;

  const currentTermCourseIds = classSetup?.currentTermKey
    ? getCoursesForTerm(profile?.dept, classSetup.currentTermKey).map((c) => c.id)
    : [];
  const complete = isClassSetupComplete(classSetup, routineCount, teacherMap, currentTermCourseIds);
  if (complete) {
    onDone?.();
    return null;
  }

  // Dismissed already today — stay out of the way until either the CR
  // comes back tomorrow (dismissedToday recalculates on next mount, since
  // it's date-keyed) or finishes setup for real (the `complete` check
  // above already handles that case regardless of dismissal).
  if (dismissedToday) return null;

  const handleDismiss = () => {
    store.set(DISMISS_KEY, todayStr());
    setDismissedToday(true);
  };

  // BUGFIX (Save button vanished before it could ever be clicked — "save
  // chapleo hocchilo na, kono error dekhini" / dates never actually
  // reached Firestore): `datesFilled` used to gate which step's UI shows
  // (`!datesFilled ? <date form> : <next step>`). The INSTANT the 4th and
  // final date field was filled in, datesFilled flipped to true on that
  // same render — which immediately swapped the whole date form (Save
  // button included) out for the NEXT step's UI, before there was ever a
  // chance to click "Save & continue". The typed dates were sitting fine
  // in `form` state the whole time (never actually lost), but
  // handleSaveDates() — the only thing that writes them to Firestore —
  // was never called, so classSetup's date fields stayed empty/stale on
  // the server. No error ever showed because there was never a failed
  // save attempt — there was no save attempt at all.
  //
  // Fix: track whether the dates step has actually been SUBMITTED
  // (datesSaved, set true only inside handleSaveDates after a successful
  // write) as a separate thing from whether the fields merely look full
  // enough to submit (datesFilled, still used below to enable/disable the
  // Save button itself). The date form now only goes away once the save
  // truly completed — filling in the last field just enables the button;
  // it no longer skips the step.
  const datesFilled = form.termStartDate && form.classEndDate && form.prepLeaveEndDate && form.postExamEndDate;
  const datesSaved = !!(classSetup?.termStartDate && classSetup?.classEndDate && classSetup?.prepLeaveEndDate && classSetup?.postExamEndDate);
  const currentTermKey = classSetup?.currentTermKey || '';
  const termDone = !!currentTermKey;
  const routineDone = routineCount > 0;
  const teacherMapDone = currentTermCourseIds.length > 0
    && currentTermCourseIds.every((id) => Array.isArray(teacherMap?.[id]) && teacherMap[id].length >= 2);

  const handleTermChange = async (termKey) => {
    if (!termKey) return;
    setTermError('');
    setTermSaving(true);
    try {
      await updateClassSetup(groupId, profile, { currentTermKey: termKey });
      await setGroupCurrentTermKey(groupId, termKey);
    } catch (e) {
      setTermError(e?.message || 'Could not save — please try again.');
    } finally {
      setTermSaving(false);
    }
  };

  const handleSaveTeachers = (courseId, teacherNames) => {
    if (!courseId) return Promise.resolve();
    // CourseTeacherDialog stays free-text/name-based by design — resolve
    // the typed names to stable teacherIds before writing. See
    // teacherRegistry.js. Pass existing ids so a same-slot retype renames
    // in place instead of minting a new id (see resolveTeacherIdsForNames).
    const existingIds = Array.isArray(teacherMap?.[courseId]) ? teacherMap[courseId] : [];
    const { registry: nextRegistry, ids } = resolveTeacherIdsForNames(teacherRegistry, teacherNames, existingIds);
    const nextMap = { ...(teacherMap || {}), [courseId]: ids };
    return updatePlannerSettings(groupId, profile, { courseTeacherMap: nextMap, teacherRegistry: nextRegistry })
      .catch((e) => {
        setTermError(e?.message || 'Could not save teachers — please try again.');
        throw e;
      });
  };

  const handleSaveDates = async () => {
    setError('');
    if (!form.termStartDate || !form.classEndDate || !form.prepLeaveEndDate || !form.postExamEndDate) {
      setError('Please fill in every date before continuing.');
      return;
    }
    if (form.classEndDate < form.termStartDate) {
      setError('Class end date can\'t be before term start date.');
      return;
    }
    if (form.prepLeaveEndDate < form.classEndDate) {
      setError('Prep leave end date can\'t be before class end date.');
      return;
    }
    if (form.postExamEndDate < form.prepLeaveEndDate) {
      setError('Break end date can\'t be before prep leave end date.');
      return;
    }
    setSaving(true);
    try {
      // BUGFIX (term start date "disappears" on the actual Schedule
      // page): termStartDate was being written ONLY to classSetup
      // (groups/{groupId}/meta/classSetup, via updateClassSetup below) —
      // but Schedule.jsx (the page every student, not just the CR, sees
      // their term dates through) reads groupTermStartDate from a
      // COMPLETELY DIFFERENT doc: deptBatchConfig/{groupId}, via
      // subscribeGroupTermStartDate/setGroupTermStartDate in
      // termStartDateSync.js. The two were never kept in sync — a CR
      // filling in this mandatory popup satisfied the checklist (classSetup
      // had the value) but the actual schedule page kept showing nothing/
      // stale data, because deptBatchConfig never got written. Writing to
      // both now keeps every reader (classSetup readers like /class-setup
      // and this modal; deptBatchConfig readers like Schedule.jsx) in sync
      // from a single save action. Best-effort on the deptBatchConfig
      // write — a failure there shouldn't block the classSetup save that
      // the mandatory-popup checklist depends on, but IS still surfaced
      // as a warning so it isn't silently lost from the actually-visible
      // schedule.
      await updateClassSetup(groupId, profile, {
        termStartDate: form.termStartDate,
        classEndDate: form.classEndDate,
        prepLeaveEndDate: form.prepLeaveEndDate,
        postExamEndDate: form.postExamEndDate,
        examCount: Math.max(1, Math.min(12, Number(form.examCount) || 5)),
      });
      try {
        await setGroupTermStartDate(groupId, form.termStartDate);
      } catch (syncErr) {
        console.error('[ClassSetupModal] deptBatchConfig termStartDate sync failed:', syncErr);
        setError('Saved, but the Schedule page may not reflect the term start date yet — please also set it from Class Routine.');
      }
    } catch (e) {
      setError(e?.message || 'Could not save — please try again.');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border)',
    background: 'var(--bg)', color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle = { fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 4, display: 'block' };

  const ChecklistRow = ({ done, label, action }) => (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      padding: '10px 12px', borderRadius: 10, marginBottom: 8,
      background: done ? 'rgba(16,185,129,0.06)' : 'rgba(var(--accentRGB), 0.04)',
      border: `1px solid ${done ? 'rgba(16,185,129,0.18)' : 'var(--border)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {done ? <CheckCircle2 size={16} color="#10B981" /> : <Circle size={16} color="var(--muted)" />}
        <span style={{ fontSize: 13, fontWeight: 600, color: done ? 'var(--text)' : 'var(--muted)' }}>{label}</span>
      </div>
      {!done && action}
    </div>
  );

  return (
    // BUGFIX (data silently lost — "save chapleo hyni, kono error dekhini"):
    // this used to have closeOnOverlayClick={true}. The native browser
    // date-picker (the calendar icon on each date input below — that's
    // browser chrome, not app-rendered UI) can render/close in a way that
    // registers as a click landing on the semi-transparent overlay behind
    // this modal, not on the modal content itself — even though visually
    // the calendar looked like it was "inside" the popup. Modal.jsx's
    // overlay onClick calls onClose (handleDismiss here) on ANY click that
    // reaches it, with no distinction between "the person meant to dismiss
    // the whole form" and "a native date-picker's own close click bubbled
    // through." The result: picking a date, closing that native calendar,
    // and the WHOLE modal silently closing — unsaved dates gone, no error
    // shown (there was never a save attempt to fail), and the same
    // incomplete popup reappearing the next day looking unchanged. There's
    // already an explicit, clearly-labeled × button (handleDismiss) for
    // "I want to leave this for later" — that's the only way out now;
    // overlay clicks are just ignored while this form is open.
    <Modal closeOnOverlayClick={false} onClose={handleDismiss} contentStyle={{ width: 'min(94vw, 480px)', maxHeight: '88vh', overflowY: 'auto' }}>
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <CalendarClock size={22} color="var(--accent)" />
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>Set up your class</h2>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Close — remind me later"
            title="Close — you'll be reminded again tomorrow until this is done"
            style={{
              flexShrink: 0, width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--bg)', color: 'var(--muted)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 16 }}>
          As CR/ACR, this info is shared with your whole class — everyone's Dashboard, Schedule and
          alerts depend on it. This only has to be done once; you can edit it later from Class Setup.
          Not ready right now? Tap <strong>×</strong> above — you'll see this again tomorrow until it's finished.
        </p>

        {!datesSaved ? (
          <>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Term start date</label>
              <input type="date" style={inputStyle} value={form.termStartDate}
                onChange={(e) => setForm({ ...form, termStartDate: e.target.value })} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Class end date</label>
              <input type="date" style={inputStyle} value={form.classEndDate} min={form.termStartDate || undefined}
                onChange={(e) => setForm({ ...form, classEndDate: e.target.value })} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Prep leave end date</label>
              <input type="date" style={inputStyle} value={form.prepLeaveEndDate} min={form.classEndDate || undefined}
                onChange={(e) => setForm({ ...form, prepLeaveEndDate: e.target.value })} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Number of theory exams</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button type="button" onClick={() => setForm({ ...form, examCount: Math.max(1, (form.examCount ?? 5) - 1) })}
                  style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', fontWeight: 800 }}>−</button>
                <span style={{ fontWeight: 800, fontSize: 16, minWidth: 24, textAlign: 'center' }}>{form.examCount ?? 5}</span>
                <button type="button" onClick={() => setForm({ ...form, examCount: Math.min(12, (form.examCount ?? 5) + 1) })}
                  style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', fontWeight: 800 }}>+</button>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Post-exam break end date</label>
              <input type="date" style={inputStyle} value={form.postExamEndDate} min={form.prepLeaveEndDate || undefined}
                onChange={(e) => setForm({ ...form, postExamEndDate: e.target.value })} />
            </div>
            {error && (
              // PERF/VISIBILITY FIX: was plain small text easy to miss in a
              // scrollable form (the CR types a date, hits Save, the error
              // renders above the fold or blends in, and it looks like
              // nothing happened at all — same "no error dekhini" symptom
              // as the overlay-click bug above, just from a different
              // cause). Now visually boxed so a real validation failure is
              // unmistakable instead of easy to scroll past.
              <div style={{
                color: 'var(--danger)', fontSize: 12.5, fontWeight: 600, marginBottom: 12,
                padding: '8px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.25)',
              }}>{error}</div>
            )}
            <button className="btn btn-primary" style={{ width: '100%' }} disabled={saving} onClick={handleSaveDates}>
              {saving ? 'Saving…' : 'Save & continue'}
            </button>
          </>
        ) : !termDone ? (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              Set your class's current term
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 12 }}>
              Pick the term everyone in your class is in right now — this replaces each student picking their own term.
            </p>
            <ClassSetupTermCourses
              dept={profile?.dept}
              currentTermKey={currentTermKey}
              onTermChange={handleTermChange}
              courseTeacherMap={teacherMap}
              teacherRegistry={teacherRegistry}
              onSaveTeachers={handleSaveTeachers}
              savingTermKey={termSaving}
            />
            {termError && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 12 }}>{termError}</div>}
          </>
        ) : (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              {teacherMapDone ? 'One more required step' : 'Assign your course teachers'}
            </div>
            {!teacherMapDone && (
              <ClassSetupTermCourses
                dept={profile?.dept}
                currentTermKey={currentTermKey}
                onTermChange={handleTermChange}
                courseTeacherMap={teacherMap}
                teacherRegistry={teacherRegistry}
                onSaveTeachers={handleSaveTeachers}
                savingTermKey={termSaving}
              />
            )}
            <ChecklistRow
              done={routineDone}
              label="Weekly class routine"
              // BUGFIX (Set up your class popup never closes, even after
              // adding a routine): this used to link to /class-routine
              // (ClassRoutine.jsx), which is a READ-ONLY routine viewer —
              // it shows entry counts per day and lets a CR set the term
              // start date, but has no add/edit form anywhere on the page
              // (compare Schedule.jsx, which owns addRoutineEntry/
              // updateRoutineEntry/the whole quick-add form). A CR
              // following this button could never actually add a routine
              // entry from where it sent them, so routineCount stayed 0
              // forever and isClassSetupComplete() never flipped true —
              // the modal looked stuck on every CR-only page permanently,
              // even though the CR had genuinely tried to complete it.
              // /schedule is where addRoutineEntry is actually wired up.
              action={<Link to="/schedule" className="btn btn-primary btn-sm">Add routine →</Link>}
            />
            <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>
              {/* CLARITY FIX: the old copy ("This popup stays until
                  everything's done... it'll close automatically") gave no
                  indication that the button right above IS the way out —
                  a CR who'd already finished dates/term/teachers, landing
                  here with only routine left, had no non-routine field to
                  fill in on THIS screen and no cue that clicking away to
                  /schedule was expected/safe. Spelling out that /schedule
                  is unlocked (no popup there) makes the escape path
                  explicit instead of implied. */}
              Tap <strong>Add routine →</strong> above — that page isn't blocked by this popup, so you can add your weekly classes there freely. Come back to any CR page after and this will have closed on its own.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}
