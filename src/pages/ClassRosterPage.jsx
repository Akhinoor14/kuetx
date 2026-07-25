import { Users } from 'lucide-react';
import ClassmatesList from '../components/ClassmatesList';
import JoinRequestsPanel from '../components/JoinRequestsPanel';
import { useClassRosterState } from './useClassRosterState';

/**
 * Independent "Roster" page — split out of the old ClassRoster.jsx
 * (Roster / Notices / My Role tab-switch). Same data source and
 * behavior as before, minus the tab switch.
 */
export default function ClassRosterPage() {
  const s = useClassRosterState();

  return (
    <div className="page-enter content-page-bg" style={{ width: 'min(95vw, 1560px)', margin: '0 auto', padding: '16px 14px', paddingBottom: 'calc(32px + env(safe-area-inset-bottom, 0px))' }}>
      <div className="content-page-hero">
        <div className="content-page-hero-main">
          <div className="content-page-hero-head">
            <div className="content-page-hero-icon">
              <Users size={24} color="var(--accent)" />
            </div>
            <h1 className="content-page-hero-title">Roster</h1>
          </div>
          {s.groupId && (
            <p className="content-page-hero-subtitle">
              Manage <strong>{s.groupLabel}</strong> members, roles, and join requests
            </p>
          )}
        </div>
        {s.groupId && s.rosterCounts && (
          <div className="content-page-hero-stats">
            <div className="content-page-hero-stat">
              <div className="content-page-hero-stat-n">{s.rosterCounts.total}</div>
              <div className="content-page-hero-stat-label">total</div>
            </div>
            <div className="content-page-hero-stat">
              <div className="content-page-hero-stat-n">{s.rosterCounts.verified}</div>
              <div className="content-page-hero-stat-label">verified</div>
            </div>
            <div className="content-page-hero-stat">
              <div className="content-page-hero-stat-n">{s.rosterCounts.cr}</div>
              <div className="content-page-hero-stat-label">CR</div>
            </div>
          </div>
        )}
      </div>

      {!s.groupId ? (
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>
          Add your department and batch in Profile to manage your class roster.
        </p>
      ) : (
        <>
          {(s.myRole === 'cr' || s.myRole === 'acr') && (
            <JoinRequestsPanel groupId={s.groupId} />
          )}
          <div style={{ marginBottom: 20 }}>
            <ClassmatesList groupId={s.groupId} showActions viewerRole="cr" currentUid={s.uid} onCounts={s.setRosterCounts} />
          </div>
        </>
      )}
    </div>
  );
}
