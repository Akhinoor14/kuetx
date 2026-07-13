// FacultyClasses.jsx — "My Classes" (§8.4 of the merged Faculty Module prompt)
//
// Card grid of this teacher's active Class Assignments (from the
// faculty/{uid}/classIndex fan-out, live-subscribed) + "+ Add Class" flow:
// Dept -> Batch -> Term -> Course -> day/time slot picker -> optional
// co-teacher search (best-effort disambiguation via findJoinableAssignment,
// never a hard block per §4 item 2's "convenience, not a gate" note).
//
// Dept list: store.js's DEPARTMENTS (canonical 16-department array).
// Batch list: store.js's BATCH_START_DATES keys.
// Term list: store.js's TERM_KEYS (Y1T1..Y4T2).
// Course list per dept+term: curriculumStore.js's getDeptTerms(deptCode) —
// deliberately NOT getAllCourses(profile), which is keyed to a STUDENT's
// own current term and can't list an arbitrary dept+term a teacher picks.
// Day/time slots: lib/timeModels.js (duplicated from Schedule.jsx — see
// that file's own header comment for why).

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { auth } from '../../lib/firebase';
import {
  DEPARTMENTS, BATCH_START_DATES, TERM_KEYS, getTermIndex,
} from '../../store/store';
import { getDeptTerms } from '../../store/curriculumStore';
import { TIME_MODELS, DAYS } from '../../lib/timeModels';
import {
  subscribeMyClassIndex, createFacultyAssignment, findJoinableAssignment, joinFacultyAssignment,
} from '../../lib/facultyClassSync';
import { notify } from '../../lib/notify';

const BATCHES = Object.keys(BATCH_START_DATES);

const inputStyle = {
  width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--bg)', color: 'var(--text)', fontSize: 13.5, outline: 'none', boxSizing: 'border-box',
};
const labelStyle = { fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 4, display: 'block' };

