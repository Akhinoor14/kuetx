import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useIsProvider } from '../hooks/useIsProvider';
import ProviderVerificationPending from '../pages/provider/ProviderVerificationPending';

/**
 * Blocks access to /provider/* routes with a HARD GATE — deliberately
 * stricter than RequireFaculty (see that file's doc comment and
 * providerSync.js's doc comment for why). Three outcomes:
 *   1. No providers/{uid} doc at all -> "Provider access required",
 *      same shape as RequireFaculty's denial screen.
 *   2. providers/{uid} exists but status is 'pending' or 'rejected' ->
 *      ProviderVerificationPending, NEVER the dashboard underneath.
 *   3. status === 'verified' -> children (the actual dashboard) render.
 * 'deactivated' is treated the same as pending/rejected — locked out,
 * shown via ProviderVerificationPending's default (pending) message,
 * since Phase 1 has no deactivation-specific copy yet.
 */
export default function RequireProvider({ children }) {
  const {
    isProvider, isVerifiedProvider, providerProfile, isResolved,
  } = useIsProvider();

  if (!isResolved) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
        Checking provider access…
      </div>
    );
  }

  if (!isProvider) {
    return (
      <div style={{ padding: '48px 20px', textAlign: 'center', maxWidth: 420, margin: '0 auto' }}>
        <div style={{ marginBottom: 12 }}><Lock size={32} color="var(--muted)" /></div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          Provider access required
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 20 }}>
          This page is only available to service provider accounts.
        </div>
        <Link to="/" className="btn btn-primary btn-sm">Back to home</Link>
      </div>
    );
  }

  if (!isVerifiedProvider) {
    return <ProviderVerificationPending providerProfile={providerProfile} />;
  }

  return children;
}
