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

import { useState } from 'react';
import { ArrowLeft, CheckCircle2, GraduationCap, Presentation, Store, X } from 'lucide-react';
import { useIsMobileNav } from './BottomNav';
import {
  DEPARTMENTS, INSTITUTES, BASIC_SCIENCE_DEPTS, DEFAULT_PROFILE,
  extractBatchFromRoll, getDeptCodeFromRoll, getTermLabelFromKey,
  normalizeProfileForSave, validateProfileForSave, tagProfileOwner, store,
} from '../store/store';
import { isKuetEmailFormat, emailRollMatchesProfile } from '../lib/kuetEmailVerify';
import { isFacultyEmailFormat } from '../lib/facultyEmailVerify';
import { isMultiSectionDept } from '../lib/groupUtils';
import { SERVICE_TYPES, PROVIDER_SIGNUP_TYPES, PROVIDER_SIGNUP_TYPE_LABELS_BN } from '../lib/serviceSync';
import { auth } from '../lib/firebase';
import { loginWithGoogle } from '../lib/firebaseAuth';
import { isBrandNewAccount } from '../lib/accountLifecycle';
import { setAccountRole, persistAccountRoleToServer } from '../lib/accountRole';
import { createFacultyAccountDoc, saveFacultyProfile, setFacultyInstitutionalEmail } from '../lib/facultySync';
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
      <p style={{ fontWeight: 800, fontSize: 18, color: 'var(--text)', margin: '0 0 18px' }}>
        তুমি কোন role হিসেবে যোগ দিচ্ছো?
      </p>
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
  else if (!/^\d{7}$/.test(roll)) errors.studentId = 'Student ID must be a 7-digit number';
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

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div>
        <label style={labelStyle}>Institutional Email</label>
        <input
          type="email" style={fieldStyle} value={form.institutionalEmail || ''} onChange={handleChange('institutionalEmail')}
          placeholder="e.g. yourname@dept.kuet.ac.bd"
        />
        {errors.institutionalEmail && <div style={errorStyle}>{errors.institutionalEmail}</div>}
        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>A Founder reviews this to verify your account</div>
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
  if (!email) errors.institutionalEmail = 'Institutional email is required';
  else if (!isFacultyEmailFormat(email)) errors.institutionalEmail = 'Must be a valid KUET institutional email';
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
function ProviderDetailsStep({ form, setForm, errors, setErrors }) {
  const handleChange = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div>
        <label style={labelStyle}>নাম / দোকানের নাম</label>
        <input style={fieldStyle} value={form.displayName || ''} onChange={handleChange('displayName')} placeholder="যেমন: Rafiq's Salon" />
        {errors.displayName && <div style={errorStyle}>{errors.displayName}</div>}
      </div>
      <div>
        <label style={labelStyle}>ফোন নাম্বার</label>
        <input style={fieldStyle} value={form.phone || ''} onChange={handleChange('phone')} placeholder="01XXXXXXXXX" />
        {errors.phone && <div style={errorStyle}>{errors.phone}</div>}
      </div>
      <div>
        <label style={labelStyle}>সার্ভিসের ধরন</label>
        <select style={fieldStyle} value={form.serviceType || SERVICE_TYPES[0]} onChange={handleChange('serviceType')}>
          {PROVIDER_SIGNUP_TYPES.map((t) => <option key={t} value={t}>{PROVIDER_SIGNUP_TYPE_LABELS_BN[t]}</option>)}
        </select>
      </div>
      {form.serviceType === 'other' && (
        <div>
          <label style={labelStyle}>সার্ভিসের ধরন লিখুন</label>
          <input style={fieldStyle} value={form.serviceTypeOther || ''} onChange={handleChange('serviceTypeOther')} placeholder="যেমন: মোবাইল সার্ভিসিং" />
          {errors.serviceTypeOther && <div style={errorStyle}>{errors.serviceTypeOther}</div>}
        </div>
      )}
      <div>
        <label style={labelStyle}>দোকানের ঠিকানা</label>
        <input style={fieldStyle} value={form.location || ''} onChange={handleChange('location')} placeholder="যেমন: KUET মেইন গেটের পাশে, ২য় তলা" />
        {errors.location && <div style={errorStyle}>{errors.location}</div>}
      </div>
    </div>
  );
}

function validateProviderStep(form) {
  const errors = {};
  if (!String(form.displayName || '').trim()) errors.displayName = 'নাম দিতে হবে';
  if (!String(form.phone || '').trim()) errors.phone = 'ফোন নাম্বার দিতে হবে';
  if (!String(form.location || '').trim()) errors.location = 'ঠিকানা দিতে হবে';
  if (form.serviceType === 'other' && !String(form.serviceTypeOther || '').trim()) errors.serviceTypeOther = 'সার্ভিসের ধরনটি লিখুন';
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
          ['Service', form.serviceType === 'other' ? form.serviceTypeOther : PROVIDER_SIGNUP_TYPE_LABELS_BN[form.serviceType] || form.serviceType],
          ['Location', form.location],
        ];

  return (
    <div>
      <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', margin: '0 0 14px' }}>
        সব ঠিক আছে তো?
      </p>
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
      <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 4 }}>
        "Sign Up with Google"-এ ক্লিক করলে Google দিয়ে সাইন ইন হয়ে সরাসরি
        অ্যাকাউন্ট তৈরি হয়ে যাবে — এরপর আর ফিরে এসে ফর্ম এডিট করার সুযোগ থাকবে না।
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
    return { ok: false, error: 'এই roll নম্বরটি অন্য একটি অ্যাকাউন্ট ইতিমধ্যে ব্যবহার করছে। সঠিক roll নম্বর দিয়ে আবার চেষ্টা করুন, অথবা admin-এর সাহায্য নিন।' };
  }

  const claim = await claimRoll(studentIdTrimmed);
  if (!claim.ok) {
    return { ok: false, error: 'এই roll নম্বরটি অন্য একটি অ্যাকাউন্ট ইতিমধ্যে ব্যবহার করছে।' };
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
        setSubmitError(result.error || 'কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।');
        setBusy(false);
        return;
      }
      onDone?.();
      onClose?.();
    } catch (err) {
      setSubmitError('Google দিয়ে সাইন ইন করা যায়নি। আবার চেষ্টা করুন।');
      setBusy(false);
    }
  };

  const handleContinue = () => {
    if (!canContinue) return;
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
    ? (busy ? 'সাইন ইন করা হচ্ছে…' : 'Sign Up with Google')
    : 'Continue';

  // ─── Mobile: full-screen takeover (§11.3.1) ───────────────────────
  if (isMobileNav) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', flexDirection: 'column',
        background: 'var(--bg)',
      }}>
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
      onClick={busy ? undefined : onClose}
    >
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
