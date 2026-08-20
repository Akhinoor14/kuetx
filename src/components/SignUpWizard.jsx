// SignUpWizard.jsx — LANDING_PAGE_REDESIGN_PROMPT.md, Phase 4/5/6.
//
// New multi-step Sign Up wizard (§11.3), fully built as of Phase 6:
// Step 1 (Role select), Step 2 (role-specific profile form, local state
// only, no Firestore write), Step 3 (Confirm/Summary + "Sign Up with
// Google" button — Google popup + Firestore commit happen here, last).
// See handleGoogleSignUp() below for the actual commit logic.
//
// Layout split per §11.3.1 (mobile) / §11.3.2 (desktop):
// - Mobile (< 768px, same MOBILE_NAV_QUERY breakpoint as useIsMobileNav):
//   full-screen takeover, sticky header with back-arrow + progress DOTS,
//   one-column stacked role cards, sticky full-width "Continue" footer.
// - Desktop (>= 768px): centered card (max-width ~460-520px) over a
//   dimmed/blurred backdrop (not opaque — this sits over the public
//   landing page, not a dashboard, so the RoleSelectScreen.jsx opaque-
//   background bugfix does not apply here — see §11.3.2's own note),
//   horizontal step LABEL bar ("১ Role · ২ Details · ৩ Confirm"),
//   3-column role card grid, right-aligned "Continue" button in the
//   footer.
//
// Role card visual language is intentionally close to
// RoleSelectScreen.jsx's existing cardStyle/icon-circle pattern (§11.3's
// "প্রায় হুবহু re-use" instruction) so Phase 5/6 don't introduce a new
// visual language on top of an already-established one.
//
// This component is purely local state — no Firestore writes, no
// account creation, nothing happens if the visitor closes it. It is
// mounted by LandingPage.jsx in place of the old single AuthModal call
// for the 'signup' intent (see LandingPage.jsx changes in this same
// phase); the 'signin' intent still opens the existing AuthModal
// unchanged, per §11.5's component-mapping table.

import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, CheckCircle2, GraduationCap, Presentation, Store, X } from 'lucide-react';
import { useIsMobileNav } from './BottomNav';
import {
  DEPARTMENTS, INSTITUTES, BASIC_SCIENCE_DEPTS, DEFAULT_PROFILE,
  extractBatchFromRoll, getDeptCodeFromRoll, getTermLabelFromKey,
  normalizeProfileForSave, validateProfileForSave, tagProfileOwner, store,
} from '../store/store';
import { isKuetEmailFormat, emailRollMatchesProfile } from '../lib/kuetEmailVerify';
import { isFacultyEmailFormat } from '../lib/facultyEmailVerify';
import { isValidRoll } from '../lib/rollFormat';
import { isMultiSectionDept } from '../lib/groupUtils';
import { SERVICE_TYPES, PROVIDER_SIGNUP_TYPES } from '../lib/serviceSync';
import { auth } from '../lib/firebase';
import { loginWithGoogle } from '../lib/firebaseAuth';
import { isBrandNewAccount } from '../lib/accountLifecycle';
import { setAccountRole, persistAccountRoleToServer } from '../lib/accountRole';
import { createFacultyAccountDoc, saveFacultyProfile, setFacultyInstitutionalEmail } from '../lib/facultySync';
import { lookupFacultyDirectoryEntry } from '../lib/facultyDirectoryMatch';
import { createProviderShell } from '../lib/providerSync';
import { pushProfile } from '../lib/firebaseSync';
import { syncBloodDonorEntry } from '../lib/bloodDonorSync';
import { ensureManualVerifyRequest } from '../lib/manualVerifyRequests';
import { isRollTakenByAnotherAccount, claimRoll } from '../lib/rollOwnership';

const STEP_LABELS = ['Role', 'Details', 'Confirm'];

const ROLES = [
  { id: 'student', label: 'Student', icon: GraduationCap },
  { id: 'teacher', label: 'Faculty Member', icon: Presentation },
  { id: 'provider', label: 'Service Provider', icon: Store },
];

// ─── Progress indicator ──────────────────────────────────────────────
// Mobile: 3 dots, active step accent-filled, rest muted-border (§11.3.1
// — dots chosen over "1/3" text since role-select is no longer a
// separate pre-form screen, it's now step 1 of one continuous flow).
// Desktop: horizontal step labels, active step in accent color, rest
// muted (§11.3.2 — desktop has room for labels, more informative).
function MobileProgressDots({ step }) {
  return (
    <div style={{ display: 'flex', gap: 5, flex: 1, justifyContent: 'center' }}>
      {STEP_LABELS.map((_, i) => (
        <div
          key={i}
          style={{
            width: 20, height: 4, borderRadius: 2,
            background: i === step ? 'var(--accent)' : 'var(--border)',
          }}
        />
      ))}
    </div>
  );
}

function DesktopStepLabels({ step }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '18px 52px 18px 28px', borderBottom: '1px solid var(--border)',
      gap: 8,
    }}>
      {STEP_LABELS.map((label, i) => (
        <span
          key={label}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 14, fontWeight: i === step ? 800 : 600,
            color: i === step ? 'var(--accent)' : 'var(--muted)',
          }}
        >
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
            fontSize: 11, fontWeight: 800,
            background: i === step ? 'var(--accent)' : 'var(--border)',
            color: i === step ? '#fff' : 'var(--muted)',
          }}>
            {i + 1}
          </span>
          {label}
        </span>
      ))}
    </div>
  );
}

