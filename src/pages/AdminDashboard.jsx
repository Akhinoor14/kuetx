import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { auth } from '../lib/firebase';
import { checkIsAdmin } from '../lib/adminAuth';
import {
  listAllGroups, subscribeCRRequests, subscribeLeaveRequests,
  clApproveCRRequest, clRejectCRRequest, clApproveLeaveCR, clRejectLeaveCR,
} from '../lib/groupSync';
import {
  assignRole, removeRole, listStaffByRole, subscribeAllCLApplications,
  approveCLApplication, rejectCLApplication,
} from '../lib/staffSync';
import { CORE_TEAM_LEAD_ROLES, ROLE_LABELS, ROLE_SCOPE_KIND, ROLES } from '../lib/staffRoles';
import { subscribePendingRollUnlockRequests, resolveRollUnlockRequest, dismissRollUnlockRequest } from '../lib/rollOwnership';
import { listPendingFlags, resolveEmailFlag } from '../lib/emailFlags';
import ClassmatesList from '../components/ClassmatesList';
import CategorySubNav from '../components/CategorySubNav';
import SubcategoryTabs from '../components/SubcategoryTabs';
import { FOUNDER_CATEGORIES, getFounderCategory, resolveCount, resolveSubtitle } from '../lib/founderCategories';

// Every role the Founder can hand out or take away from this screen —
// literally everyone, per the manifesto: Founder has full add/revoke
// power over the entire team, including Senior Campus Lead and Campus
// Lead (which CORE_TEAM_LEAD_ROLES deliberately excludes, since those
// two are scoped differently — dept / group — from the rest).
const ALL_ASSIGNABLE_ROLES = [...CORE_TEAM_LEAD_ROLES, ROLES.SENIOR_CAMPUS_LEAD, ROLES.CAMPUS_LEAD];

// ---------------------------------------------------------------------
// Card-based Founder Command Center.
//
// Previously this page was one long scroll of every section stacked on
// top of each other (Approvals, Staff Management, Communication, Classes
// Overview all always-visible). That worked when there was only a
// handful of classes, but doesn't scale — and more importantly, it gave
// no organized way to browse staff/classes by category, so the Founder
// had no single place to see EVERY person with authority (CL, SCL, and
// core team staff) grouped sensibly.
//
// New structure: a top-level grid of category cards. Clicking a card
// drills into that category's own view (back button returns to the
// grid). Classes specifically drill down Dept -> Batch -> Class, since
// that matches how SCL/CL scope already works (SCL is dept-scoped, CL is
// group/class-scoped) — Batch-first would cut across dept boundaries
// awkwardly since one batch spans many depts.
// ---------------------------------------------------------------------

// Grid card for the top-level Founder dashboard — icon comes from the
// registry (lucide-react name, not an emoji), same tinted-tile language
// as SubgroupHub's hub-grid-item elsewhere in the app.
function FounderCategoryCard({ category, count, subtitle, onClick }) {
  const Icon = Icons[category.icon] || Icons.Circle;
  return (
    <button onClick={onClick} className="founder-category-card">
      <div className="founder-category-card-icon">
        <Icon size={22} color="var(--accent)" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
          {category.label}
          {count > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 800, color: '#fff', background: 'var(--danger, #ef4444)',
              borderRadius: 999, padding: '1px 7px', lineHeight: 1.4,
            }}>{count}</span>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{subtitle}</div>
      </div>
      <Icons.ChevronRight size={18} color="var(--muted)" style={{ flexShrink: 0 }} />
    </button>
  );
}

// Wraps every category's own view with the CategorySubNav pill row, so
// jumping to a sibling category never requires a trip back through the
// grid. `view` is the current category key; `onSelect` swaps it;
// `onBack` returns to the grid. `countCtx` feeds badge counts into both
// this row and any SubcategoryTabs the category view renders itself.
function CategoryShell({ view, onSelect, onBack, countCtx, children }) {
  return (
    <div>
      <CategorySubNav
        categories={FOUNDER_CATEGORIES}
        activeKey={view}
        onSelect={onSelect}
        onBack={onBack}
        countCtx={countCtx}
      />
      {children}
    </div>
  );
}

