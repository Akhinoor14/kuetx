// SignInPrompt.jsx — Phase H of DEMO_MODE_FULL_PLAN_PROMPT.md.
//
// Plan's own instruction: "একটা reusable 'Sign in korun' prompt
// component — প্রতিটা demo পেজে আলাদা না বানিয়ে একবার বানিয়ে import
// করো" and "Sign In বাটনে ক্লিক বা কোনো write-trigger ছোঁয়ায় → Sign In
// prompt". This is that one component — a small explanatory step shown
// BEFORE AuthModal opens, so a visitor who taps something inside a demo
// dashboard (e.g. a booking button, if one is ever added to
// ProviderDemoDashboard.jsx) gets a one-line "this needs an account"
// message instead of AuthModal's full sign-up/sign-in form appearing
// with no context.
//
// Deliberately NOT a replacement for AuthModal — this sits in front of
// it. `reason` lets each call site say briefly why sign-in is needed
// ("Bookmark korte", "Booking dite", etc.) without this component having
// to know about every possible trigger across the app. Default reason
// covers the plain "Sign In" button case (LandingPage's navbar).
//
// No new demo write-triggers were added to the existing DemoDashboard
// files this phase — all three (Student/Faculty/Provider) remain purely
// read-only static previews, per Phase D/E's own established precedent
// (real writes are unsafe to fake convincingly). This component exists
// so that IF a future write-trigger is added to any demo view, there's
// already a ready-made prompt to wire it to instead of building one
// ad hoc at that point.
//
// Phase 1 (landing redesign): `intent` ('signin' | 'signup', default
// 'signin') changes the heading/button copy here. As of Phase 4/5/6,
// it ALSO changes what happens on confirm at the LandingPage level —
// intent='signup' routes onSignIn's caller to open SignUpWizard instead
// of AuthModal (see LandingPage.jsx's showAuthModal && authIntent
// branch). This component itself doesn't know which modal opens next —
// it only calls the onSignIn callback passed in — so it stays correct
// regardless of which modal the caller wires it to.
export default function SignInPrompt({ onSignIn, onClose, reason, intent = 'signin' }) {
  const isSignUp = intent === 'signup';
  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 10030, background: 'rgba(8,12,22,0.72)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}
      />
      <div style={{ position: 'fixed', inset: 0, zIndex: 10031, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 360, background: 'var(--card)',
            border: '1px solid var(--border)', borderRadius: 18,
            boxShadow: '0 24px 60px rgba(0,0,0,0.25)', padding: '1.5rem 1.4rem 1.3rem',
            textAlign: 'center',
          }}
        >
          <div style={{
            width: 48, height: 48, borderRadius: 14, margin: '0 auto 0.9rem',
            background: 'rgba(var(--accentRGB), 0.12)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem',
          }}>
            🔐
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.4rem' }}>
            {isSignUp ? 'নতুন অ্যাকাউন্ট বানান' : 'সাইন ইন করা লাগবে'}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--muted)', lineHeight: 1.6, marginBottom: '1.2rem' }}>
            {reason || (isSignUp
              ? 'Google দিয়ে মাত্র কয়েক সেকেন্ডে KUETx অ্যাকাউন্ট বানাও।'
              : 'এই অংশটা ব্যবহার করতে একটা KUETx অ্যাকাউন্ট লাগবে — মাত্র কয়েক সেকেন্ড লাগে।')}
          </div>
          <button
            type="button"
            onClick={onSignIn}
            style={{
              width: '100%', padding: '0.7rem', borderRadius: 12,
              background: 'var(--accent)', color: '#fff', border: 'none',
              fontSize: '0.9rem', fontWeight: 800, cursor: 'pointer', marginBottom: '0.5rem',
            }}
          >
            {isSignUp ? 'Sign Up with Google' : 'Sign In / Sign Up'}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '100%', padding: '0.55rem', borderRadius: 12,
              background: 'transparent', color: 'var(--muted)', border: 'none',
              fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
            }}
          >
            পরে করবো
          </button>
        </div>
      </div>
    </>
  );
}