// ─── Step 1 — Role select ────────────────────────────────────────────
// Card visual language matches RoleSelectScreen.jsx's cardStyle/icon-
// circle pattern (§11.3's "almost exact re-use" instruction). Layout
// differs by platform: mobile stacks the three cards in one column
// (larger touch targets — RoleSelectScreen's 3-column grid used to wrap
// awkwardly on small screens per §11.3.1), desktop keeps the existing
// repeat(3, 1fr) grid.
function RoleSelectStep({ selectedRole, onSelect, isMobileNav }) {
  return (
    <div>
      {/* Owner ask: drop the "তুমি কোন role হিসেবে যোগ দিচ্ছো?" heading
          entirely — redundant with the step bar already reading "Role"
          and the 3 self-explanatory cards below (icon + English label
          each). No replacement heading added; the cards start right
          under the step bar now. */}
      <div style={{
        display: isMobileNav ? 'flex' : 'grid',
        flexDirection: isMobileNav ? 'column' : undefined,
        gridTemplateColumns: isMobileNav ? undefined : 'repeat(3, 1fr)',
        gap: 12,
      }}>
        {ROLES.map((role) => {
          const Icon = role.icon;
          const active = selectedRole === role.id;
          return (
            <button
              key={role.id}
              type="button"
              onClick={() => onSelect(role.id)}
              style={{
                display: 'flex',
                flexDirection: isMobileNav ? 'row' : 'column',
                alignItems: 'center',
                gap: isMobileNav ? 14 : 12,
                padding: isMobileNav ? '16px' : '26px 16px',
                borderRadius: 14,
                border: active ? '2px solid var(--accent)' : '1px solid var(--border)',
                background: active ? 'var(--accentSoft)' : 'var(--card)',
                boxShadow: active ? '0 6px 18px rgba(var(--accentRGB),0.18)' : 'none',
                cursor: 'pointer',
                textAlign: isMobileNav ? 'left' : 'center',
                transition: 'border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease',
              }}
              onMouseEnter={(e) => { if (!isMobileNav && !active) e.currentTarget.style.borderColor = 'var(--accent)'; }}
              onMouseLeave={(e) => { if (!isMobileNav && !active) e.currentTarget.style.borderColor = 'var(--border)'; }}
            >
              <div style={{
                width: isMobileNav ? 42 : 56, height: isMobileNav ? 42 : 56,
                borderRadius: '50%', flexShrink: 0,
                background: active ? 'rgba(255,255,255,0.55)' : 'var(--accentSoft)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={isMobileNav ? 20 : 26} color="var(--accent)" />
              </div>
              <span style={{
                fontSize: isMobileNav ? 15 : 15,
                fontWeight: active ? 800 : 700,
                color: 'var(--text)',
              }}>
                {role.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Shared field styling (matches ProfileSetupModal.jsx /
// FacultyProfileSetupModal.jsx / RoleSelectScreen.jsx's provider-form
// visual language, per §11.3's "field style... সবই ইতিমধ্যে ভালোভাবে
// বানানো আছে" instruction — re-used, not reinvented). ─────────────────
const fieldStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--surfaceGlassStrong, var(--card))',
  fontSize: 14,
  color: 'var(--text)',
  fontFamily: 'inherit',
  height: 44,
  boxSizing: 'border-box',
};

const labelStyle = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text)',
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const errorStyle = { fontSize: 11, color: '#dc2626', marginTop: 5 };

// Not exported from ProfileSetupModal.jsx (locally defined there), so
// duplicated here rather than importing a private constant — same list.
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// ─── Step 2 — Student profile fields ─────────────────────────────────
// Mirrors ProfileSetupModal.jsx's `minimal` mode field set (name,
// studentId, kuetEmail, currentTermKey, bloodGroup — the actually-
// required fields per its requiredFieldMap[0]) plus dept/section, which
// auto-derive from the roll the same way. Deliberately leaves out that
// modal's live roll-claim-collision check (rollLocked/unlockRequestState)
// and CR-set term-start-date subscriptions — per the planning doc's
// §16.1 owner-confirm decision, the roll-uniqueness preview check
// belongs right after the Google popup in Phase 6 (uid needed to read
// rollOwners/{roll}), not here at Step 2 while still fully local/no-uid.
function StudentDetailsStep({ form, setForm, errors, setErrors }) {
  const autoCalculatedDept = (() => {
    const roll = String(form.studentId || '').trim();
    if (roll.length < 5 || !extractBatchFromRoll(roll)) return '';
    return getDeptCodeFromRoll(roll.padEnd(7, '0'));
  })();
  const effectiveDept = form.dept || autoCalculatedDept;

  const handleChange = (key) => (e) => {
    let val = e.target.value;
    if (key === 'studentId') val = val.replace(/\D/g, '').slice(0, 7);
    setForm((prev) => {
      const next = { ...prev, [key]: val };
      if (key === 'studentId') {
        const roll = val.trim();
        const dept = roll.length >= 5 && extractBatchFromRoll(roll) ? getDeptCodeFromRoll(roll.padEnd(7, '0')) : '';
        if (dept) next.dept = dept;
      }
      return next;
    });
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div>
        <label style={labelStyle}>Full Name</label>
        <input style={fieldStyle} value={form.name || ''} onChange={handleChange('name')} placeholder="Your full name" />
        {errors.name && <div style={errorStyle}>{errors.name}</div>}
      </div>
      <div>
        <label style={labelStyle}>Student ID (Roll)</label>
        <input style={fieldStyle} value={form.studentId || ''} onChange={handleChange('studentId')} placeholder="e.g. 2313014" />
        {errors.studentId && <div style={errorStyle}>{errors.studentId}</div>}
      </div>
      <div>
        <label style={labelStyle}>KUET Email</label>
        <input
          type="email" style={fieldStyle} value={form.kuetEmail || ''} onChange={handleChange('kuetEmail')}
          placeholder="e.g. john2313014@stud.kuet.ac.bd"
        />
        {errors.kuetEmail && <div style={errorStyle}>{errors.kuetEmail}</div>}
        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>Must be your @stud.kuet.ac.bd address with a roll matching Student ID above</div>
      </div>
      <div>
        <label style={labelStyle}>Department</label>
        <select
          style={{ ...fieldStyle, opacity: autoCalculatedDept ? 0.6 : 1, cursor: autoCalculatedDept ? 'not-allowed' : 'pointer' }}
          value={effectiveDept}
          disabled={!!autoCalculatedDept}
          onChange={(e) => { setForm((prev) => ({ ...prev, dept: e.target.value })); setErrors((prev) => ({ ...prev, dept: '' })); }}
        >
          <option value="">Select department</option>
          {DEPARTMENTS.map((d) => <option key={d.code} value={d.code}>{d.code} - {d.name}</option>)}
        </select>
        {autoCalculatedDept
          ? <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 6, fontWeight: 700 }}>✓ Auto-selected from roll: {autoCalculatedDept}</div>
          : <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>Enter a 7-digit roll number to auto-select, or choose manually.</div>}
        {errors.dept && <div style={errorStyle}>{errors.dept}</div>}
      </div>
      {isMultiSectionDept(effectiveDept) && (
        <div>
          <label style={labelStyle}>Section</label>
          <select style={fieldStyle} value={form.section || ''} onChange={handleChange('section')}>
            <option value="">Select section</option>
            <option value="A">Section A</option>
            <option value="B">Section B</option>
          </select>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>Your department runs two sections — this determines your class group.</div>
          {errors.section && <div style={errorStyle}>{errors.section}</div>}
        </div>
      )}
      <div>
        <label style={labelStyle}>Blood Group</label>
        <select style={fieldStyle} value={form.bloodGroup || ''} onChange={handleChange('bloodGroup')}>
          <option value="">Select blood group</option>
          {BLOOD_GROUPS.map((bg) => <option key={bg} value={bg}>{bg}</option>)}
        </select>
        {errors.bloodGroup && <div style={errorStyle}>{errors.bloodGroup}</div>}
      </div>
    </div>
  );
}

function validateStudentStep(form) {
  const errors = {};
  if (!String(form.name || '').trim()) errors.name = 'Name is required';
  const roll = String(form.studentId || '').trim();
  if (!roll) errors.studentId = 'Student ID is required';
  else if (!isValidRoll(roll)) errors.studentId = 'Student ID must be a 7-digit or 8-digit number';
  else if (!extractBatchFromRoll(roll)) errors.studentId = 'Student ID must be from a current or past batch';
  const email = String(form.kuetEmail || '').trim();
  if (!email) errors.kuetEmail = 'KUET email is required';
  else if (!isKuetEmailFormat(email)) errors.kuetEmail = 'Must be a valid KUET student email';
  else if (!emailRollMatchesProfile(email, form)) errors.kuetEmail = 'This email\u2019s roll doesn\u2019t match your Student ID above';
  const dept = form.dept || (roll.length >= 5 && extractBatchFromRoll(roll) ? getDeptCodeFromRoll(roll.padEnd(7, '0')) : '');
  if (!dept) errors.dept = 'Department is required';
  if (isMultiSectionDept(dept) && !String(form.section || '').trim()) errors.section = 'Please select your section';
  if (!String(form.bloodGroup || '').trim()) errors.bloodGroup = 'Blood group is required';
  return errors;
}

// ─── Step 2 — Faculty profile fields ─────────────────────────────────
// Mirrors FacultyProfileSetupModal.jsx's field set (institutional email,
// name, department, title, plus optional phone/officeRoom/preferredName)
// collapsed into this wizard's single Step 2, per §16.2's owner-confirm
// decision ("existing 3-step compress করে নতুন wizard-এর একটামাত্র
// ধাপে বসানো, আলাদা ৪-৫ ধাপ না"). Deliberately leaves out the existing
// modal's live facultyDirectory auto-match lookup (useDebouncedDirectoryLookup)
// — that's a network/Firestore-read side effect on every keystroke that
// belongs with the rest of the account-creation logic in Phase 6, not
// wired into a purely-local Step 2 form.
const FACULTY_TITLE_GROUPS = [
  { label: 'Academic', options: ['Lecturer', 'Part-time Lecturer', 'Assistant Professor', 'Associate Professor', 'Professor', 'Adjunct Professor', 'Visiting Professor', 'Instructor', 'Teaching Assistant', 'Research Assistant', 'Post-Doctoral Fellow'] },
  { label: 'Institutional Office', options: ['Vice-Chancellor', 'Pro-Vice-Chancellor', 'Registrar', 'Deputy Registrar', 'Assistant Registrar'] },
];
const OTHER_TITLE = '__other__';

function FacultyDetailsStep({ form, setForm, errors, setErrors }) {
  const [titleIsOther, setTitleIsOther] = useState(false);
  const knownTitles = FACULTY_TITLE_GROUPS.flatMap((g) => g.options);

  const handleChange = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const emailTrimmed = String(form.institutionalEmail || '').trim();
  const isKuetEmail = !!emailTrimmed && isFacultyEmailFormat(emailTrimmed);
  const isGuestEmail = !!emailTrimmed && !isKuetEmail;
  // Sub-stage gate: email must be confirmed (KUET match checked against
  // the directory, or guest checkbox ticked) before the rest of the
  // profile fields appear. `emailConfirmed` flips true once the visitor
  // presses the wizard's own Continue button below — form.institutionalEmail
  // changing after that resets it, so editing the email re-triggers the check.
  const emailConfirmed = !!form._emailConfirmed && form._emailConfirmedFor === emailTrimmed;

  // 'idle' | 'checking' | 'matched' | 'no-match' — live-debounced against
  // facultyDirectory as the user types, same pattern as
  // FacultyProfileSetupModal.jsx's useDebouncedDirectoryLookup. Runs in
  // the background; no separate confirm button needed to trigger it.
  const [lookupStatus, setLookupStatus] = useState('idle');
  const [directoryHit, setDirectoryHit] = useState(null); // matched entry object, or null
  const debounceRef = useRef(null);
  const lookupSeqRef = useRef(0);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!isKuetEmail) {
      setLookupStatus('idle');
      setDirectoryHit(null);
      return;
    }
    setLookupStatus('checking');
    const seq = ++lookupSeqRef.current;
    debounceRef.current = setTimeout(async () => {
      try {
        const entry = await lookupFacultyDirectoryEntry(emailTrimmed);
        if (seq !== lookupSeqRef.current) return; // a newer keystroke's lookup has since started
        setDirectoryHit(entry || null);
        setLookupStatus(entry ? 'matched' : 'no-match');
      } catch {
        if (seq !== lookupSeqRef.current) return;
        setDirectoryHit(null);
        setLookupStatus('no-match');
      }
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailTrimmed, isKuetEmail]);

  // Exposed so the wizard's own Continue button (in the shared footer)
  // can validate + advance this sub-stage without a second in-form button.
  form._confirmEmailStage = () => {
    if (!emailTrimmed) {
      setErrors((prev) => ({ ...prev, institutionalEmail: 'Email is required' }));
      return false;
    }
    if (isGuestEmail && !form.guestTeacherAck) {
      setErrors((prev) => ({ ...prev, guestTeacherAck: 'Please confirm you understand this account will need manual verification' }));
      return false;
    }
    if (isKuetEmail && lookupStatus === 'checking') return false; // let the in-flight check finish first
    // Owner ask (this session): "amader directory te ja ja info ache
    // sob gula diye ekhne ja ja lagbe segula fill uop hoye jawar
    // kotha" — a directory-matched teacher's Department and Title
    // should pre-fill from facultyDirectory (populated by
    // scripts/kuet_faculty_scraper.py, whose Teacher record already
    // carries `department` — the same dept-code values as this
    // wizard's DEPARTMENTS/INSTITUTES/BASIC_SCIENCE_DEPTS lists — and
    // `designation`, e.g. "Associate Professor"), not just Name. This
    // used to be a no-op for dept (`prev.dept || prev.dept`) and never
    // touched title at all. Directory's designation only auto-fills
    // when it matches one of this wizard's known FACULTY_TITLE_GROUPS
    // options exactly — an unrecognized designation string (e.g. a
    // scrape variant) is left for the person to pick manually rather
    // than silently landing in the free-text "Other" field.
    const directoryTitleKnown = directoryHit && FACULTY_TITLE_GROUPS.some((g) => g.options.includes(directoryHit.designation));
    setForm((prev) => ({
      ...prev,
      _emailConfirmed: true,
      _emailConfirmedFor: emailTrimmed,
      // Carried through to the Confirm step so its messaging reflects the
      // real directory-match result, not just the email's format.
      _directoryMatched: !!directoryHit,
      // Directory-matched fields auto-fill but stay editable below.
      name: prev.name || (directoryHit ? directoryHit.name : ''),
      dept: prev.dept || (directoryHit ? directoryHit.department : ''),
      title: prev.title || (directoryTitleKnown ? directoryHit.designation : ''),
    }));
    return true;
  };

  if (!emailConfirmed) {
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <div>
          <label style={labelStyle}>Institutional / Contact Email</label>
          <input
            type="email" style={fieldStyle} value={form.institutionalEmail || ''}
            onChange={(e) => {
              setForm((prev) => ({ ...prev, institutionalEmail: e.target.value }));
              setErrors((prev) => ({ ...prev, institutionalEmail: '', guestTeacherAck: '' }));
            }}
            placeholder="e.g. yourname@dept.kuet.ac.bd"
          />
          {errors.institutionalEmail && <div style={errorStyle}>{errors.institutionalEmail}</div>}
          {isKuetEmail && lookupStatus === 'checking' && (
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>Checking…</div>
          )}
          {isKuetEmail && lookupStatus === 'matched' && (
            <div style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', marginTop: 6 }}>
              ✓ Matched in KUET directory — confirm it's you ({directoryHit.name})
            </div>
          )}
          {isKuetEmail && lookupStatus === 'no-match' && (
            <div style={{ fontSize: 11, fontWeight: 700, color: '#d97706', marginTop: 6 }}>
              ⚠ Not matched — will need manual verification
            </div>
          )}
          {isGuestEmail && (
            <div style={{ fontSize: 11, fontWeight: 700, color: '#d97706', marginTop: 6 }}>
              ⚠ Not a KUET email — will need manual verification
            </div>
          )}
        </div>
        {isGuestEmail && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px',
            border: '1px solid var(--border)', borderRadius: 10, background: 'rgba(217,119,6,0.06)',
          }}>
            <input
              type="checkbox" id="guestTeacherAck" checked={!!form.guestTeacherAck}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, guestTeacherAck: e.target.checked }));
                setErrors((prev) => ({ ...prev, guestTeacherAck: '' }));
              }}
              style={{ marginTop: 2 }}
            />
            <label htmlFor="guestTeacherAck" style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5, cursor: 'pointer' }}>
              I'm a guest teacher — my email isn't a KUET institutional address, and I understand my account stays pending until the Founder verifies it manually.
            </label>
          </div>
        )}
        {errors.guestTeacherAck && <div style={errorStyle}>{errors.guestTeacherAck}</div>}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{
        padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700,
        background: isKuetEmail && directoryHit ? 'rgba(22,163,74,0.08)' : 'rgba(217,119,6,0.08)',
        color: isKuetEmail && directoryHit ? '#16a34a' : '#d97706',
      }}>
        {isKuetEmail && directoryHit
          ? `✓ ${emailTrimmed} — matched with KUET directory, pending Founder approval`
          : isKuetEmail
            ? `⚠ ${emailTrimmed} — no directory match, pending manual verification`
            : `⚠ ${emailTrimmed} — guest teacher, pending manual verification`}
      </div>
      <div>
        <label style={labelStyle}>Full Name</label>
        <input style={fieldStyle} value={form.name || ''} onChange={handleChange('name')} placeholder="Your full name" />
        {errors.name && <div style={errorStyle}>{errors.name}</div>}
      </div>
      <div>
        <label style={labelStyle}>Department</label>
        <select style={fieldStyle} value={form.dept || ''} onChange={handleChange('dept')}>
          <option value="">Select department / institute</option>
          <optgroup label="Departments">{DEPARTMENTS.map((d) => <option key={d.code} value={d.code}>{d.name} ({d.code})</option>)}</optgroup>
          <optgroup label="Institutes">{INSTITUTES.map((i) => <option key={i.code} value={i.code}>{i.name} ({i.code})</option>)}</optgroup>
          <optgroup label="Basic Science & Humanities">{BASIC_SCIENCE_DEPTS.map((d) => <option key={d.code} value={d.code}>{d.name} ({d.code})</option>)}</optgroup>
        </select>
        {errors.dept && <div style={errorStyle}>{errors.dept}</div>}
      </div>
      <div>
        <label style={labelStyle}>Title / Designation</label>
        <select
          style={fieldStyle}
          value={titleIsOther ? OTHER_TITLE : (knownTitles.includes(form.title) ? form.title : '')}
          onChange={(e) => {
            const v = e.target.value;
            if (v === OTHER_TITLE) { setTitleIsOther(true); setForm((f) => ({ ...f, title: knownTitles.includes(f.title) ? '' : f.title })); }
            else { setTitleIsOther(false); setForm((f) => ({ ...f, title: v })); }
            setErrors((prev) => ({ ...prev, title: '' }));
          }}
        >
          <option value="">Select title / designation</option>
          {FACULTY_TITLE_GROUPS.map((g) => (
            <optgroup key={g.label} label={g.label}>{g.options.map((t) => <option key={t} value={t}>{t}</option>)}</optgroup>
          ))}
          <option value={OTHER_TITLE}>Other…</option>
        </select>
        {titleIsOther && (
          <input style={{ ...fieldStyle, marginTop: 8 }} value={form.title || ''} onChange={handleChange('title')} placeholder="Enter your title / designation" />
        )}
        {errors.title && <div style={errorStyle}>{errors.title}</div>}
      </div>
      <div>
        <label style={labelStyle}>Phone (optional)</label>
        <input style={fieldStyle} value={form.phone || ''} onChange={handleChange('phone')} placeholder="e.g. 01700000000" />
      </div>
      <div>
        <label style={labelStyle}>Office Room (optional)</label>
        <input style={fieldStyle} value={form.officeRoom || ''} onChange={handleChange('officeRoom')} />
      </div>
    </div>
  );
}

