import { useEffect, useState } from 'react';
import {
  subscribeMembers, verifyMember, revokeVerification,
  clAppointCR, clRevokeCR, assignACR, revokeACR, handoffCR, removeMember,
  MAX_CR, MAX_ACR,
} from '../lib/groupSync';
import BlueTick from './BlueTick';

/**
 * groupId       - the batch+dept group to show
 * showActions   - true for CL/CR views (verify / promote / revoke buttons)
 * viewerRole    - 'cl' (Campus Lead / SCL / Admin / Head of Ops view, from
 *                 StaffDashboard.jsx) or 'cr' (a group's own CR/ACR view,
 *                 from ClassRoster.jsx). Determines WHICH action set
 *                 renders, since CL and CR have genuinely different
 *                 authority (see groupSync.js's CR-lifecycle comment
 *                 block and the members/{memberUid} Firestore rule):
 *                   - CL can freely appoint/revoke a CR into either open
 *                     slot (clAppointCR/clRevokeCR) — up to MAX_CR.
 *                   - CR can only hand off THEIR OWN slot to a specific
 *                     successor (handoffCR) and appoint/revoke ACR
 *                     (assignACR/revokeACR) up to MAX_ACR — a CR can
 *                     never freely appoint a brand-new, unrelated second
 *                     CR into the other slot; that still needs CL
 *                     approval via a request (see ClassRoster.jsx).
 *                 Defaults to 'cl' for backward compatibility with the
 *                 existing StaffDashboard.jsx call site.
 * currentUid    - so we can badge "You" and disallow self-demotion by accident
 */
export default function ClassmatesList({ groupId, showActions = false, viewerRole = 'cl', currentUid = null }) {
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

  // Anonymous (guest) accounts are excluded from the shared class roster —
  // Classmates/CR/notices are meant for people with a real, identifiable
  // Google/email account, not throwaway guest sessions. The Firestore
  // create rule (isRealAccount()) already stops any NEW anonymous join
  // from happening at all; this filter additionally hides any older
  // member doc written before that rule existed and that has since been
  // flagged isAnonymous:true (joinGroup() backfills this field every time
  // it runs for a given account, including on plain app-open auto-join —
  // see App.jsx). A pre-existing doc that hasn't been touched since
  // isAnonymous started being recorded has no such field yet and is left
  // visible rather than guessed at.
  const visibleMembers = members.filter((m) => m.isAnonymous !== true);

  if (visibleMembers.length === 0) {
    return (
      <div className="card" style={{ padding: 16, color: 'var(--muted)', textAlign: 'center' }}>
        No one from your class has joined yet — be the first!
      </div>
    );
  }

  const verifiedCount = visibleMembers.filter((m) => m.verified).length;
  const crCount = visibleMembers.filter((m) => m.role === 'cr').length;
  const acrCount = visibleMembers.filter((m) => m.role === 'acr').length;
  const crSlotsFull = crCount >= MAX_CR;
  const acrSlotsFull = acrCount >= MAX_ACR;

  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
        {visibleMembers.length} classmate{visibleMembers.length === 1 ? '' : 's'} · {verifiedCount} verified · {crCount}/{MAX_CR} CR · {acrCount}/{MAX_ACR} ACR
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {visibleMembers.map((m) => (
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

                  {viewerRole === 'cl' && (
                    m.role !== 'cr' ? (
                      <button
                        className="btn btn-sm btn-secondary"
                        disabled={crSlotsFull}
                        title={crSlotsFull ? `Both CR slots are full (max ${MAX_CR}) — revoke one first` : undefined}
                        onClick={() => clAppointCR(groupId, m.id)}
                      >
                        Make CR
                      </button>
                    ) : (
                      m.id !== currentUid && (
                        <button className="btn btn-sm btn-secondary" onClick={() => clRevokeCR(groupId, m.id)}>Remove CR</button>
                      )
                    )
                  )}

                  {viewerRole === 'cr' && (
                    <>
                      {/* Hand off MY OWN CR slot to this member — only shown on
                          the viewer's own row, since handoffCR replaces the
                          slot the departing CR themself holds, not any open
                          slot in general. */}
                      {m.id === currentUid && m.role === 'cr' && (
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>Use "Hand off CR" on a classmate's row below</span>
                      )}
                      {m.id !== currentUid && m.verified && m.role !== 'cr' && (
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => {
                            if (window.confirm(`Hand off CR to ${m.name || 'this classmate'}? You'll no longer be CR.`)) {
                              handoffCR(groupId, currentUid, m.id, null);
                            }
                          }}
                        >
                          Hand off CR
                        </button>
                      )}
                      {m.role === 'acr' ? (
                        <button className="btn btn-sm btn-secondary" onClick={() => revokeACR(groupId, m.id)}>Remove ACR</button>
                      ) : (
                        m.role !== 'cr' && (
                          <button
                            className="btn btn-sm btn-secondary"
                            disabled={acrSlotsFull}
                            title={acrSlotsFull ? `Both ACR slots are full (max ${MAX_ACR})` : undefined}
                            onClick={() => assignACR(groupId, m.id)}
                          >
                            Make ACR
                          </button>
                        )
                      )}
                    </>
                  )}

                  {m.role !== 'cr' && m.role !== 'acr' && m.id !== currentUid && (
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => {
                        if (window.confirm(`Remove ${m.name || 'this classmate'} from the class?`)) {
                          removeMember(groupId, m.id);
                        }
                      }}
                    >
                      Remove from class
                    </button>
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