function EmptyState({ children }) {
  return <div style={{ fontSize: 13, color: 'var(--muted)', padding: '8px 0' }}>{children}</div>;
}

// =======================================================================
// APPROVALS — every kind of pending action across the whole app, in one
// place: CL applications, CR requests, CR leave requests. Previously CR
// requests/leave requests only surfaced per-class inside "All Classes",
// buried below the roster — this pulls them all to the top since
// Approvals is what actually needs the Founder's attention right now.
// =======================================================================
function ApprovalsView({ onBack, onSelectCategory, countCtx }) {
  const [clApplications, setClApplications] = useState([]);
  const [groupIds, setGroupIds] = useState(null);
  const [crRequestsByGroup, setCrRequestsByGroup] = useState({});
  const [leaveRequestsByGroup, setLeaveRequestsByGroup] = useState({});
  const [err, setErr] = useState('');
  const [subTab, setSubTab] = useState('cl-apps');

  useEffect(() => subscribeAllCLApplications(setClApplications), []);
  useEffect(() => { listAllGroups().then((gs) => setGroupIds(gs.map((g) => g.id))); }, []);

  useEffect(() => {
    if (!groupIds) return;
    const unsubs = groupIds.map((g) => subscribeCRRequests(g, (reqs) => {
      setCrRequestsByGroup((prev) => ({ ...prev, [g]: reqs }));
    }));
    return () => unsubs.forEach((u) => u());
  }, [groupIds]);

  useEffect(() => {
    if (!groupIds) return;
    const unsubs = groupIds.map((g) => subscribeLeaveRequests(g, (reqs) => {
      setLeaveRequestsByGroup((prev) => ({ ...prev, [g]: reqs }));
    }));
    return () => unsubs.forEach((u) => u());
  }, [groupIds]);

  const allCrRequests = Object.entries(crRequestsByGroup).flatMap(([g, reqs]) => reqs.map((r) => ({ ...r, groupId: g })));
  const allLeaveRequests = Object.entries(leaveRequestsByGroup).flatMap(([g, reqs]) => reqs.map((r) => ({ ...r, groupId: g })));

  const handle = async (fn, ...args) => {
    setErr('');
    try { await fn(...args); } catch (e) { setErr(e?.message || 'Action failed — try again.'); }
  };

  const category = getFounderCategory('approvals');
  const subCtx = { ...countCtx, clApplications: clApplications.length, crRequests: allCrRequests.length, leaveRequests: allLeaveRequests.length };

  return (
    <CategoryShell view="approvals" onSelect={onSelectCategory} onBack={onBack} countCtx={countCtx}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>Approvals</h2>
      <SubcategoryTabs subcategories={category.subcategories} activeKey={subTab} onSelect={setSubTab} countCtx={subCtx} />
      {err && <div className="card" style={{ padding: 8, marginBottom: 12, fontSize: 12, color: 'var(--danger)' }}>{err}</div>}

      {subTab === 'cl-apps' && (
        <Section title="Campus Lead applications">
          {clApplications.length === 0 && <EmptyState>Nothing pending.</EmptyState>}
          {clApplications.map((a) => (
            <ApprovalRow key={a.id}
              label={`${a.name} (${a.roll}) — ${a.groupId}${a.bundledCRClaim ? ' (+ CR)' : ''}`}
              onApprove={() => handle(approveCLApplication, a.id)}
              onReject={() => handle(rejectCLApplication, a.id)}
            />
          ))}
        </Section>
      )}

      {subTab === 'cr-req' && (
        <Section title="CR requests">
          {allCrRequests.length === 0 && <EmptyState>Nothing pending.</EmptyState>}
          {allCrRequests.map((r) => (
            <ApprovalRow key={`${r.groupId}-${r.id}`}
              label={`${r.name} (${r.roll}) — ${r.groupId}`}
              onApprove={() => handle(clApproveCRRequest, r.groupId, r.id)}
              onReject={() => handle(clRejectCRRequest, r.groupId, r.id)}
            />
          ))}
        </Section>
      )}

      {subTab === 'cr-leave' && (
        <Section title="CR leave (step-down) requests">
          {allLeaveRequests.length === 0 && <EmptyState>Nothing pending.</EmptyState>}
          {allLeaveRequests.map((r) => (
            <ApprovalRow key={`${r.groupId}-${r.id}`}
              label={`${r.name} (${r.roll}) — ${r.groupId} — wants to step down as CR`}
              onApprove={() => handle(clApproveLeaveCR, r.groupId, r.id, r.uid)}
              onReject={() => handle(clRejectLeaveCR, r.groupId, r.id)}
            />
          ))}
        </Section>
      )}
    </CategoryShell>
  );
}

