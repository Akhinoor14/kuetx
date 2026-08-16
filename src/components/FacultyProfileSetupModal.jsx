// FacultyProfileSetupModal.jsx
//
// Mandatory, full-screen Faculty Profile step — the faculty equivalent of
// ProfileSetupModal's `mandatory` mode. Wraps FacultyProfile.jsx's fields
// (name, title, dept, optional phone/office/preferredName) in the same
// no-skip, opaque-background onboarding shell used by RoleSelectScreen and
// ProfileSetupModal(mandatory), instead of sending a freshly-verified
// faculty account to the STUDENT ProfileSetupModal (studentId/hall/
// advisor fields, none of which apply to a faculty account).
//
// Auth Simplification migration: Google Sign-In is the only login method
// now, so auth.currentUser.email is always a personal Gmail address, not
// the institutional email. The institutional/KUET faculty email is no
// longer the login identity — it's collected HERE, as an editable,
// required profile field, the same way a student's KUET email is
// collected on ProfileSetupModal (see kuetEmailVerify.js's
// isKuetEmailFormat / emailRollMatchesProfile pattern, mirrored below with
// isFacultyEmailFormat instead).
//
// It's stored on the PRIVATE faculty/{uid}/private/verification sub-doc
// (getFacultyInstitutionalEmail / setFacultyInstitutionalEmail in
// facultySync.js), not on the public faculty/{uid} doc — that parent doc
// is readable by any signed-in user (name/title/dept are meant to be
// public directory info), but a faculty member's self-reported contact
// email shouldn't be readable by every student the same way. Only the
// owner and Admin/HeadOfOps can read it (see firestore.rules). This is
// also why it's a distinct field/doc from `officialEmail` on the parent
// doc — officialEmail is what the existing verification bridge
// (facultySync.js / manualVerifyRequests.js) already keys off and must
// keep meaning whatever it meant before this migration.
//
// Name is NOT re-asked here if it was already collected at Register —
// AuthModal's Register form used to have an optional "Your name" field;
// if that was filled in, it's pre-filled below (still editable, never
// re-required from scratch).
//
// Wired into App.jsx's onboarding queue as 'faculty-profile', pushed by
// buildQueue() only when isFacultyProfileComplete(fdoc) is false for a
// verified faculty account — see App.jsx buildQueue() comments.
//
// STEP RESTRUCTURE (email-first): this used to be one flat form (email +
// name + title + dept + phone + office all on one screen, submitted once
// at the end) — the actual auto-verify match against facultyDirectory
// (facultyDirectoryMatch.js's tryAutoVerifyFacultyFromDirectory) only
// happened silently inside handleSubmit, so a matched faculty member got
// zero feedback that their institutional email was already recognized
// until after they'd filled out the whole form and submitted.
//
// Now split into three steps, purely a UI/form-flow change — the
// underlying save/ensureManualVerifyRequest call at the very end is
// unchanged, still one write, still the same auto-verify path:
//   1. Email        — live-debounced facultyDirectory lookup as the user
//                      types (see useDebouncedDirectoryLookup below).
//   2. Preview       — shows the match (if any): directory name/dept
//                      pre-fill the Name/Department fields, but both stay
//                      fully editable (a scrape can be stale/wrong, and a
//                      cross-department teaching assignment is common —
//                      see the pre-existing dept pre-fill comment further
//                      down). No match found isn't a dead end — just an
//                      explicit "we'll send this to the Founder for
//                      manual review" notice, and the form continues.
//   3. Details+confirm — title, phone, office, preferred name, then the
//                      same submit action as before.
// Back navigation between steps is allowed; nothing is written to
// Firestore until the final submit on step 3.

