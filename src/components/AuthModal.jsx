/**
 * AuthModal.jsx — KUETx Auth UI (Google Sign-In only)
 *
 * Auth Simplification migration: every previous method — student
 * username+password, service-provider phone+password, faculty
 * email+password — has been removed. Google Sign-In is now the only way
 * into the app, for every role. Role selection (student/faculty/provider)
 * still happens, but as a separate step AFTER sign-in (RoleSelectScreen.jsx),
 * not here.
 *
 * Both loginWithGoogle() and upgradeWithGoogle() (firebaseAuth.js) are
 * redirect-based — clicking the button navigates the whole page to Google
 * and back, it does not resolve with a user directly. This component only
 * shows a brief "redirecting…" state and then unmounts as the page
 * navigates away. The actual sign-in completion (and the onSuccess call)
 * happens later, after the page reloads, via handleGoogleRedirectResult()
 * wired up in useFirebaseAuth.js — that is the single place responsible
 * for resuming post-login routing, regardless of which screen originally
 * triggered the sign-in.
 */

import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { auth } from '../lib/firebase';
import { loginWithGoogle, upgradeWithGoogle } from '../lib/firebaseAuth';
import GuideModal from './GuideModal';

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

export default function AuthModal({ mode = 'login', isUpgrade = false, onClose, onSuccess, queueMode = false }) {
  // mode is accepted for backward compatibility with existing call sites
  // (all 4 pass mode="login") but no longer changes anything — there's no
  // Login/Register distinction anymore, just "sign in with Google."
  void mode;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [guideOpen, setGuideOpen] = useState(false);

  const handleGoogle = async () => {
    setLoading(true);
    setError('');
    try {
      // isUpgrade: there's an existing anonymous session to preserve
      // (check auth.currentUser?.isAnonymous) — link the Google account to
      // that same uid instead of starting a fresh sign-in, so local
      // IndexedDB data isn't orphaned.
      //
      // BUGFIX: loginWithGoogle()/upgradeWithGoogle() are popup-first now
      // (see firebaseAuth.js) — they resolve directly with the signed-in
      // user in the common case, instead of always navigating the page
      // away. Call onSuccess directly when that happens. They only fall
      // back to a redirect (no return value, page navigates away) for the
      // narrower case popups can't handle — that case is still picked up
      // later by handleGoogleRedirectResult() + the onAuthChange listener
      // in useFirebaseAuth.js, same as before.
      const user = isUpgrade && auth.currentUser?.isAnonymous
        ? await upgradeWithGoogle()
        : await loginWithGoogle();
      if (user) {
        onSuccess?.(user, { linked: isUpgrade });
      }
      // else: fell back to redirect, page is navigating away — nothing
      // more to do here.
    } catch (err) {
      setError('Could not sign in with Google. Please try again.');
      setLoading(false);
    }
  };

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
    >
      <div
        style={{
          background: 'var(--surfaceGlassStrong, var(--card))',
          backdropFilter: 'blur(6px)',
          borderRadius: 22,
          padding: '32px 28px',
          width: '100%', maxWidth: 420,
          border: '1px solid var(--border)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.16)',
          position: 'relative',
        }}
      >
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              position: 'absolute', top: 14, right: 14,
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--muted)', fontSize: 18, lineHeight: 1, padding: 4,
            }}
          >
            ×
          </button>
        )}

        <div style={{ marginBottom: 22, textAlign: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 6, color: 'var(--text)' }}>
            KUETx-এ স্বাগতম
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
            চালিয়ে যেতে আপনার Google অ্যাকাউন্ট দিয়ে সাইন ইন করুন।
          </div>
        </div>

        <button style={btnGoogle} onClick={handleGoogle} disabled={loading}>
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {loading ? 'সাইন ইন করা হচ্ছে…' : 'Google দিয়ে সাইন ইন করুন'}
        </button>

        <button
          type="button"
          onClick={() => setGuideOpen(true)}
          style={{
            width: '100%', marginTop: 10, padding: '10px 14px',
            borderRadius: 8, border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--accent)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <BookOpen size={15} /> KUETx Guide
        </button>

        {error && (
          <div style={{ fontSize: 12, color: 'var(--danger, #dc2626)', padding: '8px 10px', background: 'rgba(220,38,38,0.08)', borderRadius: 6, marginTop: 12 }}>
            {error}
          </div>
        )}

        {/* "X to close" / "Skip for now" — only rendered when onClose is
            truthy, same as before this migration. */}
        {onClose && (
          <div style={{ textAlign: 'center', marginTop: 14 }}>
            <button style={{ ...btnGhost, color: 'var(--muted)', textDecoration: 'none', fontSize: 12 }} onClick={onClose}>
              {queueMode ? 'Skip for now — continue without an account →' : 'Continue without signing in'}
            </button>
          </div>
        )}
      </div>

      <GuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  );
}
