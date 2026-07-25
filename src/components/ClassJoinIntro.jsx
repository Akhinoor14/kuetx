import { useEffect, useState } from 'react';
import { store, getProfile } from '../store/store';
import { getGroupId, getGroupLabel } from '../lib/groupUtils';
import { requestToJoinGroup } from '../lib/groupSync';

// Mounted once in App.jsx's Layout. Purely informational — it does NOT
// touch local schedule/assignments data in any way. Class membership now
// requires the group's CR/ACR to approve a join request (see groupSync.js
// "Join requests" section) — dismissing this dialog sends that request,
// it does NOT add the person to the roster immediately.
export default function ClassJoinIntro() {
  const [visible, setVisible] = useState(false);
  const [groupId, setGroupId] = useState(null);

  const evaluate = () => {
    const profile = getProfile();
    const gid = getGroupId(profile);
    if (!gid) return;
    const seen = store.get('classSyncIntroSeen') || {};
    if (seen[gid]) return; // shown once per group already

    setGroupId(gid);
    setVisible(true);
  };

  useEffect(() => {
    evaluate();
    const onUpdate = (e) => { if (e.detail?.key === 'profile') evaluate(); };
    window.addEventListener('kuetx:store-updated', onUpdate);
    return () => window.removeEventListener('kuetx:store-updated', onUpdate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismiss = async () => {
    const seen = store.get('classSyncIntroSeen') || {};
    store.set('classSyncIntroSeen', { ...seen, [groupId]: true });
    // Sends a join request only — does NOT add a roster entry directly.
    // The group's CR/ACR must approve it first (see JoinRequestsPanel).
    try { await requestToJoinGroup(groupId, getProfile(), String(getProfile()?.kuetEmail || '').trim()); } catch (e) { console.error('[ClassJoinIntro] request failed', e); }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div className="card" style={{ maxWidth: 420, width: '100%', padding: 20 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Join your class</h2>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
          We'll send a request to join <strong>{getGroupLabel(getProfile())}</strong>. Your class's CR or ACR
          reviews your name, roll, and KUET email, then approves it — you won't show up on the roster or see
          shared class content until that happens. If it's still pending, that just means it hasn't been
          reviewed yet, not that it's been rejected.
        </p>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
          Your personal schedule and assignments stay exactly as they are either way — nothing is shared automatically.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={dismiss}>Send request</button>
        </div>
      </div>
    </div>
  );
}

