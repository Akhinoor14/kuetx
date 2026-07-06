import { useState, useEffect, useRef } from 'react';
import {
  startKuetEmailVerification, checkKuetEmailVerified, buildKuetEmailFromProfile,
} from '../lib/kuetEmailVerify';
import { getAuthErrorMessage } from '../lib/firebaseAuth';
import { store, getProfile } from '../store/store';

const STORE_KEY = 'kuetEmailVerifiedRoll';

export default function KuetEmailVerifyBox() {
  const profile = getProfile();
  const roll = String(profile?.studentId || '').trim();
  const [namePart, setNamePart] = useState('');
  const [password, setPassword] = useState('');
  const [stage, setStage] = useState(store.get(STORE_KEY) ? 'verified' : 'idle'); // idle|sending|sent|verified|error
  const [msg, setMsg] = useState('');
  const pollRef = useRef(null);

  const email = buildKuetEmailFromProfile(namePart, profile);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const startPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const ok = await checkKuetEmailVerified().catch(() => false);
      if (ok) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        store.set(STORE_KEY, true);
        setStage('verified');
        setMsg('');
      }
    }, 4000);
  };

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
    if (!roll) {
      setMsg('Your profile has no roll number set — set it in Profile Setup first.');
      setStage('error');
      return;
    }
    const clean = namePart.trim().toLowerCase();
    if (!clean || !/^[a-z]+$/.test(clean)) {
      setMsg('Type just the name part (e.g. islam), no numbers or symbols.');
      setStage('error');
      return;
    }
    setStage('sending');
    try {
      await startKuetEmailVerification(email, password);
      setStage('sent');
      setMsg('Verification email sent — check your KUET inbox (and spam/junk folder). Click the link and this page will verify automatically, no need to come back and click anything.');
      startPolling();
    } catch (err) {
      setMsg(getAuthErrorMessage?.(err?.code) || err?.message || 'Something went wrong.');
      setStage('error');
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
          <div style={{
            display: 'flex', alignItems: 'center', borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--inputBg)', overflow: 'hidden',
          }}>
            <input type="text" placeholder="islam" value={namePart} onChange={(e) => setNamePart(e.target.value)}
              style={{ padding: '7px 9px', border: 'none', background: 'transparent', flex: 1, minWidth: 0, outline: 'none', color: 'var(--text)' }} />
            <span style={{
              padding: '7px 9px', fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap',
              userSelect: 'none', background: 'var(--border)',
            }}>
              {roll || '######'}@stud.kuet.ac.bd
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            Roll number is auto-filled from your profile and can't be changed here — it can only ever match your own roll.
          </div>
          <input type="password" placeholder="Any password (just for this verification step)" value={password} onChange={(e) => setPassword(e.target.value)}
            style={{ padding: '7px 9px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)' }} />
          <button type="submit" className="btn btn-primary btn-sm" disabled={stage === 'sending'}>
            {stage === 'sending' ? 'Sending…' : 'Send verification email'}
          </button>
        </form>
      )}
      {stage === 'sent' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--muted)' }}>
          <span style={{
            width: 13, height: 13, borderRadius: '50%',
            border: '2px solid var(--border)', borderTopColor: '#1d9bf0',
            animation: 'kuetx-spin-box 0.8s linear infinite', flexShrink: 0, display: 'inline-block',
          }} />
          Waiting for you to click the link…
          <style>{`@keyframes kuetx-spin-box { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
      {msg && <div style={{ fontSize: 12, color: stage === 'error' ? 'var(--danger)' : 'var(--muted)', marginTop: 6 }}>{msg}</div>}
    </div>
  );
}