function validateFacultyStep(form) {
  const errors = {};
  const email = String(form.institutionalEmail || '').trim();
  if (!email) errors.institutionalEmail = 'Email is required';
  // Non-KUET (guest teacher) emails are allowed, but require the
  // explicit acknowledgment checkbox — they go to manual review instead
  // of directory auto-verify. KUET emails need no checkbox.
  else if (!isFacultyEmailFormat(email) && !form.guestTeacherAck) {
    errors.guestTeacherAck = 'Please confirm you understand this account will need manual verification';
  }
  if (!form._emailConfirmed || form._emailConfirmedFor !== email) {
    errors.institutionalEmail = errors.institutionalEmail || 'Please confirm your email first';
  }
  if (!String(form.name || '').trim()) errors.name = 'Name is required';
  if (!String(form.dept || '').trim()) errors.dept = 'Department is required';
  if (!String(form.title || '').trim()) errors.title = 'Title / designation is required';
  return errors;
}

// ─── Step 2 — Provider profile fields ────────────────────────────────
// Mirrors RoleSelectScreen.jsx's provider-form step exactly (same field
// set: displayName/phone/serviceType/serviceTypeOther/location) — this
// is the field set that finishProviderSignup() there already writes to
// providerSync.js's createProviderShell(), so Phase 6 can call the same
// function with this form's values unchanged.
// Owner ask (this session): the whole SignUpWizard flow should read in
// English with no extra/unneeded labeling — the Provider step (Step 2)
// was still fully Bengali (field labels, placeholders, validation
// messages, service-type dropdown), inherited from RoleSelectScreen's
// older Bengali-first provider form. serviceSync.js's
// PROVIDER_SIGNUP_TYPE_LABELS_BN has no English counterpart and other
// screens (RoleSelectScreen, ProviderVerificationPending) still rely on
// the Bengali one deliberately, so rather than touching that shared
// source this wizard gets its own local English label map instead.
const PROVIDER_SIGNUP_TYPE_LABELS_EN = {
  salon: 'Salon',
  hotel: 'Food (Hotel/Restaurant)',
  medicine: 'Pharmacy',
  bookstore: 'Stationery',
  onlinemart: 'Online Mart',
  errand: 'Pick & Drop',
  other: 'Other',
};

