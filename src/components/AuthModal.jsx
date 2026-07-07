/**
 * AuthModal.jsx — KUETx Firebase Auth UI
 * Handles: Anonymous skip, Google login, Email/Password, Account upgrade
 */

import { useState } from 'react';
import { X, Mail, Lock, User, Chrome, CheckCircle } from 'lucide-react';
import {
  loginWithGoogle,
  loginWithEmail,
  registerWithEmail,
  upgradeWithGoogle,
  upgradeWithEmail,
  resetPassword,
  getAuthErrorMessage,
} from '../lib/firebaseAuth';

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

export default function AuthModal({ mode = 'login', isUpgrade = false, onClose, onSuccess, queueMode = false }) {
  const [tab, setTab] = useState(mode); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);

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
    if (!email || !password) { setError('Email আর password দাও।'); return; }
    setLoading(true);
    setError('');
    try {
      let user;
      if (isUpgrade || tab === 'register') {
        user = await (isUpgrade
          ? upgradeWithEmail(email, password, name)
          : registerWithEmail(email, password, name));
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
      setError(getAuthErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
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
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>
            {isUpgrade ? '🔒 Account তৈরি করো' : queueMode ? '☁️ Sync account connect করো' : tab === 'login' ? '👋 আবার স্বাগতম' : '🎉 নতুন Account'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            {isUpgrade
              ? 'তোমার সব data সেভ থাকবে। যেকোনো device থেকে access করতে পারবে।'
              : queueMode
              ? 'Firebase sync চালু করতে account দরকার। সব device-এ data sync হবে, যেকোনো জায়গা থেকে access করতে পারবে।'
              : tab === 'login'
              ? 'Login করলে সব device এ data sync হবে।'
              : 'Account বানাও — সব data cloud এ save হবে।'}
          </div>
        </div>

        {/* Tab switcher (only for non-upgrade) */}
        {!isUpgrade && (
          <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
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

        {/* Google button */}
        <button style={btnGoogle} onClick={handleGoogle} disabled={loading}>
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {loading ? 'Loading...' : 'Google দিয়ে ' + (isUpgrade || tab === 'register' ? 'Register' : 'Login')}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0', color: 'var(--muted)', fontSize: 12 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          অথবা email দিয়ে
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        {/* Email form */}
        <div style={{ display: 'grid', gap: 10 }}>
          {(tab === 'register' || isUpgrade) && (
            <div style={{ position: 'relative' }}>
              <User size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
              <input style={{ ...inputStyle, paddingLeft: 32 }} placeholder="তোমার নাম (optional)" value={name} onChange={e => setName(e.target.value)} />
            </div>
          )}
          <div style={{ position: 'relative' }}>
            <Mail size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <input style={{ ...inputStyle, paddingLeft: 32 }} type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div style={{ position: 'relative' }}>
            <Lock size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <input style={{ ...inputStyle, paddingLeft: 32 }} type="password" placeholder="Password (কমপক্ষে ৬ characters)" value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleEmail()} />
          </div>

          {!isUpgrade && tab === 'login' && !resetSent && (
            <div style={{ textAlign: 'right', marginTop: -4 }}>
              <button style={{ ...btnGhost, fontSize: 12 }} onClick={() => { setError(''); handleReset(); }} disabled={loading}>
                Password ভুলে গেছো?
              </button>
            </div>
          )}

          {resetSent && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'var(--accent)', padding: '10px 12px', background: 'rgba(34,197,94,0.08)', borderRadius: 6 }}>
              <CheckCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>Reset link পাঠানো হয়েছে {email} এ। Inbox (ও spam folder) চেক করো।</span>
            </div>
          )}

          {error && (
            <div style={{ fontSize: 12, color: 'var(--danger, #dc2626)', padding: '8px 10px', background: 'rgba(220,38,38,0.08)', borderRadius: 6 }}>
              {error}
            </div>
          )}

          <button style={btnPrimary} onClick={handleEmail} disabled={loading}>
            {loading ? 'Loading...' : isUpgrade ? 'Account তৈরি করো' : tab === 'login' ? 'Login' : 'Register'}
          </button>
        </div>

        {/* Footer links */}
        {!isUpgrade && (
          <div style={{ textAlign: 'center', marginTop: 14, fontSize: 12, color: 'var(--muted)' }}>
            {tab === 'login' ? (
              <>Account নেই? <button style={btnGhost} onClick={() => { setTab('register'); setError(''); }}>Register করো</button></>
            ) : (
              <>Already account আছে? <button style={btnGhost} onClick={() => { setTab('login'); setError(''); }}>Login করো</button></>
            )}
          </div>
        )}

        {/* Anonymous skip (only on initial, not upgrade) */}
        {!isUpgrade && onClose && (
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