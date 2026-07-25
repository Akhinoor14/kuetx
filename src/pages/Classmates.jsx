import { useState } from 'react';
import { Users } from 'lucide-react';
import { getProfile } from '../store/store';
import { getGroupId, getGroupLabel } from '../lib/groupUtils';
import { auth } from '../lib/firebase';
import ClassmatesList from '../components/ClassmatesList';

/**
 * Student-facing /classmates route.
 *
 * This file used to be a stray duplicate of the ClassmatesList component
 * itself (props: groupId/showActions/etc.), mounted directly on the route
 * as <Classmates /> with no props ever passed in — so groupId was always
 * undefined and the page permanently showed "Set your department and
 * batch in Profile to see your classmates," even for fully set-up
 * students. The real shared list component lives at
 * ../components/ClassmatesList and is used correctly by ClassRoster.jsx,
 * StaffDashboard.jsx, AdminDashboard.jsx, and FacultyClassDetail.jsx —
 * all of which derive groupId themselves before rendering it.
 *
 * This page now does the same: derive the viewer's own group from their
 * profile (same getGroupId helper ClassRoster.jsx uses) and render the
 * real ClassmatesList in plain read-only mode (showActions=false) — a
 * student browsing classmates, not managing them. CR/ACR management
 * still happens on the dedicated /class-roster page (ClassRoster.jsx).
 */
export default function Classmates() {
  const profile = getProfile();
  const groupId = getGroupId(profile);
  const groupLabel = getGroupLabel(profile);
  const uid = auth.currentUser?.uid;
  const [searchText, setSearchText] = useState('');

  return (
    <div className="page-enter page-container content-page-bg">
      <div className="content-page-hero">
        <div className="content-page-hero-icon">
          <Users size={18} color="var(--accent)" />
        </div>
        <div>
          <h1 className="content-page-hero-title">Classmates</h1>
          <p className="content-page-hero-subtitle">
            {groupLabel ? `${groupLabel} · your batch & department` : 'See who else is in your class'}
          </p>
        </div>
      </div>

      {groupId && (
        <input
          type="text"
          className="input"
          placeholder="Search by name or roll…"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ marginBottom: 16, width: '100%' }}
        />
      )}

      <ClassmatesList
        groupId={groupId}
        showActions={false}
        viewerRole="cl"
        currentUid={uid}
        searchText={searchText}
      />
    </div>
  );
}
