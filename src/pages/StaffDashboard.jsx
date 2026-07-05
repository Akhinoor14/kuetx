import { useEffect, useState } from 'react';
import { getProfile } from '../store/store';
import { auth } from '../lib/firebase';
import { ROLE_LABELS } from '../lib/staffRoles';
import {
  subscribeMyRoles, listStaffByRole, assignRole, removeRole,
  subscribeCLApplications, subscribeAllCLApplications, approveCLApplication, rejectCLApplication,
  checkSCLVacant,
} from '../lib/staffSync';
import {
  subscribeCRRequests, clApproveCRRequest, clRejectCRRequest,
  subscribeResources, moderateResource, subscribeContentModerationQueue,
  listAllGroups, getGroupMembersOnce,
} from '../lib/groupSync';
import ClassmatesList from '../components/ClassmatesList';

function Section({ title, children }) {
  return (
    <section className="card" style={{ padding: 14, marginBottom: 16 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>{title}</h2>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------
// Campus Lead section — one block per group this person leads
// ---------------------------------------------------------------------
function CampusLeadBlock({ groupId }) {
  const [crRequests, setCrRequests] = useState([]);
  const [resources, setResources] = useState([]);

  useEffect(() => subscribeCRRequests(groupId, setCrRequests), [groupId]);
  useEffect(() => subscribeResources(groupId, setResources), [groupId]);

  const pendingResources = resources.filter((r) => r.moderationStatus === 'pending');

  return (
    <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{groupId}</div>

      {crRequests.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>CR requests</div>
          {crRequests.map((r) => (
            <div key={r.id} className="card" style={{ padding: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 13 }}>{r.name} ({r.roll})</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn btn-sm btn-primary" onClick={() => clApproveCRRequest(groupId, r.id)}>Approve</button>
                <button className="btn btn-sm btn-secondary" onClick={() => clRejectCRRequest(groupId, r.id)}>Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {pendingResources.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Content pending your first-line review</div>
          {pendingResources.map((r) => (
            <div key={r.id} className="card" style={{ padding: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 13 }}>{r.title} — {r.uploadedBy?.name}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn btn-sm btn-primary" onClick={() => moderateResource(groupId, r.id, 'cl_approved')}>Forward to Content Lead</button>
                <button className="btn btn-sm btn-secondary" onClick={() => moderateResource(groupId, r.id, 'rejected')}>Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Roster</div>
      <ClassmatesList groupId={groupId} showActions currentUid={auth.currentUser?.uid} />
    </div>
  );
}

// ---------------------------------------------------------------------
// Senior Campus Lead section — one block per department they lead
// ---------------------------------------------------------------------
function SeniorCampusLeadBlock({ dept }) {
  const [applications, setApplications] = useState([]);
  const [cls, setCls] = useState(null);

  useEffect(() => subscribeCLApplications(dept, setApplications), [dept]);
  useEffect(() => { listStaffByRole('campus_lead').then((all) => setCls(all.filter((r) => r.scope?.dept ? r.scope.dept === dept : r.scope?.groupId?.endsWith(`_${dept}`)))); }, [dept]);

  return (
    <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{dept}</div>

      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Pending Campus Lead applications</div>
      {applications.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>None right now.</div>}
      {applications.map((a) => (
        <div key={a.id} className="card" style={{ padding: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 13 }}>
            {a.name} ({a.roll}) — {a.groupId} {a.bundledCRClaim && <em>(+ CR)</em>}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn btn-sm btn-primary" onClick={() => approveCLApplication(a.id)}>Approve</button>
            <button className="btn btn-sm btn-secondary" onClick={() => rejectCLApplication(a.id)}>Reject</button>
          </div>
        </div>
      ))}

      <div style={{ fontSize: 12, fontWeight: 700, margin: '10px 0 6px' }}>Campus Leads in this department</div>
      {cls === null && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Loading…</div>}
      {cls?.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)' }}>None appointed yet.</div>}
      {cls?.map((c) => (
        <div key={c.id} style={{ fontSize: 13, padding: '4px 0' }}>{c.scope?.groupId}</div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------
// Head of Ops section
// ---------------------------------------------------------------------
function HeadOfOpsSection() {
  const [scls, setScls] = useState(null);
  const [newSclUid, setNewSclUid] = useState('');
  const [newSclDept, setNewSclDept] = useState('');
  const [allApplications, setAllApplications] = useState([]);

  useEffect(() => { listStaffByRole('senior_campus_lead').then(setScls); }, []);
  useEffect(() => subscribeAllCLApplications(setAllApplications), []);

  const appoint = async () => {
    if (!newSclUid.trim() || !newSclDept.trim()) return;
    await assignRole(newSclUid.trim(), 'senior_campus_lead', { type: 'dept', dept: newSclDept.trim().toUpperCase() });
    setNewSclUid(''); setNewSclDept('');
    listStaffByRole('senior_campus_lead').then(setScls);
  };

  return (
    <Section title="Head of Operations">
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
        Every pending Campus Lead application (fallback — covers depts with no Senior Campus Lead yet)
      </div>
      {allApplications.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>Nothing pending.</div>}
      {allApplications.map((a) => (
        <div key={a.id} className="card" style={{ padding: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 13 }}>{a.name} ({a.roll}) — {a.groupId} {a.bundledCRClaim && <em>(+ CR)</em>}</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn btn-sm btn-primary" onClick={() => approveCLApplication(a.id)}>Approve</button>
            <button className="btn btn-sm btn-secondary" onClick={() => rejectCLApplication(a.id)}>Reject</button>
          </div>
        </div>
      ))}

      <div style={{ fontSize: 12, fontWeight: 700, margin: '14px 0 6px' }}>Senior Campus Leads</div>
      {scls === null && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Loading…</div>}
      {scls?.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>None appointed yet.</div>}
      {scls?.map((s) => (
        <div key={s.id} style={{ fontSize: 13, padding: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
          <span>{s.scope?.dept} — uid: {s.uid}</span>
          <button className="btn btn-sm btn-secondary" onClick={() => removeRole(s.uid, 'senior_campus_lead', s.scope)}>Remove</button>
        </div>
      ))}
      <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
        <input placeholder="New SCL's uid" value={newSclUid} onChange={(e) => setNewSclUid(e.target.value)}
          style={{ flex: 1, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)' }} />
        <input placeholder="Dept (e.g. CSE)" value={newSclDept} onChange={(e) => setNewSclDept(e.target.value)}
          style={{ width: 100, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)' }} />
        <button className="btn btn-sm btn-primary" onClick={appoint}>Appoint</button>
      </div>
      <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
        Every request escalates up the chain automatically — a department with no Senior Campus Lead
        never gets stuck, its Campus Lead applications simply show up here instead.
      </p>
    </Section>
  );
}

// ---------------------------------------------------------------------
// Content Lead section — global moderation queue across every group
// ---------------------------------------------------------------------
function ContentLeadSection() {
  const [queue, setQueue] = useState([]);
  useEffect(() => subscribeContentModerationQueue(setQueue), []);

  return (
    <Section title="Content moderation queue">
      {queue.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Nothing pending review.</div>}
      {queue.map((r) => (
        <div key={`${r.groupId}-${r.id}`} className="card" style={{ padding: 8, marginBottom: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{r.title} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>· {r.groupId}</span></div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>by {r.uploadedBy?.name} ({r.uploadedBy?.roll})</div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn btn-sm btn-primary" onClick={() => moderateResource(r.groupId, r.id, 'approved')}>Publish</button>
            <button className="btn btn-sm btn-secondary" onClick={() => moderateResource(r.groupId, r.id, 'rejected')}>Reject</button>
          </div>
        </div>
      ))}
    </Section>
  );
}

// ---------------------------------------------------------------------
// Head of Growth — aggregate counts only, no raw name/roll directory
// ---------------------------------------------------------------------
function GrowthSection() {
  const [groups, setGroups] = useState(null);
  const [counts, setCounts] = useState({});

  useEffect(() => {
    listAllGroups().then(async (gs) => {
      setGroups(gs);
      const entries = await Promise.all(gs.map(async (g) => {
        const members = await getGroupMembersOnce(g.id);
        return [g.id, members.length];
      }));
      setCounts(Object.fromEntries(entries));
    });
  }, []);

  return (
    <Section title="Growth — class activity">
      {groups === null && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Loading…</div>}
      {groups?.map((g) => (
        <div key={g.id} style={{ fontSize: 13, padding: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
          <span>{g.id}</span>
          <span style={{ color: 'var(--muted)' }}>{counts[g.id] ?? '…'} joined</span>
        </div>
      ))}
      <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
        Counts only — individual names/rolls aren't shown here to respect students who haven't chosen to join.
      </p>
    </Section>
  );
}

// ---------------------------------------------------------------------
// Main dashboard
// ---------------------------------------------------------------------
export default function StaffDashboard() {
  const [roles, setRoles] = useState(null);

  useEffect(() => subscribeMyRoles(setRoles), []);

  if (roles === null) return <div style={{ padding: 20, color: 'var(--muted)' }}>Loading…</div>;
  if (roles.length === 0) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '16px 14px', textAlign: 'center', color: 'var(--muted)' }}>
        You don't hold any KUETx staff role yet.
      </div>
    );
  }

  const clGroups = roles.filter((r) => r.role === 'campus_lead').map((r) => r.scope?.groupId).filter(Boolean);
  const sclDepts = roles.filter((r) => r.role === 'senior_campus_lead').map((r) => r.scope?.dept).filter(Boolean);
  const isHeadOfOps = roles.some((r) => r.role === 'head_of_ops');
  const isContentLead = roles.some((r) => r.role === 'content_lead');
  const isHeadOfGrowth = roles.some((r) => r.role === 'head_of_growth');
  const otherRoles = roles.filter((r) => !['campus_lead', 'senior_campus_lead'].includes(r.role));

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '16px 14px' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Staff Panel</h1>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
        Your roles: {roles.map((r) => ROLE_LABELS[r.role] || r.role).join(' · ')}
      </p>

      {isHeadOfOps && <HeadOfOpsSection />}

      {sclDepts.length > 0 && (
        <Section title="Senior Campus Lead">
          {sclDepts.map((d) => <SeniorCampusLeadBlock key={d} dept={d} />)}
        </Section>
      )}

      {clGroups.length > 0 && (
        <Section title="Campus Lead">
          {clGroups.map((g) => <CampusLeadBlock key={g} groupId={g} />)}
        </Section>
      )}

      {isContentLead && <ContentLeadSection />}
      {isHeadOfGrowth && <GrowthSection />}

      {otherRoles.filter((r) => ['finance_lead', 'legal_partnerships'].includes(r.role)).length > 0 && (
        <Section title="Finance & Legal">
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>
            Sponsorship and compliance record-keeping tools are lightweight and mostly external
            (spreadsheets, documents) per the manifesto — nothing app-specific needed here yet.
          </p>
        </Section>
      )}
    </div>
  );
}
