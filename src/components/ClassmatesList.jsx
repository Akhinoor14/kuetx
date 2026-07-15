import { useEffect, useState } from 'react';
import { Check, RotateCcw, ChevronDown } from 'lucide-react';
import {
  subscribeMembers, verifyMember, revokeVerification,
  clAppointCR, clRevokeCR, assignACR, revokeACR, handoffCR, removeMember,
  clDismissLegacyCRClaim,
  MAX_CR, MAX_ACR,
} from '../lib/groupSync';
import BlueTick from './BlueTick';
import { CRDetailModal } from '../pages/faculty/FacultyAllCR';

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
 *
 * LAYOUT (redesigned from the original 4-button-per-row + later 3-dot-menu
 * versions — see git history):
 *   - Verify/Revoke is the single most frequent action a CL/CR takes here,
 *     so it stays a direct one-click toggle button on the row itself
 *     (Pending -> "Verify"; verified -> "Revoke"), not buried in a menu.
 *   - Role changes (Make CR / Hand off CR / Make ACR / Remove ACR / Remove
 *     CR) are rare, higher-stakes actions — they live in a separate
 *     "Class Roles" section below the roster instead of cluttering every
 *     row, where you deliberately pick a member from a dropdown per
 *     action instead of hunting for the right row.
 *   - "Remove from class" is destructive and infrequent — it's handled
 *     via the bulk-select action bar (checkbox each row you want, or
 *     "Select all pending", then one confirm) rather than a per-row
 *     button, since in practice a CL/CR removing people tends to be a
 *     one-time cleanup of several stale/anonymous entries at once.
 *
 * NOTE: This component is shared between two very different pages:
 *   - Classmates.jsx (student-facing /classmates) renders it with
 *     showActions={false} — plain read-only browsing, no checkboxes, no
 *     buttons, no Class Roles section. Nothing below the "showActions &&"
 *     guards ever renders there.
 *   - ClassRoster.jsx (CR/ACR-only /class-roster, gated by <RequireCR>)
 *     and StaffDashboard.jsx (Campus Lead view) render it with
 *     showActions={true} — this is the only place the redesigned
 *     verify/revoke toggle, bulk-select bar, and Class Roles section
 *     actually appear. Keep it that way: management UI belongs on the
 *     management page, not the plain roster-browsing page.
 */
