import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { auth } from '../lib/firebase';
import { checkIsAdmin } from '../lib/adminAuth';
import { listAllGroups } from '../lib/groupSync';
import {
  assignRole, removeRole, listStaffByRole, subscribeAllCLApplications,
  approveCLApplication, rejectCLApplication,
} from '../lib/staffSync';
import { CORE_TEAM_LEAD_ROLES, ROLE_LABELS, ROLE_SCOPE_KIND, ROLES } from '../lib/staffRoles';

// Every role the Founder can hand out or take away from this screen —
// literally everyone, per the manifesto: Founder has full add/revoke
// power over the entire team, including Senior Campus Lead and Campus
// Lead (which CORE_TEAM_LEAD_ROLES deliberately excludes, since those
// two are scoped differently — dept / group — from the rest).
const ALL_ASSIGNABLE_ROLES = [...CORE_TEAM_LEAD_ROLES, ROLES.SENIOR_CAMPUS_LEAD, ROLES.CAMPUS_LEAD];

// ---------------------------------------------------------------------
// Visually separates the dashboard into labeled groups (Approvals, Staff
// Management, Communication, Classes Overview) so a page full of same-
// looking cards doesn't read as one undifferentiated wall. A thin rule
// + uppercase label is enough on its own; combined with the spacing
// below it reads as a clear section break without adding another
// nested card style.
// ---------------------------------------------------------------------
function GroupHeading({ children, first }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      margin: first ? '0 0 12px' : '28px 0 12px',
    }}>
      <span style={{
        fontSize: 11, fontWeight: 800, letterSpacing: '0.06em',
        textTransform: 'uppercase', color: 'var(--accent, #4f46e5)',
        whiteSpace: 'nowrap',
      }}>{children}</span>
      <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audienceType, setAudienceType] = useState('all');
  const [batchInput, setBatchInput] = useState('');
  const [groupInput, setGroupInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState('');

  const [groups, setGroups] = useState(null);
  const [applications, setApplications] = useState([]);

  const [newUid, setNewUid] = useState('');
  const [newRole, setNewRole] = useState(ALL_ASSIGNABLE_ROLES[0]);
  const [newScopeValue, setNewScopeValue] = useState(''); // dept (SCL) or groupId (CL)
  const [currentHolders, setCurrentHolders] = useState({});

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user) { setChecking(false); navigate('/'); return; }
      const ok = await checkIsAdmin(user.uid);
      setAuthorized(ok);
      setChecking(false);
      if (!ok) navigate('/');
    });
    return () => unsub();
  }, [navigate]);

  useEffect(() => {
    if (!authorized) return;
    listAllGroups().then(setGroups).catch(() => setGroups([]));
    return subscribeAllCLApplications(setApplications);
  }, [authorized]);

  const refreshHolders = (role) => {
    listStaffByRole(role).then((list) => setCurrentHolders((prev) => ({ ...prev, [role]: list })));
  };
  useEffect(() => { ALL_ASSIGNABLE_ROLES.forEach(refreshHolders); }, [authorized]);

  const handleAssign = async () => {
    if (!newUid.trim()) return;
    const scopeKind = ROLE_SCOPE_KIND[newRole]; // 'global' | 'dept' | 'group'
    let scope = { type: 'global' };
    if (scopeKind === 'dept') scope = { type: 'dept', dept: newScopeValue.trim().toUpperCase() };
    if (scopeKind === 'group') scope = { type: 'group', groupId: newScopeValue.trim().toUpperCase() };
    await assignRole(newUid.trim(), newRole, scope);
    setNewUid(''); setNewScopeValue('');
    refreshHolders(newRole);
  };

  const handleSendNotice = async (e) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setSending(true);
    setSendMsg('');
    let audience = { type: 'all' };
    if (audienceType === 'batch') audience = { type: 'batch', batch: batchInput.trim().toUpperCase() };
    if (audienceType === 'group') audience = { type: 'group', groupId: groupInput.trim().toUpperCase() };
    try {
      await addDoc(collection(db, 'notices'), {
        title: title.trim(), body: body.trim(), audience,
        createdBy: { uid: auth.currentUser.uid, name: 'Founder' },
        createdAt: serverTimestamp(),
      });
      setTitle(''); setBody(''); setSendMsg('Notice sent.');
    } catch (err) {
      setSendMsg(`Failed: ${err?.message || err}`);
    } finally {
      setSending(false);
    }
  };

  if (checking) return <div style={{ padding: 20, color: 'var(--muted)' }}>Checking authorization…</div>;
  if (!authorized) return null;

  return (
    <div>
      {/* ── Approvals — the thing most likely to need action right now ── */}
      <GroupHeading first>Approvals</GroupHeading>
      <div className="staff-dashboard-grid">
        <section className="card staff-section-wide" style={{ padding: 14 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>
            Ultimate fallback — every pending Campus Lead application
          </h2>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
            Normally resolved by a Senior Campus Lead, or Head of Ops if that post is vacant. Shown here too
            so nothing ever gets permanently stuck.
          </p>
          {applications.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13 }}>Nothing pending.</div>}
          {applications.map((a) => (
            <div key={a.id} className="card" style={{ padding: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 13 }}>{a.name} ({a.roll}) — {a.groupId} {a.bundledCRClaim && <em>(+ CR)</em>}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn btn-sm btn-primary" onClick={() => approveCLApplication(a.id)}>Approve</button>
                <button className="btn btn-sm btn-secondary" onClick={() => rejectCLApplication(a.id)}>Reject</button>
              </div>
            </div>
          ))}
        </section>
      </div>

      {/* ── Staff Management — who holds which role ── */}
      <GroupHeading>Staff Management</GroupHeading>
      <div className="staff-dashboard-grid">
        <section className="card" style={{ padding: 14 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Assign a staff role</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <select value={newRole} onChange={(e) => { setNewRole(e.target.value); setNewScopeValue(''); }}
              style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)' }}>
              {ALL_ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
            <input type="text" placeholder="Their uid" value={newUid} onChange={(e) => setNewUid(e.target.value)}
              style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)' }} />
            {ROLE_SCOPE_KIND[newRole] === 'dept' && (
              <input type="text" placeholder="Department (e.g. CSE)" value={newScopeValue} onChange={(e) => setNewScopeValue(e.target.value)}
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)' }} />
            )}
            {ROLE_SCOPE_KIND[newRole] === 'group' && (
              <select value={newScopeValue} onChange={(e) => setNewScopeValue(e.target.value)}
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)' }}>
                <option value="">Choose a class…</option>
                {groups?.map((g) => <option key={g.id} value={g.id}>{g.id}</option>)}
              </select>
            )}
            <button className="btn btn-primary" onClick={handleAssign}>Assign</button>
          </div>
        </section>

        <section className="card" style={{ padding: 14 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Current role holders</h2>
          {ALL_ASSIGNABLE_ROLES.every((r) => !currentHolders[r]?.length) && (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>No one holds a staff role yet.</div>
          )}
          {ALL_ASSIGNABLE_ROLES.map((r) => (
            currentHolders[r]?.length > 0 && (
              <div key={r} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{ROLE_LABELS[r]}</div>
                {currentHolders[r].map((h) => (
                  <div key={h.id} style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                    <span>{h.scope?.dept || h.scope?.groupId || ''} — {h.uid}</span>
                    <button className="btn btn-sm btn-secondary" onClick={async () => { await removeRole(h.uid, h.role, h.scope); refreshHolders(r); }}>Remove</button>
                  </div>
                ))}
              </div>
            )
          ))}
        </section>
      </div>

      {/* ── Communication — reaching students ── */}
      <GroupHeading>Communication</GroupHeading>
      <div className="staff-dashboard-grid">
        <section className="card staff-section-wide" style={{ padding: 14 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Send a notice</h2>
          <form onSubmit={handleSendNotice} style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 480 }}>
            <input type="text" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)}
              style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)' }} />
            <textarea placeholder="Message" value={body} onChange={(e) => setBody(e.target.value)} rows={3}
              style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)' }} />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ fontSize: 13 }}><input type="radio" checked={audienceType === 'all'} onChange={() => setAudienceType('all')} /> Everyone</label>
              <label style={{ fontSize: 13 }}><input type="radio" checked={audienceType === 'batch'} onChange={() => setAudienceType('batch')} /> One batch</label>
              <label style={{ fontSize: 13 }}><input type="radio" checked={audienceType === 'group'} onChange={() => setAudienceType('group')} /> One class</label>
            </div>
            {audienceType === 'batch' && (
              <input type="text" placeholder="Batch, e.g. 2K23" value={batchInput} onChange={(e) => setBatchInput(e.target.value)}
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)' }} />
            )}
            {audienceType === 'group' && (
              <select value={groupInput} onChange={(e) => setGroupInput(e.target.value)}
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)' }}>
                <option value="">Choose a class…</option>
                {groups?.map((g) => <option key={g.id} value={g.id}>{g.id}</option>)}
              </select>
            )}
            {sendMsg && <div style={{ fontSize: 12, color: sendMsg.startsWith('Failed') ? 'var(--danger)' : 'var(--success)' }}>{sendMsg}</div>}
            <button type="submit" className="btn btn-primary" disabled={sending}>{sending ? 'Sending…' : 'Send notice'}</button>
          </form>
        </section>
      </div>


      {/* ── Classes Overview — read-only reference, lowest priority ── */}
      <GroupHeading>Classes Overview</GroupHeading>
      <div className="staff-dashboard-grid">
        <section className="card staff-section-wide" style={{ padding: 14 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Classes ({groups?.length ?? '…'})</h2>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
            Read-only overview — day-to-day CR/member management belongs to each class's Campus Lead
            (Staff Panel), not here.
          </p>
          {groups?.map((g) => (
            <div key={g.id} style={{ fontSize: 13, padding: '4px 0' }}>{g.id}</div>
          ))}
        </section>
      </div>
    </div>
  );
}