function ProviderDetailsStep({ form, setForm, errors, setErrors }) {
  const handleChange = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div>
        <label style={labelStyle}>Name / Shop Name</label>
        <input style={fieldStyle} value={form.displayName || ''} onChange={handleChange('displayName')} placeholder="e.g. Rafiq's Salon" />
        {errors.displayName && <div style={errorStyle}>{errors.displayName}</div>}
      </div>
      <div>
        <label style={labelStyle}>Phone Number</label>
        <input style={fieldStyle} value={form.phone || ''} onChange={handleChange('phone')} placeholder="01XXXXXXXXX" />
        {errors.phone && <div style={errorStyle}>{errors.phone}</div>}
      </div>
      <div>
        <label style={labelStyle}>Service Type</label>
        <select style={fieldStyle} value={form.serviceType || SERVICE_TYPES[0]} onChange={handleChange('serviceType')}>
          {PROVIDER_SIGNUP_TYPES.map((t) => <option key={t} value={t}>{PROVIDER_SIGNUP_TYPE_LABELS_EN[t]}</option>)}
        </select>
      </div>
      {form.serviceType === 'other' && (
        <div>
          <label style={labelStyle}>Specify Service Type</label>
          <input style={fieldStyle} value={form.serviceTypeOther || ''} onChange={handleChange('serviceTypeOther')} placeholder="e.g. Mobile Servicing" />
          {errors.serviceTypeOther && <div style={errorStyle}>{errors.serviceTypeOther}</div>}
        </div>
      )}
      <div>
        <label style={labelStyle}>Shop Address</label>
        <input style={fieldStyle} value={form.location || ''} onChange={handleChange('location')} placeholder="e.g. Beside KUET Main Gate, 2nd Floor" />
        {errors.location && <div style={errorStyle}>{errors.location}</div>}
      </div>
    </div>
  );
}