import { useEffect, useRef, useState } from 'react';
import { GraduationCap, CheckCircle2, HelpCircle, Loader2, ChevronLeft } from 'lucide-react';
import { auth } from '../lib/firebase';
import { DEPARTMENTS, INSTITUTES, BASIC_SCIENCE_DEPTS } from '../store/store';
import { getFacultyDoc, saveFacultyProfile, getFacultyInstitutionalEmail, setFacultyInstitutionalEmail } from '../lib/facultySync';
import { ensureManualVerifyRequest } from '../lib/manualVerifyRequests';
import { guessDeptFromFacultyEmail, isFacultyEmailFormat } from '../lib/facultyEmailVerify';
import { lookupFacultyDirectoryEntry } from '../lib/facultyDirectoryMatch';

// Common KUET faculty designations. Kept as a dropdown for consistency
// across profiles (search/sort/display all rely on a small set of known
// values), but always paired with an "Other" escape hatch below — a
// closed list must never block someone whose actual designation isn't
// one of these (e.g. Adjunct Faculty, Professor Emeritus, Dean, etc.).
// Common KUET faculty designations, grouped for a cleaner dropdown.
// Always paired with an "Other" escape hatch below — a closed list must
// never block someone whose actual designation isn't one of these.
const FACULTY_TITLE_GROUPS = [
  {
    label: 'Academic',
    options: [
      'Lecturer',
      'Part-time Lecturer',
      'Assistant Professor',
      'Associate Professor',
      'Professor',
      'Adjunct Professor',
      'Visiting Professor',
      'Instructor',
      'Teaching Assistant',
      'Research Assistant',
      'Post-Doctoral Fellow',
    ],
  },
  {
    label: 'Institutional Office',
    options: [
      'Vice-Chancellor',
      'Pro-Vice-Chancellor',
      'Registrar',
      'Deputy Registrar',
      'Assistant Registrar',
    ],
  },
];
const FACULTY_TITLES = FACULTY_TITLE_GROUPS.flatMap((g) => g.options);
const OTHER_TITLE = '__other__';

const fieldStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--surfaceGlassStrong, var(--bg))',
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

