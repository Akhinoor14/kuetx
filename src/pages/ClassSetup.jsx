import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, CheckCircle2, Circle } from 'lucide-react';
import { getProfile } from '../store/store';
import { getGroupId, getGroupLabel } from '../lib/groupUtils';
import { subscribeClassSetup, updateClassSetup, subscribeRoutine, subscribePlannerSettings, updatePlannerSettings, isClassSetupComplete } from '../lib/groupSync';
import { setGroupCurrentTermKey } from '../lib/termStartDateSync';
import { getCoursesForTerm } from '../store/curriculumStore';
import ClassSetupTermCourses from '../components/ClassSetupTermCourses';

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
  const [form, setForm] = useState({ termStartDate: '', classEndDate: '', prepLeaveEndDate: '', postExamEndDate: '', examCount: 5 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');
  const [termSaving, setTermSaving] = useState(false);
  const [termError, setTermError] = useState('');
  const [termSavedMsg, setTermSavedMsg] = useState('');

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
    });
    const unsubRoutine = subscribeRoutine(groupId, (entries) => setRoutineCount((entries || []).length));
    const unsubPlanner = subscribePlannerSettings(groupId, (data) => setTeacherMap(data?.courseTeacherMap || {}));
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
      await updateClassSetup(groupId, profile, {
        termStartDate: form.termStartDate,
        classEndDate: form.classEndDate,
        prepLeaveEndDate: form.prepLeaveEndDate,
        postExamEndDate: form.postExamEndDate,
        examCount: Math.max(1, Math.min(12, Number(form.examCount) || 5)),
      });
      setSavedMsg('Saved — visible to your whole class now.');
    } catch (e) {
      setError(e?.message || 'Could not save — please try again.');
    } finally {
      setSaving(false);
    }
  };

  const currentTermKey = classSetup?.currentTermKey || '';
  const currentTermCourseIds = currentTermKey ? getCoursesForTerm(profile?.dept, currentTermKey).map((c) => c.id) : [];
  const routineDone = (routineCount || 0) > 0;
  const teacherMapDone = currentTermCourseIds.length > 0
    && currentTermCourseIds.every((id) => Array.isArray(teacherMap?.[id]) && teacherMap[id].length > 0);
  const complete = classSetup !== null && routineCount !== null && teacherMap !== null
    ? isClassSetupComplete(classSetup, routineCount, teacherMap, currentTermCourseIds)
    : false;

  const handleTermChange = async (termKey) => {
    if (!termKey || !groupId) return;
    setTermError('');
    setTermSavedMsg('');
    setTermSaving(true);
    try {
      await updateClassSetup(groupId, profile, { currentTermKey: termKey });
      await setGroupCurrentTermKey(groupId, termKey);
      setTermSavedMsg('Saved — visible to your whole class now.');
    } catch (e) {
      setTermError(e?.message || 'Could not save — please try again.');
    } finally {
      setTermSaving(false);
    }
  };

  const handleSaveTeachers = (courseId, teachers) => {
    if (!courseId || !groupId) return;
    const next = { ...(teacherMap || {}), [courseId]: teachers };
    setTermError('');
    updatePlannerSettings(groupId, profile, { courseTeacherMap: next })
      .catch((e) => setTermError(e?.message || 'Could not save teachers — please try again.'));
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
              onSaveTeachers={handleSaveTeachers}
              savingTermKey={termSaving}
            />
            {termError && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 12 }}>{termError}</div>}
            {termSavedMsg && <div style={{ color: '#10B981', fontSize: 12, marginTop: 12 }}>{termSavedMsg}</div>}
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
          </div>
        </>
      )}
    </div>
  );
}
