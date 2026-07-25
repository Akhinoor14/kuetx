import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Building2, CalendarRange, CheckCircle, ChevronRight, Circle, Clock, GraduationCap, LayoutGrid, RefreshCw, Repeat, Trash2, Users } from 'lucide-react';
import { ICONS } from '../lib/iconRegistry';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { auth } from '../lib/firebase';
import { checkIsAdmin } from '../lib/adminAuth';
import {
  listAllGroups, subscribeCRRequests, subscribeLeaveRequests,
  clApproveCRRequest, clRejectCRRequest, clApproveLeaveCR, clRejectLeaveCR,
  getGroupMembersOnce, subscribeGlobalNotices,
} from '../lib/groupSync';
import { sortByRoll } from '../lib/groupUtils';
import { deleteNoticeSoft } from '../lib/noticeUtils';
import NoticeInsightsPanel from '../components/NoticeInsightsPanel';
import NoticeComposerToolbar from '../components/NoticeComposerToolbar';
import NoticePrioritySelector from '../components/NoticePrioritySelector';
import {
  assignRole, removeRole, listStaffByRole, subscribeAllCLApplications,
  approveCLApplication, rejectCLApplication, getStaffDisplayInfoBatch,
  subscribeStaffRoleHistory,
} from '../lib/staffSync';
import { CORE_TEAM_LEAD_ROLES, ROLE_LABELS, ROLE_SCOPE_KIND, ROLES } from '../lib/staffRoles';
import { BLOOD_GROUP_VALUES } from '../store/store';
import { subscribePendingRollUnlockRequests, resolveRollUnlockRequest, dismissRollUnlockRequest } from '../lib/rollOwnership';
import { listPendingFlags, resolveEmailFlag } from '../lib/emailFlags';
import ClassmatesList from '../components/ClassmatesList';
import { renderFormattedNoticeBody } from '../lib/noticeFormat';
import CategorySubNav from '../components/CategorySubNav';
import SubcategoryTabs from '../components/SubcategoryTabs';
import { FOUNDER_CATEGORIES, getFounderCategory, resolveCount, resolveSubtitle } from '../lib/founderCategories';
import { listAllFacultyAccounts, adminVerifyFaculty, adminDeleteFaculty } from '../lib/facultySync';
import { listAllBloodDonors, searchBloodDonorsByGroup } from '../lib/bloodDonorSync';
import { listAllActiveFacultyAssignments } from '../lib/facultyClassSync';
import { useIsFaculty } from '../hooks/useIsFaculty';
import {
  subscribeManualVerifyRequests, approveManualVerifyRequest, rejectManualVerifyRequest,
} from '../lib/manualVerifyRequests';
import { subscribeAllQBUploadRequests, approveQBUpload, rejectQBUpload } from '../lib/qbUploadRequests';
import QBReviewQueue from '../components/QBReviewQueue';
import DeleteRequestQueue from '../components/DeleteRequestQueue';
import QBUploadForm from '../components/QBUploadForm';
import { withTimeout } from '../lib/safeSnapshot';

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
  const Icon = ICONS[category.icon] || Circle;
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
      <ChevronRight size={18} color="var(--muted)" style={{ flexShrink: 0 }} />
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
          <Repeat size={18} color="var(--accent)" />
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
        <RefreshCw size={13} />
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
        categories={FOUNDER_CATEGORIES.filter((cat) => !cat.hidden)}
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
  const [loadWarning, setLoadWarning] = useState('');

  const flagSlowLoad = () => setLoadWarning(
    'Some data is taking longer than usual to load (often a Firestore index still building after a deploy). It will appear automatically once ready — try refreshing in a minute if it doesn\u2019t.'
  );

  useEffect(() => withTimeout((cb) => subscribeAllCLApplications(cb), setClApplications, { onTimeout: flagSlowLoad }), []);
  useEffect(() => withTimeout((cb) => subscribeManualVerifyRequests(cb), setManualVerifyRequests, { onTimeout: flagSlowLoad }), []);
  useEffect(() => { listAllGroups().then((gs) => setGroupIds(gs.map((g) => g.id))); }, []);

  useEffect(() => {
    if (!groupIds) return;
    setCrRequestsByGroup({});
    const unsubs = groupIds.map((g) => withTimeout(
      (cb) => subscribeCRRequests(g, cb),
      (reqs) => setCrRequestsByGroup((prev) => ({ ...(prev || {}), [g]: reqs })),
      { onTimeout: flagSlowLoad }
    ));
    return () => unsubs.forEach((u) => u());
  }, [groupIds]);

  useEffect(() => {
    if (!groupIds) return;
    setLeaveRequestsByGroup({});
    const unsubs = groupIds.map((g) => withTimeout(
      (cb) => subscribeLeaveRequests(g, cb),
      (reqs) => setLeaveRequestsByGroup((prev) => ({ ...(prev || {}), [g]: reqs })),
      { onTimeout: flagSlowLoad }
    ));
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
      {loadWarning && (
        <div style={{ fontSize: 12, color: 'var(--warn, #b45309)', background: 'var(--warn-bg, #fef3c7)', padding: '8px 10px', borderRadius: 8, marginBottom: 10 }}>
          {loadWarning}
        </div>
      )}
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

// Shown when tapping a staff holder's name in "Current role holders" —
// a full page (not a small popup) with their full detail plus a real
// activity timeline. The timeline is `staffRoleHistory` (see
// logRoleHistoryEntry/subscribeStaffRoleHistory in staffSync.js) — every
// role assign/revoke event for this uid, across every role they've ever
// held, newest first. That's the only genuine per-person audit trail
// that exists anywhere in the app (there's no log of day-to-day staff
// dashboard actions, e.g. approvals clicked or notices sent — inventing
// one here would just be fake data, so this shows what's real: their
// role history) — already being written on every assign/revoke, just
// never surfaced anywhere until now.
function StaffHolderDetailPage({ holder, onClose }) {
  const info = holder.info || {};
  const scopeLabel = holder.scope?.dept || holder.scope?.groupId
    ? (holder.scope?.dept ? `Department: ${holder.scope.dept}` : `Class: ${holder.scope.groupId}`)
    : 'Global (no department/class scope)';

  const [history, setHistory] = useState(null);
  useEffect(() => subscribeStaffRoleHistory(holder.uid, setHistory), [holder.uid]);

  const formatWhen = (ts) => {
    if (!ts?.toDate) return '—';
    try {
      return ts.toDate().toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return '—'; }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'var(--bg, var(--card))', zIndex: 9999,
        overflowY: 'auto', display: 'flex', flexDirection: 'column',
      }}
    >
      <div style={{
        position: 'sticky', top: 0, zIndex: 1, background: 'var(--card)', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px',
      }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', display: 'flex', alignItems: 'center' }}>
          <ArrowLeft size={20} />
        </button>
        <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>{info.name || 'Unnamed holder'}</div>
      </div>

      <div style={{ maxWidth: 640, width: '100%', margin: '0 auto', padding: '20px 20px 60px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, padding: 16, borderRadius: 14,
          border: '1px solid var(--border)', background: 'var(--surface, var(--card))', marginBottom: 20,
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
            background: 'color-mix(in srgb, var(--accent) 15%, var(--surface))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 20, color: 'var(--accent)',
          }}>
            {(info.name || '?').trim().charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--text)' }}>{info.name || 'Unnamed holder'}</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{ROLE_LABELS[holder.role] || holder.role}</div>
          </div>
        </div>

        <Section title="Details">
          <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', padding: '0 12px' }}>
            <DetailRow label="Staff position" value={ROLE_LABELS[holder.role] || holder.role} />
            <div style={{ height: 1, background: 'var(--border)' }} />
            <DetailRow label="Scope" value={scopeLabel} />
            {info.roll && (<><div style={{ height: 1, background: 'var(--border)' }} /><DetailRow label="Roll" value={info.roll} /></>)}
            {info.dept && (<><div style={{ height: 1, background: 'var(--border)' }} /><DetailRow label="Department" value={info.dept} /></>)}
            {info.batch && (<><div style={{ height: 1, background: 'var(--border)' }} /><DetailRow label="Batch" value={info.batch} /></>)}
            {info.groupId && (<><div style={{ height: 1, background: 'var(--border)' }} /><DetailRow label="Class" value={info.groupId} /></>)}
            {info.memberRole && (
              <>
                <div style={{ height: 1, background: 'var(--border)' }} />
                <DetailRow label="Class role" value={info.memberRole === 'cr' ? 'Class Representative (CR)' : info.memberRole === 'acr' ? 'Assistant CR (ACR)' : 'Member'} />
              </>
            )}
            <div style={{ height: 1, background: 'var(--border)' }} />
            <DetailRow label="Verified" value={info.verified ? 'Yes' : 'No'} />
            <div style={{ height: 1, background: 'var(--border)' }} />
            <DetailRow label="UID" value={holder.uid} mono />
          </div>
        </Section>

        <div style={{ height: 20 }} />

        <Section title="Role activity">
          <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '0 0 10px' }}>
            Every role assigned or revoked for this person, across every role they've ever held — newest first.
          </p>
          {history === null && <EmptyState>Loading…</EmptyState>}
          {history?.length === 0 && <EmptyState>No role history recorded yet.</EmptyState>}
          {history?.map((h) => (
            <div key={h.id} style={{
              display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)',
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%', marginTop: 5, flexShrink: 0,
                background: h.event === 'revoked' ? 'var(--danger)' : 'var(--accent)',
              }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                  {h.event === 'revoked' ? 'Role revoked' : 'Role assigned'} — {ROLE_LABELS[h.role] || h.role}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{formatWhen(h.at)}</div>
              </div>
            </div>
          ))}
        </Section>
      </div>
    </div>
  );
}

