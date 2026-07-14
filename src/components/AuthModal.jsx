/**
 * AuthModal.jsx — KUETx Firebase Auth UI
 * Handles: Anonymous skip, Google login, Email/Password, Account upgrade
 */

import { useState } from 'react';
import { X, Mail, Lock, User, Chrome, CheckCircle, Eye, EyeOff } from 'lucide-react';
import {
  loginWithGoogle,
  loginWithEmail,
  registerWithEmail,
  upgradeWithGoogle,
  upgradeWithEmail,
  resetPassword,
  getAuthErrorMessage,
} from '../lib/firebaseAuth';
import { isObviouslyBadDomain, getTypoSuggestion } from '../lib/emailDomainCheck';
import { setAccountRole, persistAccountRoleToServer } from '../lib/accountRole';
// RESTRUCTURE v2: Register now asks Student/Faculty INLINE, right at the
// top of the Register tab, before showing the form — not a day later at a
// standalone 'role-select' step. That standalone step still exists as a
// safety-net for accounts that somehow ended up with no role recorded
// (see RoleSelectScreen.jsx), but the normal Register path never reaches
// it anymore: role + account + (faculty) shell doc all happen in one
// submit, right here.
import { isFacultyEmailFormat } from '../lib/facultyEmailVerify';
import { createFacultyAccountDoc } from '../lib/facultySync';

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};

const btnPrimary = {
  width: '100%',
  padding: '11px 16px',
  borderRadius: 8,
  border: 'none',
  background: 'var(--accent)',
  color: '#fff',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
};

const btnGoogle = {
  width: '100%',
  padding: '11px 16px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  color: 'var(--text)',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
};

const btnGhost = {
  background: 'none',
  border: 'none',
  color: 'var(--accent)',
  fontSize: 13,
  cursor: 'pointer',
  padding: '4px 0',
  textDecoration: 'underline',
};

