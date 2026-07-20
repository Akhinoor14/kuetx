import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Briefcase, Circle, User } from 'lucide-react';
import { getProfile } from '../store/store';
import { getGroupId } from '../lib/groupUtils';
import { subscribeMyRole } from '../lib/groupSync';
import { auth } from '../lib/firebase';
import { useIsStaff } from '../hooks/useIsStaff';
import { useViewMode } from '../hooks/useViewMode';
import { STUDENT_FIXED_BUTTONS } from './nav-system/BottomNavStudent';
import { FACULTY_FIXED_BUTTONS } from './nav-system/BottomNavFaculty';

const MOBILE_NAV_QUERY = '(max-width: 767.98px)';

export function useIsMobileNav() {
  const [isMobileNav, setIsMobileNav] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(MOBILE_NAV_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;

    const mediaQuery = window.matchMedia(MOBILE_NAV_QUERY);
    const sync = (event) => setIsMobileNav(event.matches);

    setIsMobileNav(mediaQuery.matches);

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', sync);
      return () => mediaQuery.removeEventListener('change', sync);
    }

    mediaQuery.addListener(sync);
    return () => mediaQuery.removeListener(sync);
  }, []);

  return isMobileNav;
}

// Priority for the 5th button's destination/label/icon:
// 1. Staff role or Founder -> /admin-hub (student mode) or /team (faculty
//    mode — the faculty shell has no separate /admin-hub, just the shared
//    Admin destination per nav-faculty.js), label = adminLabel (Founder
//    outranks/subsumes any other staff label per useIsStaff.js). Wins
//    even if this person is also CR/ACR — the merged hub below still
//    surfaces their CR tools, just under the Admin identity/label.
// 2. Verified CR/ACR only  -> /cr-hub, label = 'CR'/'ACR' (student mode only
//    — faculty mode has no CR concept, isRealCR is never true there anyway
//    since a real faculty account can't simultaneously hold a CR role)
// 3. Everyone else         -> /profile (student mode) or /faculty/profile
//    (faculty mode)
function ProfileButton({ isRealCR, roleLabel, isStaff, adminLabel, active, viewMode }) {
  const isFacultyMode = viewMode === 'teacher';
  let path = isFacultyMode ? '/faculty/profile' : '/profile';
  let label = 'Profile';
  let Icon = User;

  if (isStaff) {
    path = isFacultyMode ? '/team' : '/admin-hub';
    label = adminLabel || 'Admin';
    Icon = Briefcase;
  } else if (isRealCR && !isFacultyMode) {
    path = '/cr-hub';
    label = roleLabel;
  }

  return (
    <Link
      to={path}
      className={`mobile-bottom-nav-button${active ? ' active' : ''}`}
      aria-current={active ? 'page' : undefined}
    >
      <span className="mobile-bottom-nav-button-icon">
        <Icon size={18} strokeWidth={2} />
      </span>
      <span className="mobile-bottom-nav-button-label">{label}</span>
    </Link>
  );
}

export function BottomNav() {
  const location = useLocation();
  const isMobileNav = useIsMobileNav();
  const [isRealCR, setIsRealCR] = useState(false);
  const [roleLabel, setRoleLabel] = useState('CR');
  const { isRealAdmin: isStaff, adminLabel } = useIsStaff();

  // Single shared source of truth for student-vs-faculty shell — see
  // hooks/useViewMode.js. Sidebar.jsx uses the exact same hook, so the two
  // can never drift out of sync with each other again.
  const { viewMode } = useViewMode();

  useEffect(() => {
    const profile = getProfile() || {};
    const groupId = getGroupId(profile);
    if (!groupId || !auth.currentUser?.uid) { setIsRealCR(false); return; }
    return subscribeMyRole(groupId, auth.currentUser.uid, (role) => {
      setIsRealCR(role === 'cr' || role === 'acr');
      setRoleLabel(role === 'acr' ? 'ACR' : 'CR');
    });
  }, []);

  if (!isMobileNav) return null;

  const isFacultyMode = viewMode === 'teacher';
  const fixedButtons = isFacultyMode ? FACULTY_FIXED_BUTTONS : STUDENT_FIXED_BUTTONS;

  const isProfileActive = isFacultyMode
    ? (location.pathname === '/faculty/profile' || location.pathname === '/team')
    : (location.pathname === '/profile'
        || location.pathname === '/cr-hub'
        || location.pathname === '/class-management'
        || location.pathname === '/ct-quiz-planning'
        || location.pathname === '/admin-hub'
        || location.pathname === '/team');

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      <div className="mobile-bottom-nav-shell">
        {fixedButtons.map(button => {
          const Icon = Icons[button.icon] || Circle;
          const active = button.match(location.pathname);

          return (
            <Link
              key={button.id}
              to={button.path}
              className={`mobile-bottom-nav-button${active ? ' active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <span className="mobile-bottom-nav-button-icon">
                <Icon size={18} strokeWidth={2} />
              </span>
              <span className="mobile-bottom-nav-button-label">{button.label}</span>
            </Link>
          );
        })}
        <ProfileButton
          isRealCR={isRealCR}
          roleLabel={roleLabel}
          isStaff={isStaff}
          adminLabel={adminLabel}
          active={isProfileActive}
          viewMode={viewMode}
        />
      </div>
    </nav>
  );
}