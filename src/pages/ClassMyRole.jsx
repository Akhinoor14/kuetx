import { Shield } from 'lucide-react';
import { useClassRosterState } from './useClassRosterState';

/**
 * Independent "My Role" page — split out of the old ClassRoster.jsx
 * (Roster / Notices / My Role tab-switch). Same data source and
 * behavior as before, minus the tab switch. Defaults straight to this
 * page's content when arriving via Profile's "Hand over CR" link
 * (handoffIntent), same as the old default-tab behavior.
 */
export default function ClassMyRole() {
  const s = useClassRosterState();

  return (
    <div className="page-enter content-page-bg" style={{ width: 'min(95vw, 1560px)', margin: '0 auto', padding: '16px 14px', paddingBottom: 'calc(32px + env(safe-area-inset-bottom, 0px))' }}>
      <div className="content-page-hero">
        <div className="content-page-hero-main">
          <div className="content-page-hero-head">
            <div className="content-page-hero-icon">
              <Shield size={24} color="var(--accent)" />
            </div>
            <h1 className="content-page-hero-title">My Role</h1>
          </div>
          {s.groupId && (
            <p className="content-page-hero-subtitle">
              Your role and role-specific actions in <strong>{s.groupLabel}</strong>
            </p>
          )}
        </div>
      </div>

      {!s.groupId ? (
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>
          Add your department and batch in Profile to see your class role.
        </p>
      ) : (
        <>
          {s.handoffIntent && s.myRole === 'cr' && (
            <div style={{
              padding: '10px 14px', borderRadius: 10, marginBottom: 14,
              background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)',
              fontSize: 12.5, color: 'var(--text)',
            }}>
              Go to the <strong>Roster</strong> page, pick a classmate from the dropdown under <strong>"Class Roles"</strong>, and use <strong>"Hand off CR to them"</strong> to transfer your slot directly — no Campus Lead approval needed.
            </div>
          )}

          {s.myRole === 'cr' ? (
            <div className="card" style={{ padding: 14, marginBottom: 16 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Step down as CR</h2>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
                Want to stop being CR without handing off to someone specific? This sends a request to your
                Class Lead. You'll remain CR until they approve it.
              </p>
              {s.canSelfApprove && (
                <p style={{ fontSize: 12, color: 'var(--accent)', marginBottom: 10 }}>
                  You also hold Campus Lead / Senior Campus Lead / Head of Ops / Founder access for this class,
                  so you can approve this request yourself afterward from the Founder or Staff dashboard.
                </p>
              )}
              {s.leaveState === 'sent' ? (
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{s.leaveMsg}</div>
              ) : (
                <>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={s.handleRequestLeave}
                    disabled={s.leaveState === 'sending'}
                  >
                    {s.leaveState === 'sending' ? 'Sending…' : 'Request to leave CR'}
                  </button>
                  {s.leaveState === 'error' && (
                    <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 6 }}>{s.leaveMsg}</div>
                  )}
                </>
              )}
            </div>
          ) : (
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>
              Role-specific actions (like stepping down as CR) show up here once you hold that role.
            </p>
          )}
        </>
      )}
    </div>
  );
}
