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
  getGroupMembersOnce,
} from '../lib/groupSync';
import {
  assignRole, removeRole, listStaffByRole, subscribeAllCLApplications,
  approveCLApplication, rejectCLApplication, getStaffDisplayInfoBatch,
} from '../lib/staffSync';
import { CORE_TEAM_LEAD_ROLES, ROLE_LABELS, ROLE_SCOPE_KIND, ROLES } from '../lib/staffRoles';
import { subscribePendingRollUnlockRequests, resolveRollUnlockRequest, dismissRollUnlockRequest } from '../lib/rollOwnership';
import { listPendingFlags, resolveEmailFlag } from '../lib/emailFlags';
import ClassmatesList from '../components/ClassmatesList';
import { renderFormattedNoticeBody } from '../lib/noticeFormat';
import CategorySubNav from '../components/CategorySubNav';
import SubcategoryTabs from '../components/SubcategoryTabs';
import { FOUNDER_CATEGORIES, getFounderCategory, resolveCount, resolveSubtitle } from '../lib/founderCategories';
import { listAllFacultyAccounts } from '../lib/facultySync';
import { listAllActiveFacultyAssignments } from '../lib/facultyClassSync';
import { useIsFaculty } from '../hooks/useIsFaculty';
import {
  subscribeManualVerifyRequests, approveManualVerifyRequest, rejectManualVerifyRequest,
} from '../lib/manualVerifyRequests';

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

// §7 (revised) — the Founder's Student View / Teacher View switch, now
// living on the Admin/Founder dashboard's own landing page instead of
// scattered inside the sidebar and Faculty Dashboard. This button is only
// ever rendered for the Founder in the first place (this whole component
// early-returns null for anyone else, see `authorized` below) so there's
// no separate visibility check needed here beyond that.
//
// The actual viewMode state/localStorage key ('kuetx:viewMode') still
// lives in Sidebar.jsx/BottomNav.jsx, since those are what actually read
// it to decide which NAV config renders — this card is just a second,
// better-placed way to flip the same localStorage value. Both places stay
// in sync automatically since they both read the same key.
function FounderViewSwitchCard() {
  const [current, setCurrent] = useState(() => {
    try { return localStorage.getItem('kuetx:viewMode') || 'student'; } catch { return 'student'; }
  });

  const flip = () => {
    const next = current === 'teacher' ? 'student' : 'teacher';
    try { localStorage.setItem('kuetx:viewMode', next); } catch { /* ignore */ }
    setCurrent(next);
  };

  return (
    <div className="card" style={{
      padding: 16, marginBottom: 18, display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          background: 'color-mix(in srgb, var(--accent) 12%, var(--surface))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icons.Repeat size={18} color="var(--accent)" />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)' }}>
            Founder testing view
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Currently viewing as: <strong style={{ color: 'var(--text)' }}>{current === 'teacher' ? 'Teacher' : 'Student'}</strong>
          </div>
        </div>
      </div>
      <button
        onClick={flip}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 8,
          border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
          background: 'color-mix(in srgb, var(--accent) 10%, var(--card))',
          color: 'var(--accent)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', flexShrink: 0,
        }}
      >
        <Icons.RefreshCw size={13} />
        Switch to {current === 'teacher' ? 'Student' : 'Teacher'} View
      </button>
    </div>
  );
}