function validateProviderStep(form) {
  const errors = {};
  if (!String(form.displayName || '').trim()) errors.displayName = 'Name is required';
  if (!String(form.phone || '').trim()) errors.phone = 'Phone number is required';
  if (!String(form.location || '').trim()) errors.location = 'Address is required';
  if (form.serviceType === 'other' && !String(form.serviceTypeOther || '').trim()) errors.serviceTypeOther = 'Please specify the service type';
  return errors;
}

// ─── Step 3 — Confirm/Summary + Sign Up with Google ──────────────────
// §11.3.3: role-specific 2-3 key facts as a summary card, then the
// Google popup fires only from HERE — the one true "double-check"
// moment, since there's no way back to edit the form after uid exists
// (§11.3.3's own reasoning). This is also where account creation
// actually happens (Phase 6 scope) — mirrors each existing screen's
// save path field-for-field so nothing about the write itself is new,
// only the sequencing (all local until this one click) is.
//
// §16.1's roll preview-check: done AFTER the Google popup (uid needed
// to read rollOwners/{roll} per firestore.rules) but BEFORE any profile
// write — isRollTakenByAnotherAccount() is a read-only check, the real
// claimRoll() (which writes) only runs once that comes back clear.
function ConfirmStep({ role, form, busy, error, onConfirm }) {
  const summaryRows = role === 'student'
    ? [
        ['Name', form.name],
        ['Roll', form.studentId],
        ['Department', form.dept],
        form.section ? ['Section', form.section] : null,
        ['Blood Group', form.bloodGroup],
      ].filter(Boolean)
    : role === 'teacher'
      ? [
          ['Name', form.name],
          ['Department', form.dept],
          ['Title', form.title],
          ['Institutional Email', form.institutionalEmail],
        ]
      : [
          ['Name', form.displayName],
          ['Phone', form.phone],
          ['Service', form.serviceType === 'other' ? form.serviceTypeOther : PROVIDER_SIGNUP_TYPE_LABELS_EN[form.serviceType] || form.serviceType],
          ['Location', form.location],
        ];

  return (
    <div>
      {/* Owner ask: same reasoning as Step 1's now-removed heading —
          the step bar already reads "Confirm", so a duplicate "সব ঠিক
          আছে তো?" question here was redundant extra labeling. Removed,
          summary card starts right away. */}
      <div style={{
        borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surfaceGlass, var(--card))',
        padding: 14, display: 'grid', gap: 8, marginBottom: 16,
      }}>
        {summaryRows.map(([label, value]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
            <span style={{ color: 'var(--muted)' }}>{label}</span>
            <span style={{ color: 'var(--text)', fontWeight: 600, textAlign: 'right' }}>{value || '—'}</span>
          </div>
        ))}
      </div>
      {role === 'teacher' && (
        <p style={{ fontSize: 11, fontWeight: 700, color: form._directoryMatched ? '#16a34a' : '#d97706', marginBottom: 4 }}>
          {form._directoryMatched
            ? '✓ Matched with KUET directory — pending Founder approval'
            : '⚠ No directory match — pending manual verification'}
        </p>
      )}
      <p style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 4 }}>
        Can't edit after this — Sign Up with Google creates your account immediately.
      </p>
      {error && (
        <div style={{ fontSize: 12, color: 'var(--danger, #dc2626)', padding: '8px 10px', background: 'rgba(220,38,38,0.08)', borderRadius: 6, marginTop: 10 }}>
          {error}
        </div>
      )}
    </div>
  );
}