function ApprovalRow({ label, onApprove, onReject }) {
  return (
    <div className="card" style={{ padding: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
      <span style={{ fontSize: 13 }}>{label}</span>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <button className="btn btn-sm btn-primary" onClick={onApprove}>Approve</button>
        <button className="btn btn-sm btn-secondary" onClick={onReject}>Reject</button>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="card" style={{ padding: 14, marginBottom: 16 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)' }}>{title}</h3>
      {children}
    </section>
  );
}

// =======================================================================
// STAFF & ROLES — assign / view every staff-role holder, grouped by role
// category so "who has authority over what" is scannable at a glance
// instead of one flat list.
// =======================================================================
const ROLE_CATEGORY = {
  [ROLES.HEAD_OF_OPS]: 'Leadership',
  [ROLES.SENIOR_CAMPUS_LEAD]: 'Campus Leadership',
  [ROLES.CAMPUS_LEAD]: 'Campus Leadership',
  [ROLES.CONTENT_LEAD]: 'Content & Growth',
  [ROLES.HEAD_OF_GROWTH]: 'Content & Growth',
  [ROLES.FRONTEND_ENG]: 'Engineering',
  [ROLES.BACKEND_ENG]: 'Engineering',
  [ROLES.DATA_SYSTEMS_LEAD]: 'Engineering',
  [ROLES.QA_ENGINEER]: 'Engineering',
  [ROLES.DESIGN_LEAD]: 'Engineering',
  [ROLES.FINANCE_LEAD]: 'Finance & Legal',
  [ROLES.LEGAL_PARTNERSHIPS]: 'Finance & Legal',
};
const CATEGORY_ORDER = ['Leadership', 'Campus Leadership', 'Content & Growth', 'Engineering', 'Finance & Legal'];

function StaffRolesView({ onBack, onSelectCategory, groups, countCtx }) {
  const [newUid, setNewUid] = useState('');
  const [newRole, setNewRole] = useState(ALL_ASSIGNABLE_ROLES[0]);
  const [newScopeValue, setNewScopeValue] = useState('');
  const [currentHolders, setCurrentHolders] = useState({});
  const [holdersError, setHoldersError] = useState(null);
  const [subTab, setSubTab] = useState('assign');

  const refreshHolders = (role) => {
    listStaffByRole(role)
      .then((list) => setCurrentHolders((prev) => ({ ...prev, [role]: list })))
      .catch((err) => {
        // Previously swallowed silently (no .catch at all) — a missing
        // collectionGroup index or a permission issue on staff/*/roles/*
        // rejected here and the role's entry in currentHolders just never
        // got set, so the UI fell through to "No one holds a staff role
        // yet" even when staff genuinely existed. Surface it instead.
        console.error(`[StaffRolesView] failed to load holders for role "${role}":`, err);
        setHoldersError(err?.message || 'Failed to load some staff roles — check the console for details.');
      });
  };
  useEffect(() => { ALL_ASSIGNABLE_ROLES.forEach(refreshHolders); }, []);

  const handleAssign = async () => {
    if (!newUid.trim()) return;
    const scopeKind = ROLE_SCOPE_KIND[newRole];
    let scope = { type: 'global' };
    if (scopeKind === 'dept') scope = { type: 'dept', dept: newScopeValue.trim().toUpperCase() };
    if (scopeKind === 'group') scope = { type: 'group', groupId: newScopeValue.trim().toUpperCase() };
    await assignRole(newUid.trim(), newRole, scope);
    setNewUid(''); setNewScopeValue('');
    refreshHolders(newRole);
  };

  const totalHolders = ALL_ASSIGNABLE_ROLES.reduce((sum, r) => sum + (currentHolders[r]?.length || 0), 0);
  const category = getFounderCategory('staff');
  const subCtx = { ...countCtx, staffHolders: totalHolders };

  return (
    <CategoryShell view="staff" onSelect={onSelectCategory} onBack={onBack} countCtx={countCtx}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>Staff & Roles</h2>
      <SubcategoryTabs subcategories={category.subcategories} activeKey={subTab} onSelect={setSubTab} countCtx={subCtx} />

      {subTab === 'assign' && (
        <Section title="Assign a staff role">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 420 }}>
            <select value={newRole} onChange={(e) => { setNewRole(e.target.value); setNewScopeValue(''); }}
              style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)' }}>
              {ALL_ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
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
        </Section>
      )}

      {subTab === 'holders' && (
        <Section title={`Current role holders${totalHolders ? ` (${totalHolders})` : ''}`}>
          {holdersError && (
            <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 10 }}>{holdersError}</div>
          )}
          {totalHolders === 0 && <EmptyState>No one holds a staff role yet.</EmptyState>}
          {CATEGORY_ORDER.map((cat) => {
            const rolesInCat = ALL_ASSIGNABLE_ROLES.filter((r) => ROLE_CATEGORY[r] === cat && currentHolders[r]?.length > 0);
            if (rolesInCat.length === 0) return null;
            return (
              <div key={cat} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{cat}</div>
                {rolesInCat.map((r) => (
                  <div key={r} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{ROLE_LABELS[r]}</div>
                    {currentHolders[r].map((h) => (
                      <div key={h.id} style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                        <span>{h.scope?.dept || h.scope?.groupId || ''} — {h.uid}</span>
                        <button className="btn btn-sm btn-secondary" onClick={async () => { await removeRole(h.uid, h.role, h.scope); refreshHolders(r); }}>Remove</button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            );
          })}
        </Section>
      )}
    </CategoryShell>
  );
}

// =======================================================================
// CLASSES & STUDENTS — Dept -> Batch drilldown. A batch IS a class (group
// ids are `{BATCH}_{DEPT}`, one group per batch per dept) — there's no
// separate "class" concept underneath a batch, so this is a two-level
// breadcrumb (Dept > Batch), not three. Dept-first still matches how
// SCL (dept-scoped) authority is structured; batch-first would cut
// across dept boundaries awkwardly.
//
// This uses its own breadcrumb UI rather than SubcategoryTabs — Dept and
// Batch are a hierarchical path (each dept has different batches), not a
// fixed set of siblings, so a pill row that lists every batch across
// every dept wouldn't make sense as a tab bar. See founderCategories.js's
// `drilldown: true` note for the general distinction.
// =======================================================================
function parseGroupId(id) {
  // Group ids are `{BATCH}_{DEPT}`, e.g. "2K23_ESE"
  const idx = id.indexOf('_');
  if (idx === -1) return { batch: id, dept: '' };
  return { batch: id.slice(0, idx), dept: id.slice(idx + 1) };
}

function ClassesBreadcrumb({ dept, batch, onDept, onBatch }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginBottom: 16, flexWrap: 'wrap' }}>
      <button onClick={() => { onDept(null); onBatch(null); }}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: dept ? 'var(--muted)' : 'var(--text)', fontWeight: dept ? 500 : 700 }}>
        All departments
      </button>
      {dept && (
        <>
          <Icons.ChevronRight size={13} color="var(--muted)" />
          <button onClick={() => onBatch(null)}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: batch ? 'var(--muted)' : 'var(--text)', fontWeight: batch ? 500 : 700 }}>
            {dept}
          </button>
        </>
      )}
      {batch && (
        <>
          <Icons.ChevronRight size={13} color="var(--muted)" />
          <span style={{ fontWeight: 700 }}>{batch}</span>
        </>
      )}
    </div>
  );
}

