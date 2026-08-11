import { useEffect, useState } from 'react';
import SubgroupHub from './SubgroupHub';
import { useIsStaff } from '../../hooks/useIsStaff';
import { getProfile } from '../../store/store';
import { getGroupId } from '../../lib/groupUtils';
import { subscribeMyRole } from '../../lib/groupSync';
import { auth } from '../../lib/firebase';

/**
 * Bottom-nav 5th-button destination for anyone holding a KUETx staff
 * role (Founder or any PANEL_ROLES entry from staffRoles.js).
 *
 * If this person is ALSO CR/ACR for their class, this hub merges both
 * identities into one page instead of splitting them across /cr-hub and
 * /admin-hub — Profile first (used every day), then CR tools (daily,
 * class-level work), then the Team & Administration section (occasional,
 * higher-authority work). The page title/5th-button label always follows
 * the staff identity (adminLabel, e.g. 'Founder') per useIsStaff.js —
 * staff status outranks CR/ACR for display purposes even though both
 * toolsets are shown.
 */
export default function AdminHub() {
  const { adminLabel } = useIsStaff();
  const [isRealCR, setIsRealCR] = useState(false);
  const [roleLabel, setRoleLabel] = useState('CR');

  useEffect(() => {
    const profile = getProfile() || {};
    const groupId = getGroupId(profile);
    if (!groupId || !auth.currentUser?.uid) return;
    return subscribeMyRole(groupId, auth.currentUser.uid, (role) => {
      setIsRealCR(role === 'cr' || role === 'acr');
      setRoleLabel(role === 'acr' ? 'ACR' : 'CR');
    });
  }, []);

  const label = adminLabel || 'Admin';

  const profileSection = {
    title: 'Profile',
    icon: 'User',
    items: [
      { id: 'profile', label: 'Profile', icon: 'User', accent: 'blue', path: '/profile' },
    ],
  };

  const crSection = {
    title: roleLabel,
    icon: 'Shield',
    items: [
      { id: 'class-setup',      label: 'Class Setup',        icon: 'CalendarClock', accent: 'blue',   path: '/class-setup' },
      { id: 'class-routine',    label: 'Routine',            icon: 'CalendarDays',  accent: 'green',  path: '/class-routine' },
      { id: 'class-planner',    label: 'Class Planner',      icon: 'CalendarCheck', accent: 'amber',  path: '/class-planner' },
      { id: 'ct-quiz-planning', label: 'CT & Quiz Planner',  icon: 'CalendarCheck', accent: 'red',    path: '/ct-quiz-planning' },
      { id: 'class-roster',     label: 'Roster',             icon: 'Users',         accent: 'purple', path: '/class-roster' },
      { id: 'class-notices',    label: 'Class Announcements', icon: 'Bell',         accent: 'blue',   path: '/class-notices' },
      { id: 'class-my-role',    label: 'My Role',            icon: 'Shield',        accent: 'green',  path: '/class-my-role' },
    ],
  };

  const adminSection = {
    title: 'Team & Administration',
    icon: 'Briefcase',
    items: [
      { id: 'team', label: 'Team & Administration', icon: 'Briefcase', accent: 'amber', path: '/team' },
    ],
  };

  const sections = [profileSection];
  if (isRealCR) sections.push(crSection);
  sections.push(adminSection);

  return <SubgroupHub pageTitle={label} extra={sections} />;
}