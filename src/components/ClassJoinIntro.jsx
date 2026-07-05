import { useEffect, useState } from 'react';
import { store, getProfile } from '../store/store';
import { getGroupId, getGroupLabel } from '../lib/groupUtils';
import { joinGroup } from '../lib/groupSync';

// Mounted once in App.jsx's Layout. Purely informational — it does NOT
// touch local schedule/assignments data in any way. Joining a class group
// only adds a roster entry (groupSync.joinGroup); the group's own routine
// only ever comes from its CR. This dialog just explains that once, so
// students aren't confused about why their view might change.
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
    // Joining just adds a roster entry (verified:false) — never touches
    // schedule/assignments data, personal or shared.
    try { await joinGroup(groupId, getProfile()); } catch (e) { console.error('[ClassJoinIntro] join failed', e); }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div className="card" style={{ maxWidth: 420, width: '100%', padding: 20 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>You're part of a class now</h2>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
          You've been added to <strong>{getGroupLabel(getProfile())}</strong>'s roster in Classmates. Your
          personal schedule and assignments stay exactly as they are — nothing is shared automatically.
        </p>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
          Once your class's CR sets up a shared routine, you'll see it on the Schedule page instead of your
          personal one — and you can always switch back by leaving the class group.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={dismiss}>Got it</button>
        </div>
      </div>
    </div>
  );
}
