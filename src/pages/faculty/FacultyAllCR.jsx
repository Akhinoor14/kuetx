// FacultyAllCR.jsx — "All CR" (faculty-wide CR/ACR directory)
//
// Grid of every CR/ACR across ALL of this faculty's active classes
// (faculty/{uid}/classIndex fan-out — same source FacultyClasses.jsx
// already subscribes to), grouped by batch (color) then dept, sorted the
// same way "My Classes" sorts its batch groups. Clicking a card opens a
// detail panel with Name, Roll, Dept, Batch, Term, and contact info
// (email, mobile, WhatsApp — mobile/WhatsApp only exist once the CR/ACR
// has supplied one; see groupSync.js's updateOwnMobile + ClaimCRCard.jsx's
// mandatory-mobile-on-claim gate, and CRMobileNumberBanner.jsx for the
// migration path for CR/ACR appointed before that existed).
//
// Members are fetched once per unique groupId (not live-subscribed) since
// this is a reference/lookup page, not something that needs to reflect a
// mid-session CR handoff instantly — reopening the page is enough. Uses
// getGroupMembersOnce (groupSync.js), which Firestore rules already allow
// any faculty account to read per-group (see members/{memberUid}'s
// isFaculty(...) branch) — no rules change needed.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { auth } from '../../lib/firebase';
import { DEPARTMENTS } from '../../store/store';
import { getBatchColor, sortBatches } from '../../lib/timeModels';
import { getActiveBatches } from '../../lib/appConfigSync';
import { subscribeMyClassIndex } from '../../lib/facultyClassSync';
import { getGroupMembersOnce } from '../../lib/groupSync';

const getDeptName = (code) => (DEPARTMENTS.find((d) => d.code === code)?.name || code);

