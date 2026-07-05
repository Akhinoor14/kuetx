import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminSignIn } from '../lib/adminAuth';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const result = await adminSignIn(email.trim(), password);
    setBusy(false);
    if (result.ok) {
      navigate('/admin');
    } else if (result.reason === 'not-authorized') {
      setError('This account is not an authorized owner account.');
    } else {
      setError('Sign-in failed — check the email and password.');
    }
  };

  return (
    <div style={{ maxWidth: 380, margin: '48px auto', padding: '0 14px' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Admin Login</h1>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
        This is only for the site owner. Your normal student session is not affected by this login.
      </p>
      <form onSubmit={handleSubmit} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input
          type="email" placeholder="Owner email" value={email} autoComplete="username"
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)' }}
        />
        <input
          type="password" placeholder="Password" value={password} autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)' }}
        />
        {error && <div style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</div>}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
