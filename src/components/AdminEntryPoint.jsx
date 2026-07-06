import { useEffect, useState } from 'react';
import { adminAuth, adminSignIn, checkIsAdmin } from '../lib/adminAuth';
import AdminDashboard from '../pages/AdminDashboard';

/**
 * Lives inside the unified /team page. Founder auth deliberately stays on
 * its own secondary Firebase app instance (see adminAuth.js) so it never
 * collides with whatever main-session student identity is active — but
 * the *UI* for it is now inline here rather than a separate nav entry.
 */
export default function AdminEntryPoint() {
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const uid = adminAuth.currentUser?.uid;
    if (!uid) { setChecking(false); return; }
    checkIsAdmin(uid).then((ok) => { setAuthorized(ok); setChecking(false); });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const result = await adminSignIn(email.trim(), password);
    setBusy(false);
    if (result.ok) {
      setAuthorized(true);
    } else if (result.reason === 'not-authorized') {
      setError('This account is not an authorized owner account.');
    } else {
      setError('Sign-in failed — check the email and password.');
    }
  };

  if (checking) return null;
  if (authorized) return <AdminDashboard />;

  return (
    <section className="card" style={{ padding: 14 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Founder access</h2>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
        Only for the site owner. This is separate from your normal KUETx session, so signing in or out
        here never affects your regular account.
      </p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 320 }}>
        <input type="email" placeholder="Owner email" value={email} autoComplete="username"
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)' }} />
        <input type="password" placeholder="Password" value={password} autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)' }} />
        {error && <div style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</div>}
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </section>
  );
}
