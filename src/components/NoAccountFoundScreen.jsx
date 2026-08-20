// NoAccountFoundScreen.jsx
//
// Replaces the old RoleSelectScreen.jsx. Current model: Sign In and Sign
// Up are two fully separate flows (see AuthModal.jsx / SignUpWizard.jsx) —
// there is no post-auth "pick your role" step anymore, since SignUpWizard
// already collects role + profile details BEFORE the Google popup fires,
// for any genuinely new account.
//
// This screen only ever renders for the leftover edge case: a real,
// signed-in Google account (via the plain Sign In button, an anonymous
// upgrade, or a re-auth prompt) whose role can't be found anywhere in
// Firestore (users/{uid}.role, faculty/{uid}, providers/{uid},
// students/{uid} — see App.jsx's buildQueue() fallback chain). That means
// either this Google account never actually completed KUETx Sign Up, or
// an earlier Sign Up's write silently failed. Either way, the fix is the
// same: sign this session out and send the person to Sign Up, not a
// role-picker — there's no partial/legacy role-only state left to recover
// in the current model.

import { useState } from 'react';
import { auth } from '../lib/firebase';
import { logout } from '../lib/firebaseAuth';

export default function NoAccountFoundScreen() {
  const email = auth.currentUser?.email || '';
  const [offlineNotice, setOfflineNotice] = useState(false);

  const handleGoToSignUp = async () => {
    // Second layer of defense on top of buildQueue()'s lookupFailed check
    // (App.jsx) — that check already keeps this screen from rendering in
    // the first place on a known network failure, but connectivity can
    // still drop in the gap between this screen mounting and the button
    // being pressed. Signing out here on a dead connection would strand
    // the person signed-out with no way to Sign Up either, so just warn
    // instead of proceeding.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setOfflineNotice(true);
      return;
    }
    await logout();
    window.location.href = '/';
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'var(--bg, #fff)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 420,
          width: '100%',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
          অ্যাকাউন্ট খুঁজে পাওয়া যায়নি
        </h2>
        <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>
          {email
            ? <>এই Google অ্যাকাউন্টের ({email}) সাথে কোনো KUETx অ্যাকাউন্ট সেটআপ করা নেই। নতুন অ্যাকাউন্ট তৈরি করতে Sign Up করুন।</>
            : <>এই Google অ্যাকাউন্টের সাথে কোনো KUETx অ্যাকাউন্ট সেটআপ করা নেই। নতুন অ্যাকাউন্ট তৈরি করতে Sign Up করুন।</>}
        </p>
        <button
          onClick={handleGoToSignUp}
          style={{
            padding: '11px 24px',
            borderRadius: 8,
            border: 'none',
            background: 'var(--accent)',
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            marginTop: 6,
          }}
        >
          Sign Up করুন
        </button>
        {offlineNotice && (
          <p style={{ fontSize: 12, color: 'var(--danger, #dc2626)', margin: 0 }}>
            ইন্টারনেট সংযোগ নেই — সংযোগ ফিরে এলে আবার চেষ্টা করুন।
          </p>
        )}
      </div>
    </div>
  );
}
