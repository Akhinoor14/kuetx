import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, CheckCircle2, Circle } from 'lucide-react';
import { getProfile, getCurrentTermKey } from '../store/store';
import { getGroupId, getGroupLabel } from '../lib/groupUtils';
import { subscribeClassSetup, updateClassSetup, subscribeRoutine, subscribePlannerSettings, updatePlannerSettings, isClassSetupComplete, clearRoutineForTermChange } from '../lib/groupSync';
import { resolveTeacherIdsForNames, resolveTeacherNames } from '../lib/teacherRegistry';
import { setGroupCurrentTermKey, setGroupTermStartDate } from '../lib/termStartDateSync';
import { getCoursesForTerm } from '../store/curriculumStore';
import ClassSetupTermCourses from '../components/ClassSetupTermCourses';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import { Send } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';

/**
 * Dedicated, always-reachable page (CRHub → "Class Setup") for a CR/ACR to
 * review and edit every piece of mandatory class-wide data in one place —
 * the same fields the mandatory ClassSetupModal collects on first CR
 * visit, backed by the exact same read/write functions (groups/{groupId}/
 * meta/classSetup), so there's nothing to keep in sync between "onboarding"
 * and "editing later". Routine and course-teacher map still live on their
 * own dedicated pages (Routine, Class Planner) — this page links out to
 * them and shows whether each is done, rather than re-implementing their
 * editors here.
 */
