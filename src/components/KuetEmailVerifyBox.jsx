import { useState } from 'react';
import {
  startKuetEmailVerification, checkKuetEmailVerified, isKuetEmailFormat,
} from '../lib/kuetEmailVerify';
import { getAuthErrorMessage } from '../lib/firebaseAuth';
import { store } from '../store/store';

const STORE_KEY = 'kuetEmailVerifiedRoll';

export default function KuetEmailVerifyBox() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [stage, setStage] = useState(store.get(STORE_KEY) ? 'verified' : 'idle'); // idle|sending|sent|checking|verified|error
  const [msg, setMsg] = useState('');

  if (stage === 'verified') {
    return (
      <div className="card" style={{ padding: 10, fontSize: 12, color: 'var(--success)', marginBottom: 12 }}>
        ✓ KUET email verified — you auto-verify instantly in your own class group. Your regular KUETx
        account and login were not changed at all.
      </div>
    );
  }

  const handleStart = async (e) => {
    e.preventDefault();
    if (!isKuetEmailFormat(email)) {
      setMsg('Use your KUET student email, e.g. name2313014@stud.kuet.ac.bd');
      setStage('error');
      return;
    }
    setStage('sending');
    try {
      await startKuetEmailVerification(email.trim(), password);
      setStage('sent');
      setMsg('Verification email sent — check your KUET inbox, then come back and tap "I\'ve verified."');
    } catch (err) {
      setMsg(getAuthErrorMessage?.(err?.code) || err?.message || 'Something went wrong.');
      setStage('error');
    }
  };

  const handleCheck = async () => {
    setStage('checking');
    const ok = await checkKuetEmailVerified();
    if (ok) {
      store.set(STORE_KEY, true);
      setStage('verified');
      setMsg('');
    } else {
      setStage('sent');
      setMsg('Not verified yet — click the link in your KUET inbox first.');
    }
  };

  return (
    <div className="card" style={{ padding: 12, marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Verify with your KUET email (optional)</div>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
        Instantly verified in your class group, no waiting for CR/Campus Lead approval. This is a
        separate, one-time proof step — it never changes your regular KUETx login.
      </p>
      {(stage === 'idle' || stage === 'error' || stage === 'sending') && (
        <form onSubmit={handleStart} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input type="email" placeholder="name2313014@stud.kuet.ac.bd" value={email} onChange={(e) => setEmail(e.target.value)}
            style={{ padding: '7px 9px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)' }} />
          <input type="password" placeholder="Any password (just for this verification step)" value={password} onChange={(e) => setPassword(e.target.value)}
            style={{ padding: '7px 9px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)' }} />
          <button type="submit" className="btn btn-primary btn-sm" disabled={stage === 'sending'}>
            {stage === 'sending' ? 'Sending…' : 'Send verification email'}
          </button>
        </form>
      )}
      {(stage === 'sent' || stage === 'checking') && (
        <button className="btn btn-primary btn-sm" onClick={handleCheck} disabled={stage === 'checking'}>
          {stage === 'checking' ? 'Checking…' : "I've verified"}
        </button>
      )}
      {msg && <div style={{ fontSize: 12, color: stage === 'error' ? 'var(--danger)' : 'var(--muted)', marginTop: 6 }}>{msg}</div>}
    </div>
  );
}