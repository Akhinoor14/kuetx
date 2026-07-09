import { useEffect, useState } from 'react';
import { Users2 } from 'lucide-react';
import { getProfile } from '../store/store';
import { getGroupId, getGroupLabel } from '../lib/groupUtils';
import { joinGroup, waitForOwnMembership } from '../lib/groupSync';
import { auth } from '../lib/firebase';
import ClassmatesList from '../components/ClassmatesList';
import KuetEmailVerifyBox from '../components/KuetEmailVerifyBox';
import ClaimCRCard from '../components/ClaimCRCard';

export default function Classmates() {
  const profile = getProfile();
  const groupId = getGroupId(profile);
  const groupLabel = getGroupLabel(profile);
  const [searchText, setSearchText] = useState('');
  // Gates ClassmatesList from mounting its members subscription before this
  // user's own membership doc exists. Firestore rules require an existing
  // members/{uid} doc to read the members collection at all (isGroupMember),
  // so subscribing in the same tick as joinGroup() raced a permission-denied
  // on every first-ever visit (self-healed after a few seconds via retry,
  // but showed a misleading empty "no classmates" list in the meantime).
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (!groupId) return;
    setJoined(false);
    joinGroup(groupId, profile)
      .then(() => waitForOwnMembership(groupId))
      .then(() => setJoined(true))
      .catch((e) => { console.error('[Classmates] join failed', e); setJoined(true); });
  }, [groupId]);

  return (
    <div className="page-enter content-page-bg classmates-page-shell" style={{ width: 'min(95vw, 1560px)', margin: '0 auto', padding: '16px 14px' }}>
      <div className="content-page-hero">
        <div className="content-page-hero-icon">
          <Users2 size={18} color="var(--accent)" />
        </div>
        <h1 className="content-page-hero-title">Classmates</h1>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
        {groupId
          ? <>Everyone from your class — <strong>{groupLabel}</strong> — who has joined KUETx.</>
          : 'Add your department and batch in Profile to find your classmates.'}
      </p>

      {groupId && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 10, alignItems: 'center', marginBottom: 14 }}>
          <input
            className="input"
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search by name or roll"
            style={{ width: '100%', minWidth: 0 }}
          />
          <div style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
            Roll filter
          </div>
        </div>
      )}

      {groupId && <KuetEmailVerifyBox />}

      {groupId && <ClaimCRCard groupId={groupId} profile={profile} />}

      {joined
        ? <ClassmatesList groupId={groupId} currentUid={auth.currentUser?.uid} searchText={searchText} />
        : <div style={{ padding: 16, color: 'var(--muted)', fontSize: 13 }}>Loading classmates...</div>}
    </div>
  );
}
