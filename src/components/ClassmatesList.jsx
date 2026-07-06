import { useEffect, useState } from 'react';
import { subscribeMembers, verifyMember, revokeVerification, clAppointCR, clRevokeCR } from '../lib/groupSync';
import BlueTick from './BlueTick';

/**
 * groupId       - the batch+dept group to show
 * showActions   - true for CR/admin views (verify / promote / revoke buttons)
 * currentUid    - so we can badge "You" and disallow self-demotion by accident
 */
export default function ClassmatesList({ groupId, showActions = false, currentUid = null }) {
  const [members, setMembers] = useState(null); // null = loading

  useEffect(() => {
    if (!groupId) { setMembers([]); return; }
    return subscribeMembers(groupId, setMembers);
  }, [groupId]);

  if (!groupId) {
    return (
      <div className="card" style={{ padding: 16, color: 'var(--muted)', textAlign: 'center' }}>
        Set your department and batch in Profile to see your classmates.
      </div>
    );
  }

  if (members === null) {
    return <div style={{ padding: 16, color: 'var(--muted)' }}>Loading classmates…</div>;
  }

  if (members.length === 0) {
    return (
      <div className="card" style={{ padding: 16, color: 'var(--muted)', textAlign: 'center' }}>
        No one from your class has joined yet — be the first!
      </div>
    );
  }

  const verifiedCount = members.filter((m) => m.verified).length;

  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
        {members.length} classmate{members.length === 1 ? '' : 's'} · {verifiedCount} verified
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {members.map((m) => (
          <div
            key={m.id}
            className="card"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', background: 'var(--accentSoft)',
                color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 13, flexShrink: 0,
              }}>
                {(m.name || '?').trim().charAt(0).toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name || 'Unnamed'}</span>
                  {m.verified && <BlueTick size={13} />}
                  {m.id === currentUid && <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(you)</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{m.roll || '—'}</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              {m.role === 'cr' && (
                <span style={{
                  fontSize: 11, fontWeight: 700, color: 'var(--accent)', background: 'var(--accentSoft)',
                  padding: '2px 8px', borderRadius: 999,
                }}>CR</span>
              )}
              {m.role === 'acr' && (
                <span style={{
                  fontSize: 11, fontWeight: 700, color: 'var(--accent)', background: 'var(--accentSoft)',
                  padding: '2px 8px', borderRadius: 999,
                }}>ACR</span>
              )}
              {m.role !== 'cr' && m.legacyCRClaim && (
                <span style={{
                  fontSize: 11, fontWeight: 600, color: 'var(--warning)', background: 'var(--warningBg)',
                  padding: '2px 8px', borderRadius: 999,
                }} title="Claimed CR before this system existed — pending admin review">
                  Claims CR
                </span>
              )}
              {!m.verified && (
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                  color: 'var(--muted)', background: 'var(--inputBg)',
                }}>
                  Pending
                </span>
              )}

              {showActions && (
                <div style={{ display: 'flex', gap: 4 }}>
                  {!m.verified && (
                    <button className="btn btn-sm btn-secondary" onClick={() => verifyMember(groupId, m.id)}>Verify</button>
                  )}
                  {m.verified && (
                    <button className="btn btn-sm btn-secondary" onClick={() => revokeVerification(groupId, m.id)}>Revoke</button>
                  )}
                  {m.role !== 'cr' ? (
                    <button className="btn btn-sm btn-secondary" onClick={() => clAppointCR(groupId, m.id)}>Make CR</button>
                  ) : (
                    m.id !== currentUid && (
                      <button className="btn btn-sm btn-secondary" onClick={() => clRevokeCR(groupId, m.id)}>Remove CR</button>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
