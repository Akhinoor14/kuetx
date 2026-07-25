import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Crown } from 'lucide-react';
import { store, getProfile } from '../store/store';
import { getGroupId, getGroupLabel } from '../lib/groupUtils';
import { subscribeCRStatus } from '../lib/groupSync';

/**
 * Persistent (non-dismissible) banner shown whenever the current user's
 * class group has no active CR at all (crCount === 0). Per the confirmed
 * requirement, this is NOT a one-time popup like ClassJoinIntro — it stays
 * up on every page until someone actually claims CR for the group, so a
 * leaderless class doesn't quietly stay that way just because nobody
 * happened to look at Profile.jsx.
 *
 * Mounted once in App.jsx's Layout, same spot as ClassJoinIntro. Renders
 * nothing on /profile itself (ClaimCRCard is already right there on that
 * page, so a second nudge on top of it would be redundant). No separate
 * guard is needed for onboarding/profile-setup — Layout (and everything
 * inside it, including this banner) simply isn't mounted at all while
 * `current === 'profile'` in App.jsx's queue (see the `queueBuilt`
 * conditional there), so this component never gets a chance to render
 * before a profile actually exists.
 */
export default function NoCRBanner() {
  const [groupId, setGroupId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [crStatus, setCrStatus] = useState(null); // null = unknown yet
  const location = useLocation();
  const navigate = useNavigate();

  const evaluate = () => {
    const p = getProfile();
    setProfile(p);
    setGroupId(getGroupId(p) || null);
  };

  useEffect(() => {
    evaluate();
    const onUpdate = (e) => { if (e.detail?.key === 'profile') evaluate(); };
    window.addEventListener('kuetx:store-updated', onUpdate);
    return () => window.removeEventListener('kuetx:store-updated', onUpdate);
  }, []);

  useEffect(() => {
    if (!groupId) { setCrStatus(null); return; }
    return subscribeCRStatus(groupId, setCrStatus);
  }, [groupId]);

  if (!groupId || !crStatus) return null;
  if (crStatus.hasCR) return null;
  if (location.pathname === '/profile') return null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate('/profile')}
      onKeyDown={(e) => { if (e.key === 'Enter') navigate('/profile'); }}
      style={{
        position: 'sticky', top: 0, zIndex: 900, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: '8px 14px', fontSize: 12.5, fontWeight: 600, textAlign: 'center',
        background: 'var(--warning, #f59e0b)', color: '#1a1200',
      }}
    >
      <Crown size={14} />
      {getGroupLabel(profile)} has no CR yet — tap to claim CR for your class
    </div>
  );
}