// Builds the payload each existing screen already sends, then performs
// the same write sequence — no new Firestore shape, just triggered from
// this wizard's Confirm step instead of the old post-popup queue steps.
async function commitStudentSignup(form) {
  const studentIdTrimmed = String(form.studentId || '').trim();
  const effectiveDept = form.dept || getDeptCodeFromRoll(studentIdTrimmed.padEnd(7, '0'));
  const batch = extractBatchFromRoll(studentIdTrimmed);

  // §16.1: read-only preview check right after the popup, before any
  // write — catches the common case cheaply; the real claimRoll() below
  // is still the authoritative, race-safe check (rules-enforced).
  const taken = await isRollTakenByAnotherAccount(studentIdTrimmed);
  if (taken) {
    return { ok: false, error: 'This roll number is already used by another account. Please try again with the correct roll number, or contact admin for help.' };
  }

  const claim = await claimRoll(studentIdTrimmed);
  if (!claim.ok) {
    return { ok: false, error: 'This roll number is already used by another account.' };
  }

  const normalized = normalizeProfileForSave({
    ...DEFAULT_PROFILE,
    ...form,
    studentId: studentIdTrimmed,
    kuetEmail: String(form.kuetEmail || '').trim(),
    name: String(form.name || '').trim(),
    dept: effectiveDept,
    section: isMultiSectionDept(effectiveDept) ? String(form.section || '').trim().toUpperCase() : '',
    bloodGroup: String(form.bloodGroup || '').trim(),
    batch,
    currentTermKey: String(form.currentTermKey || '').trim(),
    currentTerm: form.currentTermKey ? getTermLabelFromKey(form.currentTermKey) : '',
    termStartDate: null,
    yearStarted: null,
    totalCreditsRequired: DEFAULT_PROFILE.totalCreditsRequired,
  });

  const result = validateProfileForSave(normalized);
  if (!result.ok) {
    return { ok: false, error: Object.values(result.errors).join(' ') };
  }

  setAccountRole('student');
  await persistAccountRoleToServer('student');

  const savedProfile = tagProfileOwner(normalized, auth.currentUser?.uid);
  store.set('profile', savedProfile);
  await pushProfile(auth.currentUser.uid, savedProfile).catch((err) => {
    console.warn('[SignUpWizard] pushProfile failed:', err.message);
  });
  syncBloodDonorEntry(auth.currentUser.uid, normalized).catch(() => {});
  if (!claim.reclaimed) {
    ensureManualVerifyRequest('student', { name: normalized.name, email: normalized.kuetEmail, roll: studentIdTrimmed });
  }

  return { ok: true };
}