export default function ClassmatesList({ groupId, showActions = false, viewerRole = 'cl', currentUid = null, searchText = '', groupMeta = null }) {
  const [members, setMembers] = useState(null); // null = loading
  const [selectedCR, setSelectedCR] = useState(null); // CR/ACR row picked for the detail panel
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [rolesPickerId, setRolesPickerId] = useState('');
  const [roleActionBusy, setRoleActionBusy] = useState(false);

  useEffect(() => {
    if (!groupId) { setMembers([]); return; }
    return subscribeMembers(groupId, setMembers);
  }, [groupId]);

  useEffect(() => { setSelectedIds(new Set()); }, [groupId]);

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

  const visibleMembers = members.filter((m) => m.isAnonymous !== true);
  const normalizedSearch = searchText.trim().toLowerCase();
  const filteredMembersUnsorted = normalizedSearch
    ? visibleMembers.filter((m) => {
        const name = (m.name || '').toLowerCase();
        const roll = (m.roll || '').toLowerCase();
        const role = (m.role || '').toLowerCase();
        return name.includes(normalizedSearch) || roll.includes(normalizedSearch) || role.includes(normalizedSearch);
      })
    : visibleMembers;
  const rolePriority = (role) => (role === 'cr' ? 0 : role === 'acr' ? 1 : 2);
  const filteredMembers = [...filteredMembersUnsorted].sort((a, b) => {
    const pa = rolePriority(a.role);
    const pb = rolePriority(b.role);
    if (pa !== pb) return pa - pb;
    return (a.roll || '').localeCompare(b.roll || '', undefined, { numeric: true });
  });

  if (visibleMembers.length === 0) {
    return (
      <div className="card" style={{ padding: 16, color: 'var(--muted)', textAlign: 'center' }}>
        No one from your class has joined yet — be the first!
      </div>
    );
  }

  if (filteredMembers.length === 0) {
    return (
      <div className="card" style={{ padding: 16, color: 'var(--muted)', textAlign: 'center' }}>
        No classmates match this filter.
      </div>
    );
  }

  const verifiedCount = visibleMembers.filter((m) => m.verified).length;
  const crCount = visibleMembers.filter((m) => m.role === 'cr').length;
  const acrCount = visibleMembers.filter((m) => m.role === 'acr').length;
  const crSlotsFull = crCount >= MAX_CR;
  const acrSlotsFull = acrCount >= MAX_ACR;

  const selectableMembers = filteredMembers.filter((m) => m.id !== currentUid);
  const removableSelectedIds = [...selectedIds].filter((id) => {
    const m = filteredMembers.find((x) => x.id === id);
    return m && m.role !== 'cr' && m.role !== 'acr';
  });
  const pendingSelectableIds = selectableMembers.filter((m) => !m.verified).map((m) => m.id);
  const allPendingSelected = pendingSelectableIds.length > 0 && pendingSelectableIds.every((id) => selectedIds.has(id));

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllPending = () => {
    setSelectedIds((prev) => {
      if (allPendingSelected) {
        const next = new Set(prev);
        pendingSelectableIds.forEach((id) => next.delete(id));
        return next;
      }
      return new Set([...prev, ...pendingSelectableIds]);
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const verifiableSelectedIds = [...selectedIds].filter((id) => {
    const m = filteredMembers.find((x) => x.id === id);
    return m && !m.verified;
  });
  const revocableSelectedIds = [...selectedIds].filter((id) => {
    const m = filteredMembers.find((x) => x.id === id);
    return m && m.verified;
  });

  const runBulkOn = async (ids, fn) => {
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      await Promise.all(ids.map((id) => fn(id).catch(() => {})));
    } finally {
      setBulkBusy(false);
      clearSelection();
    }
  };

  const handleBulkVerify = () => runBulkOn(verifiableSelectedIds, (id) => verifyMember(groupId, id));
  const handleBulkRevoke = () => runBulkOn(revocableSelectedIds, (id) => revokeVerification(groupId, id));
  const handleBulkRemove = () => {
    if (removableSelectedIds.length === 0) return;
    if (!window.confirm(`Remove ${removableSelectedIds.length} selected classmate${removableSelectedIds.length === 1 ? '' : 's'} from the class?`)) return;
    setBulkBusy(true);
    Promise.all(removableSelectedIds.map((id) => removeMember(groupId, id).catch(() => {})))
      .finally(() => { setBulkBusy(false); clearSelection(); });
  };

  const rolesPickerMember = filteredMembers.find((m) => m.id === rolesPickerId) || null;
  const roleActionsForPicked = (() => {
    const m = rolesPickerMember;
    if (!m) return [];
    const actions = [];
    if (viewerRole === 'cl') {
      if (m.role !== 'cr') {
        if (m.id !== currentUid) {
          actions.push({
            key: 'make-cr', label: 'Make CR', disabled: crSlotsFull,
            title: crSlotsFull ? `Both CR slots are full (max ${MAX_CR}) — revoke one first` : undefined,
            run: () => clAppointCR(groupId, m.id),
          });
        }
        if (m.legacyCRClaim) {
          actions.push({
            key: 'clear-claim', label: 'Clear "Claims CR" badge',
            title: 'Dismiss this badge without appointing them CR — use if they already stepped down or the claim is outdated',
            run: () => {
              if (window.confirm(`Clear the "Claims CR" badge${m.id === currentUid ? ' for yourself' : ` for ${m.name || 'this classmate'}`}? This does NOT remove CR status — use "Remove CR" for that.`)) {
                return clDismissLegacyCRClaim(groupId, m.id);
              }
            },
          });
        }
      } else if (m.id !== currentUid) {
        actions.push({ key: 'remove-cr', label: 'Remove CR', danger: true, run: () => clRevokeCR(groupId, m.id) });
      }
    }
    if (viewerRole === 'cr') {
      if (m.id !== currentUid && m.verified && m.role !== 'cr') {
        actions.push({
          key: 'handoff-cr', label: 'Hand off CR to them',
          run: () => {
            if (window.confirm(`Hand off CR to ${m.name || 'this classmate'}? You'll no longer be CR.`)) {
              return handoffCR(groupId, currentUid, m.id, null);
            }
          },
        });
      }
      if (m.role === 'acr') {
        actions.push({ key: 'remove-acr', label: 'Remove ACR', danger: true, run: () => revokeACR(groupId, m.id) });
      } else if (m.role !== 'cr') {
        actions.push({
          key: 'make-acr', label: 'Make ACR', disabled: acrSlotsFull,
          title: acrSlotsFull ? `Both ACR slots are full (max ${MAX_ACR})` : undefined,
          run: () => assignACR(groupId, m.id),
        });
      }
    }
    return actions;
  })();

  const runRoleAction = async (action) => {
    if (action.disabled) return;
    setRoleActionBusy(true);
    try {
      await action.run();
    } finally {
      setRoleActionBusy(false);
    }
  };

  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
        Showing {filteredMembers.length} of {visibleMembers.length} classmate{visibleMembers.length === 1 ? '' : 's'} · {verifiedCount} verified · {crCount}/{MAX_CR} CR · {acrCount}/{MAX_ACR} ACR
      </div>

      {showActions && selectableMembers.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)', cursor: pendingSelectableIds.length ? 'pointer' : 'default', width: 'fit-content' }}>
            <input
              type="checkbox"
              checked={allPendingSelected}
              disabled={pendingSelectableIds.length === 0}
              onChange={selectAllPending}
            />
            Select all pending
          </label>

          {selectedIds.size > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
              marginTop: 8, padding: '8px 10px', borderRadius: 10,
              background: 'var(--accentSoft)',
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginRight: 2 }}>{selectedIds.size} selected</span>
              {verifiableSelectedIds.length > 0 && (
                <button type="button" className="btn btn-sm btn-secondary" disabled={bulkBusy} onClick={handleBulkVerify}>
                  {bulkBusy ? '…' : `Verify (${verifiableSelectedIds.length})`}
                </button>
              )}
              {revocableSelectedIds.length > 0 && (
                <button type="button" className="btn btn-sm btn-secondary" disabled={bulkBusy} onClick={handleBulkRevoke}>
                  {bulkBusy ? '…' : `Revoke (${revocableSelectedIds.length})`}
                </button>
              )}
              {removableSelectedIds.length > 0 && (
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  disabled={bulkBusy}
                  onClick={handleBulkRemove}
                  style={{ color: 'var(--danger)' }}
                >
                  {bulkBusy ? '…' : `Remove (${removableSelectedIds.length})`}
                </button>
              )}
              <button type="button" className="btn btn-sm btn-secondary" disabled={bulkBusy} onClick={clearSelection} style={{ marginLeft: 'auto' }}>
                Clear
              </button>
            </div>
          )}
        </div>
      )}

      <div className={showActions ? 'classmates-list-stack' : 'classmates-list-grid'}>
        {filteredMembers.map((m) => (
          <div
            key={m.id}
            className={showActions ? 'card classmates-list-card' : 'card classmates-list-card classmates-list-card-compact'}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: showActions ? '8px 10px' : '12px', gap: 6,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: '1 1 auto' }}>
              {showActions && (
                m.id !== currentUid ? (
                  <input
                    type="checkbox"
                    checked={selectedIds.has(m.id)}
                    onChange={() => toggleSelected(m.id)}
                    style={{ flexShrink: 0, width: 15, height: 15 }}
                    aria-label={`Select ${m.name || 'classmate'}`}
                  />
                ) : (
                  <span style={{ width: 15, flexShrink: 0 }} />
                )
              )}
              <div style={{
                width: 30, height: 30, borderRadius: '50%', background: 'var(--accentSoft)',
                color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 12.5, flexShrink: 0,
              }}>
                {(m.name || '?').trim().charAt(0).toUpperCase()}
              </div>
              <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                <div style={{ fontWeight: 600, fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name || 'Unnamed'}</span>
                  {m.verified && <BlueTick size={12} />}
                  {m.id === currentUid && <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 12 }}>(you)</span>}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{m.roll || '—'}</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5, flexShrink: 0 }}>
              {m.role !== 'cr' && m.legacyCRClaim && (
                <span style={{
                  fontSize: 10.5, fontWeight: 600, color: 'var(--warning)', background: 'var(--warningBg)',
                  padding: '2px 7px', borderRadius: 999, whiteSpace: 'nowrap',
                }} title="Claimed CR before this system existed — pending admin review">
                  Claims CR
                </span>
              )}
              {(m.role === 'cr' || m.role === 'acr') && (
                <span
                  onClick={() => setSelectedCR(m)}
                  style={{
                    fontSize: 10.5, fontWeight: 700, color: 'var(--accent)', background: 'var(--accentSoft)',
                    padding: '2px 7px', borderRadius: 999, cursor: 'pointer',
                  }}
                  title={m.role === 'cr' ? 'View CR info' : 'View ACR info'}
                >{m.role.toUpperCase()}</span>
              )}

              {showActions && m.id !== currentUid && (
                <button
                  type="button"
                  onClick={() => (m.verified ? revokeVerification(groupId, m.id) : verifyMember(groupId, m.id))}
                  title={m.verified ? 'Revoke verification' : 'Verify member'}
                  aria-label={m.verified ? 'Revoke verification' : 'Verify member'}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 28, height: 28, borderRadius: 8, flexShrink: 0, padding: 0,
                    border: '1px solid var(--border)', cursor: 'pointer',
                    background: m.verified ? 'var(--surface)' : 'var(--accentSoft)',
                    color: m.verified ? 'var(--muted)' : 'var(--accent)',
                  }}
                >
                  {m.verified ? <RotateCcw size={14} /> : <Check size={15} />}
                </button>
              )}
              {!showActions && !m.verified && (
                <span style={{
                  fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 999,
                  color: 'var(--muted)', background: 'var(--inputBg)', whiteSpace: 'nowrap',
                }}>
                  Pending
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {showActions && (
        <div className="card" style={{ padding: 14, marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Class Roles</div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 10 }}>
            Appoint or change CR/ACR. Pick a classmate, then choose an action.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
              <select
                value={rolesPickerId}
                onChange={(e) => setRolesPickerId(e.target.value)}
                className="input"
                style={{ width: '100%', appearance: 'none', paddingRight: 30 }}
              >
                <option value="">Select a classmate…</option>
                {filteredMembers.filter((m) => m.id !== currentUid || viewerRole !== 'cr').map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || 'Unnamed'} {m.roll ? `(${m.roll})` : ''}{m.role === 'cr' ? ' — CR' : m.role === 'acr' ? ' — ACR' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--muted)' }} />
            </div>

            {rolesPickerMember && roleActionsForPicked.length === 0 && (
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>No role actions available for this member.</span>
            )}
            {rolesPickerMember && roleActionsForPicked.map((action) => (
              <button
                key={action.key}
                type="button"
                className="btn btn-sm btn-secondary"
                disabled={action.disabled || roleActionBusy}
                title={action.title}
                onClick={() => runRoleAction(action)}
                style={{ color: action.danger ? 'var(--danger)' : undefined }}
              >
                {roleActionBusy ? '…' : action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedCR && (
        <CRDetailModal member={{ ...selectedCR, ...(groupMeta || {}) }} onClose={() => setSelectedCR(null)} />
      )}
    </div>
  );
}