function ClassesView({ onBack, onSelectCategory, countCtx }) {
  const [groups, setGroups] = useState(null);
  const [dept, setDept] = useState(null);
  const [batch, setBatch] = useState(null);

  useEffect(() => { listAllGroups().then(setGroups); }, []);

  const byDept = useMemo(() => {
    if (!groups) return {};
    const map = {};
    groups.forEach((g) => {
      const { batch: b, dept: d } = parseGroupId(g.id);
      if (!map[d]) map[d] = {};
      // A batch normally maps to exactly one group id; if data ever has
      // more than one group sharing a batch+dept, keep them all so
      // nothing silently disappears — surfaced as a small inline choice
      // rather than a whole extra drilldown screen.
      if (!map[d][b]) map[d][b] = [];
      map[d][b].push(g.id);
    });
    return map;
  }, [groups]);

  const depts = Object.keys(byDept).sort();
  const subtitle = resolveSubtitle(getFounderCategory('classes'), { ...countCtx, classCount: groups?.length });

  const body = () => {
    if (groups === null) return <EmptyState>Loading…</EmptyState>;

    // Batch selected -> that batch's roster (a batch IS a class).
    if (dept && batch) {
      const groupIds = byDept[dept]?.[batch] || [];
      if (groupIds.length === 1) return <ClassBlock groupId={groupIds[0]} />;
      // Rare: more than one group under the same dept+batch — let the
      // Founder pick which before showing a roster.
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {groupIds.map((g) => (
            <button key={g} onClick={() => setBatch(`${batch}::${g}`)}
              className="card" style={{ padding: 12, textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{g}</span>
              <Icons.ChevronRight size={14} color="var(--muted)" />
            </button>
          ))}
        </div>
      );
    }

    // Dept selected -> its batches (each batch = one class).
    if (dept) {
      const batches = Object.keys(byDept[dept] || {}).sort();
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {batches.length === 0 && <EmptyState>No batches in {dept} yet.</EmptyState>}
          {batches.map((b) => (
            <button key={b} onClick={() => setBatch(b)}
              className="card" style={{ padding: 12, textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{b}</span>
              <Icons.ChevronRight size={14} color="var(--muted)" />
            </button>
          ))}
        </div>
      );
    }

    // Nothing selected -> departments.
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {depts.length === 0 && <EmptyState>No classes yet.</EmptyState>}
        {depts.map((d) => {
          const batchCount = Object.keys(byDept[d]).length;
          return (
            <button key={d} onClick={() => setDept(d)}
              className="card" style={{ padding: 12, textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{d}</span>
              <span style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                {batchCount} batch{batchCount > 1 ? 'es' : ''} <Icons.ChevronRight size={14} />
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <CategoryShell view="classes" onSelect={onSelectCategory} onBack={onBack} countCtx={countCtx}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px' }}>Classes & Students</h2>
      <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 14px' }}>{subtitle}</p>
      <ClassesBreadcrumb dept={dept} batch={batch} onDept={setDept} onBatch={setBatch} />
      {body()}
    </CategoryShell>
  );
}

function ClassBlock({ groupId }) {
  const [crRequests, setCrRequests] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [approveErr, setApproveErr] = useState('');

  useEffect(() => subscribeCRRequests(groupId, setCrRequests), [groupId]);
  useEffect(() => subscribeLeaveRequests(groupId, setLeaveRequests), [groupId]);

  const handleApprove = async (targetUid) => {
    setApproveErr('');
    try { await clApproveCRRequest(groupId, targetUid); } catch (e) { setApproveErr(e?.message || 'Approve failed — try again.'); }
  };
  const handleApproveLeave = async (requestDocId, targetUid) => {
    setApproveErr('');
    try { await clApproveLeaveCR(groupId, requestDocId, targetUid); } catch (e) { setApproveErr(e?.message || 'Approve failed — try again.'); }
  };

  return (
    <div>
      {approveErr && <div className="card" style={{ padding: 8, marginBottom: 8, fontSize: 12, color: 'var(--danger)' }}>{approveErr}</div>}

      {crRequests.length > 0 && (
        <Section title="CR requests">
          {crRequests.map((r) => (
            <ApprovalRow key={r.id} label={`${r.name} (${r.roll})`}
              onApprove={() => handleApprove(r.id)} onReject={() => clRejectCRRequest(groupId, r.id)} />
          ))}
        </Section>
      )}

      {leaveRequests.length > 0 && (
        <Section title="CR leave requests">
          {leaveRequests.map((r) => (
            <ApprovalRow key={r.id} label={`${r.name} (${r.roll}) — wants to step down as CR`}
              onApprove={() => handleApproveLeave(r.id, r.uid)} onReject={() => clRejectLeaveCR(groupId, r.id)} />
          ))}
        </Section>
      )}

      <Section title="Roster">
        <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: -4, marginBottom: 10 }}>
          "Claims CR" badge = held CR before this system existed, or a stale claim — review, promote, or use "Clear claim" to dismiss.
        </p>
        <ClassmatesList groupId={groupId} showActions viewerRole="cl" currentUid={auth.currentUser?.uid} />
      </Section>
    </div>
  );
}

// =======================================================================
// TRUST & SAFETY — email flags + roll unlock requests. Grouped together
// since both are "something looks wrong with an account, review it"
// tasks, distinct from day-to-day CR/staff administration.
// =======================================================================
function TrustSafetyView({ onBack, onSelectCategory, countCtx }) {
  const [flags, setFlags] = useState(null);
  const [flagErr, setFlagErr] = useState(null);
  const [rollRequests, setRollRequests] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [subTab, setSubTab] = useState('flags');

  const refreshFlags = () => {
    listPendingFlags({}).then(setFlags).catch((e) => setFlagErr(e?.message || 'Failed to load email flags.'));
  };
  useEffect(() => { refreshFlags(); }, []);
  useEffect(() => subscribePendingRollUnlockRequests(setRollRequests), []);

  const handleResolveFlag = async (f, status) => {
    setBusyId(f.id);
    try { await resolveEmailFlag(f.id, status); refreshFlags(); } finally { setBusyId(null); }
  };
  const handleResolveRoll = async (r) => {
    setBusyId(r.id);
    try { await resolveRollUnlockRequest(r.id, r.roll); } finally { setBusyId(null); }
  };
  const handleDismissRoll = async (r) => {
    setBusyId(r.id);
    try { await dismissRollUnlockRequest(r.id); } finally { setBusyId(null); }
  };

  const category = getFounderCategory('trust');
  const subCtx = { ...countCtx, emailFlags: flags?.length || 0, rollRequests: rollRequests.length };

  return (
    <CategoryShell view="trust" onSelect={onSelectCategory} onBack={onBack} countCtx={countCtx}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>Trust & Safety</h2>
      <SubcategoryTabs subcategories={category.subcategories} activeKey={subTab} onSelect={setSubTab} countCtx={subCtx} />

      {subTab === 'flags' && (
        <Section title="Pending email flags">
          {flagErr && <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 8 }}>{flagErr}</div>}
          {flags === null && !flagErr && <EmptyState>Loading…</EmptyState>}
          {flags?.length === 0 && <EmptyState>No pending email flags.</EmptyState>}
          {flags?.map((f) => (
            <div key={f.id} className="card" style={{ padding: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div>
                <div style={{ fontSize: 13 }}>{f.targetEmail || '(no email)'} — {f.dept || f.groupId || 'unscoped'}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{f.reason}</div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn btn-sm btn-primary" onClick={() => handleResolveFlag(f, 'resolved')} disabled={busyId === f.id}>Fixed</button>
                <button className="btn btn-sm btn-secondary" onClick={() => handleResolveFlag(f, 'dismissed')} disabled={busyId === f.id}>Dismiss</button>
              </div>
            </div>
          ))}
        </Section>
      )}

      {subTab === 'roll' && (
        <Section title="Roll unlock requests">
          {rollRequests.length === 0 && <EmptyState>Nothing pending.</EmptyState>}
          {rollRequests.map((r) => (
            <div key={r.id} className="card" style={{ padding: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Roll: {r.roll}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{r.note}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-sm" onClick={() => handleResolveRoll(r)} disabled={busyId === r.id}>
                  {busyId === r.id ? 'Working…' : 'Release roll'}
                </button>
                <button className="btn btn-sm btn-secondary" onClick={() => handleDismissRoll(r)} disabled={busyId === r.id}>Dismiss</button>
              </div>
            </div>
          ))}
        </Section>
      )}
    </CategoryShell>
  );
}

// =======================================================================
// COMMUNICATION — send a notice to everyone / one batch / one class.
// =======================================================================
function CommunicationView({ onBack, onSelectCategory, groups, countCtx }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audienceType, setAudienceType] = useState('all');
  const [batchInput, setBatchInput] = useState('');
  const [groupInput, setGroupInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState('');

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

  return (
    <CategoryShell view="comms" onSelect={onSelectCategory} onBack={onBack} countCtx={countCtx}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>Communication</h2>
      <Section title="Send a notice">
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
      </Section>
    </CategoryShell>
  );
}

// =======================================================================
// Main hub
// =======================================================================
export default function AdminDashboard() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [view, setView] = useState(null); // null = grid, else category key

  const [groups, setGroups] = useState(null);
  const [applications, setApplications] = useState([]);
  const [rollRequests, setRollRequests] = useState([]);
  const [emailFlagCount, setEmailFlagCount] = useState(0);
  const [crCountMap, setCrCountMap] = useState({});
  const [leaveCountMap, setLeaveCountMap] = useState({});

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

  useEffect(() => { if (authorized) subscribePendingRollUnlockRequests(setRollRequests); }, [authorized]);
  useEffect(() => { if (authorized) listPendingFlags({}).then((f) => setEmailFlagCount(f.length)).catch(() => {}); }, [authorized]);

  // Badge counts for CR + leave requests across all classes, for the
  // Approvals card badge — one subscription per group, kept as a map so
  // updates to one group's count don't require refetching everything.
  useEffect(() => {
    if (!authorized || !groups) return;
    const unsubs = groups.map((g) => subscribeCRRequests(g.id, (reqs) => {
      setCrCountMap((prev) => ({ ...prev, [g.id]: reqs.length }));
    }));
    return () => unsubs.forEach((u) => u());
  }, [authorized, groups]);
  useEffect(() => {
    if (!authorized || !groups) return;
    const unsubs = groups.map((g) => subscribeLeaveRequests(g.id, (reqs) => {
      setLeaveCountMap((prev) => ({ ...prev, [g.id]: reqs.length }));
    }));
    return () => unsubs.forEach((u) => u());
  }, [authorized, groups]);

  const totalCrReq = Object.values(crCountMap).reduce((a, b) => a + b, 0);
  const totalLeaveReq = Object.values(leaveCountMap).reduce((a, b) => a + b, 0);

  if (checking) return <div style={{ padding: 20, color: 'var(--muted)' }}>Checking authorization…</div>;
  if (!authorized) return null;

  // Single shared count context, fed into the grid, CategorySubNav badges,
  // and (via each view's own local counts merged on top) SubcategoryTabs
  // badges too. Keys here match what founderCategories.js's getCount
  // functions read — add a new metric here + reference it from the
  // registry, no component changes needed.
  const countCtx = {
    clApplications: applications.length,
    crRequests: totalCrReq,
    leaveRequests: totalLeaveReq,
    emailFlags: emailFlagCount,
    rollRequests: rollRequests.length,
    classCount: groups?.length,
  };

  const onSelectCategory = (key) => setView(key);
  const onBack = () => setView(null);

  const viewProps = { groups, countCtx, onSelectCategory, onBack };

  if (view === 'approvals') return <ApprovalsView {...viewProps} />;
  if (view === 'staff') return <StaffRolesView {...viewProps} />;
  if (view === 'classes') return <ClassesView {...viewProps} />;
  if (view === 'trust') return <TrustSafetyView {...viewProps} />;
  if (view === 'comms') return <CommunicationView {...viewProps} />;

  // Top-level grid — fully generated from FOUNDER_CATEGORIES. Adding a
  // category to that registry adds a card here automatically.
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        {FOUNDER_CATEGORIES.map((cat) => (
          <FounderCategoryCard
            key={cat.key}
            category={cat}
            count={resolveCount(cat, countCtx)}
            subtitle={resolveSubtitle(cat, countCtx)}
            onClick={() => setView(cat.key)}
          />
        ))}
      </div>
    </div>
  );
}