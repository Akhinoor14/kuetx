import { useEffect, useState } from 'react';
import SubgroupHub from './SubgroupHub';
import { getProfile } from '../../store/store';
import { getGroupId } from '../../lib/groupUtils';
import { subscribeMyRole } from '../../lib/groupSync';
import { auth } from '../../lib/firebase';

/**
 * Bottom-nav 5th-button destination for verified CR/ACR users.
 * Shows Profile alongside their CR tools as one hub page — Profile isn't
 * dropped just because the button is now role-specific, it's still one
 * tap away here.
 *
 * If role verification hasn't resolved yet or turns out false (e.g. the
 * user navigated here directly by URL without being CR/ACR), falls back
 * to a plain Profile-only view rather than blocking the page — mirrors
 * how RequireCR still guards the two actual tool routes themselves.
 */
export default function CRHub() {
  const [roleLabel, setRoleLabel] = useState('CR');

  useEffect(() => {
    const profile = getProfile() || {};
    const groupId = getGroupId(profile);
    if (!groupId || !auth.currentUser?.uid) return;
    return subscribeMyRole(groupId, auth.currentUser.uid, (role) => {
      setRoleLabel(role === 'acr' ? 'ACR' : 'CR');
    });
  }, []);

  const extra = {
    title: roleLabel,
    icon: 'Shield',
    items: [
      { id: 'profile',           label: 'Profile',            icon: 'User',          path: '/profile' },
      { id: 'class-routine',     label: 'Routine',            icon: 'CalendarDays',  path: '/class-routine' },
      { id: 'class-planner',     label: 'Class Planner',      icon: 'CalendarCheck', path: '/class-planner' },
      { id: 'ct-quiz-planning',  label: 'CT & Quiz Planner',  icon: 'CalendarCheck', path: '/ct-quiz-planning' },
      { id: 'class-roster',      label: 'Roster',             icon: 'Users',         path: '/class-roster' },
      { id: 'class-notices',     label: 'Notices',            icon: 'Bell',          path: '/class-notices' },
      { id: 'class-my-role',     label: 'My Role',            icon: 'Shield',        path: '/class-my-role' },
    ],
  };

  return <SubgroupHub pageTitle={roleLabel} extra={extra} />;
}