async function commitFacultySignup(form) {
  const uid = auth.currentUser.uid;
  await createFacultyAccountDoc(uid, auth.currentUser.email);
  await Promise.all([
    saveFacultyProfile(uid, form),
    setFacultyInstitutionalEmail(uid, form.institutionalEmail),
  ]);
  setAccountRole('teacher');
  await persistAccountRoleToServer('teacher');
  ensureManualVerifyRequest('faculty', {
    name: form.name,
    email: String(form.institutionalEmail || '').trim(),
    googleEmail: auth.currentUser?.email || '',
    dept: form.dept,
  });
  return { ok: true };
}

async function commitProviderSignup(form) {
  setAccountRole('provider');
  await persistAccountRoleToServer('provider');
  await createProviderShell(auth.currentUser.uid, {
    displayName: form.displayName,
    phone: form.phone,
    serviceType: form.serviceType || SERVICE_TYPES[0],
    serviceTypeOther: form.serviceTypeOther,
    location: form.location,
  });
  return { ok: true };
}



// initialRole: optional pre-fill for step 1, sourced from LandingPage's
// `?role=` query param (the demo-mockup role card selection), passed
// through wizardRoleFor() at the LandingPage boundary. This still
// validates against VALID_ROLE_IDS before using it, since the query
// param is user-editable URL state, not a guarantee — this component
// stays agnostic to what LandingPage's own role ids look like.
// PHASE 8: the 'faculty' (landing) vs 'teacher' (here) id mismatch
// flagged in Phase 4 is now resolved — LandingPage.jsx's
// wizardRoleFor()/LANDING_ROLE_TO_WIZARD_ROLE remaps 'faculty' ->
// 'teacher' before calling this component, so initialRole received
// here is already in this file's id space; no change needed on this
// side. Also added in Phase 8: an explicit "Sign Up as {role}" CTA
// under each demo preview (both mobile and desktop) so the role
// context from the demo carries into Sign Up, not just the query
// param persisting incidentally.
const VALID_ROLE_IDS = ['student', 'teacher', 'provider'];