export default function FacultyProfileSetupModal({ onSave }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', title: '', dept: '', phone: '', officeRoom: '', preferredName: '', institutionalEmail: '' });
  const [errors, setErrors] = useState({});
  // Whether the Title dropdown is showing the free-text "Other" field —
  // true if the stored title doesn't match one of the known FACULTY_TITLES
  // (so we never silently discard/overwrite someone's actual title on load).
  const [titleIsOther, setTitleIsOther] = useState(false);

  // --- Step wizard state ---
  // 1 = email, 2 = directory preview, 3 = remaining details + confirm.
  const [step, setStep] = useState(1);
  // 'idle' | 'checking' | 'matched' | 'no-match' — drives Step 1's inline
  // status and whether Step 2 shows a match card or a "not found" notice.
  const [lookupStatus, setLookupStatus] = useState('idle');
  const [directoryMatch, setDirectoryMatch] = useState(null);
  const debounceRef = useRef(null);
  const lookupSeqRef = useRef(0); // guards against a stale, slower response overwriting a newer one

  // Live-debounced facultyDirectory lookup as the email field changes —
  // this is read-only preview data (lookupFacultyDirectoryEntry never
  // writes anything); the actual auto-verify write still only happens
  // once, inside handleSubmit on final confirm, exactly like before this
  // restructure.
  useEffect(() => {
    const email = form.institutionalEmail.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!email || !isFacultyEmailFormat(email)) {
      setLookupStatus('idle');
      setDirectoryMatch(null);
      return;
    }
    setLookupStatus('checking');
    const seq = ++lookupSeqRef.current;
    debounceRef.current = setTimeout(async () => {
      try {
        const entry = await lookupFacultyDirectoryEntry(email);
        if (seq !== lookupSeqRef.current) return; // a newer keystroke's lookup has since started
        setDirectoryMatch(entry);
        setLookupStatus(entry ? 'matched' : 'no-match');
      } catch {
        if (seq !== lookupSeqRef.current) return;
        // Lookup failure (offline, blocked request) — same as "no match",
        // never blocks the form; falls through to manual review either way.
        setDirectoryMatch(null);
        setLookupStatus('no-match');
      }
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [form.institutionalEmail]);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setLoading(false); return; }
    Promise.all([
      getFacultyDoc(uid),
      // Private sub-doc — only readable by the owner (this is always the
      // owner's own uid here) or Admin. A brand-new account won't have
      // this doc yet; getFacultyInstitutionalEmail returns '' for that
      // case rather than throwing.
      getFacultyInstitutionalEmail(uid),
    ]).then(([fdoc, institutionalEmail]) => {
      if (fdoc) {
        // officialEmail (on the public doc) is kept as a fallback
        // pre-fill only for any account that predates this field split
        // (e.g. seeded from the Google login email by
        // createFacultyAccountDoc) — never written back automatically,
        // the person still has to confirm/edit and submit it themselves.
        const prefillEmail = institutionalEmail || fdoc.officialEmail || '';
        setTitleIsOther(Boolean(fdoc.title) && !FACULTY_TITLES.includes(fdoc.title));
        setForm({
          name: fdoc.name || '',
          title: fdoc.title || '',
          // Best-effort pre-fill only — cross-department teaching
          // assignments are common, so this is a starting guess, not
          // authoritative; the dropdown stays fully editable.
          dept: fdoc.dept || guessDeptFromFacultyEmail(prefillEmail) || '',
          phone: fdoc.phone || '',
          officeRoom: fdoc.officeRoom || '',
          preferredName: fdoc.preferredName || '',
          institutionalEmail,
        });
        // A returning user with data already on file (e.g. they closed
        // the modal partway through on a previous load) skips straight
        // to Step 3 instead of re-walking email/preview — everything
        // needed for those steps is already filled in and still fully
        // editable via the "back" button from Step 3 if they want to
        // revisit it.
        if (institutionalEmail && fdoc.name && fdoc.dept) {
          setStep(3);
        }
      }
      setLoading(false);
    });
  }, []);

  const handleChange = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  // Step 1 only checks the email field — the rest of the form doesn't
  // exist on screen yet at this point.
  const validateStep1 = () => {
    const next = {};
    if (!form.institutionalEmail.trim()) {
      next.institutionalEmail = 'Institutional email is required';
    } else if (!isFacultyEmailFormat(form.institutionalEmail.trim())) {
      next.institutionalEmail = "This doesn't look like a valid KUET institutional email (a *.kuet.ac.bd address, not @stud.kuet.ac.bd).";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // Step 2 (preview) only gates on name/dept — both editable, pre-filled
  // from directoryMatch when there was one, but nothing stops someone
  // without a match from typing them in fresh.
  const validateStep2 = () => {
    const next = {};
    if (!form.name.trim()) next.name = 'Name is required';
    if (!form.dept.trim()) next.dept = 'Department is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // Step 3 (final submit) re-validates everything — belt-and-suspenders
  // in case someone reaches this step via back-navigation with a field
  // since cleared.
  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = 'Name is required';
    if (!form.title.trim()) next.title = 'Title / designation is required';
    if (!form.dept.trim()) next.dept = 'Department is required';
    if (!form.institutionalEmail.trim()) {
      next.institutionalEmail = 'Institutional email is required';
    } else if (!isFacultyEmailFormat(form.institutionalEmail.trim())) {
      next.institutionalEmail = "This doesn't look like a valid KUET institutional email (a *.kuet.ac.bd address, not @stud.kuet.ac.bd).";
    }
    // NOTE: phone stays optional here, same as before this migration. The
    // migration prompt suggested requiring it too (a number the Founder
    // can call to verify), but that's a product-decision call, not
    // something to silently flip — left as-is pending an explicit
    // decision from the person running this migration.
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goToStep2 = () => {
    if (!validateStep1()) return;
    // Entering Step 2 with a fresh directory match: pre-fill name/dept if
    // those fields are still empty (never overwrite something the person
    // already typed, e.g. if they went back and changed the email again
    // after already filling name/dept once).
    if (directoryMatch) {
      setForm((f) => ({
        ...f,
        name: f.name.trim() ? f.name : (directoryMatch.name || ''),
        dept: f.dept.trim() ? f.dept : (directoryMatch.department || ''),
      }));
    }
    setStep(2);
  };

  const goToStep3 = () => {
    if (!validateStep2()) return;
    setStep(3);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      // institutionalEmail goes to the PRIVATE sub-doc (not the public
      // faculty/{uid} doc saveFacultyProfile writes to) — see the file
      // header comment for why. Two writes, but each hits the right
      // Firestore rule for what it's touching.
      await Promise.all([
        saveFacultyProfile(auth.currentUser.uid, form),
        setFacultyInstitutionalEmail(auth.currentUser.uid, form.institutionalEmail),
      ]);
      // This is the most reliable trigger point for faculty: name+dept
      // are guaranteed valid here (validate() above), and this step is
      // mandatory in the onboarding queue (App.jsx 'faculty-profile'),
      // so it also covers accounts whose shell doc got created via
      // saveFacultyProfile's own self-heal path rather than
      // createFacultyAccountDoc — idempotent doc ID means this is a
      // no-op if AuthModal's earlier call already succeeded.
      //
      // `email` here is the institutional email, not the Google login
      // email — this is what the Founder actually needs to see to verify
      // someone is real KUET faculty (and what approveManualVerifyRequest
      // writes into verifiedFacultyEmails/{email} on approval, bridging
      // back onto faculty/{uid}.officialEmail — see facultySync.js). The
      // personal Gmail login address is included separately as
      // googleEmail — AdminDashboard's Approvals tab shows both side by
      // side so the Founder can cross-check them.
      ensureManualVerifyRequest('faculty', {
        name: form.name,
        email: form.institutionalEmail.trim(),
        googleEmail: auth.currentUser?.email || '',
        dept: form.dept,
      });
      onSave?.();
    } catch (err) {
      // Firestore's SDK surfaces both "genuinely denied by rules" and
      // "the write couldn't reach the server at all" (blocked by an
      // ad-blocker / privacy extension killing the Firestore channel,
      // offline, flaky connection, etc.) as the same generic
      // 'permission-denied' code, because the client can't tell the two
      // apart — it never got a real response either way. Showing the raw
      // Firestore message here ("Missing or insufficient permissions")
      // reads as an account/access problem and sends people down the
      // wrong troubleshooting path when the actual cause, in the vast
      // majority of real cases, is a blocked network request. We give the
      // network explanation first since it's by far the more common and
      // more fixable case for a signed-in user completing their own profile.
      const code = err?.code || '';
      const isLikelyBlocked = code === 'permission-denied' || code === 'unavailable' || /network|blocked|failed to fetch/i.test(err?.message || '');
      setErrors((prev) => ({
        ...prev,
        _general: isLikelyBlocked
          ? 'Could not save — this looks like a network/ad-blocker issue, not an account problem. Please disable any ad-blocker or privacy extension for this site (or add an exception for firestore.googleapis.com) and try again.'
          : (err.message || 'Could not save profile. Please try again.'),
      }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
      // Fully opaque, matching RoleSelectScreen / mandatory ProfileSetupModal
      // — no dashboard visible behind it, dimmed or otherwise.
      background: `
        radial-gradient(1200px 600px at 15% -10%, var(--accentSoft), transparent 60%),
        radial-gradient(900px 500px at 110% 110%, var(--accentSoft), transparent 55%),
        var(--bg)
      `,
    }}>
      <form
        onSubmit={(e) => {
          // Enter-to-submit inside a <form> always targets the nearest
          // submit-type button, which only exists on Step 3 now — but an
          // Enter press on Step 1/2's inputs still fires this handler with
          // no submit button focused, so guard on step explicitly instead
          // of relying on button wiring alone.
          if (step !== 3) { e.preventDefault(); return; }
          handleSubmit(e);
        }}
        style={{
          background: 'var(--surfaceGlassStrong, var(--card))',
          backdropFilter: 'blur(6px)',
          borderRadius: 22,
          padding: '32px 28px',
          width: '100%', maxWidth: 560,
          border: '1px solid var(--border)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.16)',
          maxHeight: '94vh',
          overflowY: 'auto',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ marginBottom: 22, textAlign: 'center' }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14, margin: '0 auto 14px',
            background: 'var(--accentSoft)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <GraduationCap size={24} color="var(--accent)" />
          </div>
          <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 6, color: 'var(--text)' }}>
            Complete your Faculty Profile
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            One-time setup. This is what students and staff will see for you across KUETx.
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px 0' }}>Loading…</div>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {/* Step indicator — purely visual, no click-to-jump (each step
                gates the next via validateStep1/validateStep2 above). */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  style={{
                    width: n === step ? 22 : 8, height: 8, borderRadius: 4,
                    background: n <= step ? 'var(--accent)' : 'var(--border)',
                    transition: 'width 0.2s, background 0.2s',
                  }}
                />
              ))}
            </div>

            {/* ---------- STEP 1: email ---------- */}
            {step === 1 && (
              <>
                <div>
                  <label style={labelStyle}>Institutional Email</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      style={{ ...fieldStyle, paddingRight: 38 }}
                      type="email"
                      value={form.institutionalEmail}
                      onChange={handleChange('institutionalEmail')}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); goToStep2(); } }}
                      placeholder="name@dept.kuet.ac.bd"
                      autoFocus
                    />
                    <div style={{ position: 'absolute', right: 10, top: 0, bottom: 0, display: 'flex', alignItems: 'center' }}>
                      {lookupStatus === 'checking' && <Loader2 size={16} color="var(--muted)" style={{ animation: 'spin 1s linear infinite' }} />}
                      {lookupStatus === 'matched' && <CheckCircle2 size={16} color="#16a34a" />}
                      {lookupStatus === 'no-match' && <HelpCircle size={16} color="var(--muted)" />}
                    </div>
                  </div>
                  {errors.institutionalEmail && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 5 }}>{errors.institutionalEmail}</div>}
                  {!errors.institutionalEmail && lookupStatus === 'matched' && (
                    <div style={{ fontSize: 11.5, color: '#16a34a', marginTop: 5, fontWeight: 600 }}>
                      Found in the official KUET faculty directory — next step will pre-fill your details.
                    </div>
                  )}
                  {!errors.institutionalEmail && lookupStatus === 'no-match' && (
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 5 }}>
                      Not found in the directory yet — that's fine, you can still continue and your account will be reviewed by the Founder.
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={goToStep2}
                  disabled={lookupStatus === 'checking'}
                  style={{
                    marginTop: 6, padding: '12px 18px', borderRadius: 8, border: 'none',
                    background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 14,
                    cursor: lookupStatus === 'checking' ? 'wait' : 'pointer', opacity: lookupStatus === 'checking' ? 0.7 : 1,
                  }}
                >
                  Continue
                </button>
              </>
            )}

            {/* ---------- STEP 2: preview / name & department ---------- */}
            {step === 2 && (
              <>
                {directoryMatch ? (
                  <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                    borderRadius: 10, background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.25)',
                  }}>
                    <CheckCircle2 size={18} color="#16a34a" style={{ flexShrink: 0, marginTop: 1 }} />
                    <div style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.5 }}>
                      Matched against the official directory as <strong>{directoryMatch.name}</strong>
                      {directoryMatch.department ? ` (${directoryMatch.department})` : ''}. Pre-filled below — feel free to correct anything that's out of date.
                    </div>
                  </div>
                ) : (
                  <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                    borderRadius: 10, background: 'var(--surfaceGlassStrong, var(--bg))', border: '1px solid var(--border)',
                  }}>
                    <HelpCircle size={18} color="var(--muted)" style={{ flexShrink: 0, marginTop: 1 }} />
                    <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>
                      No directory match for this email — enter your details below and a Founder will review your account.
                    </div>
                  </div>
                )}

                <div>
                  <label style={labelStyle}>Full Name</label>
                  <input style={fieldStyle} value={form.name} onChange={handleChange('name')} placeholder="Your full name" />
                  {errors.name && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 5 }}>{errors.name}</div>}
                </div>

                <div>
                  <label style={labelStyle}>Department</label>
                  <select style={fieldStyle} value={form.dept} onChange={handleChange('dept')}>
                    <option value="">Select department / institute</option>
                    <optgroup label="Departments">
                      {DEPARTMENTS.map((d) => <option key={d.code} value={d.code}>{d.name} ({d.code})</option>)}
                    </optgroup>
                    <optgroup label="Institutes">
                      {INSTITUTES.map((i) => <option key={i.code} value={i.code}>{i.name} ({i.code})</option>)}
                    </optgroup>
                    <optgroup label="Basic Science & Humanities">
                      {BASIC_SCIENCE_DEPTS.map((d) => <option key={d.code} value={d.code}>{d.name} ({d.code})</option>)}
                    </optgroup>
                  </select>
                  {errors.dept && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 5 }}>{errors.dept}</div>}
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    style={{
                      padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border)',
                      background: 'transparent', color: 'var(--text)', fontWeight: 700, fontSize: 14,
                      cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <ChevronLeft size={16} /> Back
                  </button>
                  <button
                    type="button"
                    onClick={goToStep3}
                    style={{
                      flex: 1, padding: '12px 18px', borderRadius: 8, border: 'none',
                      background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                    }}
                  >
                    Continue
                  </button>
                </div>
              </>
            )}

            {/* ---------- STEP 3: remaining details + confirm ---------- */}
            {step === 3 && (
              <>
                <div>
                  <label style={labelStyle}>Title / Designation</label>
                  <select
                    style={fieldStyle}
                    value={titleIsOther ? OTHER_TITLE : (FACULTY_TITLES.includes(form.title) ? form.title : '')}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === OTHER_TITLE) {
                        setTitleIsOther(true);
                        // Don't clear an existing custom title when switching into Other.
                        setForm((f) => ({ ...f, title: FACULTY_TITLES.includes(f.title) ? '' : f.title }));
                      } else {
                        setTitleIsOther(false);
                        setForm((f) => ({ ...f, title: v }));
                      }
                      setErrors((prev) => ({ ...prev, title: '' }));
                    }}
                  >
                    <option value="">Select title / designation</option>
                    {FACULTY_TITLE_GROUPS.map((g) => (
                      <optgroup key={g.label} label={g.label}>
                        {g.options.map((t) => <option key={t} value={t}>{t}</option>)}
                      </optgroup>
                    ))}
                    <option value={OTHER_TITLE}>Other…</option>
                  </select>
                  {titleIsOther && (
                    <input
                      style={{ ...fieldStyle, marginTop: 8 }}
                      value={form.title}
                      onChange={handleChange('title')}
                      placeholder="Enter your title / designation"
                      autoFocus
                    />
                  )}
                  {errors.title && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 5 }}>{errors.title}</div>}
                </div>

                <div>
                  <label style={labelStyle}>Phone (optional)</label>
                  <input style={fieldStyle} value={form.phone} onChange={handleChange('phone')} placeholder="e.g. 01700000000" />
                </div>

                <div>
                  <label style={labelStyle}>Office Room (optional)</label>
                  <input style={fieldStyle} value={form.officeRoom} onChange={handleChange('officeRoom')} />
                </div>

                <div>
                  <label style={labelStyle}>Preferred display name (optional, self-facing only)</label>
                  <input style={fieldStyle} value={form.preferredName} onChange={handleChange('preferredName')} />
                </div>

                {errors._general && (
                  <div style={{ fontSize: 12, color: '#dc2626', padding: '8px 10px', background: 'rgba(220,38,38,0.08)', borderRadius: 6 }}>
                    {errors._general}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={saving}
                    style={{
                      padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border)',
                      background: 'transparent', color: 'var(--text)', fontWeight: 700, fontSize: 14,
                      cursor: saving ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <ChevronLeft size={16} /> Back
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      flex: 1, padding: '12px 18px', borderRadius: 8, border: 'none',
                      background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 14,
                      cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1,
                    }}
                  >
                    {saving ? 'Saving…' : 'Finish Setup'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