// BUGFIX: Batch, Term, and Course were previously three fully independent
// dropdowns with zero cross-validation — a teacher could select, say,
// batch 2k25 (started June 2026, barely into Y1T1) together with term
// Y4T2, a combination that can't be real yet. This is a SOFT warning, not
// a hard block: a teacher legitimately might backfill a class for a term
// that already finished, or pre-create one slightly ahead of schedule —
// so we surface the mismatch instead of silently allowing it with zero
// feedback (which is what "everything is selectable" actually meant).
// Roughly 6 months/term is KUET's typical cadence; this is intentionally
// approximate since exact term calendars vary by roadmap config.
function getBatchTermPlausibility(batch, term) {
  if (!batch || !term) return null;
  const startDate = BATCH_START_DATES[batch];
  if (!startDate) return null;
  const termIndex = getTermIndex(term); // 0-based: Y1T1=0, Y1T2=1, ...
  if (termIndex < 0) return null;

  const monthsElapsed = (Date.now() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
  const expectedTermIndex = Math.floor(monthsElapsed / 6);

  // One term of slack in either direction is normal (early/late starts,
  // backfilling a just-finished term) — only warn once the gap is large
  // enough that the combination looks like a mistake rather than a
  // legitimate edge case.
  const gap = termIndex - expectedTermIndex;
  if (gap > 1) {
    return `${batch.toUpperCase()} looks too early for ${term} — double check this is the batch you meant.`;
  }
  if (gap < -2) {
    return `${term} looks like it's already well behind ${batch.toUpperCase()}'s current progress — double check this is the term you meant.`;
  }
  return null;
}

function AddClassModal({ onClose, onCreated }) {
  const [dept, setDept] = useState('');
  const [batch, setBatch] = useState('');
  const [term, setTerm] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [day, setDay] = useState(DAYS[0]);
  const [modelId, setModelId] = useState('50min');
  const [slot, setSlot] = useState(TIME_MODELS['50min'].slots[0]);
  const [saving, setSaving] = useState(false);
  const [joinOffer, setJoinOffer] = useState(null); // { id, groupId, ... } | null

  const termCourses = useMemo(() => {
    if (!dept || !term) return [];
    const terms = getDeptTerms(dept);
    return terms[term] || [];
  }, [dept, term]);

  const selectedCourse = termCourses.find((c) => c.code === courseCode) || null;
  const batchTermWarning = useMemo(() => getBatchTermPlausibility(batch, term), [batch, term]);

  // Best-effort join-instead-of-duplicate check (§4 item 2) — fires once
  // dept+batch+term+course are all picked, silently offers a join if an
  // open-slot match exists. Never blocks continuing to create a new one.
  useEffect(() => {
    setJoinOffer(null);
    if (!dept || !batch || !term || !courseCode) return;
    let cancelled = false;
    const groupId = `${String(batch).toUpperCase()}_${String(dept).toUpperCase()}`;
    findJoinableAssignment(groupId, courseCode, term).then((match) => {
      if (!cancelled && match) setJoinOffer(match);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [dept, batch, term, courseCode]);

  const handleJoin = async () => {
    if (!joinOffer) return;
    setSaving(true);
    try {
      await joinFacultyAssignment(auth.currentUser.uid, joinOffer.groupId, joinOffer.id);
      notify('Joined the existing class assignment.', 'success');
      onCreated();
    } catch (e) {
      notify(e.message || 'Could not join this class.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!dept || !batch || !term || !courseCode) {
      notify('Please select department, batch, term, and course.', 'error');
      return;
    }
    setSaving(true);
    try {
      await createFacultyAssignment(auth.currentUser.uid, {
        dept, batch, term,
        courseCode,
        courseTitle: selectedCourse?.title || '',
        courseType: selectedCourse?.type || 'Theory',
        dayTimeSlots: [{ day, slot, modelId }],
      });
      notify('Class created.', 'success');
      onCreated();
    } catch (e) {
      notify(e.message || 'Could not create this class.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16,
    }}>
      <div style={{
        background: 'var(--card)', borderRadius: 18, padding: 24, width: '100%', maxWidth: 480,
        maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border)', boxShadow: '0 32px 80px rgba(0,0,0,0.28)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--text)' }}>Add Class</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
            <Icons.X size={18} />
          </button>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label style={labelStyle}>Department</label>
            <select style={inputStyle} value={dept} onChange={(e) => { setDept(e.target.value); setTerm(''); setCourseCode(''); }}>
              <option value="">Select department</option>
              {DEPARTMENTS.map((d) => <option key={d.code} value={d.code}>{d.name} ({d.code})</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Batch</label>
            <select style={inputStyle} value={batch} onChange={(e) => setBatch(e.target.value)}>
              <option value="">Select batch</option>
              {BATCHES.map((b) => <option key={b} value={b}>{b.toUpperCase()}</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Term</label>
            <select style={inputStyle} value={term} onChange={(e) => { setTerm(e.target.value); setCourseCode(''); }} disabled={!dept}>
              <option value="">Select term</option>
              {TERM_KEYS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Course</label>
            <select style={inputStyle} value={courseCode} onChange={(e) => setCourseCode(e.target.value)} disabled={!term || termCourses.length === 0}>
              <option value="">{term && termCourses.length === 0 ? 'No courses found for this term' : 'Select course'}</option>
              {termCourses.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.title} ({c.type})</option>)}
            </select>
          </div>

          {batchTermWarning && (
            <div style={{
              padding: '10px 12px', borderRadius: 8, background: 'color-mix(in srgb, #f59e0b 10%, var(--card))',
              border: '1px solid color-mix(in srgb, #f59e0b 35%, transparent)', fontSize: 12.5, color: 'var(--text)',
            }}>
              ⚠️ {batchTermWarning}
            </div>
          )}

          {joinOffer && (
            <div style={{
              padding: '10px 12px', borderRadius: 8, background: 'color-mix(in srgb, var(--accent) 8%, var(--card))',
              border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)', fontSize: 12.5, color: 'var(--text)',
            }}>
              This course already has an open teacher slot for this batch and term.{' '}
              <button onClick={handleJoin} disabled={saving} style={{ color: 'var(--accent)', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                Join it instead
              </button>{' '}
              — or continue below to create a separate one.
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Day</label>
              <select style={inputStyle} value={day} onChange={(e) => setDay(e.target.value)}>
                {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Time model</label>
              <select style={inputStyle} value={modelId} onChange={(e) => { setModelId(e.target.value); setSlot(TIME_MODELS[e.target.value].slots[0]); }}>
                {Object.values(TIME_MODELS).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Time slot</label>
            <select style={inputStyle} value={slot} onChange={(e) => setSlot(e.target.value)}>
              {TIME_MODELS[modelId].slots.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <button
            onClick={handleCreate}
            disabled={saving || !dept || !batch || !term || !courseCode}
            style={{
              marginTop: 6, padding: '11px 16px', borderRadius: 8, border: 'none',
              background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13.5,
              cursor: 'pointer', opacity: (saving || !dept || !batch || !term || !courseCode) ? 0.6 : 1,
            }}
          >
            {saving ? 'Creating…' : 'Create Class'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FacultyClasses() {
  const navigate = useNavigate();
  const [classes, setClasses] = useState(null); // null = loading, [] = loaded-empty
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setClasses([]); return; }
    return subscribeMyClassIndex(uid, setClasses);
  }, []);

  const activeClasses = (classes || []).filter((c) => c.status === 'active');

  return (
    <div className="hub-page-bg" style={{ minHeight: '100vh' }}>
      <div style={{ padding: '20px 24px 40px', width: '97%', maxWidth: 'none', margin: '0 auto' }}>
        <div className="hub-page-hero" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="hub-page-hero-icon">
              <Icons.BookOpen size={20} color="var(--accent)" />
            </div>
            <h1 className="hub-page-hero-title">My Classes</h1>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 8,
              border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}
          >
            <Icons.Plus size={15} /> Add Class
          </button>
        </div>

        {classes === null && (
          <div style={{ color: 'var(--muted)', fontSize: 13, padding: '20px 0' }}>Loading…</div>
        )}

        {classes !== null && activeClasses.length === 0 && (
          <div style={{
            padding: 24, borderRadius: 14, border: '1px solid var(--border)',
            background: 'var(--card)', color: 'var(--muted)', fontSize: 13.5, textAlign: 'center',
          }}>
            You haven't added any classes yet. Tap "Add Class" to get started.
          </div>
        )}

        <div className="hub-grid">
          {activeClasses.map((c) => (
            <div
              key={c.id}
              className="hub-grid-item"
              onClick={() => navigate(`/faculty/classes/${c.id}?groupId=${encodeURIComponent(c.groupId)}`)}
              style={{ cursor: 'pointer' }}
            >
              <div className="hub-grid-item-icon" style={{
                background: 'color-mix(in srgb, var(--accent) 15%, var(--surface))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icons.BookOpen size={17} color="var(--accent)" />
              </div>
              <span className="hub-grid-item-label" style={{ fontWeight: 600, color: '#5c5a54' }}>
                {c.courseCode} · {c.batch?.toUpperCase()} {c.dept}
              </span>
            </div>
          ))}
        </div>
      </div>

      {showAdd && (
        <AddClassModal
          onClose={() => setShowAdd(false)}
          onCreated={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}