export default function ClassSetup() {
  const profile = getProfile();
  const groupId = getGroupId(profile);
  const groupLabel = getGroupLabel(profile);

  const [classSetup, setClassSetup] = useState(null);
  const [routineCount, setRoutineCount] = useState(null);
  const [teacherMap, setTeacherMap] = useState(null);
  const [teacherRegistry, setTeacherRegistry] = useState({});
  const [form, setForm] = useState({ termStartDate: '', classEndDate: '', prepLeaveEndDate: '', postExamEndDate: '', examCount: 5 });
  const [examList, setExamList] = useState([]);
  const [examSaving, setExamSaving] = useState(false);
  const [examError, setExamError] = useState('');
  const [examSavedMsg, setExamSavedMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');
  const [termSaving, setTermSaving] = useState(false);
  const [termError, setTermError] = useState('');
  const [termSavedMsg, setTermSavedMsg] = useState('');
  // BUGFIX (major logic gap — see clearRoutineForTermChange in
  // groupSync.js): changing the term now clears the shared weekly
  // routine, since old-term classes were otherwise never removed. That's
  // destructive shared data for the whole class, so route it through a
  // confirm dialog instead of firing silently the moment the CR picks a
  // new term from the dropdown.
  const [pendingTermKey, setPendingTermKey] = useState(null);
  const [telegramLinking, setTelegramLinking] = useState(false);
  const [telegramCode, setTelegramCode] = useState('');
  const [telegramError, setTelegramError] = useState('');

  useEffect(() => {
    if (!groupId) return;
    const unsubSetup = subscribeClassSetup(groupId, (data) => {
      setClassSetup(data);
      setForm({
        termStartDate: data?.termStartDate || '',
        classEndDate: data?.classEndDate || '',
        prepLeaveEndDate: data?.prepLeaveEndDate || '',
        postExamEndDate: data?.postExamEndDate || '',
        examCount: data?.examCount || 5,
      });
      const termKey = data?.currentTermKey || getCurrentTermKey(profile);
      const count = Math.max(1, Math.min(12, Number(data?.examCount) || 5));
      const overrides = (data?.examOverrides && data.examOverrides[termKey]) || [];
      setExamList(Array.from({ length: count }, (_, i) => ({
        course: i + 1,
        name: overrides[i]?.name || '',
        examDate: overrides[i]?.examDate || '',
      })));
    });
    const unsubRoutine = subscribeRoutine(groupId, (entries) => setRoutineCount((entries || []).length));
    const unsubPlanner = subscribePlannerSettings(groupId, (data) => {
      setTeacherMap(data?.courseTeacherMap || {});
      setTeacherRegistry(data?.teacherRegistry || {});
    });
    return () => { unsubSetup(); unsubRoutine(); unsubPlanner(); };
  }, [groupId]);

  const inputStyle = {
    width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border)',
    background: 'var(--bg)', color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle = { fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 4, display: 'block' };

  const handleSave = async () => {
    setError('');
    setSavedMsg('');
    if (!form.termStartDate || !form.classEndDate || !form.prepLeaveEndDate || !form.postExamEndDate) {
      setError('Please fill in every date.');
      return;
    }
    if (form.classEndDate < form.termStartDate) { setError('Class end date can\'t be before term start date.'); return; }
    if (form.prepLeaveEndDate < form.classEndDate) { setError('Prep leave end date can\'t be before class end date.'); return; }
    if (form.postExamEndDate < form.prepLeaveEndDate) { setError('Break end date can\'t be before prep leave end date.'); return; }
    setSaving(true);
    try {
      // Same fix as ClassSetupModal.jsx's handleSaveDates — see that
      // file's comment for the full explanation. termStartDate must be
      // written to BOTH classSetup (this doc) and deptBatchConfig (via
      // setGroupTermStartDate) since Schedule.jsx and other student-
      // facing pages read from deptBatchConfig, not classSetup.
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
        console.error('[ClassSetup] deptBatchConfig termStartDate sync failed:', syncErr);
      }
      setSavedMsg('Saved — visible to your whole class now.');
    } catch (e) {
      setError(e?.message || 'Could not save — please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveExams = async () => {
    setExamError('');
    setExamSavedMsg('');
    setExamSaving(true);
    try {
      const termKey = classSetup?.currentTermKey || getCurrentTermKey(profile);
      if (!termKey) {
        setExamError('Set the current term above first.');
        setExamSaving(false);
        return;
      }
      const nextForTerm = examList.map(x => ({ course: x.course, examDate: x.examDate || '', name: x.name || '' }));
      const nextOverrides = { ...(classSetup?.examOverrides || {}), [termKey]: nextForTerm };
      await updateClassSetup(groupId, profile, { examOverrides: nextOverrides });
      setExamSavedMsg('Saved — visible to your whole class now.');
    } catch (e) {
      setExamError(e?.message || 'Could not save — please try again.');
    } finally {
      setExamSaving(false);
    }
  };

  const handleConnectTelegram = async () => {
    setTelegramError('');
    setTelegramCode('');
    setTelegramLinking(true);
    try {
      const startTelegramLink = httpsCallable(functions, 'startTelegramLink');
      const res = await startTelegramLink({ groupId });
      setTelegramCode(res.data?.code || '');
    } catch (e) {
      setTelegramError(e?.message || 'Could not generate a code — please try again.');
    } finally {
      setTelegramLinking(false);
    }
  };

  const currentTermKey = classSetup?.currentTermKey || '';
  const currentTermCourseIds = currentTermKey ? getCoursesForTerm(profile?.dept, currentTermKey).map((c) => c.id) : [];
  const routineDone = (routineCount || 0) > 0;
  const teacherMapDone = currentTermCourseIds.length > 0
    && currentTermCourseIds.every((id) => Array.isArray(teacherMap?.[id]) && teacherMap[id].length >= 2);
  const complete = classSetup !== null && routineCount !== null && teacherMap !== null
    ? isClassSetupComplete(classSetup, routineCount, teacherMap, currentTermCourseIds)
    : false;

  const handleTermChange = (termKey) => {
    if (!termKey || !groupId) return;
    // First-time setup (no term set yet) needs no confirmation or
    // routine clear — there's nothing old to lose.
    if (!currentTermKey) {
      commitTermChange(termKey);
      return;
    }
    if (termKey === currentTermKey) return;
    setPendingTermKey(termKey);
  };

  const commitTermChange = async (termKey) => {
    setTermError('');
    setTermSavedMsg('');
    setTermSaving(true);
    try {
      const isRealChange = !!currentTermKey && termKey !== currentTermKey;
      await updateClassSetup(groupId, profile, { currentTermKey: termKey });
      await setGroupCurrentTermKey(groupId, termKey);
      if (isRealChange) {
        // Routine entries are the only thing scoped to a term — teacher
        // assignments (courseTeacherMap) deliberately stay untouched, see
        // clearRoutineForTermChange's own comment.
        await clearRoutineForTermChange(groupId, profile);
      }
      setTermSavedMsg(isRealChange
        ? 'Saved — visible to your whole class now. Old routine cleared for the new term.'
        : 'Saved — visible to your whole class now.');
    } catch (e) {
      setTermError(e?.message || 'Could not save — please try again.');
    } finally {
      setTermSaving(false);
      setPendingTermKey(null);
    }
  };

  const handleSaveTeachers = (courseId, teacherNames) => {
    if (!courseId || !groupId) return Promise.resolve();
    setTermError('');
    // CourseTeacherDialog stays free-text/name-based by design — resolve
    // the typed names to stable teacherIds (reusing an existing id for a
    // name already in the registry) before writing, so courseTeacherMap
    // itself never stores raw name strings. See teacherRegistry.js.
    // Pass this course's CURRENT ids so a retyped name at the same slot is
    // treated as a rename of that teacher, not a lookup for a new one
    // (see resolveTeacherIdsForNames' own comment on why this matters).
    const existingIds = Array.isArray(teacherMap?.[courseId]) ? teacherMap[courseId] : [];
    const { registry: nextRegistry, ids } = resolveTeacherIdsForNames(teacherRegistry, teacherNames, existingIds);
    const nextMap = { ...(teacherMap || {}), [courseId]: ids };
    return updatePlannerSettings(groupId, profile, { courseTeacherMap: nextMap, teacherRegistry: nextRegistry })
      .catch((e) => {
        setTermError(e?.message || 'Could not save teachers — please try again.');
        throw e;
      });
  };

  const ChecklistRow = ({ done, label, action }) => (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      padding: '10px 12px', borderRadius: 10, marginBottom: 8,
      background: done ? 'rgba(16,185,129,0.06)' : 'rgba(var(--accentRGB), 0.04)',
      border: `1px solid ${done ? 'rgba(16,185,129,0.18)' : 'var(--border)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {done ? <CheckCircle2 size={16} color="#10B981" /> : <Circle size={16} color="var(--muted)" />}
        <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      </div>
      {action}
    </div>
  );

  return (
    <div className="page-enter content-page-bg" style={{ width: 'min(95vw, 720px)', margin: '0 auto', padding: '16px 14px', paddingBottom: 'calc(32px + env(safe-area-inset-bottom, 0px))' }}>
      <div className="content-page-hero">
        <div className="content-page-hero-main">
          <div className="content-page-hero-head">
            <div className="content-page-hero-icon">
              <CalendarClock size={24} color="var(--accent)" />
            </div>
            <h1 className="content-page-hero-title">Class Setup</h1>
          </div>
          {groupId && (
            <p className="content-page-hero-subtitle">
              Shared term timeline, routine and teacher assignments for <strong>{groupLabel}</strong>
            </p>
          )}
        </div>
      </div>

      {!groupId ? (
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>Add your department and batch in Profile first.</p>
      ) : (
        <>
          <div className="card" style={{ padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              {complete ? 'All set' : 'Setup status'}
            </div>
            <ChecklistRow done={!!(form.termStartDate && form.classEndDate && form.prepLeaveEndDate && form.postExamEndDate)} label="Term timeline dates" />
            <ChecklistRow done={!!currentTermKey} label="Current term" />
            <ChecklistRow
              done={routineDone}
              label="Weekly class routine"
              action={<Link to="/class-routine" className="btn btn-primary btn-sm">{routineDone ? 'Edit →' : 'Add routine →'}</Link>}
            />
            <ChecklistRow done={teacherMapDone} label="Course–teacher assignments" />
          </div>

          <div className="card" style={{ padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
              Current term &amp; teachers
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.5 }}>
              Sets the term for everyone in your class, then lets you assign a teacher to each course in it — right here.
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
            {termSavedMsg && <div style={{ color: '#10B981', fontSize: 12, marginTop: 12 }}>{termSavedMsg}</div>}
            <ConfirmDialog
              open={!!pendingTermKey}
              title="Change term for the whole class?"
              message="This clears the current weekly routine for everyone in your class — you'll need to add the new term's classes to the routine again. Course–teacher assignments are not affected."
              confirmLabel="Change term & clear routine"
              cancelLabel="Cancel"
              confirmTone="danger"
              onConfirm={() => commitTermChange(pendingTermKey)}
              onCancel={() => setPendingTermKey(null)}
            />
          </div>

          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
              Term timeline
            </div>
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
            {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 10 }}>{error}</div>}
            {savedMsg && <div style={{ color: '#10B981', fontSize: 12, marginBottom: 10 }}>{savedMsg}</div>}
            <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>

            {currentTermKey && examList.length > 0 && (
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <label style={labelStyle}>Exam names &amp; dates</label>
                <p style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.5 }}>
                  Name each exam however you like — this replaces the plain "Exam 1, Exam 2…" labels for your whole class.
                </p>
                <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                  {examList.map((e, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))', gap: 8, alignItems: 'center' }}>
                      <input type="text" style={inputStyle} placeholder={`Exam ${e.course} name (optional)`} value={e.name}
                        onChange={(ev) => {
                          const v = ev.target.value;
                          setExamList((prev) => prev.map((p, idx) => idx === i ? { ...p, name: v } : p));
                        }} />
                      <input type="date" style={inputStyle} value={e.examDate}
                        onChange={(ev) => {
                          const v = ev.target.value;
                          setExamList((prev) => prev.map((p, idx) => idx === i ? { ...p, examDate: v } : p));
                        }} />
                    </div>
                  ))}
                </div>
                {examError && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 10 }}>{examError}</div>}
                {examSavedMsg && <div style={{ color: '#10B981', fontSize: 12, marginBottom: 10 }}>{examSavedMsg}</div>}
                <button className="btn btn-primary" disabled={examSaving} onClick={handleSaveExams}>
                  {examSaving ? 'Saving…' : 'Save exam names & dates'}
                </button>
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 16, marginTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
              Telegram notices
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.5 }}>
              Connect your class's own Telegram group and every notice posted here gets sent there
              automatically — only to that one group, nowhere else.
            </p>
            {classSetup?.telegramChatId ? (
              <div style={{ fontSize: 13, color: '#10B981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Send size={14} /> Connected — notices are being sent to your class's Telegram group.
              </div>
            ) : telegramCode ? (
              <div>
                <p style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 8 }}>
                  1. Add <strong>@KUETxNoticeBot</strong> to your class's Telegram group.<br />
                  2. Send this in that group (expires in 15 min):
                </p>
                <div style={{
                  fontSize: 18, fontWeight: 800, letterSpacing: '0.06em', padding: '10px 14px',
                  borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)',
                  textAlign: 'center', marginBottom: 10, fontFamily: 'monospace',
                }}>
                  /register {telegramCode}
                </div>
                <button className="btn btn-ghost" disabled={telegramLinking} onClick={handleConnectTelegram}>
                  {telegramLinking ? 'Generating…' : 'Generate a new code'}
                </button>
              </div>
            ) : (
              <button className="btn btn-primary" disabled={telegramLinking || !groupId} onClick={handleConnectTelegram}>
                <Send size={14} /> {telegramLinking ? 'Generating…' : 'Connect Telegram'}
              </button>
            )}
            {telegramError && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 10 }}>{telegramError}</div>}
          </div>
        </>
      )}
    </div>
  );
}