export default function AuthModal({ mode = 'login', isUpgrade = false, onClose, onSuccess, queueMode = false, variant = 'student' }) {
  // variant === 'faculty': §5 Step 2 of the merged Faculty Module prompt.
  // Same underlying Firebase email+password flow as the student path
  // (registerWithEmail/upgradeWithEmail, unchanged) — this variant only
  // adds a client-side *.kuet.ac.bd suffix gate before submit (Deviation 1)
  // and, on success, creates the faculty/{uid} doc with verifiedAt: null
  // (Deviation 2 hard gate — the caller then routes to
  // FacultyVerifyHoldingScreen, which is where the magic-link mechanism
  // lives). No Google Sign-In, no register/login tab toggle, no student
  // Bengali copy — everything in this branch is English per Deviation 3.
  const isFaculty = variant === 'faculty';
  // showAsFaculty: drives ALL faculty-styled copy/placeholders/behavior
  // below (English text, institutional-email placeholder, no Google, no
  // anonymous skip) — true either when a caller pre-forces variant=
  // "faculty" (legacy path, still supported), OR when someone on the
  // Register tab just picked Faculty inline. Login/Upgrade never set
  // registerRole, so this only ever differs from isFaculty during a
  // fresh Register.
  const [tab, setTab] = useState(mode); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  // Inline Register-tab role choice: null until picked, then 'student' |
  // 'teacher'. Only meaningful on the Register tab — Login stays
  // role-agnostic (existing accounts get routed by buildQueue's
  // server-side role lookup, same as before). Resets whenever the tab
  // changes back to Register from Login, so switching tabs never leaves
  // a stale choice behind.
  const [registerRole, setRegisterRole] = useState(null);
  const showAsFaculty = isFaculty || registerRole === 'teacher';
  // BUGFIX: showEmailForm removed — email/password form is now always
  // shown expanded (no longer collapsed behind a "or use email" toggle),
  // since it's the primary path and Google is now the secondary option.
  const [domainWarning, setDomainWarning] = useState(false);
  const [typoSuggestion, setTypoSuggestion] = useState(null);
  // BUGFIX (Register/Login dead-end): if an account exists but its
  // verification (KUET email OTP/magic-link, faculty or student) never
  // finished — network drop, closed tab, whatever — the person is left
  // with nowhere to go: Register says "already in use" (no fallback,
  // since that fallback previously only existed for the anonymous-
  // upgrade path below), Login says "wrong password" (they may genuinely
  // have forgotten it, mistyped it originally, or be on a device that
  // never had it saved), and "Forgot password?" was only ever shown on
  // the Login tab, invisible from the Register-tab error and from a
  // failed Login attempt itself. Nothing connected the two failures to
  // the one path that actually resolves both: Reset Password. This flag
  // tracks "we're in that dead-end right now" so the UI can surface the
  // reset option in-context instead of leaving a silent trap.
  const [stuckOnExistingEmail, setStuckOnExistingEmail] = useState(false);

  const handleEmailBlur = () => {
    setDomainWarning(!!email && isObviouslyBadDomain(email));
    setTypoSuggestion(email ? getTypoSuggestion(email) : null);
  };

  const applyTypoSuggestion = () => {
    if (!typoSuggestion) return;
    const at = email.lastIndexOf('@');
    setEmail(email.slice(0, at + 1) + typoSuggestion);
    setDomainWarning(false);
    setTypoSuggestion(null);
  };

  const handleReset = async () => {
    if (!email) { setError('Please enter your email address first, then a reset link will be sent.'); return; }
    setLoading(true);
    setError('');
    try {
      await resetPassword(email);
      setResetSent(true);
    } catch (err) {
      setError(getAuthErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    setError('');
    try {
      const user = isUpgrade ? await upgradeWithGoogle() : await loginWithGoogle();
      // BUGFIX (see BUGFIX_SIGNUP_ROLE_ORDER.md): Google Sign-In is
      // student-only (Deviation 3 — faculty always uses institutional
      // email/password, never Google), and Firebase auto-creates the
      // account on first use with no separate "register" step to hook
      // into. Safe to always persist 'student' here regardless of
      // new-vs-returning: for a genuinely new account this is the first
      // (and only, permanent) role write; for a returning account,
      // firestore.rules already rejects overwriting an existing
      // users/{uid}.role, so this is a harmless no-op.
      // RESTRUCTURE note: Google is unaffected by the auth/role-select
      // reorder — since it's always student and never faculty, there's
      // no ambiguous role to defer here, unlike email Register above.
      setAccountRole('student');
      persistAccountRoleToServer('student').catch(() => {});
      onSuccess?.(user, { linked: isUpgrade });
    } catch (err) {
      if (isUpgrade && err.code === 'auth/credential-already-in-use') {
        // This Google account already belongs to a real (non-anonymous)
        // account from before — can't link it to a NEW anonymous uid.
        // Fall back to logging into that existing account directly, so
        // a returning user isn't stuck just because they're currently
        // holding a fresh anonymous session on this device.
        try {
          const user = await loginWithGoogle();
          setAccountRole('student');
          persistAccountRoleToServer('student').catch(() => {});
          onSuccess?.(user, { linked: false, fellBackToExistingAccount: true });
          return;
        } catch (err2) {
          setError(getAuthErrorMessage(err2.code));
          return;
        }
      }
      setError(getAuthErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleEmail = async () => {
    if (!email || !password) {
      setError('Please enter both your email address and password.');
      return;
    }

    // Register (not Login, not Upgrade) now requires the inline role
    // choice to have been made first — the role-styled fields below only
    // render once registerRole is set, so this mainly guards against a
    // stray Enter-key submit before a choice is picked.
    if (!isUpgrade && tab === 'register' && !registerRole) {
      setError('Please choose Student or Faculty first.');
      return;
    }

    // Faculty institutional-email gate now runs HERE, at submit time,
    // instead of later at RoleSelectScreen — role is already known (it's
    // why the form looks the way it does), so this is the earliest point
    // the format can actually be checked.
    if (!isUpgrade && tab === 'register' && registerRole === 'teacher' && !isFacultyEmailFormat(email)) {
      setError(
        "This doesn't look like a valid KUET institutional email " +
        '(a *.kuet.ac.bd address, not @stud.kuet.ac.bd). ' +
        'Faculty accounts need an institutional email — if you have a ' +
        'personal address, choose Student instead.'
      );
      return;
    }

    // Domain check itself lives in firebaseAuth.js (registerWithEmail /
    // upgradeWithEmail) — that's the single enforcement point, so it
    // can't be bypassed by any other caller of those functions. Here we
    // just run it ONE extra time up front purely for UX: instant
    // specific feedback (typo suggestion, disposable, etc) before
    // showing a generic Firebase error, and a "checking..." button
    // state. This used to duplicate the network call (once here, once
    // inside firebaseAuth.js) — now it's skipped here and we just catch
    // the domain-not-real error thrown by firebaseAuth.js below instead,
    // so the MX lookup only ever runs once per submit.
    setLoading(true);
    setError('');
    setStuckOnExistingEmail(false);
    try {
      let user;
      if (isUpgrade || tab === 'register') {
        user = await (isUpgrade
          ? upgradeWithEmail(email, password, name)
          : registerWithEmail(email, password, name));
        // RESTRUCTURE v2: role IS known here now (registerRole, chosen
        // inline before this form even rendered) for a plain Register —
        // save it immediately, and create the faculty shell doc in the
        // same submit if Faculty was chosen. Account create + role save
        // + (faculty) shell doc all happen in one Register click.
        // 'role-select' (RoleSelectScreen.jsx) still exists purely as a
        // safety-net for an existing account with no role recorded
        // anywhere — this normal Register path never reaches it.
        if (!isUpgrade && registerRole) {
          setAccountRole(registerRole);
          persistAccountRoleToServer(registerRole).catch(() => {});
          if (registerRole === 'teacher') {
            await createFacultyAccountDoc(user.uid, email);
          }
        }
      } else {
        user = await loginWithEmail(email, password);
      }
      onSuccess?.(user, { linked: isUpgrade });
    } catch (err) {
      // BUGFIX (Register/Login dead-end): this used to only run for
      // isUpgrade — a plain (non-upgrade) Register hitting
      // auth/email-already-in-use had NO fallback at all, which is
      // exactly the trap someone falls into if they registered once,
      // never finished verification (network drop, closed tab), and
      // came back later: Register now says "already in use" with no way
      // forward, since the account genuinely already exists. Trying the
      // typed password as a login first means the common case — they
      // remember the password they just set — resolves silently and
      // sends them straight back into their unfinished verification
      // step, instead of dead-ending on an error screen.
      if (
        (err.code === 'auth/credential-already-in-use' || err.code === 'auth/email-already-in-use')
      ) {
        try {
          const existingUser = await loginWithEmail(email, password);
          onSuccess?.(existingUser, { linked: false, fellBackToExistingAccount: true });
          return;
        } catch (err2) {
          // Wrong/forgotten password on an account that DOES exist —
          // this is the other half of the trap. Don't just show a raw
          // error: flag it so the UI can surface "Forgot password?"
          // right here, even though we're on the Register tab where
          // that link normally doesn't appear at all.
          setStuckOnExistingEmail(true);
          setError(getAuthErrorMessage(err2.code));
          return;
        }
      }
      // Plain Login (not Register/Upgrade) failing with invalid
      // credentials is the same dead-end from the other direction — the
      // account might exist with a different/forgotten password. Surface
      // the same inline reset hint here too, since "Forgot password?"
      // sitting a few pixels above the error isn't obviously connected
      // to it, especially on a mobile-width screen where it can scroll
      // out of view before the error even renders.
      if (!isUpgrade && tab === 'login' && err.code === 'auth/invalid-credential') {
        setStuckOnExistingEmail(true);
      }
      setError(describeDomainError(err) || getAuthErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  // Turns a thrown auth/domain-not-real error (see firebaseAuth.js) into
  // the most specific Bengali message we can give — typo suggestion is
  // the most actionable, so it takes priority over the generic message
  // getAuthErrorMessage would otherwise show for that same error code.
  const describeDomainError = (err) => {
    if (err.code !== 'auth/domain-not-real') return null;
    if (err.domainReason === 'typo' && err.domainSuggestion) {
      return `Is this email address correct? Did you mean "${err.domainSuggestion}"?`;
    }
    if (err.domainReason === 'disposable') {
      return 'This appears to be a temporary or disposable email address. Please use a real email address.';
    }
    if (err.domainReason === 'no-mx') {
      return 'This email address does not appear to be able to receive mail. Please check the spelling or use a different email address.';
    }
    return getAuthErrorMessage(err.code);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: 16,
    }}>
      <div style={{
        background: 'var(--card)', borderRadius: 18, padding: 24,
        width: '100%', maxWidth: 500, position: 'relative',
        border: '1px solid var(--border)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.28)',
      }}>
        {/* Close */}
        {onClose && !isUpgrade && (
          <button onClick={onClose} style={{
            position: 'absolute', top: 14, right: 14,
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)',
          }}>
            <X size={18} />
          </button>
        )}

        {/* Header */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontWeight: 800, fontSize: 19, marginBottom: 4 }}>
            {showAsFaculty
              ? (tab === 'login' ? 'Faculty Sign In' : 'Faculty Sign Up')
              : (isUpgrade ? 'Create account' : queueMode ? 'Enable sync' : tab === 'login' ? 'Welcome back' : 'Create your account')}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>
            {showAsFaculty
              ? (tab === 'login'
                  ? 'Sign in with your KUET institutional email.'
                  : 'Sign up with your KUET institutional email (name@dept.kuet.ac.bd).')
              : (isUpgrade || queueMode
                  ? 'Your data will sync across devices.'
                  : tab === 'login'
                  ? 'Sign in to sync data across devices.'
                  : 'Your data will be saved to the cloud.')}
          </div>
        </div>

        {/* BUGFIX: Email/Password now shown first (expanded, not collapsed
            behind a toggle) — Google Sign-In moved below as the secondary
            option. Student-only reorder; faculty flow is unaffected since
            it never shows Google at all. */}
        {!isUpgrade && (
          <div style={{ display: 'flex', gap: 0, marginBottom: 14, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
            {['login', 'register'].map(t => (
              <button key={t} onClick={() => { setTab(t); setError(''); setRegisterRole(null); setStuckOnExistingEmail(false); }}
                style={{
                  flex: 1, padding: '9px 0', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  background: tab === t ? 'var(--accent)' : 'var(--card)',
                  color: tab === t ? '#fff' : 'var(--muted)',
                }}>
                {t === 'login' ? 'Login' : 'Register'}
              </button>
            ))}
          </div>
        )}

        {/* Inline Register-tab role choice — shown first, before any form
            field. Student/Faculty picks which field set + copy renders
            below (student-style Bengali form vs faculty-style English
            institutional-email form). Never shown on Login (role-
            agnostic by design) or Upgrade (anonymous-session upgrade is
            always student, same as Google). */}
        {!isUpgrade && tab === 'register' && !isFaculty && !registerRole && (
          <div style={{ display: 'grid', gap: 10, marginBottom: 4 }}>
            <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Which role are you joining as?</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setRegisterRole('student')}
                style={{ ...btnGoogle, flexDirection: 'column', gap: 4, padding: '16px 10px' }}
              >
                <User size={18} />
                Student
              </button>
              <button
                type="button"
                onClick={() => setRegisterRole('teacher')}
                style={{ ...btnGoogle, flexDirection: 'column', gap: 4, padding: '16px 10px' }}
              >
                <Chrome size={18} />
                Faculty
              </button>
            </div>
          </div>
        )}

        {/* Email form — for Register, only shows once a role is picked
            above (or immediately, if isFaculty was pre-forced by a
            caller, or if isUpgrade, both of which skip the role picker
            entirely). Login always shows immediately, role-agnostic. */}
        {(tab === 'login' || isUpgrade || isFaculty || registerRole) && (
        <div style={{ display: 'grid', gap: 10 }}>
          {/* BUGFIX: this row used to render even when registerRole was
              still null (isFaculty-forced case), showing a "Switch to
              Student" link that defaulted to a guessed label instead of
              reflecting an actual choice — misleading, since no role had
              been picked yet. Now split into two unambiguous states:
              (1) a role was picked inline just now → show which one,
              plus a real "switch" link back to the picker; (2) the
              caller pre-forced variant="faculty" (no inline picker was
              ever shown, so there's nothing to "switch" back to) → show
              a plain, non-interactive "Faculty" indicator instead. */}
          {tab === 'register' && !isUpgrade && registerRole && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: -4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                Signing up as: {registerRole === 'teacher' ? 'Faculty' : 'Student'}
              </span>
              <button
                type="button"
                onClick={() => setRegisterRole(null)}
                style={{ ...btnGhost, fontSize: 12, padding: 0 }}
              >
                ← Change
              </button>
            </div>
          )}
          {tab === 'register' && !isUpgrade && isFaculty && !registerRole && (
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: -4 }}>
              Signing up as: Faculty
            </div>
          )}
          {(tab === 'register' || isUpgrade) && (
            <div style={{ position: 'relative' }}>
              <User size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
              <input style={{ ...inputStyle, paddingLeft: 32 }} placeholder="Your name (optional)" value={name} onChange={e => setName(e.target.value)} />
            </div>
          )}
          <div style={{ position: 'relative' }}>
            <Mail size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <input style={{ ...inputStyle, paddingLeft: 32 }} type="email" placeholder={showAsFaculty ? 'Institutional email (name@dept.kuet.ac.bd)' : 'Email address'} value={email}
              onChange={e => { setEmail(e.target.value); setDomainWarning(false); setTypoSuggestion(null); }} onBlur={handleEmailBlur} />
          </div>
          {typoSuggestion && (tab === 'register' || isUpgrade) && (
            <div style={{ fontSize: 12, color: 'var(--warning)', marginTop: -4 }}>
              {showAsFaculty ? `Did you mean "${typoSuggestion}"?` : `Did you mean "${typoSuggestion}"?`}{' '}
              <button type="button" onClick={applyTypoSuggestion} style={{ ...btnGhost, fontSize: 12, padding: 0 }}>
                {showAsFaculty ? 'Yes, fix it' : 'Yes, fix it'}
              </button>
            </div>
          )}
          {domainWarning && !typoSuggestion && (tab === 'register' || isUpgrade) && (
            <div style={{ fontSize: 12, color: 'var(--warning)', marginTop: -4 }}>
              {showAsFaculty ? 'Please double-check this email address.' : 'Please double-check this email address.'}
            </div>
          )}
          <div style={{ position: 'relative' }}>
            <Lock size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <input
              style={{ ...inputStyle, paddingLeft: 32, paddingRight: 42 }}
              type={showPassword ? 'text' : 'password'}
              placeholder="Password (at least 6 characters)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleEmail()}
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--muted)',
              }}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {!isUpgrade && (tab === 'login' || stuckOnExistingEmail) && !resetSent && (
            <div style={{ textAlign: 'right', marginTop: -4 }}>
              <button style={{ ...btnGhost, fontSize: 12 }} onClick={() => { setError(''); setStuckOnExistingEmail(false); handleReset(); }} disabled={loading}>
                {showAsFaculty ? 'Forgot password?' : 'Forgot password?'}
              </button>
            </div>
          )}

          {resetSent && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'var(--accent)', padding: '10px 12px', background: 'rgba(34,197,94,0.08)', borderRadius: 6 }}>
              <CheckCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{showAsFaculty ? `A reset link has been sent to ${email}. Check your inbox (and spam folder).` : `A reset link has been sent to ${email}. Check your inbox (and spam folder).`}</span>
            </div>
          )}

          {error && (
            <div style={{ fontSize: 12, color: 'var(--danger, #dc2626)', padding: '8px 10px', background: 'rgba(220,38,38,0.08)', borderRadius: 6 }}>
              {error}
              {stuckOnExistingEmail && (
                <div style={{ marginTop: 6, color: 'var(--muted)', fontWeight: 400 }}>
                  {showAsFaculty
                    ? "An account with this email already exists — if you don't remember the password, use \"Forgot password?\" above to reset it and continue."
                    : 'An account with this email already exists — if you do not remember the password, use "Forgot password?" above to reset it and continue.'}
                </div>
              )}
            </div>
          )}

          <button style={btnPrimary} onClick={handleEmail} disabled={loading}>
            {showAsFaculty
              ? (loading
                  ? ((isUpgrade || tab === 'register') ? 'Verifying email and creating account…' : 'Loading…')
                  : (isUpgrade ? 'Create account' : tab === 'login' ? 'Sign In' : 'Sign Up'))
              : (loading
                  ? ((isUpgrade || tab === 'register') ? 'Verifying email and creating account...' : 'Loading...')
                  : isUpgrade ? 'Create account' : tab === 'login' ? 'Sign in' : 'Create account')}
          </button>
        </div>
        )}

        {/* Google button — never shown for faculty (Deviation: email+password
            only, no Google Sign-In, no per-department config toggle).
            BUGFIX: moved below the email/password form (was above it).
            Now also hidden whenever showAsFaculty is true for any reason
            (pre-forced variant OR just chosen inline on Register) — and,
            on the Register tab specifically, hidden until a role has
            actually been picked (registerRole), since there's no form to
            attach it below yet during the inline role-choice screen. */}
        {!showAsFaculty && (tab === 'login' || isUpgrade || registerRole) && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0', color: 'var(--muted)', fontSize: 12 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              or
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <button style={btnGoogle} onClick={handleGoogle} disabled={loading}>
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {loading ? 'Loading...' : 'Continue with Google to ' + (isUpgrade || tab === 'register' ? 'sign up' : 'sign in')}
            </button>
          </>
        )}

        {/* Anonymous skip (only on initial, not upgrade) — never shown for
            faculty: the merged prompt's Deviation 2 hard gate means there is
            no "skip for now" path once someone has chosen the Faculty Member
            role, unlike the student flow's optional anonymous mode. Also
            hidden while the Register tab is still on the inline role-choice
            screen (registerRole === null) — nothing to skip past yet. */}
        {!isUpgrade && !showAsFaculty && (tab === 'login' || registerRole) && onClose && (
          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <button style={{ ...btnGhost, color: 'var(--muted)', textDecoration: 'none', fontSize: 12 }} onClick={onClose}>
              {queueMode ? 'Skip for now — continue without an account →' : 'Continue without signing in'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}