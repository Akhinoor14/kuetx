import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { getProfile } from '../store/store';
import { getGroupId } from '../lib/groupUtils';
import { subscribeMyRole } from '../lib/groupSync';
import { auth } from '../lib/firebase';

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

// First 4 buttons are fixed destinations. The 5th is role-aware:
// - normal user -> /profile (Profile page)
// - CR/ACR      -> /cr-hub (Profile + Class Management + CT & Quiz Planner)
// Icon/avatar and match-paths for the 5th button are computed at render
// time since they depend on live auth + role state.
const FIXED_BUTTONS = [
  { id: 'home',      label: 'Home',      icon: 'Home',         path: '/',                match: (p) => p === '/' },
  { id: 'academics', label: 'Academics', icon: 'BookOpen',      path: '/academic-core',   match: (p) => p === '/academic-core' || ['/courses', '/syllabus', '/question-bank', '/solutions', '/marks', '/results', '/alerts'].includes(p) },
  { id: 'daily',     label: 'Daily',     icon: 'CalendarCheck', path: '/daily-academics', match: (p) => p === '/daily-academics' || ['/attendance', '/schedule', '/assignments', '/teachers', '/classmates', '/diary'].includes(p) },
  { id: 'campus',    label: 'Campus',    icon: 'Layers',        path: '/campus',          match: (p) => p === '/campus' || p === '/daily-life' || p === '/campus-life' || ['/notes', '/self-study', '/time', '/namaz', '/clubs', '/projects', '/tours', '/money', '/tuition'].includes(p) },
];

function ProfileButton({ isRealCR, roleLabel, active }) {
  const path = isRealCR ? '/cr-hub' : '/profile';
  const label = isRealCR ? roleLabel : 'Profile';

  return (
    <Link
      to={path}
      className={`mobile-bottom-nav-button${active ? ' active' : ''}`}
      aria-current={active ? 'page' : undefined}
    >
      <span className="mobile-bottom-nav-button-icon">
        <Icons.User size={18} strokeWidth={2} />
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

  const isProfileActive = location.pathname === '/profile'
    || location.pathname === '/cr-hub'
    || location.pathname === '/class-management'
    || location.pathname === '/ct-quiz-planning';

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      <div className="mobile-bottom-nav-shell">
        {FIXED_BUTTONS.map(button => {
          const Icon = Icons[button.icon] || Icons.Circle;
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
        <ProfileButton isRealCR={isRealCR} roleLabel={roleLabel} active={isProfileActive} />
      </div>
    </nav>
  );
}
