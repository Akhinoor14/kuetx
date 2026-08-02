import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Crown } from 'lucide-react';
import { store, getProfile } from '../store/store';
import { getGroupId, getGroupLabel } from '../lib/groupUtils';
import { subscribeCRStatus } from '../lib/groupSync';
import { useIsProvider } from '../hooks/useIsProvider';
import { useIsFaculty } from '../hooks/useIsFaculty';

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
 *
 * BUGFIX (leaked onto /provider/*): getProfile()/getGroupId() read from a
 * LOCAL store cache (store.get('profile')) that is not role-scoped — it's
 * whatever student-shaped profile data happens to still be cached on this
 * device (e.g. left over from before switching to/creating a provider
 * account in the same browser), completely independent of whether the
 * CURRENT signed-in account is actually a provider or faculty account.
 * Every other Layout-global that reads getProfile()/getGroupId()
 * (Sidebar, Navbar) already checks useIsProvider()/useIsFaculty() first
 * — this one didn't, so a provider account with stale student profile
 * data cached locally saw the CR banner on every /provider/* page. Same
 * "server-verified role wins over local cache" principle as
 * RequireStudentMode/RootRouteResolver — CR is a strictly student-shell
 * concept, so both non-student roles are gated out here before evaluate()
 * or the CR-status subscription ever runs.
 */
export default function NoCRBanner() {
  const [groupId, setGroupId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [crStatus, setCrStatus] = useState(null); // null = unknown yet
  const location = useLocation();
  const navigate = useNavigate();
  const { isProvider, isResolved: isProviderResolved } = useIsProvider();
  const { isFaculty, isFounderBypass, isResolved: isFacultyResolved } = useIsFaculty();
  const isGenuineFaculty = isFaculty && !isFounderBypass;
  const isStudentShell = isProviderResolved && isFacultyResolved && !isProvider && !isGenuineFaculty;

  const evaluate = () => {
    const p = getProfile();
    setProfile(p);
    setGroupId(getGroupId(p) || null);
  };

  useEffect(() => {
    if (!isStudentShell) return;
    evaluate();
    const onUpdate = (e) => { if (e.detail?.key === 'profile') evaluate(); };
    window.addEventListener('kuetx:store-updated', onUpdate);
    return () => window.removeEventListener('kuetx:store-updated', onUpdate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStudentShell]);

  useEffect(() => {
    if (!groupId) { setCrStatus(null); return; }
    return subscribeCRStatus(groupId, setCrStatus);
  }, [groupId]);

  if (!isStudentShell) return null;
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
