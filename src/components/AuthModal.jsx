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
// RESTRUCTURE: isFacultyEmailFormat and createFacultyAccountDoc moved to
// RoleSelectScreen.jsx — faculty-specific logic now runs at role-choice
// time, not inside the generic auth step (see handleEmail comment below).
import { setAccountRole, persistAccountRoleToServer } from '../lib/accountRole';

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
  const [tab, setTab] = useState(mode); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  // BUGFIX: showEmailForm removed — email/password form is now always
  // shown expanded (no longer collapsed behind a "or use email" toggle),
  // since it's the primary path and Google is now the secondary option.
  const [domainWarning, setDomainWarning] = useState(false);
  const [typoSuggestion, setTypoSuggestion] = useState(null);

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
    if (!email) { setError('আগে email address দাও, তারপর reset link পাঠানো হবে।'); return; }
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
      setError(isFaculty ? 'Please enter both email and password.' : 'Email আর password দাও।');
      return;
    }

    // RESTRUCTURE: the faculty email-format pre-check used to live here,
    // gated on isFaculty. Post-restructure, 'auth' is always generic
    // (role unknown), so isFaculty is never true at this point — that
    // validation now happens in RoleSelectScreen.jsx instead, at the
    // moment someone actually picks "Faculty Member" and their email is
    // finally known to matter.

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
    try {
      let user;
      if (isUpgrade || tab === 'register') {
        user = await (isUpgrade
          ? upgradeWithEmail(email, password, name)
          : registerWithEmail(email, password, name));
        // RESTRUCTURE: role is no longer set here. Previously this ran
        // right after AuthModal was rendered with a pre-decided
        // variant="faculty"/"student" (chosen by Role Select, which used
        // to run BEFORE 'auth'). Now 'auth' runs first with no role
        // decided at all — Register just creates a plain account with NO
        // role, and the very next queue step is 'role-select', which is
        // the one place role actually gets chosen and persisted
        // (RoleSelectScreen.jsx). Faculty's verifiedAt:null doc creation
        // has moved there too, since it can't happen before a role is
        // even picked.
      } else {
        user = await loginWithEmail(email, password);
      }
      onSuccess?.(user, { linked: isUpgrade });
    } catch (err) {
      if (isUpgrade && (err.code === 'auth/credential-already-in-use' || err.code === 'auth/email-already-in-use')) {
        // Same fallback as Google above: this email already has a real
        // account from before this device's current anonymous session —
        // log into it directly instead of leaving the user stuck.
        try {
          const user = await loginWithEmail(email, password);
          onSuccess?.(user, { linked: false, fellBackToExistingAccount: true });
          return;
        } catch (err2) {
          setError(getAuthErrorMessage(err2.code));
          return;
        }
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
      return `এই email ঠিক আছে তো? "${err.domainSuggestion}" বলতে চাওনি তো?`;
    }
    if (err.domainReason === 'disposable') {
      return 'এটা একটা temporary/disposable email service মনে হচ্ছে — সরাসরি একটা real email address ব্যবহার করো।';
    }
    if (err.domainReason === 'no-mx') {
      return 'এই email address-এ মেইল পাঠানো যাচ্ছে না মনে হচ্ছে — বানান আরেকবার চেক করো, নাহলে অন্য একটা email দাও।';
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
            {isFaculty
              ? (tab === 'login' ? 'Faculty Sign In' : 'Faculty Sign Up')
              : (isUpgrade ? 'Account তৈরি করো' : queueMode ? 'Sync চালু করো' : tab === 'login' ? 'স্বাগতম' : 'Account বানাও')}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>
            {isFaculty
              ? (tab === 'login'
                  ? 'Sign in with your KUET institutional email.'
                  : 'Sign up with your KUET institutional email (name@dept.kuet.ac.bd).')
              : (isUpgrade || queueMode
                  ? 'সব device-এ data sync হবে।'
                  : tab === 'login'
                  ? 'Login করে সব device-এ data sync করো।'
                  : 'সব data cloud-এ save হবে।')}
          </div>
        </div>

        {/* BUGFIX: Email/Password now shown first (expanded, not collapsed
            behind a toggle) — Google Sign-In moved below as the secondary
            option. Student-only reorder; faculty flow is unaffected since
            it never shows Google at all. */}
        {!isUpgrade && (
          <div style={{ display: 'flex', gap: 0, marginBottom: 14, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
            {['login', 'register'].map(t => (
              <button key={t} onClick={() => { setTab(t); setError(''); }}
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

        {/* Email form */}
        <div style={{ display: 'grid', gap: 10 }}>
          {(tab === 'register' || isUpgrade) && (
            <div style={{ position: 'relative' }}>
              <User size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
              <input style={{ ...inputStyle, paddingLeft: 32 }} placeholder={isFaculty ? 'Your name (optional)' : 'তোমার নাম (optional)'} value={name} onChange={e => setName(e.target.value)} />
            </div>
          )}
          <div style={{ position: 'relative' }}>
            <Mail size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <input style={{ ...inputStyle, paddingLeft: 32 }} type="email" placeholder={isFaculty ? 'Institutional email (name@dept.kuet.ac.bd)' : 'Email address'} value={email}
              onChange={e => { setEmail(e.target.value); setDomainWarning(false); setTypoSuggestion(null); }} onBlur={handleEmailBlur} />
          </div>
          {typoSuggestion && (tab === 'register' || isUpgrade) && (
            <div style={{ fontSize: 12, color: 'var(--warning)', marginTop: -4 }}>
              {isFaculty ? `Did you mean "${typoSuggestion}"?` : `"${typoSuggestion}" বলতে চাওনি তো?`}{' '}
              <button type="button" onClick={applyTypoSuggestion} style={{ ...btnGhost, fontSize: 12, padding: 0 }}>
                {isFaculty ? 'Yes, fix it' : 'হ্যাঁ, ঠিক করো'}
              </button>
            </div>
          )}
          {domainWarning && !typoSuggestion && (tab === 'register' || isUpgrade) && (
            <div style={{ fontSize: 12, color: 'var(--warning)', marginTop: -4 }}>
              {isFaculty ? 'Please double-check this email address.' : 'Email address-টা একবার চেক করে দাও, ঠিক লিখেছো তো?'}
            </div>
          )}
          <div style={{ position: 'relative' }}>
            <Lock size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <input
              style={{ ...inputStyle, paddingLeft: 32, paddingRight: 42 }}
              type={showPassword ? 'text' : 'password'}
              placeholder={isFaculty ? 'Password (at least 6 characters)' : 'Password (কমপক্ষে ৬ characters)'}
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

          {!isUpgrade && tab === 'login' && !resetSent && (
            <div style={{ textAlign: 'right', marginTop: -4 }}>
              <button style={{ ...btnGhost, fontSize: 12 }} onClick={() => { setError(''); handleReset(); }} disabled={loading}>
                {isFaculty ? 'Forgot password?' : 'Password ভুলে গেছো?'}
              </button>
            </div>
          )}

          {resetSent && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'var(--accent)', padding: '10px 12px', background: 'rgba(34,197,94,0.08)', borderRadius: 6 }}>
              <CheckCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{isFaculty ? `A reset link has been sent to ${email}. Check your inbox (and spam folder).` : `Reset link পাঠানো হয়েছে ${email} এ। Inbox (ও spam folder) চেক করো।`}</span>
            </div>
          )}

          {error && (
            <div style={{ fontSize: 12, color: 'var(--danger, #dc2626)', padding: '8px 10px', background: 'rgba(220,38,38,0.08)', borderRadius: 6 }}>
              {error}
            </div>
          )}

          <button style={btnPrimary} onClick={handleEmail} disabled={loading}>
            {isFaculty
              ? (loading
                  ? ((isUpgrade || tab === 'register') ? 'Verifying email and creating account…' : 'Loading…')
                  : (isUpgrade ? 'Create account' : tab === 'login' ? 'Sign In' : 'Sign Up'))
              : (loading
                  ? ((isUpgrade || tab === 'register') ? 'Email চেক করে Account তৈরি হচ্ছে...' : 'Loading...')
                  : isUpgrade ? 'Account তৈরি করো' : tab === 'login' ? 'Login' : 'Register')}
          </button>
        </div>

        {/* Google button — never shown for faculty (Deviation: email+password
            only, no Google Sign-In, no per-department config toggle).
            BUGFIX: moved below the email/password form (was above it). */}
        {!isFaculty && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0', color: 'var(--muted)', fontSize: 12 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              অথবা
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <button style={btnGoogle} onClick={handleGoogle} disabled={loading}>
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {loading ? 'Loading...' : 'Google দিয়ে ' + (isUpgrade || tab === 'register' ? 'Register' : 'Login')}
            </button>
          </>
        )}

        {/* Anonymous skip (only on initial, not upgrade) — never shown for
            faculty: the merged prompt's Deviation 2 hard gate means there is
            no "skip for now" path once someone has chosen the Faculty Member
            role, unlike the student flow's optional anonymous mode. */}
        {!isUpgrade && !isFaculty && onClose && (
          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <button style={{ ...btnGhost, color: 'var(--muted)', textDecoration: 'none', fontSize: 12 }} onClick={onClose}>
              {queueMode ? 'Skip for now — continue without account →' : 'এখন না — login ছাড়াই ব্যবহার করব'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}