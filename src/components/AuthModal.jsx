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
 * loginWithGoogle() and upgradeWithGoogle() (firebaseAuth.js) are
 * popup-first: clicking the button resolves directly with the signed-in
 * user in the common case (see handleGoogle() below), no full-page
 * navigation. They only fall back to a redirect for the narrower case a
 * popup can't handle — that case still completes later, after the page
 * reloads, via handleGoogleRedirectResult() wired up in
 * useFirebaseAuth.js, which is also where isBrandNewAccount() is called
 * on that path.
 */

import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { auth } from '../lib/firebase';
import { loginWithGoogle, upgradeWithGoogle } from '../lib/firebaseAuth';
import { isBrandNewAccount } from '../lib/accountLifecycle';
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

export default function AuthModal({ mode = 'login', isUpgrade = false, intent = null, onClose, onSuccess, queueMode = false, theme = null }) {
  // mode is accepted for backward compatibility with existing call sites
  // (all 4 pass mode="login") but no longer changes anything — there's no
  // Login/Register distinction anymore, just "sign in with Google."
  void mode;
  // Phase 3 (landing redesign, §11.2): intent is an opt-in UX signal from
  // the caller (LandingPage's Sign In vs Sign Up button — see authIntent
  // in LandingPage.jsx). Default null (not 'signin') deliberately, so
  // every OTHER existing call site (App.jsx's upgrade modal, queue-mode
  // login, global auth modal; Profile.jsx's re-auth prompts) keeps its
  // current plain behavior unless it explicitly opts in — those contexts
  // are upgrade/mandatory/global flows, not "I clicked Sign In on the
  // landing page", so the inline "no account yet" notice below would be
  // the wrong message there. It only activates for intent === 'signin'.
  //
  // KX_THEME_HANDOFF_PROMPT.md's undone-work item: AuthModal is shared
  // app-wide (App.jsx's global/queue-mode auth gate, Profile.jsx's re-auth
  // prompts, About.jsx, GuestBanner.jsx — 7 call sites total, not just the
  // landing page), so unlike SignInPrompt.jsx/SignUpWizard.jsx it can NOT
  // be unconditionally retheme'd — that would silently change Sign In's
  // colors everywhere in the app, not just on the landing page. `theme`
  // opts in explicitly: default null keeps every existing call site's
  // current plain app-theme behavior byte-for-byte; only LandingPage.jsx
  // passes theme="kx". Same scoped-CSS-variable-override technique as
  // SignUpWizard.jsx's .kx-signup-theme / SignInPrompt.jsx's
  // .kx-signin-prompt-theme, just conditionally applied here.
  const kxThemed = theme === 'kx';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [guideOpen, setGuideOpen] = useState(false);
  // Holds the just-signed-in user + info while we show the inline notice,
  // so "Sign Up শুরু করুন" can call onSuccess with the SAME user/info
  // already obtained — no second Google popup, per §11.2's explicit
  // "Google popup আবার দেখাতে হবে না" requirement (uid is already in hand,
  // App.jsx's buildQueue() will route a brand-new account into
  // RoleSelectScreen on its own once onSuccess fires, same as it already
  // does for any other brand-new sign-in — no new destination needed).
  const [pendingNewUser, setPendingNewUser] = useState(null);

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
        // Phase 2 (landing redesign, §9.2/§9.4): expose new-vs-returning
        // here for callers (the future Sign Up wizard's Phase 3/6) instead
        // of adding a fresh isNewUser return value to firebaseAuth.js's
        // loginWithGoogle()/upgradeWithGoogle()/handleGoogleRedirectResult().
        // accountLifecycle.js's isBrandNewAccount() already does this exact
        // check (creationTime === lastSignInTime) and is already relied on
        // by useFirebaseAuth.js for sync/cache decisions — reusing it here
        // avoids a second, possibly-inconsistent source of truth. Note this
        // only covers the popup-success path; the redirect-fallback path
        // (user === null here, page navigating away) still resolves later
        // via handleGoogleRedirectResult() + onAuthChange in
        // useFirebaseAuth.js, which is also where isBrandNewAccount() is
        // already called — a future wizard phase reading isNewUser off the
        // redirect path should read it from there, not from this callback.
        const info = { linked: isUpgrade, isNewUser: isBrandNewAccount(user) };
        // Phase 3 (§11.2): only intercept with the inline notice when the
        // visitor explicitly clicked "Sign In" (not "Sign Up", not the
        // default queue/upgrade paths elsewhere in the app, which don't
        // pass intent at all and keep their existing plain behavior).
        if (info.isNewUser && intent === 'signin') {
          setPendingNewUser({ user, info });
          setLoading(false);
          return;
        }
        onSuccess?.(user, info);
      }
      // else: fell back to redirect, page is navigating away — nothing
      // more to do here.
    } catch (err) {
      setError('Could not sign in with Google. Please try again.');
      setLoading(false);
    }
  };

  // "Sign Up শুরু করুন" on the inline notice — reuses the user/info already
  // obtained above, no second Google popup.
  const handleContinueAsSignUp = () => {
    if (!pendingNewUser) return;
    onSuccess?.(pendingNewUser.user, pendingNewUser.info);
  };

  return (
    <div
      className={kxThemed ? 'kx-auth-modal-theme' : undefined}
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
      {kxThemed && (
        <style>{`
          .kx-auth-modal-theme {
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
        `}</style>
      )}
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

        {/* Phase 3 (§11.2): inline "no account yet" notice — replaces the
            normal Google button block while pendingNewUser is set. Same
            modal, no new screen/popup. */}
        {pendingNewUser ? (
          <div>
            <div
              style={{
                fontSize: 13, color: 'var(--text)', lineHeight: 1.6,
                padding: '12px 14px', borderRadius: 10, marginBottom: 14,
                background: 'rgba(220,38,38,0.08)',
                border: '1px solid rgba(220,38,38,0.25)',
              }}
            >
              এই Google অ্যাকাউন্ট দিয়ে KUETx-এ এখনো অ্যাকাউন্ট নেই।
            </div>
            <button style={btnGoogle} onClick={handleContinueAsSignUp}>
              Sign Up শুরু করুন
            </button>
            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <button
                style={{ ...btnGhost, color: 'var(--muted)', textDecoration: 'none', fontSize: 12 }}
                onClick={() => setPendingNewUser(null)}
              >
                অন্য Google অ্যাকাউন্ট দিয়ে চেষ্টা করুন
              </button>
            </div>
          </div>
        ) : (
          <>
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
          </>
        )}

        {error && (
          <div style={{ fontSize: 12, color: 'var(--danger, #dc2626)', padding: '8px 10px', background: 'rgba(220,38,38,0.08)', borderRadius: 6, marginTop: 12 }}>
            {error}
          </div>
        )}

        {/* "X to close" / "Skip for now" — only rendered when onClose is
            truthy, same as before this migration. Hidden while the inline
            notice above is showing (it has its own "try another account"
            ghost button instead — a plain close here would just discard
            the already-signed-in Google session with no clear next step).
            Also hidden for intent === 'signin' (landing page's Sign In
            button specifically) — a visitor who explicitly clicked "Sign
            In" doesn't need a "continue without signing in" escape hatch
            sitting right under the button they just pressed; the X in the
            corner is already the close action there. Every other caller
            (App.jsx's queue-mode/global auth gate, Profile.jsx re-auth,
            landing's own Sign Up path) doesn't pass intent="signin" and
            keeps this link exactly as before. */}
        {onClose && !pendingNewUser && intent !== 'signin' && (
          <div style={{ textAlign: 'center', marginTop: 14 }}>
            <button style={{ ...btnGhost, color: 'var(--muted)', textDecoration: 'none', fontSize: 12 }} onClick={onClose}>
              {queueMode ? 'Skip for now — continue without an account →' : 'Continue without signing in'}
            </button>
          </div>
        )}
      </div>

      {/* documentation/03-features/guest-mode/GUEST_MODE_PLAN_PROMPT.md Phase 5.1 — AuthModal only ever renders for a
          visitor who hasn't completed sign-in yet (that's the whole
          point of this modal), so the Guide opened from here is always
          the 'guest' Overview, never a role-specific feature guide. */}
      <GuideModal open={guideOpen} onClose={() => setGuideOpen(false)} resolvedRole="guest" />
    </div>
  );
}