export default function FacultyAllCR() {
  const navigate = useNavigate();
  const [classIndex, setClassIndex] = useState(null); // null = loading
  const [batches, setBatches] = useState([]);
  const [membersByGroup, setMembersByGroup] = useState({}); // groupId -> members[]
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [selected, setSelected] = useState(null); // the CR/ACR row picked for the detail panel

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setClassIndex([]); return; }
    return subscribeMyClassIndex(uid, setClassIndex);
  }, []);

  useEffect(() => {
    getActiveBatches().then((list) => setBatches(sortBatches(list)));
  }, []);

  // Every distinct groupId across this faculty's active classes — several
  // classes (different courses) can share the same groupId (same batch+
  // dept), so this collapses them before fetching members, avoiding a
  // redundant fetch per course for the exact same class roster.
  const activeGroupIds = useMemo(() => {
    const set = new Set();
    (classIndex || []).forEach((c) => {
      if (c.status === 'active' && c.groupId) set.add(c.groupId);
    });
    return [...set];
  }, [classIndex]);

  useEffect(() => {
    if (classIndex === null) return; // still waiting on the class list itself
    if (activeGroupIds.length === 0) { setMembersByGroup({}); setLoadingMembers(false); return; }
    let cancelled = false;
    setLoadingMembers(true);
    Promise.all(activeGroupIds.map((groupId) =>
      getGroupMembersOnce(groupId)
        .then((members) => [groupId, members])
        .catch((e) => { console.error('[FacultyAllCR] failed to load members for', groupId, e); return [groupId, []]; })
    )).then((pairs) => {
      if (cancelled) return;
      const map = {};
      pairs.forEach(([groupId, members]) => { map[groupId] = members; });
      setMembersByGroup(map);
      setLoadingMembers(false);
    });
    return () => { cancelled = true; };
  }, [activeGroupIds, classIndex]);

  // One row per CR/ACR per groupId (a person only ever holds one role in
  // one group, so groupId+uid is naturally unique here). dept/batch come
  // straight off the groupId's own classIndex entry rather than being
  // re-derived from the group id string, since classIndex already carries
  // them as separate, canonical fields.
  const crRows = useMemo(() => {
    const groupMeta = {}; // groupId -> { dept, batch }
    (classIndex || []).forEach((c) => {
      if (c.groupId && !groupMeta[c.groupId]) groupMeta[c.groupId] = { dept: c.dept, batch: c.batch, term: c.term };
    });
    const rows = [];
    Object.entries(membersByGroup).forEach(([groupId, members]) => {
      const meta = groupMeta[groupId] || {};
      members.forEach((m) => {
        if (m.role === 'cr' || m.role === 'acr') {
          rows.push({ ...m, groupId, dept: meta.dept, batch: meta.batch, term: meta.term });
        }
      });
    });
    return rows;
  }, [membersByGroup, classIndex]);

  // Group -> batch (colored header) -> dept, sorted the same way "My
  // Classes" orders its batch groups, so the two pages feel consistent.
  const rowsByBatch = useMemo(() => {
    const groups = {};
    crRows.forEach((r) => {
      const key = r.batch || 'other';
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });
    Object.values(groups).forEach((list) => {
      list.sort((a, b) => (a.dept || '').localeCompare(b.dept || '') || (a.name || '').localeCompare(b.name || ''));
    });
    const orderedKeys = [...batches.filter((b) => groups[b]), ...Object.keys(groups).filter((k) => !batches.includes(k))];
    return orderedKeys.map((key) => ({ batch: key, items: groups[key] }));
  }, [crRows, batches]);

  const isLoading = classIndex === null || loadingMembers;
  const totalCount = crRows.length;

  return (
    <div className="hub-page-bg" style={{ minHeight: '100vh' }}>
      <div className="page-container" style={{ padding: '20px 24px 40px' }}>
        <div className="hub-page-hero">
          <div className="hub-page-hero-main">
            <div className="hub-page-hero-head">
              <button
                onClick={() => navigate('/faculty/classes')}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34,
                  borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer', flexShrink: 0,
                }}
                title="Back to My Classes"
              >
                <Icons.ArrowLeft size={16} color="var(--text)" />
              </button>
              <div className="hub-page-hero-icon">
                <Icons.Users size={24} color="var(--accent)" />
              </div>
              <h1 className="hub-page-hero-title">All CR</h1>
            </div>
            <div className="hub-page-hero-subtitle">
              {isLoading ? 'Loading CR/ACR list…' : 'CR and ACR across your active classes'}
            </div>
          </div>
          {!isLoading && (
            <div className="hub-page-hero-stats">
              <div className="hub-page-hero-stat">
                <div className="hub-page-hero-stat-n">{totalCount}</div>
                <div className="hub-page-hero-stat-label">total</div>
              </div>
            </div>
          )}
        </div>

        {isLoading && (
          <div style={{ color: 'var(--muted)', fontSize: 13, padding: '20px 0' }}>Loading…</div>
        )}

        {!isLoading && totalCount === 0 && (
          <div style={{
            padding: 24, borderRadius: 14, border: '1px solid var(--border)',
            background: 'var(--card)', color: 'var(--muted)', fontSize: 13.5, textAlign: 'center', marginTop: 16,
          }}>
            None of your active classes have a CR or ACR appointed yet.
          </div>
        )}

        {rowsByBatch.map(({ batch, items }) => {
          const color = getBatchColor(batch, batches);
          return (
            <div key={batch} style={{ marginTop: 18, marginBottom: 8 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '6px 12px',
                borderRadius: 999, background: color.bg, border: `1px solid ${color.border}`, width: 'fit-content',
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color.text }} />
                <span style={{ fontSize: 12.5, fontWeight: 800, color: color.text }}>{batch.toUpperCase()}</span>
                <span style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>
                  {items.length} CR/ACR
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                {items.map((m) => (
                  <div
                    key={`${m.groupId}:${m.id}`}
                    onClick={() => setSelected(m)}
                    style={{
                      cursor: 'pointer', border: `1px solid ${color.border}`, background: color.bg,
                      borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', background: 'var(--accentSoft)',
                        color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: 13, flexShrink: 0,
                      }}>
                        {(m.name || '?').trim().charAt(0).toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {m.name || 'Unnamed'}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{m.roll || '—'}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <span style={{
                        fontSize: 10.5, fontWeight: 800, color: color.text, background: 'rgba(255,255,255,0.5)',
                        padding: '2px 8px', borderRadius: 999,
                      }}>
                        {m.role === 'cr' ? 'CR' : 'ACR'}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>{getDeptName(m.dept)}</span>
                    </div>
                    {!m.mobile && (
                      <div style={{ fontSize: 10.5, color: 'var(--warning, #b45309)', marginTop: 2 }}>
                        No mobile number on file yet
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <CRDetailModal member={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

export function DetailRow({ label, value, href }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0' }}>
      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</span>
      {href ? (
        <a href={href} style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{value}</a>
      ) : (
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{value || '—'}</span>
      )}
    </div>
  );
}

export function CRDetailModal({ member, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--card)', borderRadius: 18, padding: 24, width: '100%', maxWidth: 380,
          border: '1px solid var(--border)', boxShadow: '0 32px 80px rgba(0,0,0,0.28)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>{member.name || 'Unnamed'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
            <Icons.X size={18} />
          </button>
        </div>
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <DetailRow label="Role" value={member.role === 'cr' ? 'Class Representative (CR)' : 'Assistant CR (ACR)'} />
          <div style={{ height: 1, background: 'var(--border)' }} />
          <DetailRow label="Roll" value={member.roll} />
          <div style={{ height: 1, background: 'var(--border)' }} />
          <DetailRow label="Department" value={getDeptName(member.dept)} />
          <div style={{ height: 1, background: 'var(--border)' }} />
          <DetailRow label="Batch" value={member.batch?.toUpperCase()} />
          {member.term && (
            <>
              <div style={{ height: 1, background: 'var(--border)' }} />
              <DetailRow label="Term" value={member.term} />
            </>
          )}
          {member.accountEmail && (
            <>
              <div style={{ height: 1, background: 'var(--border)' }} />
              <DetailRow label="Email" value={member.accountEmail} href={`mailto:${member.accountEmail}`} />
            </>
          )}
          {member.mobile ? (
            <>
              <div style={{ height: 1, background: 'var(--border)' }} />
              <DetailRow label="Mobile" value={member.mobile} href={`tel:${member.mobile}`} />
              <div style={{ height: 1, background: 'var(--border)' }} />
              {/* Only one number is ever collected from a CR/ACR (see
                  ClaimCRCard.jsx — "mobile number", mandatory). This
                  WhatsApp link is a best-effort assumption that the same
                  number is reachable on WhatsApp, NOT a separately
                  confirmed contact channel — most Bangladeshi numbers are
                  on WhatsApp, but it's not guaranteed. Labeled explicitly
                  so a faculty member doesn't mistake it for verified data. */}
              <DetailRow
                label="WhatsApp (same number)"
                value={member.mobile}
                href={`https://wa.me/${String(member.mobile).replace(/[^0-9]/g, '')}`}
              />
            </>
          ) : (
            <>
              <div style={{ height: 1, background: 'var(--border)' }} />
              <div style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 0' }}>
                No mobile number on file yet — this CR/ACR was appointed before mobile numbers were mandatory.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