export default function SignUpWizard({ onClose, initialRole = null, onDone }) {
  const isMobileNav = useIsMobileNav();
  const [step, setStep] = useState(0); // 0 = role, 1 = details, 2 = confirm
  const [role, setRole] = useState(VALID_ROLE_IDS.includes(initialRole) ? initialRole : null);
  // Step 2's local form state — one shared object, shape differs by role
  // (student/faculty/provider each read/write their own keys, per the
  // field sets mirrored from ProfileSetupModal.jsx / FacultyProfileSetupModal.jsx
  // / RoleSelectScreen.jsx's provider-form above). Reset whenever the
  // chosen role changes, so switching roles on Step 1 (via Back) doesn't
  // leave stale fields from a different role's form lingering in state.
  const [detailsForm, setDetailsForm] = useState({});
  const [detailsErrors, setDetailsErrors] = useState({});
  // Step 3 — Google popup + account-creation state. `busy` disables Back
  // and the Continue/"Sign Up with Google" button while the popup and
  // subsequent writes are in flight, so a second click can't fire a
  // second popup or a duplicate write. `submitError` covers both a
  // failed/cancelled popup and a failed write after a successful popup
  // (e.g. roll already taken) — in the latter case the Google session
  // itself is already established, so the person can just retry Confirm
  // rather than needing to redo Steps 1-2.
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const selectRole = (newRole) => {
    if (newRole !== role) setDetailsForm({});
    setRole(newRole);
  };

  const validateDetails = () => {
    const errors = role === 'student' ? validateStudentStep(detailsForm)
      : role === 'teacher' ? validateFacultyStep(detailsForm)
      : role === 'provider' ? validateProviderStep(detailsForm)
      : {};
    setDetailsErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const canContinue = step === 0 ? !!role : !busy;

  const handleBack = () => {
    if (busy) return;
    if (step === 0) {
      onClose?.();
      return;
    }
    setSubmitError('');
    setStep(step - 1);
  };

  // Step 3's "Sign Up with Google" — the one place the actual popup +
  // account-creation writes happen (§11.3.3/§11.6: Google comes last,
  // so nothing is created if the visitor abandons the wizard earlier).
  // Reuses loginWithGoogle() exactly as AuthModal.jsx does — plain sign-
  // in, never upgradeWithGoogle()/anonymous-linking, per §16.3's finding
  // that the anonymous-session path is dead code and never applies here.
  const handleGoogleSignUp = async () => {
    setBusy(true);
    setSubmitError('');
    try {
      const user = await loginWithGoogle();
      if (!user) {
        // Fell back to a redirect — page is navigating away, nothing
        // more to do here (same as AuthModal.jsx's handleGoogle()).
        return;
      }
      // Existing-account safety check: if this Google account already
      // has a KUETx account (isNewUser false — e.g. the visitor picked
      // "Sign Up" but actually already has an account), don't create a
      // second/duplicate role doc on top of it. App.jsx's own
      // buildQueue()/auth-state resolution will pick up the existing
      // account correctly once this modal closes.
      if (!isBrandNewAccount(user)) {
        onDone?.();
        onClose?.();
        return;
      }

      const commit = role === 'student' ? commitStudentSignup
        : role === 'teacher' ? commitFacultySignup
        : commitProviderSignup;
      const result = await commit(detailsForm);
      if (!result.ok) {
        setSubmitError(result.error || 'Something went wrong. Please try again.');
        setBusy(false);
        return;
      }
      onDone?.();
      onClose?.();
    } catch (err) {
      // Person closed/dismissed Google's popup themselves — not a real
      // failure, so no scary error message, just let them try again
      // (see firebaseAuth.js's loginWithGoogle() header for why this
      // case no longer triggers a page-navigating redirect fallback).
      setSubmitError(
        err?.code === 'auth/popup-closed-by-user'
          ? 'The Google sign-in window was closed. Tap "Sign Up with Google" again when ready.'
          : 'Could not sign in with Google. Please try again.'
      );
      setBusy(false);
    }
  };

  const handleContinue = () => {
    if (!canContinue) return;
    // Teacher role, Step 2, email not confirmed yet: the first Continue
    // press just confirms the email sub-stage (runs the same validation
    // the old in-form "Confirm & Continue" button used to) instead of
    // advancing the wizard — pressing Continue again afterwards moves on
    // to the rest of the profile fields. Keeps a single footer button
    // instead of a second in-form button stacked above it.
    if (step === 1 && role === 'teacher' && !(detailsForm._emailConfirmed && detailsForm._emailConfirmedFor === String(detailsForm.institutionalEmail || '').trim())) {
      detailsForm._confirmEmailStage?.();
      return;
    }
    if (step === 1 && !validateDetails()) return;
    if (step === STEP_LABELS.length - 1) {
      handleGoogleSignUp();
      return;
    }
    setStep(step + 1);
  };

  const stepContent = step === 0
    ? <RoleSelectStep selectedRole={role} onSelect={selectRole} isMobileNav={isMobileNav} />
    : step === 1
      ? (role === 'student'
          ? <StudentDetailsStep form={detailsForm} setForm={setDetailsForm} errors={detailsErrors} setErrors={setDetailsErrors} />
          : role === 'teacher'
            ? <FacultyDetailsStep form={detailsForm} setForm={setDetailsForm} errors={detailsErrors} setErrors={setDetailsErrors} />
            : <ProviderDetailsStep form={detailsForm} setForm={setDetailsForm} errors={detailsErrors} setErrors={setDetailsErrors} />)
      : <ConfirmStep role={role} form={detailsForm} busy={busy} error={submitError} onConfirm={handleGoogleSignUp} />;

  const continueLabel = step === STEP_LABELS.length - 1
    ? (busy ? 'Signing in…' : 'Sign Up with Google')
    : 'Continue';

  // ─── kx-theme override ──────────────────────────────────────────────
  // Rather than rewriting every var(--accent)/var(--card)/var(--border)
  // call below (17+ call sites, all wired into real form logic), this
  // remaps the app's generic theme variables to the landing page's
  // --kx-* values, scoped only to this modal via .kx-signup-theme. Every
  // existing var(--accent) etc. call site below picks up the new colors
  // automatically — zero risk to the actual form/validation/Firestore
  // logic, which is untouched.
  const kxThemeVars = (
    <style>{`
      .kx-signup-theme {
        --accent: #22c55e;
        --accentSoft: rgba(34,197,94,0.1);
        --accentRGB: 34,197,94;
        --card: #ffffff;
        --surface: #ffffff;
        --surfaceGlass: #ffffff;
        --surfaceGlassStrong: #ffffff;
        --border: #dcd8cc;
        --text: #16241a;
        --muted: #4a5750;
        --bg: #f7f6f1;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', 'Noto Sans Bengali', sans-serif;
      }
      .kx-signup-theme h1, .kx-signup-theme h2, .kx-signup-theme h3 {
        font-family: 'Manrope', 'Hind Siliguri', -apple-system, sans-serif;
      }
    `}</style>
  );

  // ─── Mobile: full-screen takeover (§11.3.1) ───────────────────────
  if (isMobileNav) {
    return (
      <div className="kx-signup-theme" style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', flexDirection: 'column',
        background: 'var(--bg)',
      }}>
        {kxThemeVars}
        <div style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 12px', borderBottom: '1px solid var(--border)',
        }}>
          <button
            type="button"
            onClick={handleBack}
            aria-label={step === 0 ? 'Close' : 'Back'}
            style={{
              width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
              background: 'var(--surface, var(--card))', border: '1px solid var(--border)',
              cursor: 'pointer', color: 'var(--text)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            {step === 0 ? <X size={17} /> : <ArrowLeft size={17} />}
          </button>
          <MobileProgressDots step={step} />
          <div style={{ width: 36 }} />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px' }}>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 4px' }}>
            Step {step + 1} of {STEP_LABELS.length}
          </p>
          {stepContent}
        </div>

        <div style={{ flexShrink: 0, padding: '14px 16px', borderTop: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={handleContinue}
            disabled={!canContinue}
            style={{
              width: '100%', padding: 12, borderRadius: 8, border: 'none',
              background: canContinue ? 'var(--accent)' : 'var(--border)',
              color: canContinue ? '#fff' : 'var(--muted)',
              fontSize: 14, fontWeight: 700,
              cursor: canContinue ? 'pointer' : 'not-allowed',
            }}
          >
            {continueLabel}
          </button>
        </div>
      </div>
    );
  }

  // ─── Desktop: centered card over dimmed backdrop (§11.3.2) ─────────
  return (
    <div
      className="kx-signup-theme"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        background: `
          radial-gradient(1200px 600px at 15% -10%, var(--accentSoft), transparent 60%),
          radial-gradient(900px 500px at 110% 110%, var(--accentSoft), transparent 55%),
          var(--bg)
        `,
      }}
    >
      {kxThemeVars}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surfaceGlassStrong, var(--card))',
          backdropFilter: 'blur(6px)',
          borderRadius: 22,
          width: '100%', maxWidth: 560,
          border: '1px solid var(--border)',
          boxShadow: '0 40px 100px rgba(0,0,0,0.22)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            style={{
              position: 'absolute', top: 12, right: 12, zIndex: 2,
              width: 32, height: 32, borderRadius: '50%',
              background: 'var(--surface, var(--card))', border: '1px solid var(--border)',
              cursor: busy ? 'not-allowed' : 'pointer',
              color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: busy ? 0.4 : 1,
            }}
          >
            <X size={16} />
          </button>
        )}

        <DesktopStepLabels step={step} />

        <div style={{ padding: 28, maxHeight: '62vh', overflowY: 'auto' }}>
          {stepContent}
        </div>

        <div style={{
          padding: '16px 28px', borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'flex-end', gap: 10,
        }}>
          {step > 0 && (
            <button
              type="button"
              onClick={handleBack}
              style={{
                padding: '11px 20px', borderRadius: 10, border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--text)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={handleContinue}
            disabled={!canContinue}
            style={{
              padding: '11px 24px', borderRadius: 10, border: 'none',
              background: canContinue ? 'var(--accent)' : 'var(--border)',
              color: canContinue ? '#fff' : 'var(--muted)',
              fontSize: 14, fontWeight: 800,
              cursor: canContinue ? 'pointer' : 'not-allowed',
            }}
          >
            {continueLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