function DetailRow({ label, value, href, mono }) {
  if (!value) return null;
  const content = href
    ? <a href={href} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{value}</a>
    : value;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', alignItems: 'flex-start' }}>
      <div style={{ fontSize: 12, color: 'var(--muted)', flexShrink: 0 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', textAlign: 'right', wordBreak: 'break-word', fontFamily: mono ? 'monospace' : 'inherit' }}>
        {content}
      </div>
    </div>
  );
}

// =======================================================================
// QUESTION BANK — Founder's own upload panel (any dept, auto-published),
// the review queue for Campus Lead submissions, and pending delete
// requests. Previously buried as a subtab inside Approvals; split out
// into its own top-level category since it's a distinct, frequent
// workflow, not an approvals inbox item.
// =======================================================================
function QuestionBankView({ onBack, onSelectCategory, countCtx }) {
  const [subTab, setSubTab] = useState('upload');
  const category = getFounderCategory('question-bank');

  return (
    <CategoryShell view="question-bank" onSelect={onSelectCategory} countCtx={countCtx}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>Question Bank</h2>
      <SubcategoryTabs subcategories={category.subcategories} activeKey={subTab} onSelect={setSubTab} countCtx={countCtx} />

      {subTab === 'upload' && (
        <Section title="Upload a paper (any department — auto-published, no review)">
          <QBUploadForm isFounder onUploaded={() => {}} />
        </Section>
      )}

      {subTab === 'review' && (
        <Section title="Pending review (Campus Lead submissions)">
          <QBReviewQueue all />
        </Section>
      )}

      {subTab === 'delete-requests' && (
        <Section title="Pending delete requests">
          <DeleteRequestQueue />
        </Section>
      )}
    </CategoryShell>
  );
}

function StaffRolesView({ onBack, onSelectCategory, groups, countCtx }) {
  const [subTab, setSubTab] = useState('assign');
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
  const [selectedHolder, setSelectedHolder] = useState(null);

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
        {holdersLoading && <EmptyState>Loading current role holders…</EmptyState>}
        {!holdersLoading && totalHolders === 0 && <EmptyState>No one holds a staff role yet.</EmptyState>}
        {!holdersLoading && totalHolders > 0 && (
          <>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>
              Founder can revoke any holder below. A person holding multiple roles appears once per role. Tap a name for full details.
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
                  const resolvedName = info?.name;
                  const label = resolvedName || 'Unnamed holder';
                  return (
                    <div key={`${r}-${h.id}`} className="staff-holder-card">
                      <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                        {ROLE_LABELS[r]}
                      </div>
                      <button
                        onClick={() => setSelectedHolder({ ...h, role: r, info })}
                        title={resolvedName ? `View full details — ${resolvedName}` : `View full details — uid ${h.uid}`}
                        style={{
                          all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, width: '100%', minWidth: 0,
                        }}
                      >
                        <div style={{
                          width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                          background: 'color-mix(in srgb, var(--accent) 15%, var(--surface))',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 800, fontSize: 12.5, color: 'var(--accent)',
                        }}>
                          {label.trim().charAt(0).toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{
                            fontSize: 13, fontWeight: 700, color: resolvedName ? 'var(--text)' : 'var(--muted)',
                            fontStyle: resolvedName ? 'normal' : 'italic',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>
                            {label}
                          </div>
                          {info?.roll && (
                            <div style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{info.roll}</div>
                          )}
                        </div>
                      </button>
                      {(h.scope?.dept || h.scope?.groupId) && (
                        <div style={{
                          fontSize: 11, color: 'var(--muted)', marginTop: 8, padding: '3px 8px', borderRadius: 999,
                          background: 'var(--surface)', border: '1px solid var(--border)', display: 'inline-block',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
                        }}>
                          {h.scope?.dept || h.scope?.groupId}
                        </div>
                      )}
                      <button
                        className="btn btn-sm btn-secondary"
                        title="Revoke this role from the holder"
                        onClick={async () => { await removeRole(h.uid, h.role, h.scope); refreshHolders(r); }}
                        style={{ marginTop: 10, width: '100%' }}
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
      )}

      {selectedHolder && (
        <StaffHolderDetailPage holder={selectedHolder} onClose={() => setSelectedHolder(null)} />
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
          <ChevronRight size={13} color="var(--muted)" />
          <button onClick={() => onBatch(null)}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: batch ? 'var(--muted)' : 'var(--text)', fontWeight: batch ? 500 : 700 }}>
            {dept}
          </button>
        </>
      )}
      {batch && (
        <>
          <ChevronRight size={13} color="var(--muted)" />
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

  // Summary stats for the top-of-page cards (only shown at the
  // dept/batch-not-yet-selected root level, alongside the dept grid).
  // "Total Class" = total groups/batches (each dept+batch pair is one
  // class, e.g. CSE 2K23), same number the existing subtitle already
  // uses. "Total Batch" is a DIFFERENT count — unique batch/year values
  // only (e.g. 2K23, 2K24), collapsing across departments, so CSE 2K23
  // and ECE 2K23 count once, not twice. "Total Student" sums every
  // group's live member count once memberCounts has loaded.
  const totalClasses = groups?.length ?? null;
  const totalBatches = useMemo(() => {
    if (!groups) return null;
    const years = new Set(groups.map((g) => parseGroupId(g.id).batch));
    return years.size;
  }, [groups]);
  const totalStudents = useMemo(() => {
    if (!memberCounts) return null;
    return Object.values(memberCounts).reduce((sum, c) => sum + (c || 0), 0);
  }, [memberCounts]);

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
                  {count != null && `${count} students`} <ChevronRight size={14} />
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
                  {count != null ? `${count} students` : '\u00A0'} <ChevronRight size={12} style={{ marginLeft: 'auto' }} />
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
                <ChevronRight size={12} style={{ marginLeft: 'auto' }} />
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
      {!dept && !batch && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{
            flex: '1 1 160px', padding: 16, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--card)',
          }}>
            <LayoutGrid size={18} color="var(--accent)" style={{ marginBottom: 8 }} />
            <div style={{ fontWeight: 800, fontSize: 22, color: 'var(--text)' }}>{totalClasses ?? '—'}</div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Total Class</div>
          </div>
          <div style={{
            flex: '1 1 160px', padding: 16, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--card)',
          }}>
            <CalendarRange size={18} color="var(--accent)" style={{ marginBottom: 8 }} />
            <div style={{ fontWeight: 800, fontSize: 22, color: 'var(--text)' }}>{totalBatches ?? '—'}</div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Total Batch</div>
          </div>
          <div style={{
            flex: '1 1 160px', padding: 16, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--card)',
          }}>
            <Users size={18} color="var(--accent)" style={{ marginBottom: 8 }} />
            <div style={{ fontWeight: 800, fontSize: 22, color: 'var(--text)' }}>{totalStudents ?? '—'}</div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Total Student</div>
          </div>
        </div>
      )}
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
  // uid -> true while an admin-verify click is in flight, so the button
  // shows a spinner/disabled state and can't be double-clicked.
  const [verifying, setVerifying] = useState({});
  // Separate from `verifying` — a row can only be doing one of these at
  // once anyway, but keeping them as two maps avoids one action's button
  // disabling based on the other's in-flight state by accident.
  const [deleting, setDeleting] = useState({});
  // Surfaces the real reason "Class Assignments" is empty — this query is
  // a collectionGroup query with a composite index requirement (status +
  // createdAt); if that index hasn't been deployed to the live Firebase
  // project yet, Firestore throws instead of returning results, and the
  // error carries a direct "create this index" console link. Silently
  // swallowing that into an empty array (the old behavior) made a config
  // problem look identical to "no teacher has added a class yet" — with
  // real assignment data already existing, that's misleading, not benign.
  const [assignmentsError, setAssignmentsError] = useState(null);

  const reloadFaculty = () => listAllFacultyAccounts().then(setFacultyList).catch(() => setFacultyList([]));

  useEffect(() => {
    reloadFaculty();
  }, []);

  // Only fetched once the Assignments sub-tab is actually opened — this is
  // a collectionGroup query (genuinely necessary here, see
  // listAllActiveFacultyAssignments()'s own comment for why it's an
  // exception to this module's usual avoid-collectionGroup rule), no
  // reason to pay that cost for Admins who only ever look at Directory/
  // Pending.
  useEffect(() => {
    if (subTab !== 'assignments' || assignments !== null) return;
    setAssignmentsError(null);
    listAllActiveFacultyAssignments()
      .then(setAssignments)
      .catch((err) => {
        console.error('[Founder] failed to load faculty class assignments:', err);
        setAssignments([]);
        setAssignmentsError(err?.message || 'Failed to load class assignments.');
      });
  }, [subTab, assignments]);

  const loading = facultyList === null;
  const verified = (facultyList || []).filter((f) => f.verifiedAt);
  const pending = (facultyList || []).filter((f) => !f.verifiedAt);
  const facultyNameByUid = Object.fromEntries((facultyList || []).map((f) => [f.uid, f.name || f.officialEmail]));

  // listAllFacultyAccounts() is a plain one-shot read (not live), so a
  // successful verify click won't move the account from Pending to
  // Directory on its own — refetch right after so the list reflects the
  // change immediately instead of looking like the click did nothing.
  const handleVerify = async (uid) => {
    setVerifying((prev) => ({ ...prev, [uid]: true }));
    try {
      await adminVerifyFaculty(uid);
      await reloadFaculty();
    } catch (e) {
      alert(e?.message || 'Could not verify this account. Please try again.');
    } finally {
      setVerifying((prev) => {
        const next = { ...prev };
        delete next[uid];
        return next;
      });
    }
  };

  const handleDelete = async (f) => {
    const label = f.name || f.officialEmail || 'this account';
    if (!window.confirm(`Remove ${label} from Faculty? This can't be undone — they'd need to sign up and be verified again.`)) return;
    setDeleting((prev) => ({ ...prev, [f.uid]: true }));
    try {
      await adminDeleteFaculty(f.uid);
      await reloadFaculty();
    } catch (e) {
      alert(e?.message || 'Could not remove this account. Please try again.');
    } finally {
      setDeleting((prev) => {
        const next = { ...prev };
        delete next[f.uid];
        return next;
      });
    }
  };

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
              <GraduationCap size={18} color="var(--accent)" style={{ marginBottom: 8 }} />
              <div style={{ fontWeight: 800, fontSize: 22, color: 'var(--text)' }}>{loading ? '—' : verified.length}</div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Total Teachers</div>
            </div>
            <div style={{
              flex: '1 1 160px', padding: 16, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--card)',
            }}>
              <Building2 size={18} color="var(--accent)" style={{ marginBottom: 8 }} />
              <div style={{ fontWeight: 800, fontSize: 22, color: 'var(--text)' }}>{loading ? '—' : Object.keys(deptCounts).length}</div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Departments Represented</div>
            </div>
            <div style={{
              flex: '1 1 160px', padding: 16, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--card)',
            }}>
              <Clock size={18} color="var(--accent)" style={{ marginBottom: 8 }} />
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
            {verified.map((f) => {
              const isDeleting = !!deleting[f.uid];
              return (
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
                <button
                  onClick={() => handleDelete(f)}
                  disabled={isDeleting}
                  className="btn btn-sm btn-secondary"
                  title="Remove this faculty account (e.g. mistakenly approved)"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, opacity: isDeleting ? 0.6 : 1, color: 'var(--danger)' }}
                >
                  <Trash2 size={14} />
                  {isDeleting ? 'Removing…' : 'Remove'}
                </button>
              </div>
              );
            })}
          </Section>
        </>
      )}

      {subTab === 'pending' && (
        <Section title="Accounts awaiting Blue Tick verification">
          {loading && <EmptyState>Loading…</EmptyState>}
          {!loading && pending.length === 0 && <EmptyState>Nothing pending.</EmptyState>}
          {pending.map((f) => {
            const hasProfile = String(f.name || '').trim() || String(f.title || '').trim() || String(f.dept || '').trim();
            const isVerifying = !!verifying[f.uid];
            const isDeleting = !!deleting[f.uid];
            return (
              <div key={f.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, padding: '12px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  {/* Name/title/dept show up here once the account has
                      completed FacultyProfileSetupModal — profile setup
                      is unconditional (doesn't wait on Admin approval),
                      so most Pending accounts already have this filled
                      in by the time an Admin looks at this tab. Falls
                      back to just the email for a brand-new account that
                      hasn't reached profile setup yet. */}
                  {hasProfile ? (
                    <>
                      <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)' }}>
                        {f.name || 'Unnamed'}
                        {f.title && <span style={{ fontWeight: 500, color: 'var(--muted)' }}> · {f.title}</span>}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                        {f.dept && <span>{f.dept} · </span>}
                        <span style={{ wordBreak: 'break-all' }}>{f.officialEmail}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontWeight: 600, fontSize: 13, wordBreak: 'break-all' }}>{f.officialEmail}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>Account created, profile not filled in yet</div>
                    </>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => handleVerify(f.uid)}
                    disabled={isVerifying || isDeleting}
                    className="btn btn-primary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: isVerifying ? 0.6 : 1 }}
                  >
                    <CheckCircle size={14} />
                    {isVerifying ? 'Verifying…' : 'Verify'}
                  </button>
                  <button
                    onClick={() => handleDelete(f)}
                    disabled={isVerifying || isDeleting}
                    className="btn btn-sm btn-secondary"
                    title="Remove this signup request"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: isDeleting ? 0.6 : 1, color: 'var(--danger)' }}
                  >
                    <Trash2 size={14} />
                    {isDeleting ? 'Removing…' : 'Remove'}
                  </button>
                </div>
              </div>
            );
          })}
        </Section>
      )}

      {subTab === 'assignments' && (
        <Section title="Class Assignments">
          {assignmentsError && (
            <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 10, lineHeight: 1.5 }}>
              {assignmentsError.includes('index')
                ? <>Couldn't load class assignments — Firestore needs a composite index for this query that hasn't been created yet. {assignmentsError.includes('http') ? 'Check the browser console for a direct "create index" link from Firebase.' : ''}</>
                : <>Couldn't load class assignments: {assignmentsError}</>}
              <button
                className="btn btn-sm btn-secondary"
                style={{ display: 'block', marginTop: 8 }}
                onClick={() => setAssignments(null)}
              >
                Retry
              </button>
            </div>
          )}
          {assignments === null && <EmptyState>Loading…</EmptyState>}
          {assignments !== null && assignments.length === 0 && !assignmentsError && <EmptyState>No active class assignments yet.</EmptyState>}
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


// =======================================================================
// BLOOD BANK — Founder searches by blood group; results show name, roll,
// and department for every matching student. Backed by the separate
// bloodDonors/{uid} collection (see bloodDonorSync.js) rather than the
// personal per-user profile store, which isn't queryable across students.
// =======================================================================
function BloodBankView({ onBack, onSelectCategory, countCtx }) {
  const [selectedGroup, setSelectedGroup] = useState('');
  const [results, setResults] = useState(null); // null = no search run yet
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  // All donors fetched once (cheap — this collection is small, one doc
  // per student with a blood group on file) so every group button can
  // show its own live count without firing 8 separate queries.
  const [allDonors, setAllDonors] = useState(null);

  useEffect(() => {
    listAllBloodDonors().then(setAllDonors).catch(() => setAllDonors([]));
  }, []);

  const countsByGroup = useMemo(() => {
    const counts = {};
    (allDonors || []).forEach((d) => {
      const bg = String(d.bloodGroup || '').trim().toUpperCase();
      if (bg) counts[bg] = (counts[bg] || 0) + 1;
    });
    return counts;
  }, [allDonors]);

  const runSearch = async (bg) => {
    setSelectedGroup(bg);
    if (!bg) { setResults(null); return; }
    setSearching(true);
    setError('');
    try {
      const donors = await searchBloodDonorsByGroup(bg);
      setResults(donors.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
    } catch (err) {
      setError(err?.message || 'Search failed.');
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <CategoryShell view="blood" onSelect={onSelectCategory} countCtx={countCtx}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px' }}>Blood Bank</h2>
      <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 16px' }}>
        {countCtx.bloodDonorCount ?? '…'} students have a blood group on file. Search one to see who's available.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
        {BLOOD_GROUP_VALUES.map((bg) => (
          <button
            key={bg}
            type="button"
            onClick={() => runSearch(bg)}
            style={{
              padding: '10px 18px', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer',
              border: selectedGroup === bg ? '1px solid var(--accent)' : '1px solid var(--border)',
              background: selectedGroup === bg ? 'color-mix(in srgb, var(--accent) 14%, var(--surface))' : 'var(--card)',
              color: selectedGroup === bg ? 'var(--accent)' : 'var(--text)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 64,
            }}
          >
            <span>{bg}</span>
            <span style={{ fontSize: 10.5, fontWeight: 700, opacity: 0.7 }}>
              {allDonors === null ? '…' : (countsByGroup[bg] || 0)}
            </span>
          </button>
        ))}
      </div>

      {error && <div style={{ fontSize: 12.5, color: 'var(--danger)', marginBottom: 12 }}>{error}</div>}

      {!selectedGroup && <EmptyState>Pick a blood group above to search.</EmptyState>}

      {selectedGroup && (
        <Section title={`${selectedGroup} · ${searching ? '…' : (results || []).length} found`}>
          {searching && <EmptyState>Searching…</EmptyState>}
          {!searching && (results || []).length === 0 && <EmptyState>No students with {selectedGroup} on file yet.</EmptyState>}
          {!searching && (results || []).map((donor) => (
            <div key={donor.uid} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px', borderBottom: '1px solid var(--border)',
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                background: 'color-mix(in srgb, var(--danger, #dc2626) 14%, var(--surface))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 13, color: 'var(--danger, #dc2626)',
              }}>
                {donor.bloodGroup}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)' }}>{donor.name || 'Unnamed'}</div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                  <span>Roll {donor.studentId || '—'}</span>
                  <span>·</span>
                  <span>{donor.dept || '—'}</span>
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
  const noticeTextareaRef = useRef(null);
  const [priority, setPriority] = useState('normal');
  const [audienceType, setAudienceType] = useState('all');
  const [batchInput, setBatchInput] = useState('');
  const [groupInput, setGroupInput] = useState('');
  // Individual/role-based targeting (handoff item 3). audienceType stays
  // the top-level pill row ('all' | 'batch' | 'group' | 'students' |
  // 'faculty'); studentPickMode/facultyPickMode are the sub-choices under
  // 'students'/'faculty' respectively.
  const [studentPickMode, setStudentPickMode] = useState('batch'); // 'batch' | 'individuals'
  const [facultyPickMode, setFacultyPickMode] = useState('all'); // 'all' | 'individuals'
  const [pickerDept, setPickerDept] = useState('');
  const [pickerBatch, setPickerBatch] = useState('');
  const [pickerMembers, setPickerMembers] = useState(null); // null = not loaded, [] = loaded empty
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentUids, setSelectedStudentUids] = useState(() => new Set());
  const [facultyAccounts, setFacultyAccounts] = useState(null);
  const [facultySearch, setFacultySearch] = useState('');
  const [selectedFacultyUids, setSelectedFacultyUids] = useState(() => new Set());
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState('');

  // Phase 2 of the Notice upgrade: this Founder/Admin's own sent root
  // notices, for the Manage/Delete + Insights UI below. subscribeGlobalNotices
  // returns every root notice (not scoped to a group), so filter to
  // createdBy.uid === the signed-in admin — matches the same self-only
  // scoping firestore.rules' new reads/{uid} READ rule already applies
  // (a non-sender Admin/HeadOfOps CAN read another admin's stats via
  // isAdmin()/isHeadOfOps(), but this list only shows "MY sent notices"
  // for a focused Manage view, same as the CR/ACR and Teacher surfaces).
  const [sentNotices, setSentNotices] = useState([]);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setSentNotices([]); return; }
    return subscribeGlobalNotices((notices) => {
      setSentNotices(
        notices
          // Phase 2 follow-up: keep the admin's own soft-deleted notices
          // visible here (as an audit trail, with a "Deleted" tag in the
          // render below) rather than filtering them out — only the
          // student-facing merged feed (subscribeAllNotices's emit())
          // hides deleted:true notices.
          .filter((n) => n.createdBy?.uid === uid)
          .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)),
      );
    });
  }, []);

  // Dept -> batch options derived from the groups prop (same parseGroupId
  // pattern ClassesView already uses above) — feeds the individual-student
  // picker's dept select, then that dept's batch select.
  const deptBatchMap = useMemo(() => {
    const map = {};
    (groups || []).forEach((g) => {
      const { batch: b, dept: d } = parseGroupId(g.id);
      if (!d) return;
      if (!map[d]) map[d] = new Set();
      map[d].add(b);
    });
    const out = {};
    Object.keys(map).sort().forEach((d) => { out[d] = [...map[d]].sort(); });
    return out;
  }, [groups]);
  const pickerDepts = Object.keys(deptBatchMap);
  const pickerBatches = pickerDept ? (deptBatchMap[pickerDept] || []) : [];

  // Individual-student picker: fetch this dept+batch's member list once
  // both dept and batch are chosen. Reuses getGroupMembersOnce the same
  // way computeAudienceSize does above — groupId is `${batch}_${dept}`
  // (see parseGroupId's reverse). Roll-sorted via the shared sortByRoll
  // (groupUtils.js), same sorter FacultyClassDetail.jsx's roster tabs use.
  useEffect(() => {
    if (audienceType !== 'students' || studentPickMode !== 'individuals' || !pickerDept || !pickerBatch) {
      setPickerMembers(null);
      return;
    }
    let cancelled = false;
    setPickerMembers(null);
    getGroupMembersOnce(`${pickerBatch}_${pickerDept}`).then((members) => {
      if (cancelled) return;
      setPickerMembers(sortByRoll(members));
    }).catch(() => { if (!cancelled) setPickerMembers([]); });
    return () => { cancelled = true; };
  }, [audienceType, studentPickMode, pickerDept, pickerBatch]);

  // Individual-faculty picker: fetch the full faculty/{uid} collection
  // once, only when the faculty-individuals mode is actually selected —
  // no reason to pay this query on every CommunicationView mount.
  useEffect(() => {
    if (audienceType !== 'faculty' || facultyPickMode !== 'individuals') return;
    if (facultyAccounts !== null) return; // already loaded once this mount
    let cancelled = false;
    listAllFacultyAccounts().then((accounts) => {
      if (cancelled) return;
      setFacultyAccounts(accounts.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
    }).catch(() => { if (!cancelled) setFacultyAccounts([]); });
    return () => { cancelled = true; };
  }, [audienceType, facultyPickMode, facultyAccounts]);

  const toggleStudentUid = (uid) => {
    setSelectedStudentUids((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
  };
  const toggleFacultyUid = (uid) => {
    setSelectedFacultyUids((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
  };

  const handleDeleteNotice = async (noticeId) => {
    if (!window.confirm('Delete this notice? It will be removed from everyone\'s feed.')) return;
    setDeletingId(noticeId);
    try {
      await deleteNoticeSoft(noticeId, null);
    } catch (err) {
      setSendMsg(`Failed to delete: ${err?.message || err}`);
    } finally {
      setDeletingId(null);
    }
  };

  // Phase 1 of the Notice upgrade: audienceSize at send time, so the
  // Insights panel (Phase 2) never has to retroactively guess reach for
  // an already-sent notice. Reuses listAllGroups/getGroupMembersOnce —
  // the same functions ClassesView already uses for its "Total Student"
  // card above — rather than scanning the whole `users` collection,
  // since group membership (verified: true) IS the real notice-reach
  // population for every audience type here.
  //
  // 'all' -> every verified member across every group.
  // 'batch' -> every verified member across every group in that batch
  //   (a batch can span >1 group/dept, so this is NOT just one group's
  //   member count — see byDept/parseGroupId above for why one batch can
  //   map to several dept groups).
  // 'group' -> that one group's verified member count.
  // 'student_uids' / 'faculty_uids' -> just uids.length, no query needed —
  //   the uids array IS the exact audience, unlike the population-level
  //   types above where we have to count group membership.
  // 'faculty_all' -> handoff item 3 didn't ask for a Reach count for this
  //   one specifically (a verified-faculty count would need a query over
  //   the faculty/{uid} collection filtering verifiedAt != null); left as
  //   null (Insights panel already handles null gracefully) rather than
  //   guessing at a definition of "reach" for this audience.
  //
  // Best-effort: any failure here must never block sending the notice —
  // falls back to omitting audienceSize entirely, and the UI shows
  // "Reach data not available" for notices missing this field.
  const computeAudienceSize = async (aud) => {
    if (aud.type === 'student_uids' || aud.type === 'faculty_uids') {
      return Array.isArray(aud.uids) ? aud.uids.length : null;
    }
    if (aud.type === 'faculty_all') return null;
    try {
      const allGroups = await listAllGroups();
      if (aud.type === 'group') {
        const members = await getGroupMembersOnce(aud.groupId);
        return members.filter((m) => m.verified === true).length;
      }
      const targetGroups = aud.type === 'batch'
        ? allGroups.filter((g) => parseGroupId(g.id).batch === aud.batch)
        : allGroups;
      const counts = await Promise.all(
        targetGroups.map(async (g) => (await getGroupMembersOnce(g.id)).filter((m) => m.verified === true).length),
      );
      return counts.reduce((sum, c) => sum + c, 0);
    } catch {
      return null;
    }
  };

  const handleSendNotice = async (e) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    let audience = { type: 'all' };
    if (audienceType === 'batch') audience = { type: 'batch', batch: batchInput.trim().toUpperCase() };
    if (audienceType === 'group') audience = { type: 'group', groupId: groupInput.trim().toUpperCase() };
    if (audienceType === 'students') {
      if (studentPickMode === 'batch') {
        audience = { type: 'batch', batch: batchInput.trim().toUpperCase() };
      } else {
        const uids = [...selectedStudentUids];
        if (uids.length === 0) { setSendMsg('Pick at least one student first.'); return; }
        if (uids.length > 300) { setSendMsg(`Too many students selected (${uids.length}). Individual targeting is capped at 300 — use "A whole batch" instead for larger groups.`); return; }
        audience = { type: 'student_uids', uids };
      }
    }
    if (audienceType === 'faculty') {
      if (facultyPickMode === 'all') {
        audience = { type: 'faculty_all' };
      } else {
        const uids = [...selectedFacultyUids];
        if (uids.length === 0) { setSendMsg('Pick at least one faculty member first.'); return; }
        if (uids.length > 300) { setSendMsg(`Too many faculty selected (${uids.length}). Individual targeting is capped at 300 — use "All faculty" instead for larger groups.`); return; }
        audience = { type: 'faculty_uids', uids };
      }
    }
    setSending(true);
    setSendMsg('');
    try {
      const audienceSize = await computeAudienceSize(audience);
      await addDoc(collection(db, 'notices'), {
        title: title.trim(), body: body.trim(), audience,
        createdBy: { uid: auth.currentUser.uid, name: 'Founder' },
        createdAt: serverTimestamp(),
        // Phase 4 of the Notice upgrade: optional priority, defaults to
        // 'normal' — see postGroupNotice in groupSync.js for the same
        // pattern/reasoning.
        priority,
        ...(audienceSize !== null ? { audienceSize } : {}),
      });
      setTitle(''); setBody(''); setShowPreview(false); setPriority('normal'); setSendMsg('Notice sent.');
      setSelectedStudentUids(new Set());
      setSelectedFacultyUids(new Set());
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
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Priority</label>
            <NoticePrioritySelector value={priority} onChange={setPriority} />
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
                <NoticeComposerToolbar
                  textareaRef={noticeTextareaRef}
                  value={body}
                  onChange={setBody}
                />
                <textarea ref={noticeTextareaRef} placeholder={'What do you want to tell them?\n\nLeave a blank line to start a new paragraph.'} value={body} onChange={(e) => setBody(e.target.value)} rows={5}
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
                { key: 'students', label: 'Specific students' },
                { key: 'faculty', label: 'Faculty' },
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

          {audienceType === 'students' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { key: 'batch', label: 'A whole batch' },
                  { key: 'individuals', label: 'Pick individuals' },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setStudentPickMode(opt.key)}
                    className="btn btn-sm"
                    style={{
                      background: studentPickMode === opt.key ? 'var(--accentBg, #eef2ff)' : 'transparent',
                      color: studentPickMode === opt.key ? 'var(--accent, #4f46e5)' : 'var(--muted)',
                      border: studentPickMode === opt.key ? '1px solid var(--accent, #4f46e5)' : '1px solid var(--border)',
                      fontWeight: studentPickMode === opt.key ? 700 : 500,
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {studentPickMode === 'batch' && (
                <input type="text" placeholder="Batch, e.g. 2K23" value={batchInput} onChange={(e) => setBatchInput(e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)' }} />
              )}

              {studentPickMode === 'individuals' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <select
                      value={pickerDept}
                      onChange={(e) => { setPickerDept(e.target.value); setPickerBatch(''); setSelectedStudentUids(new Set()); setStudentSearch(''); }}
                      style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)' }}
                    >
                      <option value="">Department…</option>
                      {pickerDepts.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <select
                      value={pickerBatch}
                      onChange={(e) => { setPickerBatch(e.target.value); setSelectedStudentUids(new Set()); setStudentSearch(''); }}
                      disabled={!pickerDept}
                      style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)', opacity: pickerDept ? 1 : 0.6 }}
                    >
                      <option value="">Batch…</option>
                      {pickerBatches.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>

                  {pickerDept && pickerBatch && pickerMembers !== null && pickerMembers.length > 0 && (
                    <input
                      type="text"
                      placeholder="Search by name or roll…"
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)' }}
                    />
                  )}

                  {pickerDept && pickerBatch && (
                    <div style={{ border: '1px solid var(--border)', borderRadius: 8, maxHeight: 260, overflowY: 'auto' }}>
                      {pickerMembers === null && (
                        <div style={{ padding: 12, fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>Loading students…</div>
                      )}
                      {pickerMembers !== null && pickerMembers.length === 0 && (
                        <div style={{ padding: 12, fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>No students in this batch yet.</div>
                      )}
                      {pickerMembers !== null && pickerMembers.length > 0
                        && pickerMembers.filter((m) => {
                          const q = studentSearch.trim().toLowerCase();
                          if (!q) return true;
                          return (m.name || '').toLowerCase().includes(q) || (m.roll || '').toLowerCase().includes(q);
                        }).length === 0 && (
                        <div style={{ padding: 12, fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>No matches.</div>
                      )}
                      {pickerMembers
                        ?.filter((m) => {
                          const q = studentSearch.trim().toLowerCase();
                          if (!q) return true;
                          return (m.name || '').toLowerCase().includes(q) || (m.roll || '').toLowerCase().includes(q);
                        })
                        .map((m) => (
                        <label
                          key={m.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                            borderBottom: '1px solid var(--border)', cursor: 'pointer', fontSize: 12.5,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedStudentUids.has(m.id)}
                            onChange={() => toggleStudentUid(m.id)}
                          />
                          <span style={{ color: 'var(--muted)', minWidth: 56, flexShrink: 0 }}>{m.roll || '—'}</span>
                          <span style={{ color: 'var(--text)', flex: 1 }}>{m.name || 'Unnamed'}</span>
                          {!m.verified && (
                            <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--muted)', padding: '1px 5px', borderRadius: 4, border: '1px solid var(--border)' }}>Unverified</span>
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                  {selectedStudentUids.size > 0 && (
                    <div style={{ fontSize: 11.5, color: selectedStudentUids.size > 300 ? '#dc2626' : 'var(--accent)', fontWeight: 700 }}>
                      {selectedStudentUids.size} student{selectedStudentUids.size === 1 ? '' : 's'} selected
                      {selectedStudentUids.size > 300 ? ' — over the 300 limit, use "A whole batch" instead' : ''}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {audienceType === 'faculty' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { key: 'all', label: 'All faculty' },
                  { key: 'individuals', label: 'Pick individuals' },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setFacultyPickMode(opt.key)}
                    className="btn btn-sm"
                    style={{
                      background: facultyPickMode === opt.key ? 'var(--accentBg, #eef2ff)' : 'transparent',
                      color: facultyPickMode === opt.key ? 'var(--accent, #4f46e5)' : 'var(--muted)',
                      border: facultyPickMode === opt.key ? '1px solid var(--accent, #4f46e5)' : '1px solid var(--border)',
                      fontWeight: facultyPickMode === opt.key ? 700 : 500,
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {facultyPickMode === 'individuals' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input
                    type="text"
                    placeholder="Search by name…"
                    value={facultySearch}
                    onChange={(e) => setFacultySearch(e.target.value)}
                    style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)' }}
                  />
                  <div style={{ border: '1px solid var(--border)', borderRadius: 8, maxHeight: 260, overflowY: 'auto' }}>
                    {facultyAccounts === null && (
                      <div style={{ padding: 12, fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>Loading faculty…</div>
                    )}
                    {facultyAccounts !== null && facultyAccounts.length === 0 && (
                      <div style={{ padding: 12, fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>No faculty accounts yet.</div>
                    )}
                    {facultyAccounts
                      ?.filter((f) => !facultySearch.trim() || (f.name || '').toLowerCase().includes(facultySearch.trim().toLowerCase()))
                      .map((f) => (
                        <label
                          key={f.uid}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                            borderBottom: '1px solid var(--border)', cursor: 'pointer', fontSize: 12.5,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedFacultyUids.has(f.uid)}
                            onChange={() => toggleFacultyUid(f.uid)}
                          />
                          <span style={{ color: 'var(--text)', flex: 1 }}>{f.name || 'Unnamed'}</span>
                          <span style={{ color: 'var(--muted)', fontSize: 11 }}>{f.dept || ''}</span>
                          {!f.verifiedAt && (
                            <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--muted)', padding: '1px 5px', borderRadius: 4, border: '1px solid var(--border)' }}>Unverified</span>
                          )}
                        </label>
                      ))}
                  </div>
                  {selectedFacultyUids.size > 0 && (
                    <div style={{ fontSize: 11.5, color: selectedFacultyUids.size > 300 ? '#dc2626' : 'var(--accent)', fontWeight: 700 }}>
                      {selectedFacultyUids.size} faculty selected
                      {selectedFacultyUids.size > 300 ? ' — over the 300 limit, use "All faculty" instead' : ''}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {sendMsg && <div style={{ fontSize: 12, color: sendMsg.startsWith('Failed') ? 'var(--danger)' : 'var(--success)' }}>{sendMsg}</div>}
          <button type="submit" className="btn btn-primary" disabled={sending}>{sending ? 'Sending…' : 'Send notice'}</button>
        </form>
      </Section>

      {sentNotices.length > 0 && (
        <Section title="Sent notices">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 480 }}>
            {sentNotices.map((n) => (
              <div key={n.id} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{n.title}</div>
                    {n.deleted && (
                      <span style={{
                        fontSize: 9.5, fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase',
                        border: '1px solid var(--danger)', borderRadius: 4, padding: '1px 5px', flexShrink: 0,
                      }}>
                        Deleted
                      </span>
                    )}
                  </div>
                  {!n.deleted && (
                    <button
                      type="button"
                      onClick={() => handleDeleteNotice(n.id)}
                      disabled={deletingId === n.id}
                      aria-label={`Delete notice: ${n.title}`}
                      style={{
                        display: 'flex', alignItems: 'center', flexShrink: 0, color: 'var(--danger)',
                        background: 'none', border: 'none', cursor: deletingId === n.id ? 'not-allowed' : 'pointer',
                        padding: 0, opacity: deletingId === n.id ? 0.5 : 1,
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, opacity: n.deleted ? 0.6 : 1 }}>
                  {renderFormattedNoticeBody(n.body)}
                </div>
                <NoticeInsightsPanel
                  noticeId={n.id}
                  groupId={null}
                  audienceSize={n.audienceSize}
                  title={n.title}
                />
              </div>
            ))}
          </div>
        </Section>
      )}
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
  const [qbUploadCount, setQbUploadCount] = useState(0);
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
  useEffect(() => subscribeAllQBUploadRequests((reqs) => setQbUploadCount(reqs.length)), []);

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

  // Blood Bank overview count — just the total on file, for the grid
  // card's subtitle/badge. BloodBankView does its own fetch for the
  // actual search results (a targeted where() query), this is only the
  // cheap "how many total" number shown before drilling in.
  const [bloodDonorCount, setBloodDonorCount] = useState(null);
  useEffect(() => {
    listAllBloodDonors().then((list) => setBloodDonorCount(list.length)).catch(() => setBloodDonorCount(0));
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
    qbUploadRequests: qbUploadCount,
    emailFlags: emailFlagCount,
    rollRequests: rollRequests.length,
    classCount: groups?.length,
    facultyCount: (facultyList || []).filter((f) => f.verifiedAt).length,
    facultyPending: (facultyList || []).filter((f) => !f.verifiedAt).length,
    bloodDonorCount,
  };

  const onSelectCategory = (key) => setView(key);
  const onBack = () => setView(null);

  const viewProps = { groups, countCtx, onSelectCategory, onBack };

  if (view === 'approvals') return <ApprovalsView {...viewProps} />;
  if (view === 'question-bank') return <QuestionBankView {...viewProps} />;
  if (view === 'staff') return <StaffRolesView {...viewProps} />;
  if (view === 'classes') return <ClassesView {...viewProps} />;
  if (view === 'trust') return <TrustSafetyView {...viewProps} />;
  if (view === 'comms') return <CommunicationView {...viewProps} />;
  if (view === 'faculty') return <FacultyView {...viewProps} />;
  if (view === 'blood') return <BloodBankView {...viewProps} />;

  // Top-level grid — fully generated from FOUNDER_CATEGORIES, plus one
  // router-linked card (Manage Batches — a real page route, not an
  // internal `view`) styled to match so it doesn't stand out as a
  // different kind of thing in the grid.
  return (
    <div>
      <FounderViewSwitchCard />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        <Link to="/admin/batches" className="founder-category-card" style={{ textDecoration: 'none' }}>
          <div className="founder-category-card-icon">
            <Users size={22} color="var(--accent)" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>Manage Batches</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Active batch list & colors</div>
          </div>
          <ChevronRight size={18} color="var(--muted)" style={{ flexShrink: 0 }} />
        </Link>
        {FOUNDER_CATEGORIES.filter((cat) => !cat.hidden).map((cat) => (
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