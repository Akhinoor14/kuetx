import { useEffect, useState } from 'react';
import SubgroupHub from './SubgroupHub';
import { getProfile } from '../../store/store';
import { getGroupId } from '../../lib/groupUtils';
import { subscribeMyRole } from '../../lib/groupSync';
import { auth } from '../../lib/firebase';

/**
 * Bottom-nav 5th-button destination for verified CR/ACR users, and the
 * /class-rep sidebar hub target. Shows only the 6 CR tool pages — no
 * Profile card here, Profile has its own dedicated nav entry/button
 * elsewhere so it doesn't need to be duplicated on this hub too.
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
      { id: 'class-setup',       label: 'Class Setup',        icon: 'CalendarClock', accent: 'blue',   path: '/class-setup' },
      { id: 'class-routine',     label: 'Routine',            icon: 'CalendarDays',  accent: 'green',  path: '/class-routine' },
      { id: 'class-planner',     label: 'Class Planner',      icon: 'CalendarCheck', accent: 'amber',  path: '/class-planner' },
      { id: 'ct-quiz-planning',  label: 'CT & Quiz Planner',  icon: 'CalendarCheck', accent: 'red',    path: '/ct-quiz-planning' },
      { id: 'class-roster',      label: 'Roster',             icon: 'Users',         accent: 'purple', path: '/class-roster' },
      { id: 'class-notices',     label: 'Class Announcements', icon: 'Bell',         accent: 'blue',   path: '/class-notices' },
      { id: 'class-my-role',     label: 'My Role',            icon: 'Shield',        accent: 'green',  path: '/class-my-role' },
    ],
  };

  return <SubgroupHub pageTitle={roleLabel} extra={extra} />;
}