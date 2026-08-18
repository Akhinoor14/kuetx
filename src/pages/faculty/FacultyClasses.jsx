// FacultyClasses.jsx — "My Classes" (§8.4 of the merged Faculty Module prompt)
//
// Card grid of this teacher's active Class Assignments (from the
// faculty/{uid}/classIndex fan-out, live-subscribed) + "+ Add Class" flow:
// Dept -> Batch -> Term -> Course -> day/time slot picker -> optional
// co-teacher search (best-effort disambiguation via findJoinableAssignment,
// never a hard block per §4 item 2's "convenience, not a gate" note).
//
// Dept list: store.js's DEPARTMENTS (canonical 16-department array).
// Batch list + start dates: appConfigSync.js's live config/batches doc
// (Founder-editable — see FounderBatchSettings.jsx), falling back to
// store.js's BATCH_START_DATES seed until that doc exists.
// Term list: derived from curriculumStore.js's getDeptTerms(deptCode),
// with TERM_KEYS as fallback while a department's curriculum is loading.
// Course list per dept+term: curriculumStore.js's getDeptTerms(deptCode) —
// deliberately NOT getAllCourses(profile), which is keyed to a STUDENT's
// own current term and can't list an arbitrary dept+term a teacher picks.
// Day/time slots: lib/timeModels.js (duplicated from Schedule.jsx — see
// that file's own header comment for why).
// Sessional/Lab courses: offers a "Full sessional block (3 periods)" vs
// "Single slot" choice once the selected course's type is Sessional/Lab —
// same 3-period-wide slot strings (getPresetSessionalSlots) the student
// Schedule.jsx grid already renders as one merged/rowspan cell, so a
// teacher's own listing lines up with what students already see.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { auth } from '../../lib/firebase';
import {
  DEPARTMENTS, TERM_KEYS, getTermIndex,
} from '../../store/store';
import { getDeptTerms } from '../../store/curriculumStore';
import {
  TIME_MODELS, DAYS, isSessionalType, getPresetSessionalSlots, getBatchColor, sortBatches,
} from '../../lib/timeModels';
import { getActiveBatches, getBatchStartDates } from '../../lib/appConfigSync';
import {
  subscribeMyClassIndex, createFacultyAssignment, findJoinableAssignment, requestToJoinFacultyAssignment,
  findConflictingAssignment, joinViaInviteCode,
} from '../../lib/facultyClassSync';
import { notify } from '../../lib/notify';
import { useIsFaculty } from '../../hooks/useIsFaculty';
import { getGroupId, isMultiSectionDept } from '../../lib/groupUtils';

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
function getBatchTermPlausibility(batch, term, startDates) {
  if (!batch || !term) return null;
  const startDate = startDates?.[batch];
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

// Exported so other faculty pages (e.g. FacultySchedule.jsx's empty-grid-cell
// click) can open the exact same Add Class flow instead of duplicating its
// dept->batch->term->course->slot logic. initialDay/initialSlot let a caller
// pre-fill the day/time picker (day+slot alone isn't enough to create a
// class here — dept/batch/term/course still have to be picked — so this is
// a head start, not a full quick-add).
export function AddClassModal({ onClose, onCreated, batches, initialDay, initialSlot }) {
  const [dept, setDept] = useState('');
  const [batch, setBatch] = useState('');
  // Section — required only for the 4 multi-section depts (CE/EEE/ME/CSE,
  // 120 seats/batch). 'A' | 'B' | 'BOTH'. 'BOTH' creates two separate
  // assignments (one per section-group) since Section A and B meet at
  // different times in reality, even for the same course/teacher.
  const [section, setSection] = useState('');
  const [term, setTerm] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [day, setDay] = useState(initialDay || DAYS[0]);
  const [modelId, setModelId] = useState('50min');
  const [slot, setSlot] = useState(initialSlot || TIME_MODELS['50min'].slots[0]);
  // Sessional block choice — only meaningful once the selected course is
  // Sessional/Lab (see isSessionalCourse below). 'full' picks one of the
  // 3-period-wide preset slots (getPresetSessionalSlots); 'single' keeps
  // using the normal per-period TIME_MODELS slot list, for a teacher who
  // only wants ONE period of what's otherwise a multi-period lab — e.g.
  // co-teaching where each teacher covers a different single period of
  // the same sessional, rather than one teacher owning the whole block.
  const [sessionalMode, setSessionalMode] = useState('full');
  const [sessionalSlot, setSessionalSlot] = useState(getPresetSessionalSlots('50min')[0] || '');
  const [saving, setSaving] = useState(false);
  const [joinOffer, setJoinOffer] = useState(null); // { id, groupId, ... } | null
  const [slotConflict, setSlotConflict] = useState(null); // { courseCode, courseTitle, ... } | null
  const [batchStartDates, setBatchStartDates] = useState({});
  // Phase I — "Have a code?" alternative entry, skips the whole
  // dept/batch/section/term/course picker below entirely when used.
  const [showCodeEntry, setShowCodeEntry] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [joiningViaCode, setJoiningViaCode] = useState(false);
  useEffect(() => {
    getBatchStartDates().then(setBatchStartDates);
  }, []);

  const termCourses = useMemo(() => {
    if (!dept || !term) return [];
    const terms = getDeptTerms(dept);
    return terms[term] || [];
  }, [dept, term]);

  const termOptions = useMemo(() => {
    if (!dept) return TERM_KEYS;
    const termKeys = Object.keys(getDeptTerms(dept) || {}).filter((k) => /^Y\d+T[12]$/.test(String(k)));
    if (!termKeys.length) return TERM_KEYS;
    return termKeys.sort((a, b) => getTermIndex(a) - getTermIndex(b));
  }, [dept]);

  const selectedCourse = termCourses.find((c) => c.code === courseCode) || null;
  const isSessionalCourse = isSessionalType(selectedCourse?.type);
  const batchTermWarning = useMemo(() => getBatchTermPlausibility(batch, term, batchStartDates), [batch, term, batchStartDates]);

  // Keep the sessional-block slot options in sync with the chosen time
  // model — a 50-min-model sessional's 3 preset ranges differ from the
  // 40-min-model's, so switching models needs to reset the picked value
  // back to a valid option rather than leaving a stale one selected.
  useEffect(() => {
    const presets = getPresetSessionalSlots(modelId);
    if (presets.length) setSessionalSlot(presets[0]);
  }, [modelId]);

  // The actual slot value that gets saved — full sessional block preset
  // when the course is Sessional/Lab AND the teacher picked 'full', the
  // single-period slot otherwise (either a non-sessional course, or a
  // sessional where the teacher explicitly wants just one period).
  const effectiveSlot = (isSessionalCourse && sessionalMode === 'full') ? sessionalSlot : slot;

  // Best-effort join-instead-of-duplicate check (§4 item 2) — fires once
  // dept+batch+term+course are all picked, silently offers a join if an
  // open-slot match exists. Never blocks continuing to create a new one.
  useEffect(() => {
    setJoinOffer(null);
    if (!dept || !batch || !term || !courseCode) return;
    // For multi-section depts, a specific section (not 'BOTH', not empty)
    // is needed to resolve one real group — skip the join-offer check
    // until the teacher has picked which section this is for.
    if (isMultiSectionDept(dept) && (!section || section === 'BOTH')) return;
    const groupId = getGroupId({ dept, batch, section });
    if (!groupId) return;
    let cancelled = false;
    findJoinableAssignment(groupId, courseCode, term).then((match) => {
      if (!cancelled && match) setJoinOffer(match);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [dept, batch, section, term, courseCode]);

  // PHASE 1 (CR_TEACHER_LINKING_NOTES.md) — this used to call
  // joinFacultyAssignment() directly, silently adding this teacher to
  // someone else's class with no notice to them at all. It now files a
  // pending request instead; the existing teacher on the assignment has
  // to accept it from their own Class Detail page before this account
  // actually joins.
  const handleJoin = async () => {
    if (!joinOffer) return;
    setSaving(true);
    try {
      await requestToJoinFacultyAssignment(auth.currentUser.uid, joinOffer.groupId, joinOffer.id, {
        requestedByName: auth.currentUser.displayName || null,
      });
      notify('Request sent — the class stays with the current teacher until they accept.', 'success');
      onCreated();
    } catch (e) {
      notify(e.message || 'Could not send a join request.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Phase I — code-based join, bypasses dept/batch/section/term/course
  // entirely (the code itself already identifies the exact assignment).
  const handleJoinViaCode = async () => {
    if (!codeInput.trim()) return;
    setJoiningViaCode(true);
    try {
      await joinViaInviteCode(auth.currentUser.uid, codeInput);
      notify('Joined the class.', 'success');
      onCreated();
    } catch (e) {
      notify(e.message || 'Could not join with this code.', 'error');
    } finally {
      setJoiningViaCode(false);
    }
  };

  // Cross-teacher/cross-course day+time conflict check — fires whenever
  // the picked day+slot changes (not just on the initial dept/batch/term/
  // course selection, since a teacher tweaking the time slot after
  // picking a course should re-check too). Soft warning only, per
  // findConflictingAssignment's own doc comment — never blocks Create.
  useEffect(() => {
    setSlotConflict(null);
    if (!dept || !batch || !term || !courseCode) return;
    if (isMultiSectionDept(dept) && (!section || section === 'BOTH')) return;
    const groupId = getGroupId({ dept, batch, section });
    if (!groupId) return;
    let cancelled = false;
    findConflictingAssignment(groupId, {
      courseCode, term, dayTimeSlots: [{ day, slot: effectiveSlot }],
    }).then((match) => {
      if (!cancelled) setSlotConflict(match);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [dept, batch, section, term, courseCode, day, effectiveSlot]);

  const handleCreate = async () => {
    if (!dept || !batch || !term || !courseCode) {
      notify('Please select department, batch, term, and course.', 'error');
      return;
    }
    if (isMultiSectionDept(dept) && !section) {
      notify('This department has two sections — please select Section A, B, or Both.', 'error');
      return;
    }
    setSaving(true);
    try {
      const basePayload = {
        dept, batch, term,
        courseCode,
        courseTitle: selectedCourse?.title || '',
        courseType: selectedCourse?.type || 'Theory',
        dayTimeSlots: [{ day, slot: effectiveSlot, modelId }],
      };
      if (isMultiSectionDept(dept) && section === 'BOTH') {
        // Section A and B meet at different times in reality even for the
        // same course/teacher, so 'Both' creates two independent
        // assignments — one per section-group — rather than one shared
        // assignment. The teacher can adjust each section's time
        // separately afterward if needed.
        await createFacultyAssignment(auth.currentUser.uid, { ...basePayload, section: 'A' });
        await createFacultyAssignment(auth.currentUser.uid, { ...basePayload, section: 'B' });
        notify('Classes created for both sections.', 'success');
      } else {
        await createFacultyAssignment(auth.currentUser.uid, {
          ...basePayload,
          section: isMultiSectionDept(dept) ? section : undefined,
        });
        notify('Class created.', 'success');
      }
      onCreated();
    } catch (e) {
      notify(e.message || 'Could not create this class.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="faculty-add-class-overlay" style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16,
    }}>
      <div className="faculty-add-class-card" style={{
        background: 'var(--card)', borderRadius: 18, padding: 24, width: '100%', maxWidth: 480,
        maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border)', boxShadow: '0 32px 80px rgba(0,0,0,0.28)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--text)' }}>Add Class</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
            <Icons.X size={18} />
          </button>
        </div>

        {/* Phase I — alternative entry point: skip the whole picker below
            if a co-teacher already gave you a code. */}
        <div style={{ marginBottom: 16 }}>
          {!showCodeEntry ? (
            <button
              onClick={() => setShowCodeEntry(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontWeight: 600, fontSize: 12.5, textDecoration: 'underline', padding: 0 }}
            >
              Have a code from your co-teacher?
            </button>
          ) : (
            <div style={{ padding: '12px 14px', borderRadius: 10, background: 'color-mix(in srgb, var(--accent) 8%, var(--card))', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)' }}>
              <label style={labelStyle}>Invite code</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em', textTransform: 'uppercase' }}
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  placeholder="e.g. 7K4XPQ"
                  maxLength={6}
                />
                <button
                  onClick={handleJoinViaCode}
                  disabled={joiningViaCode || !codeInput.trim()}
                  style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', opacity: (joiningViaCode || !codeInput.trim()) ? 0.6 : 1, whiteSpace: 'nowrap' }}
                >
                  {joiningViaCode ? 'Joining…' : 'Join'}
                </button>
              </div>
              <button
                onClick={() => { setShowCodeEntry(false); setCodeInput(''); }}
                style={{ marginTop: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 11.5, padding: 0 }}
              >
                Or pick the class manually below
              </button>
            </div>
          )}
        </div>

        <div className="faculty-add-class-fields" style={{ display: 'grid', gap: 12 }}>
          <div>
            <label style={labelStyle}>Department</label>
            <select style={inputStyle} value={dept} onChange={(e) => { setDept(e.target.value); setSection(''); setTerm(''); setCourseCode(''); }}>
              <option value="">Select department</option>
              {DEPARTMENTS.map((d) => <option key={d.code} value={d.code}>{d.name} ({d.code})</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Batch</label>
            <select style={inputStyle} value={batch} onChange={(e) => setBatch(e.target.value)}>
              <option value="">Select batch</option>
              {batches.map((b) => <option key={b} value={b}>{b.toUpperCase()}</option>)}
            </select>
          </div>

          {/* Section — only for CE/EEE/ME/CSE (120 seats/batch, split into
              ~60-student Section A / B). 'Both' schedules the same course
              for both sections as two separate assignments, since A and B
              meet at different times in reality even with the same
              teacher/course. */}
          {isMultiSectionDept(dept) && (
            <div>
              <label style={labelStyle}>Section</label>
              <select style={inputStyle} value={section} onChange={(e) => setSection(e.target.value)}>
                <option value="">Select section</option>
                <option value="A">Section A</option>
                <option value="B">Section B</option>
                <option value="BOTH">Both (creates two classes)</option>
              </select>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                This department runs two sections with separate routines. Pick the one this class is for.
              </div>
            </div>
          )}

          <div>
            <label style={labelStyle}>Term</label>
            <select style={inputStyle} value={term} onChange={(e) => { setTerm(e.target.value); setCourseCode(''); }} disabled={!dept}>
              <option value="">Select term</option>
              {termOptions.map((t) => <option key={t} value={t}>{t}</option>)}
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
            <div className="faculty-add-class-span2" style={{
              padding: '10px 12px', borderRadius: 8, background: 'color-mix(in srgb, #f59e0b 10%, var(--card))',
              border: '1px solid color-mix(in srgb, #f59e0b 35%, transparent)', fontSize: 12.5, color: 'var(--text)',
            }}>
              ⚠️ {batchTermWarning}
            </div>
          )}

          {joinOffer && (
            <div className="faculty-add-class-span2" style={{
              padding: '10px 12px', borderRadius: 8, background: 'color-mix(in srgb, var(--accent) 8%, var(--card))',
              border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)', fontSize: 12.5, color: 'var(--text)',
            }}>
              This course already has an open teacher slot for this batch and term.{' '}
              <button onClick={handleJoin} disabled={saving} style={{ color: 'var(--accent)', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                Request to join it instead
              </button>{' '}
              — the other teacher will need to accept — or continue below to create a separate one.
            </div>
          )}

          <div className="faculty-add-class-span2" style={{ display: 'flex', gap: 10 }}>
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

          {isSessionalCourse && (
            <div className="faculty-add-class-span2">
              <label style={labelStyle}>This is a Sessional/Lab course</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setSessionalMode('full')}
                  style={{
                    flex: 1, padding: '9px 10px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                    border: sessionalMode === 'full' ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                    background: sessionalMode === 'full' ? 'rgba(59,130,246,0.10)' : 'var(--bg)',
                    color: sessionalMode === 'full' ? 'var(--accent)' : 'var(--text)',
                  }}
                >
                  Full sessional block (3 periods)
                </button>
                <button
                  type="button"
                  onClick={() => setSessionalMode('single')}
                  style={{
                    flex: 1, padding: '9px 10px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                    border: sessionalMode === 'single' ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                    background: sessionalMode === 'single' ? 'rgba(59,130,246,0.10)' : 'var(--bg)',
                    color: sessionalMode === 'single' ? 'var(--accent)' : 'var(--text)',
                  }}
                >
                  Single period only
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, lineHeight: 1.4 }}>
                {sessionalMode === 'full'
                  ? 'You teach the whole 3-period lab block yourself.'
                  : 'You only teach one period of this lab (e.g. co-teaching with others covering the other periods).'}
              </div>
            </div>
          )}

          {isSessionalCourse && sessionalMode === 'full' ? (
            <div>
              <label style={labelStyle}>Sessional block</label>
              <select style={inputStyle} value={sessionalSlot} onChange={(e) => setSessionalSlot(e.target.value)}>
                {getPresetSessionalSlots(modelId).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label style={labelStyle}>Time slot</label>
              <select style={inputStyle} value={slot} onChange={(e) => setSlot(e.target.value)}>
                {TIME_MODELS[modelId].slots.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          {slotConflict && (
            <div className="faculty-add-class-span2" style={{
              padding: '10px 12px', borderRadius: 8, background: 'color-mix(in srgb, #dc2626 8%, var(--card))',
              border: '1px solid color-mix(in srgb, #dc2626 35%, transparent)', fontSize: 12.5, color: 'var(--text)', lineHeight: 1.5,
            }}>
              ⚠️ <strong>{slotConflict.courseCode}</strong> ({slotConflict.courseTitle || 'another course'}) is already
              scheduled for {batch?.toUpperCase()} {dept} on {day} at {slotConflict.conflictingSlot?.slot} — that overlaps
              the time you picked. Double-check this is intentional (e.g. a different teacher/section) before creating.
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={saving || !dept || !batch || !term || !courseCode || (isMultiSectionDept(dept) && !section)}
            className="faculty-add-class-span2 accent-fill-glass"
            style={{
              marginTop: 6, padding: '11px 16px', borderRadius: 8,
              color: '#fff', fontWeight: 700, fontSize: 13.5,
              cursor: 'pointer', opacity: (saving || !dept || !batch || !term || !courseCode || (isMultiSectionDept(dept) && !section)) ? 0.6 : 1,
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
  const [batches, setBatches] = useState([]);
  // Creating a class assignment is one of the handful of writes that
  // still needs the Blue Tick (see firestore.rules' facultyAssignments
  // create rule) — a fake/unverified account creating one would show up
  // in the real batch+dept group and affect everyone reading it. This
  // page itself (browsing existing classes, All CR) stays open either way.
  const { isFounderBypass, facultyProfile } = useIsFaculty();
  const isVerified = isFounderBypass || !!facultyProfile?.verifiedAt;

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setClasses([]); return; }
    return subscribeMyClassIndex(uid, setClasses);
  }, []);

  useEffect(() => {
    // Sorted ascending by batch year (2k22 -> 2k23 -> ...) so the batch
    // dropdown and the "My Classes" grouping below both show smaller/older
    // batches first. getBatchColor() is always called with this same
    // sorted array, so color assignment stays consistent with what's shown.
    getActiveBatches().then((list) => setBatches(sortBatches(list)));
  }, []);

  const activeClasses = (classes || []).filter((c) => c.status === 'active');

  // Group by batch — a teacher's classes across different depts still
  // belong to the same student cohort when the batch matches, so grouping
  // this way (rather than by dept) makes it easy to see "everything I
  // teach 2K23" at a glance. Each batch group gets a colored header using
  // the same fixed batch->color mapping as everywhere else (My Classes
  // dashboard card, schedule grid, Manage Batches settings).
  const classesByBatch = useMemo(() => {
    const groups = {};
    activeClasses.forEach((c) => {
      const key = c.batch || 'other';
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    });
    // Batches in the configured order first, then any leftover/unknown
    // batch keys (e.g. one not in the active list anymore) at the end.
    const orderedKeys = [...batches.filter((b) => groups[b]), ...Object.keys(groups).filter((k) => !batches.includes(k))];
    return orderedKeys.map((key) => ({ batch: key, items: groups[key] }));
  }, [activeClasses, batches]);

  return (
    <div className="hub-page-bg" style={{ minHeight: '100vh' }}>
      <div className="page-container" style={{ padding: '20px 24px 40px' }}>
        <div className="hub-page-hero">
          <div className="hub-page-hero-main">
            <div className="hub-page-hero-head">
              <div className="hub-page-hero-icon">
                <Icons.BookOpen size={24} color="var(--accent)" />
              </div>
              <h1 className="hub-page-hero-title">My Classes</h1>
            </div>
            <div className="hub-page-hero-subtitle">Classes you actively teach this term</div>
          </div>
          <div className="hub-page-hero-actions">
            <div className="hub-page-hero-stats" style={{ marginRight: 4 }}>
              <div className="hub-page-hero-stat">
                <div className="hub-page-hero-stat-n">{activeClasses.length}</div>
                <div className="hub-page-hero-stat-label">classes</div>
              </div>
            </div>
            <button
              onClick={() => navigate('/faculty/all-cr')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)',
                fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}
            >
              <Icons.Users size={15} /> <span className="btn-txt">All CR</span>
            </button>
            <button
              className="accent-fill-glass"
              onClick={() => setShowAdd(true)}
              disabled={!isVerified}
              title={!isVerified ? 'Teacher Verification needed before you can add a class' : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 8,
                color: '#fff', fontWeight: 700, fontSize: 13,
                cursor: isVerified ? 'pointer' : 'not-allowed', opacity: isVerified ? 1 : 0.5,
              }}
            >
              <Icons.Plus size={15} /> <span className="btn-txt">Add Class</span>
            </button>
          </div>
        </div>

        {!isVerified && (
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
            🔒 Adding a new class needs Teacher Verification. You can still browse everything here — visit{' '}
            <span
              onClick={() => navigate('/faculty/contact')}
              style={{ color: 'var(--accent)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
            >
              Contact
            </span>{' '}
            if you need help getting verified.
          </div>
        )}

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

        {classesByBatch.map(({ batch, items }) => {
          const color = getBatchColor(batch, batches);
          return (
            <div key={batch} style={{ marginTop: 18, marginBottom: 8 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '6px 12px',
                borderRadius: 999, background: color.bg, border: `1px solid ${color.border}`, width: 'fit-content',
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color.text }} />
                <span style={{ fontSize: 12.5, fontWeight: 800, color: color.text }}>{batch.toUpperCase()}</span>
                <span style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>
                  {items.length} class{items.length !== 1 ? 'es' : ''}
                </span>
              </div>
              <div className="hub-grid">
                {items.map((c) => (
                  <div
                    key={c.id}
                    className="hub-grid-item"
                    onClick={() => navigate(`/faculty/classes/${c.id}?groupId=${encodeURIComponent(c.groupId)}`)}
                    style={{ cursor: 'pointer', border: `1px solid ${color.border}`, background: color.bg }}
                  >
                    <div className="hub-grid-item-icon" style={{
                      background: 'color-mix(in srgb, var(--accent) 15%, var(--surface))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icons.BookOpen size={17} color="var(--accent)" />
                    </div>
                    <span className="hub-grid-item-label" style={{ fontWeight: 600, color: '#5c5a54' }}>
                      {c.batch?.toUpperCase()} {c.dept} · {c.courseCode}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {showAdd && (
        <AddClassModal
          onClose={() => setShowAdd(false)}
          onCreated={() => setShowAdd(false)}
          batches={batches}
        />
      )}
    </div>
  );
}