// Wraps every category's own view with the CategorySubNav pill row, so
// jumping to a sibling category never requires a trip back through the
// grid. `view` is the current category key; `onSelect` swaps it;
// `onBack` returns to the grid. `countCtx` feeds badge counts into both
// this row and any SubcategoryTabs the category view renders itself.
function CategoryShell({ view, onSelect, countCtx, children }) {
  return (
    <div>
      <CategorySubNav
        categories={FOUNDER_CATEGORIES}
        activeKey={view}
        onSelect={onSelect}
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
  // Each of these starts as `null` — meaning "not yet loaded" — instead
  // of `[]`/`{}`. That distinguishes "still loading" from "loaded and
  // genuinely empty", so EmptyState's "Nothing pending." text only ever
  // shows once the real data has actually arrived. Previously these
  // started as [] / {}, so the first render always looked empty and then
  // popped once Firestore resolved — the flicker the Founder was seeing.
  const [clApplications, setClApplications] = useState(null);
  const [groupIds, setGroupIds] = useState(null);
  const [crRequestsByGroup, setCrRequestsByGroup] = useState(null);
  const [leaveRequestsByGroup, setLeaveRequestsByGroup] = useState(null);
  const [manualVerifyRequests, setManualVerifyRequests] = useState(null);
  const [err, setErr] = useState('');
  const [subTab, setSubTab] = useState('cl-apps');

  useEffect(() => subscribeAllCLApplications(setClApplications), []);
  useEffect(() => subscribeManualVerifyRequests(setManualVerifyRequests), []);
  useEffect(() => { listAllGroups().then((gs) => setGroupIds(gs.map((g) => g.id))); }, []);

  useEffect(() => {
    if (!groupIds) return;
    setCrRequestsByGroup({});
    const unsubs = groupIds.map((g) => subscribeCRRequests(g, (reqs) => {
      setCrRequestsByGroup((prev) => ({ ...(prev || {}), [g]: reqs }));
    }));
    return () => unsubs.forEach((u) => u());
  }, [groupIds]);

  useEffect(() => {
    if (!groupIds) return;
    setLeaveRequestsByGroup({});
    const unsubs = groupIds.map((g) => subscribeLeaveRequests(g, (reqs) => {
      setLeaveRequestsByGroup((prev) => ({ ...(prev || {}), [g]: reqs }));
    }));
    return () => unsubs.forEach((u) => u());
  }, [groupIds]);

  // `null` while the relevant subscription hasn't resolved at all yet —
  // used below to show a loading state instead of the empty state.
  const clAppsLoading = clApplications === null;
  const crReqLoading = crRequestsByGroup === null;
  const leaveReqLoading = leaveRequestsByGroup === null;
  const manualVerifyLoading = manualVerifyRequests === null;

  const allCrRequests = Object.entries(crRequestsByGroup || {}).flatMap(([g, reqs]) => reqs.map((r) => ({ ...r, groupId: g })));
  const allLeaveRequests = Object.entries(leaveRequestsByGroup || {}).flatMap(([g, reqs]) => reqs.map((r) => ({ ...r, groupId: g })));

  const handle = async (fn, ...args) => {
    setErr('');
    try { await fn(...args); } catch (e) { setErr(e?.message || 'Action failed — try again.'); }
  };

  const category = getFounderCategory('approvals');
  const subCtx = { ...countCtx, clApplications: clApplications?.length || 0, crRequests: allCrRequests.length, leaveRequests: allLeaveRequests.length, manualVerifyRequests: manualVerifyRequests?.length || 0 };

  return (
    <CategoryShell view="approvals" onSelect={onSelectCategory} countCtx={countCtx}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>Approvals</h2>
      <SubcategoryTabs subcategories={category.subcategories} activeKey={subTab} onSelect={setSubTab} countCtx={subCtx} />
      {err && <div className="card" style={{ padding: 8, marginBottom: 12, fontSize: 12, color: 'var(--danger)' }}>{err}</div>}

      {subTab === 'cl-apps' && (
        <Section title="Campus Lead applications">
          {clAppsLoading && <EmptyState>Loading…</EmptyState>}
          {!clAppsLoading && clApplications.length === 0 && <EmptyState>Nothing pending.</EmptyState>}
          {(clApplications || []).map((a) => (
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
          {crReqLoading && <EmptyState>Loading…</EmptyState>}
          {!crReqLoading && allCrRequests.length === 0 && <EmptyState>Nothing pending.</EmptyState>}
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
          {leaveReqLoading && <EmptyState>Loading…</EmptyState>}
          {!leaveReqLoading && allLeaveRequests.length === 0 && <EmptyState>Nothing pending.</EmptyState>}
          {allLeaveRequests.map((r) => (
            <ApprovalRow key={`${r.groupId}-${r.id}`}
              label={`${r.name} (${r.roll}) — ${r.groupId} — wants to step down as CR`}
              onApprove={() => handle(clApproveLeaveCR, r.groupId, r.id, r.uid)}
              onReject={() => handle(clRejectLeaveCR, r.groupId, r.id)}
            />
          ))}
        </Section>
      )}

      {subTab === 'manual-verify' && (
        <Section title="Manual verification requests">
          {manualVerifyLoading && <EmptyState>Loading…</EmptyState>}
          {!manualVerifyLoading && manualVerifyRequests.length === 0 && <EmptyState>Nothing pending.</EmptyState>}
          {(manualVerifyRequests || []).map((r) => (
            <ApprovalRow key={r.id}
              label={`${r.name || 'Unknown'} — ${r.email} — ${r.role === 'faculty' ? 'Faculty' : 'Student'}${r.roll ? ` (Roll: ${r.roll})` : ''}${r.dept ? ` — ${r.dept}` : ''}`}
              onApprove={() => handle(approveManualVerifyRequest, r.id)}
              onReject={() => handle(rejectManualVerifyRequest, r.id)}
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

function reportStaffRoleHolders(holdersByRole, loadError = null) {
  const rows = ALL_ASSIGNABLE_ROLES.map((role) => ({
    role,
    label: ROLE_LABELS[role],
    count: holdersByRole[role]?.length || 0,
  }));
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  console.groupCollapsed(`[Founder] Staff role holders report${total ? ` (${total})` : ''}`);
  console.table(rows.map(({ role, label, count }) => ({ role, label, count })));
  if (loadError) {
    console.warn('[Founder] staff-role load warning:', loadError);
  }
  if (total === 0) {
    console.info('No role holders were returned. Possible reasons: no staff roles are assigned yet, or the current session cannot read staff role docs because deployed Firestore rules are not matching the expected Founder/admin access path.');
  } else {
    const populated = rows.filter((row) => row.count > 0).length;
    console.info(`Loaded ${total} role assignments across ${populated}/${rows.length} roles.`);
  }
  console.groupEnd();
}

function StaffRolesView({ onBack, onSelectCategory, groups, countCtx }) {
  const [newUid, setNewUid] = useState('');
  const [newRole, setNewRole] = useState(ALL_ASSIGNABLE_ROLES[0]);
  const [newScopeValue, setNewScopeValue] = useState('');
  const [currentHolders, setCurrentHolders] = useState({});
  const [holdersError, setHoldersError] = useState(null);
  const [holdersLoading, setHoldersLoading] = useState(false);
  // 'all' or a specific role key — lets the Founder jump straight to one
  // role's holders instead of always scrolling the full list. Only roles
  // that currently HAVE holders show as chips (an empty-role chip would
  // just be dead weight in a list that's meant to stay compact).
  const [holderFilter, setHolderFilter] = useState('all');
  // uid -> { name, roll }, resolved separately from the role docs
  // themselves (which only ever store uid — see getStaffDisplayInfo in
  // staffSync.js for why a second lookup is needed here).
  const [displayInfo, setDisplayInfo] = useState({});

  const resolveDisplayInfo = async (holdersByRole) => {
    const allUids = Object.values(holdersByRole).flat().map((h) => h.uid);
    const info = await getStaffDisplayInfoBatch(allUids);
    setDisplayInfo((prev) => ({ ...prev, ...info }));
  };

  const refreshHolders = async (role) => {
    try {
      const list = await listStaffByRole(role);
      setCurrentHolders((prev) => ({ ...prev, [role]: list }));
      resolveDisplayInfo({ [role]: list });
      return list;
    } catch (err) {
      setCurrentHolders((prev) => ({ ...prev, [role]: [] }));
      console.error(`[Founder] failed to load holders for role "${role}":`, err);
      setHoldersError(err?.code === 'permission-denied'
        ? 'Staff role data could not be read (permission denied) — this usually means a Firestore rules deploy is out of date. Check the console for details.'
        : (err?.message || 'Failed to load some staff roles.'));
      return [];
    }
  };

  useEffect(() => {
    let cancelled = false;
    setHoldersLoading(true);
    const loadAllHolders = async () => {
      const nextHolders = {};
      let nextError = null;
      for (const role of ALL_ASSIGNABLE_ROLES) {
        try {
          nextHolders[role] = await listStaffByRole(role);
        } catch (err) {
          nextHolders[role] = [];
          // permission-denied here is NOT an expected/benign case for an
          // Admin or Head of Ops session — it used to be silently
          // swallowed on the (wrong) assumption that it just meant "this
          // particular role's docs aren't readable", which hid a real
          // Firestore rules bug (missing collectionGroup match for the
          // 'roles' subcollection) behind a UI that quietly showed "0
          // holders" for every role with no indication anything had
          // failed. Surface it like any other load error instead.
          console.error(`[Founder] failed to load holders for role "${role}":`, err);
          nextError = err?.code === 'permission-denied'
            ? 'Staff role data could not be read (permission denied) — this usually means a Firestore rules deploy is out of date. Check the console for details.'
            : (err?.message || 'Failed to load some staff roles.');
        }
      }
      if (cancelled) return;
      setCurrentHolders(nextHolders);
      setHoldersError(nextError);
      setHoldersLoading(false);
      reportStaffRoleHolders(nextHolders, nextError);
      resolveDisplayInfo(nextHolders);
    };
    loadAllHolders().catch((err) => {
      if (cancelled) return;
      setHoldersError(err?.message || 'Failed to load staff roles.');
      setHoldersLoading(false);
      console.error('[Founder] unexpected staff-role loader failure:', err);
      reportStaffRoleHolders({}, err?.message || 'Failed to load staff roles.');
    });
    return () => { cancelled = true; };
  }, []);

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
    <CategoryShell view="staff" onSelect={onSelectCategory} countCtx={countCtx}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>Staff & Roles</h2>
      <SubcategoryTabs subcategories={category.subcategories} activeKey="holders" onSelect={() => {}} countCtx={subCtx} />

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

      <Section title={`Current role holders${totalHolders ? ` (${totalHolders})` : ''}`}>
        {holdersError && (
          <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 10 }}>{holdersError}</div>
        )}
        {holdersLoading && <EmptyState>Loading current role holders…</EmptyState>}
        {!holdersLoading && totalHolders === 0 && <EmptyState>No one holds a staff role yet.</EmptyState>}
        {!holdersLoading && totalHolders > 0 && (
          <>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>
              Founder can revoke any holder below. A person holding multiple roles appears once per role.
            </p>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 12 }}>
              <button
                onClick={() => setHolderFilter('all')}
                className="btn btn-sm"
                style={{
                  whiteSpace: 'nowrap',
                  background: holderFilter === 'all' ? 'var(--accentBg, #eef2ff)' : 'transparent',
                  color: holderFilter === 'all' ? 'var(--accent, #4f46e5)' : 'var(--muted)',
                  border: holderFilter === 'all' ? '1px solid var(--accent, #4f46e5)' : '1px solid var(--border)',
                  fontWeight: holderFilter === 'all' ? 700 : 500,
                }}
              >
                All ({totalHolders})
              </button>
              {ALL_ASSIGNABLE_ROLES.filter((r) => (currentHolders[r]?.length || 0) > 0).map((r) => (
                <button
                  key={r}
                  onClick={() => setHolderFilter(r)}
                  className="btn btn-sm"
                  style={{
                    whiteSpace: 'nowrap',
                    background: holderFilter === r ? 'var(--accentBg, #eef2ff)' : 'transparent',
                    color: holderFilter === r ? 'var(--accent, #4f46e5)' : 'var(--muted)',
                    border: holderFilter === r ? '1px solid var(--accent, #4f46e5)' : '1px solid var(--border)',
                    fontWeight: holderFilter === r ? 700 : 500,
                  }}
                >
                  {ROLE_LABELS[r]} ({currentHolders[r].length})
                </button>
              ))}
            </div>

            <div className="staff-holders-grid">
              {ALL_ASSIGNABLE_ROLES
                .filter((r) => holderFilter === 'all' || holderFilter === r)
                .filter((r) => (currentHolders[r]?.length || 0) > 0)
                .flatMap((r) => (currentHolders[r] || []).map((h) => {
                  const info = displayInfo[h.uid];
                  const label = info?.name
                    ? `${info.name}${info.roll ? ` (${info.roll})` : ''}`
                    : h.uid;
                  return (
                    <div key={`${r}-${h.id}`} className="staff-holder-card">
                      <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                        {ROLE_LABELS[r]}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', wordBreak: 'break-word' }}>{label}</div>
                      {(h.scope?.dept || h.scope?.groupId) && (
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                          {h.scope?.dept || h.scope?.groupId}
                        </div>
                      )}
                      <button
                        className="btn btn-sm btn-secondary"
                        title="Revoke this role from the holder"
                        onClick={async () => { await removeRole(h.uid, h.role, h.scope); refreshHolders(r); }}
                        style={{ marginTop: 8, width: '100%' }}
                      >
                        Revoke
                      </button>
                    </div>
                  );
                }))}
            </div>
          </>
        )}
      </Section>
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
  // Per-group member counts, fetched as a second async layer after `groups`
  // resolves — so dept/batch cards render immediately with names/batch
  // counts, and the student-count numbers pop in once available instead of
  // blocking the whole view on N parallel roster fetches.
  const [memberCounts, setMemberCounts] = useState(null);

  useEffect(() => { listAllGroups().then(setGroups); }, []);

  useEffect(() => {
    if (!groups) return;
    let cancelled = false;
    Promise.all(
      groups.map(async (g) => ({ groupId: g.id, count: (await getGroupMembersOnce(g.id)).length })),
    ).then((rows) => {
      if (cancelled) return;
      setMemberCounts(Object.fromEntries(rows.map((r) => [r.groupId, r.count])));
    });
    return () => { cancelled = true; };
  }, [groups]);

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

  // Student totals derived from memberCounts — undefined/null-safe so a
  // dept/batch renders its count as soon as memberCounts is available,
  // without waiting on every single group's fetch if one is still pending.
  const studentTotalForGroupIds = (groupIds) => {
    if (!memberCounts) return null;
    return groupIds.reduce((sum, gid) => sum + (memberCounts[gid] ?? 0), 0);
  };
  const studentTotalForDept = (d) => {
    if (!memberCounts) return null;
    const groupIds = Object.values(byDept[d] || {}).flat();
    return studentTotalForGroupIds(groupIds);
  };

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
        <div className="classes-drilldown-grid">
          {groupIds.map((g) => {
            const count = memberCounts?.[g];
            return (
              <button key={g} onClick={() => setBatch(`${batch}::${g}`)}
                className="card" style={{ padding: 12, textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{g}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {count != null && `${count} students`} <Icons.ChevronRight size={14} />
                </span>
              </button>
            );
          })}
        </div>
      );
    }

    // Dept selected -> its batches (each batch = one class).
    if (dept) {
      const batches = Object.keys(byDept[dept] || {}).sort();
      return (
        <div className="classes-drilldown-grid">
          {batches.length === 0 && <EmptyState>No batches in {dept} yet.</EmptyState>}
          {batches.map((b) => {
            const count = studentTotalForGroupIds(byDept[dept][b]);
            return (
              <button key={b} onClick={() => setBatch(b)}
                className="card" style={{ padding: 12, textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{b}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {count != null ? `${count} students` : '\u00A0'} <Icons.ChevronRight size={12} style={{ marginLeft: 'auto' }} />
                </span>
              </button>
            );
          })}
        </div>
      );
    }

    // Nothing selected -> departments.
    return (
      <div className="classes-drilldown-grid">
        {depts.length === 0 && <EmptyState>No classes yet.</EmptyState>}
        {depts.map((d) => {
          const batchCount = Object.keys(byDept[d]).length;
          const studentCount = studentTotalForDept(d);
          return (
            <button key={d} onClick={() => setDept(d)}
              className="card" style={{ padding: 12, textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{d}</span>
              <span style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                {batchCount} batch{batchCount > 1 ? 'es' : ''}{studentCount != null ? ` · ${studentCount} students` : ''}
                <Icons.ChevronRight size={12} style={{ marginLeft: 'auto' }} />
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <CategoryShell view="classes" onSelect={onSelectCategory} countCtx={countCtx}>
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
  // null = not yet loaded (same reasoning as `flags` above) — avoids
  // flashing "Nothing pending." before the first subscription snapshot.
  const [rollRequests, setRollRequests] = useState(null);
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
  const subCtx = { ...countCtx, emailFlags: flags?.length || 0, rollRequests: rollRequests?.length || 0 };

  return (
    <CategoryShell view="trust" onSelect={onSelectCategory} countCtx={countCtx}>
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
          {rollRequests === null && <EmptyState>Loading…</EmptyState>}
          {rollRequests?.length === 0 && <EmptyState>Nothing pending.</EmptyState>}
          {(rollRequests || []).map((r) => (
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
// §7 of the merged Faculty Module prompt — Admin's "Faculty" category.
// Follows the exact same "start with null, not [], to avoid the
// Founder-page flicker" pattern established in ApprovalsView/TrustSafetyView
// above (Phase A's fix) — genuinely reused, not just referenced.
function FacultyView({ onBack, onSelectCategory, countCtx }) {
  const [facultyList, setFacultyList] = useState(null);
  const [assignments, setAssignments] = useState(null);
  const [subTab, setSubTab] = useState('directory');

  useEffect(() => {
    listAllFacultyAccounts().then(setFacultyList).catch(() => setFacultyList([]));
  }, []);

  // Only fetched once the Assignments sub-tab is actually opened — this is
  // a collectionGroup query (genuinely necessary here, see
  // listAllActiveFacultyAssignments()'s own comment for why it's an
  // exception to this module's usual avoid-collectionGroup rule), no
  // reason to pay that cost for Admins who only ever look at Directory/
  // Pending.
  useEffect(() => {
    if (subTab !== 'assignments' || assignments !== null) return;
    listAllActiveFacultyAssignments().then(setAssignments).catch(() => setAssignments([]));
  }, [subTab, assignments]);

  const loading = facultyList === null;
  const verified = (facultyList || []).filter((f) => f.verifiedAt);
  const pending = (facultyList || []).filter((f) => !f.verifiedAt);
  const facultyNameByUid = Object.fromEntries((facultyList || []).map((f) => [f.uid, f.name || f.officialEmail]));

  // Total-teachers count grouped by department, for the "sundor kore" (see
  // conversation) redesigned Directory tab — same shape as the student
  // side's per-dept breakdown, just for faculty instead of students.
  const deptCounts = useMemo(() => {
    const map = {};
    verified.forEach((f) => {
      const d = f.dept || 'Unspecified';
      map[d] = (map[d] || 0) + 1;
    });
    return map;
  }, [verified]);

  const category = getFounderCategory('faculty');
  const subCtx = { ...countCtx, facultyCount: verified.length, facultyPending: pending.length };

  return (
    <CategoryShell view="faculty" onSelect={onSelectCategory} countCtx={countCtx}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>Faculty</h2>
      <SubcategoryTabs subcategories={category.subcategories} activeKey={subTab} onSelect={setSubTab} countCtx={subCtx} />

      {subTab === 'directory' && (
        <>
          {/* Total Teachers overview — mirrors the per-dept student-count
              breakdown on the Classes view, sized as prominent stat cards
              rather than the old plain flat list. */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{
              flex: '1 1 160px', padding: 16, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--card)',
            }}>
              <Icons.GraduationCap size={18} color="var(--accent)" style={{ marginBottom: 8 }} />
              <div style={{ fontWeight: 800, fontSize: 22, color: 'var(--text)' }}>{loading ? '—' : verified.length}</div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Total Teachers</div>
            </div>
            <div style={{
              flex: '1 1 160px', padding: 16, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--card)',
            }}>
              <Icons.Building2 size={18} color="var(--accent)" style={{ marginBottom: 8 }} />
              <div style={{ fontWeight: 800, fontSize: 22, color: 'var(--text)' }}>{loading ? '—' : Object.keys(deptCounts).length}</div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Departments Represented</div>
            </div>
            <div style={{
              flex: '1 1 160px', padding: 16, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--card)',
            }}>
              <Icons.Clock size={18} color="var(--accent)" style={{ marginBottom: 8 }} />
              <div style={{ fontWeight: 800, fontSize: 22, color: 'var(--text)' }}>{loading ? '—' : pending.length}</div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Awaiting Verification</div>
            </div>
          </div>

          {!loading && verified.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {Object.entries(deptCounts).sort((a, b) => b[1] - a[1]).map(([d, count]) => (
                <span key={d} style={{
                  fontSize: 11.5, fontWeight: 600, padding: '4px 10px', borderRadius: 999,
                  background: 'color-mix(in srgb, var(--accent) 10%, var(--surface))',
                  border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)', color: 'var(--text)',
                }}>
                  {d} · {count}
                </span>
              ))}
            </div>
          )}

          <Section title="Teachers">
            {loading && <EmptyState>Loading…</EmptyState>}
            {!loading && verified.length === 0 && <EmptyState>No verified faculty accounts yet.</EmptyState>}
            {verified.map((f) => (
              <div key={f.uid} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px', borderBottom: '1px solid var(--border)',
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                  background: 'color-mix(in srgb, var(--accent) 15%, var(--surface))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: 14, color: 'var(--accent)',
                }}>
                  {(f.name || f.officialEmail || '?').trim().charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)' }}>{f.name || 'Unnamed'}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 2 }}>
                    {f.title && (
                      <span style={{
                        fontWeight: 600, padding: '1px 7px', borderRadius: 999,
                        background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)',
                      }}>{f.title}</span>
                    )}
                    {f.dept && <span>{f.dept}</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3, wordBreak: 'break-all' }}>{f.officialEmail}</div>
                </div>
              </div>
            ))}
          </Section>
        </>
      )}

      {subTab === 'pending' && (
        <Section title="Accounts awaiting email verification">
          {loading && <EmptyState>Loading…</EmptyState>}
          {!loading && pending.length === 0 && <EmptyState>Nothing pending.</EmptyState>}
          {pending.map((f) => (
            <div key={f.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{f.officialEmail}</div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Signed up, not yet verified</div>
              </div>
            </div>
          ))}
        </Section>
      )}

      {subTab === 'assignments' && (
        <Section title="Class Assignments">
          {assignments === null && <EmptyState>Loading…</EmptyState>}
          {assignments !== null && assignments.length === 0 && <EmptyState>No active class assignments yet.</EmptyState>}
          {(assignments || []).map((a) => (
            <div key={`${a.groupId}-${a.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>
                  {a.courseCode}{a.courseTitle ? ` — ${a.courseTitle}` : ''}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                  {a.batch?.toUpperCase()} {a.dept} · {a.term} · {(a.teacherUids || []).map((uid) => facultyNameByUid[uid] || uid).join(', ') || 'No teacher yet'}
                </div>
              </div>
            </div>
          ))}
        </Section>
      )}
    </CategoryShell>
  );
}

function CommunicationView({ onBack, onSelectCategory, groups, countCtx }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [showPreview, setShowPreview] = useState(false);
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
      setTitle(''); setBody(''); setShowPreview(false); setSendMsg('Notice sent.');
    } catch (err) {
      setSendMsg(`Failed: ${err?.message || err}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <CategoryShell view="comms" onSelect={onSelectCategory} countCtx={countCtx}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>Communication</h2>
      <Section title="Send a notice">
        <form onSubmit={handleSendNotice} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 480 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Title</label>
            <input type="text" placeholder="e.g. Mid-term routine update" value={title} onChange={(e) => setTitle(e.target.value)}
              style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Message</label>
              <button
                type="button"
                onClick={() => setShowPreview((v) => !v)}
                disabled={!title.trim() && !body.trim()}
                style={{
                  fontSize: 10.5, fontWeight: 700, color: 'var(--accent)', background: 'none', border: 'none',
                  cursor: 'pointer', padding: 0, opacity: (!title.trim() && !body.trim()) ? 0.5 : 1,
                }}
              >
                {showPreview ? 'Back to edit' : 'Preview'}
              </button>
            </div>

            {!showPreview ? (
              <>
                <textarea placeholder={'What do you want to tell them?\n\nLeave a blank line to start a new paragraph.'} value={body} onChange={(e) => setBody(e.target.value)} rows={5}
                  style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)', lineHeight: 1.55, resize: 'vertical' }} />
                <div style={{ fontSize: 10.5, color: 'var(--muted)', lineHeight: 1.4 }}>
                  Blank line = new paragraph. It'll show up formatted and spaced for readers.
                </div>
              </>
            ) : (
              <div style={{
                padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--surface)', fontSize: 13, color: 'var(--text)', lineHeight: 1.55,
                minHeight: 80,
              }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>{title.trim() || <span style={{ color: 'var(--muted)' }}>(no title)</span>}</div>
                {body.trim()
                  ? renderFormattedNoticeBody(body)
                  : <span style={{ color: 'var(--muted)' }}>(nothing written yet)</span>}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Audience</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { key: 'all', label: 'Everyone' },
                { key: 'batch', label: 'One batch' },
                { key: 'group', label: 'One class' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setAudienceType(opt.key)}
                  className="btn btn-sm"
                  style={{
                    background: audienceType === opt.key ? 'var(--accentBg, #eef2ff)' : 'transparent',
                    color: audienceType === opt.key ? 'var(--accent, #4f46e5)' : 'var(--muted)',
                    border: audienceType === opt.key ? '1px solid var(--accent, #4f46e5)' : '1px solid var(--border)',
                    fontWeight: audienceType === opt.key ? 700 : 500,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
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
  const [manualVerifyCount, setManualVerifyCount] = useState(0);
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

  // Previously these three effects (groups, CL applications, roll-unlock
  // requests, email flags) were all gated behind `authorized`, and the
  // two badge-count listener effects below were gated behind `groups` —
  // meaning nothing started until checkIsAdmin resolved, and the ~2×N
  // per-group listeners couldn't even begin until listAllGroups had
  // *also* round-tripped after that. That's what made the grid feel
  // slow even once the page had "loaded": the cards themselves paint
  // instantly, but every badge count sat at 0 through a long serial
  // chain of network legs.
  //
  // These reads don't actually depend on `authorized` being confirmed —
  // Firestore rules are the real gate on whether they succeed — so we
  // fire them immediately, in parallel with the admin check. If the
  // user turns out not to be authorized, `if (!authorized) return null`
  // below still prevents anything from rendering, and the listeners get
  // torn down by their own cleanup on unmount.
  useEffect(() => {
    listAllGroups().then(setGroups).catch(() => setGroups([]));
    return subscribeAllCLApplications(setApplications);
  }, []);

  useEffect(() => subscribePendingRollUnlockRequests(setRollRequests), []);
  useEffect(() => { listPendingFlags({}).then((f) => setEmailFlagCount(f.length)).catch(() => {}); }, []);
  useEffect(() => subscribeManualVerifyRequests((reqs) => setManualVerifyCount(reqs.length)), []);

  // Badge counts for CR + leave requests across all classes, for the
  // Approvals card badge — one subscription per group, kept as a map so
  // updates to one group's count don't require refetching everything.
  // Fires as soon as `groups` arrives, no longer waiting on `authorized`
  // too (see note above).
  useEffect(() => {
    if (!groups) return;
    const unsubs = groups.map((g) => subscribeCRRequests(g.id, (reqs) => {
      setCrCountMap((prev) => ({ ...prev, [g.id]: reqs.length }));
    }));
    return () => unsubs.forEach((u) => u());
  }, [groups]);
  useEffect(() => {
    if (!groups) return;
    const unsubs = groups.map((g) => subscribeLeaveRequests(g.id, (reqs) => {
      setLeaveCountMap((prev) => ({ ...prev, [g.id]: reqs.length }));
    }));
    return () => unsubs.forEach((u) => u());
  }, [groups]);

  // §7 of the merged Faculty Module prompt — fetched here (above the
  // authorized-check early return below) rather than where it's used,
  // since hooks in this component must all run unconditionally on every
  // render, matching every other useState/useEffect above.
  const [facultyList, setFacultyList] = useState(null);
  useEffect(() => {
    listAllFacultyAccounts().then(setFacultyList).catch(() => setFacultyList([]));
  }, []);

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
    manualVerifyRequests: manualVerifyCount,
    emailFlags: emailFlagCount,
    rollRequests: rollRequests.length,
    classCount: groups?.length,
    facultyCount: (facultyList || []).filter((f) => f.verifiedAt).length,
    facultyPending: (facultyList || []).filter((f) => !f.verifiedAt).length,
  };

  const onSelectCategory = (key) => setView(key);
  const onBack = () => setView(null);

  const viewProps = { groups, countCtx, onSelectCategory, onBack };

  if (view === 'approvals') return <ApprovalsView {...viewProps} />;
  if (view === 'staff') return <StaffRolesView {...viewProps} />;
  if (view === 'classes') return <ClassesView {...viewProps} />;
  if (view === 'trust') return <TrustSafetyView {...viewProps} />;
  if (view === 'comms') return <CommunicationView {...viewProps} />;
  if (view === 'faculty') return <FacultyView {...viewProps} />;

  // Top-level grid — fully generated from FOUNDER_CATEGORIES. Adding a
  // category to that registry adds a card here automatically.
  return (
    <div>
      <FounderViewSwitchCard />
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