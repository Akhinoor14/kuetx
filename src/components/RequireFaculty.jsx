// RequireFaculty.jsx
//
// Blocks access to /faculty/* pages unless the current user is either:
//   (a) a real, verified faculty account (faculty/{uid}.verifiedAt set), or
//   (b) the Founder, via the same admins/{uid} bypass pattern used
//       elsewhere (AdminEntryPoint.jsx) — pure UI bypass, not a second
//       account, per §7/§9 item 9 of the merged prompt.
//
// Deliberately does NOT trust any self-reported flag (e.g. a local
// accountRole === 'teacher' choice from the Role Select step) — that only
// decides which auth branch to show, never grants access on its own. The
// only source of truth is useIsFaculty(), which itself only trusts
// Firestore (see that file's comments).
//
// Per Deviation 3 (merged prompt §2 item 14): everything under /faculty/*
// is English-only, professional/corporate tone — this file included.

import { useIsFaculty } from '../hooks/useIsFaculty';

export default function RequireFaculty({ children }) {
  const { isRealFaculty, isFounderBypass, facultyDoc, isResolved } = useIsFaculty();

  if (!isResolved) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
        Checking faculty access…
      </div>
    );
  }

  if (isFounderBypass) {
    return children;
  }

  if (isRealFaculty) {
    return children;
  }

  // Account exists but hasn't clicked the verification link yet — this is
  // the Deviation 2 hard gate. Distinct from "no faculty account at all"
  // so the messaging is accurate (resend link vs. sign up).
  if (facultyDoc && !facultyDoc.verifiedAt) {
    return (
      <div style={{ padding: '48px 20px', textAlign: 'center', maxWidth: 420, margin: '0 auto' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📧</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          Please verify your email to continue
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 20 }}>
          We sent a sign-in link to <strong>{facultyDoc.officialEmail}</strong>.
          Open it from your inbox to unlock your Teacher dashboard — this page
          will continue automatically once it's confirmed.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '48px 20px', textAlign: 'center', maxWidth: 420, margin: '0 auto' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
        This page is for verified faculty accounts only
      </div>
      <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
        Sign in with your KUET institutional email to access the Teacher dashboard.
      </div>
    </div>
  );
}
