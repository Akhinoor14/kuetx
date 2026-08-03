import { useEffect, useState } from 'react';
import { getProfile } from '../store/store';
import { auth } from '../lib/firebase';
import { ROLE_LABELS } from '../lib/staffRoles';
import {
  subscribeMyRoles, listStaffByRole, listCampusLeadsForDept, assignRole, removeRole,
  subscribeCLApplications, subscribeAllCLApplications, approveCLApplication, rejectCLApplication,
  checkSCLVacant, getStaffDisplayInfo,
} from '../lib/staffSync';
import {
  subscribeCRRequests, clApproveCRRequest, clRejectCRRequest,
  subscribeLeaveRequests, clApproveLeaveCR, clRejectLeaveCR,
  listAllGroups, getGroupMembersOnce,
} from '../lib/groupSync';
import { subscribePendingRollUnlockRequests, resolveRollUnlockRequest, dismissRollUnlockRequest } from '../lib/rollOwnership';
import { subscribeIsAdmin } from '../lib/adminAuth';
import { flagSuspiciousEmail, unflagEmail, summarizeEmailHealth, listPendingFlags, resolveEmailFlag } from '../lib/emailFlags';
import { isObviouslyBadDomain } from '../lib/emailDomainCheck';
import ClassmatesList from '../components/ClassmatesList';
import QBUploadForm from '../components/QBUploadForm';
import { withTimeout } from '../lib/safeSnapshot';
import QBReviewQueue from '../components/QBReviewQueue';
import AnalyticsDashboard from '../components/AnalyticsDashboard';
import RequestDeleteButton from '../components/RequestDeleteButton';
import SectionTabs from '../components/SectionTabs';

// ---------------------------------------------------------------------
// Founder-only: roll ownership unlock requests (see rollOwnership.js).
// Not tied to the staff/{uid}/roles hierarchy since this is Founder-level
// account-integrity work, same tier as the `admins/{uid}` doc itself.
// ---------------------------------------------------------------------
function RollUnlockSection() {
  const [requests, setRequests] = useState([]);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => withTimeout((cb) => subscribePendingRollUnlockRequests(cb), setRequests, { fallbackValue: [] }), []);

  if (requests.length === 0) return null;

  const handleResolve = async (req) => {
    setBusyId(req.id);
    try {
      await resolveRollUnlockRequest(req.id, req.roll);
    } finally {
      setBusyId(null);
    }
  };
  const handleDismiss = async (req) => {
    setBusyId(req.id);
    try {
      await dismissRollUnlockRequest(req.id);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Section wide title="Roll Unlock Requests">
      {requests.map((r) => (
        <div key={r.id} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ minWidth: 0, wordBreak: 'break-word' }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Roll: {r.roll}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{r.note}</div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button className="btn btn-sm" onClick={() => handleResolve(r)} disabled={busyId === r.id}>
              {busyId === r.id ? 'Working…' : 'Release roll'}
            </button>
            <button className="btn btn-sm btn-secondary" onClick={() => handleDismiss(r)} disabled={busyId === r.id}>Dismiss</button>
          </div>
        </div>
      ))}
    </Section>
  );
}

function Section({ title, children, wide }) {
  return (
    <section className={`card${wide ? ' staff-section-wide' : ''}`} style={{ padding: 14, marginBottom: 16 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>{title}</h2>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------
// Labeled break between role-scoped groups of cards, so e.g. "Senior
// Campus Lead" tools and "Campus Lead" tools don't visually blur into
// one undifferentiated stack when someone holds more than one role.
// Same treatment as AdminDashboard.jsx's GroupHeading, kept local here
// since the two pages don't currently share a components file for this.
// ---------------------------------------------------------------------
function GroupHeading({ children, first }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      margin: first ? '0 0 12px' : '20px 0 12px',
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

// ---------------------------------------------------------------------
// Founder/Head of Ops: cross-group view of pending CR claim + leave
// requests. Without this, a group whose Campus Lead post is vacant, or
// whose CL is unresponsive, has NO ONE who can see/act on its requests
// in the UI — even though firestore.rules already permits Admin/Head
// of Ops to approve/reject them. This closes that gap; it reuses the
// exact same CampusLeadBlock UI, just fed every group instead of only
// ones the viewer personally leads.
// ---------------------------------------------------------------------
function AdminAllGroupsSection() {
  const [groupIds, setGroupIds] = useState(null);

  useEffect(() => {
    listAllGroups().then((groups) => setGroupIds(groups.map((g) => g.id)));
  }, []);

  if (groupIds === null) return null;
  if (groupIds.length === 0) return null;

  return (
    <Section wide title="All Classes — CR & Leave Requests (Founder/Head of Ops view)">
      <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>
        Shows every class, including ones without an active Campus Lead — use this if a
        request is stuck because the group's CL post is vacant or unresponsive.
      </p>
      {groupIds.map((g) => <CampusLeadBlock key={g} groupId={g} />)}
    </Section>
  );
}

// ---------------------------------------------------------------------
// Campus Lead section — one block per group this person leads
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// Email audit — per-group list of members whose account email looks
// fake/suspicious, with a one-tap flag action. See emailFlags.js for the
// full design rationale (manual review, never auto-delete/lock).
//
// accountEmail is a self-written display field on the member doc (see
// joinGroup() in groupSync.js) — it's the person's own login email,
// separate from any KUET institutional verification email. Anonymous
// accounts have no accountEmail at all, so they're skipped here (nothing
// to flag — they have no email-recovery risk to begin with).
// ---------------------------------------------------------------------
function EmailAuditBlock({ groupId, dept }) {
  const [members, setMembers] = useState(null);
  const [busyUid, setBusyUid] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    getGroupMembersOnce(groupId).then((m) => { if (!cancelled) setMembers(m); });
    return () => { cancelled = true; };
  }, [groupId]);

  if (members === null) return null;

  const withEmail = members.filter((m) => m.accountEmail);
  const health = summarizeEmailHealth(withEmail.map((m) => ({ email: m.accountEmail })));
  const suspicious = withEmail.filter((m) => isObviouslyBadDomain(m.accountEmail));

  if (suspicious.length === 0) return null;

  const handleFlag = async (m) => {
    setBusyUid(m.id);
    setErr('');
    try {
      await flagSuspiciousEmail(m.id, m.accountEmail, { dept, groupId }, 'Domain does not look trustworthy');
    } catch (e) {
      setErr(e?.message || 'Could not flag this entry.');
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
        Email Audit <span style={{ fontWeight: 400, color: 'var(--muted)' }}>
          ({health.outsideIdeal}/{health.total} outside the ideal domain, {health.obviouslyBad} obviously fake)
        </span>
      </div>
      {err && <div style={{ fontSize: 11.5, color: 'var(--danger)', marginBottom: 6 }}>{err}</div>}
      {suspicious.map((m) => (
        <div key={m.id} className="card" style={{ padding: 8, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <div style={{ minWidth: 0, wordBreak: 'break-word' }}>
            <div style={{ fontSize: 13 }}>{m.name} ({m.roll})</div>
            <div style={{ fontSize: 11.5, color: 'var(--danger)', wordBreak: 'break-all' }}>{m.accountEmail}</div>
          </div>
          <button className="btn btn-sm btn-secondary" onClick={() => handleFlag(m)} disabled={busyUid === m.id}>
            {busyUid === m.id ? 'Flagging…' : 'Flag'}
          </button>
        </div>
      ))}
    </div>
  );
}

function CampusLeadBlock({ groupId }) {
  const [crRequests, setCrRequests] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [approveErr, setApproveErr] = useState('');
  // Each CampusLeadBlock instance owns its own tab state — a Campus Lead
  // leading multiple classes gets one block per class (see the .map() call
  // site below), so this must stay local to the component, not hoisted to
  // a shared/module-level variable, or switching tabs on one class's card
  // would wrongly switch every other class's card too.
  const [activeTab, setActiveTab] = useState('approvals');

  useEffect(() => subscribeCRRequests(groupId, setCrRequests), [groupId]);
  useEffect(() => subscribeLeaveRequests(groupId, setLeaveRequests), [groupId]);

  const handleApprove = async (targetUid) => {
    setApproveErr('');
    try {
      await clApproveCRRequest(groupId, targetUid);
    } catch (e) {
      // Most likely: the CR slot (max 1) is already full — surfaced
      // clearly rather than a silent no-op, since this is the one case
      // clApproveCRRequest can legitimately reject.
      setApproveErr(e?.message || 'Approve failed — try again.');
    }
  };

  const handleApproveLeave = async (requestDocId, targetUid) => {
    setApproveErr('');
    try {
      await clApproveLeaveCR(groupId, requestDocId, targetUid);
    } catch (e) {
      setApproveErr(e?.message || 'Approve failed — try again.');
    }
  };

  const pendingCount = crRequests.length + leaveRequests.length;

  return (
    <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{groupId}</div>

      {approveErr && (
        <div className="card" style={{ padding: 8, marginBottom: 8, fontSize: 12, color: 'var(--danger)' }}>{approveErr}</div>
      )}

      <SectionTabs
        tabs={[
          { key: 'approvals', label: 'Approvals', badge: pendingCount },
          { key: 'roster', label: 'Roster' },
          { key: 'qb', label: 'Question Bank' },
        ]}
        active={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === 'approvals' && (
        <>
          {crRequests.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>CR requests</div>
              {crRequests.map((r) => (
                <div key={r.id} className="card" style={{ padding: 8, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, minWidth: 0, wordBreak: 'break-word' }}>{r.name} ({r.roll})</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    <button className="btn btn-sm btn-primary" onClick={() => handleApprove(r.id)}>Approve</button>
                    <button className="btn btn-sm btn-secondary" onClick={() => clRejectCRRequest(groupId, r.id)}>Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {leaveRequests.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>CR leave requests</div>
              {leaveRequests.map((r) => (
                <div key={r.id} className="card" style={{ padding: 8, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, minWidth: 0, wordBreak: 'break-word' }}>{r.name} ({r.roll}) — wants to step down as CR</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    <button className="btn btn-sm btn-primary" onClick={() => handleApproveLeave(r.id, r.uid)}>Approve</button>
                    <button className="btn btn-sm btn-secondary" onClick={() => clRejectLeaveCR(groupId, r.id)}>Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {pendingCount === 0 && (
            <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>Nothing pending — all caught up.</p>
          )}
        </>
      )}

      {activeTab === 'roster' && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
            Roster <span style={{ fontWeight: 400, color: 'var(--muted)' }}>("Claims CR" badge = held CR before this system existed — review and confirm/promote if still accurate)</span>
          </div>
          <ClassmatesList groupId={groupId} showActions viewerRole="cl" currentUid={auth.currentUser?.uid} />
          <div style={{ marginTop: 14 }}>
            <EmailAuditBlock groupId={groupId} dept={groupId.split('_')[1]} />
          </div>
        </>
      )}

      {activeTab === 'qb' && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Upload a Question Bank paper</div>
          <QBUploadForm
            profile={{ dept: groupId.split('_')[1], batch: groupId.split('_')[0] }}
            groupId={groupId}
          />

          <div style={{ fontSize: 12, fontWeight: 700, margin: '14px 0 6px' }}>Request removal of a live paper</div>
          <RequestDeleteButton groupId={groupId} dept={groupId.split('_')[1]} />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Senior Campus Lead section — one block per department they lead
// ---------------------------------------------------------------------
function SeniorCampusLeadBlock({ dept }) {
  const [applications, setApplications] = useState([]);
  const [cls, setCls] = useState(null);
  const [clsError, setClsError] = useState(null);

  useEffect(() => subscribeCLApplications(dept, setApplications), [dept]);
  useEffect(() => {
    setClsError(null);
    listCampusLeadsForDept(dept)
      .then(setCls)
      .catch((err) => setClsError(err?.message || 'Failed to load campus leads.'));
  }, [dept]);

  return (
    <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{dept}</div>

      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Pending Campus Lead applications</div>
      {applications.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>None right now.</div>}
      {applications.map((a) => (
        <div key={a.id} className="card" style={{ padding: 8, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 13, minWidth: 0, wordBreak: 'break-word' }}>
            {a.name} ({a.roll}) — {a.groupId} {a.bundledCRClaim && <em>(+ CR)</em>}
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <button className="btn btn-sm btn-primary" onClick={() => approveCLApplication(a.id)}>Approve</button>
            <button className="btn btn-sm btn-secondary" onClick={() => rejectCLApplication(a.id)}>Reject</button>
          </div>
        </div>
      ))}

      <div style={{ fontSize: 12, fontWeight: 700, margin: '10px 0 6px' }}>Pending email flags in this department</div>
      <EmailFlagReviewBlock dept={dept} />

      <div style={{ fontSize: 12, fontWeight: 700, margin: '10px 0 6px' }}>Pending Question Bank uploads</div>
      <QBReviewQueue dept={dept} />

      <div style={{ fontSize: 12, fontWeight: 700, margin: '10px 0 6px' }}>Department Analytics</div>
      <AnalyticsDashboard dept={dept} />

      <div style={{ fontSize: 12, fontWeight: 700, margin: '10px 0 6px' }}>Campus Leads in this department</div>
      {clsError && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{clsError}</div>}
      {!clsError && cls === null && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Loading…</div>}
      {!clsError && cls?.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)' }}>None appointed yet.</div>}
      {cls?.map((c) => (
        <div key={c.groupId} style={{ fontSize: 13, padding: '4px 0' }}>
          {c.name ? `${c.name}${c.roll ? ` (${c.roll})` : ''}` : c.uid || c.groupId}
          <span style={{ color: 'var(--muted)' }}> — {c.groupId}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------
// Fallback flag review — Head of Ops/Founder sees EVERY pending email
// flag regardless of dept/group, so a flag never gets stuck just because
// a dept's SCL post happens to be vacant or unresponsive (same universal
// fallback principle as the CL applications list above).
// ---------------------------------------------------------------------
function EmailFlagReviewBlock({ dept, groupId } = {}) {
  const [flags, setFlags] = useState(null);
  const [error, setError] = useState(null);
  const [busyUid, setBusyUid] = useState(null);

  const refresh = () => {
    setError(null);
    listPendingFlags({ dept, groupId })
      .then(setFlags)
      .catch((err) => setError(err?.message || 'Failed to load email flags.'));
  };
  useEffect(() => { refresh(); }, [dept, groupId]);

  if (error) {
    return <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 12 }}>{error}</div>;
  }
  if (flags === null) {
    return <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>Loading…</div>;
  }
  if (flags.length === 0) {
    return <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>No pending email flags.</div>;
  }

  const handleResolve = async (f, status) => {
    setBusyUid(f.id);
    try {
      await resolveEmailFlag(f.id, status);
      await refresh();
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <div style={{ marginBottom: 12 }}>
      {flags.map((f) => (
        <div key={f.id} className="card" style={{ padding: 8, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <div style={{ minWidth: 0, wordBreak: 'break-word' }}>
            <div style={{ fontSize: 13 }}>{f.targetEmail || '(no email)'} — {f.dept || f.groupId || 'unscoped'}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{f.reason}</div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <button className="btn btn-sm btn-primary" onClick={() => handleResolve(f, 'resolved')} disabled={busyUid === f.id}>Fixed</button>
            <button className="btn btn-sm btn-secondary" onClick={() => handleResolve(f, 'dismissed')} disabled={busyUid === f.id}>Dismiss</button>
          </div>
        </div>
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
  useEffect(() => withTimeout((cb) => subscribeAllCLApplications(cb), setAllApplications, { fallbackValue: [] }), []);

  const [appointError, setAppointError] = useState('');

  const appoint = async () => {
    if (!newSclUid.trim()) return;
    setAppointError('');
    try {
      // SCL is often the very first appointment in a dept — there's no
      // CL/CR around yet to have "verified" this person, so we don't
      // gate on that. Every student has dept/batch/roll from signup,
      // which is enough to derive their dept — use it to auto-fill if
      // Head of Ops left the field blank, but the appointment itself
      // (typed in by hand, or auto-filled and confirmed) is what counts.
      const info = await getStaffDisplayInfo(newSclUid.trim());
      // BUGFIX (person's actual bug — SCL couldn't see their own CLs,
      // permission-denied): only the manually-typed newSclDept was
      // uppercased here — the info.dept fallback (read from the target's
      // own signup profile) was used as-is, whatever case that profile
      // happened to store. staff/{uid}/roles/senior_campus_lead_{dept}'s
      // doc ID is built directly from this string (see roleDocId in
      // staffSync.js), and firestore.rules' isSCLFor(dept) does an EXACT-
      // CASE exists() check against 'senior_campus_lead_' + dept, where
      // dept always comes from deptOfGroup(groupId) — which is always
      // uppercase, since groupId itself is built consistently uppercase
      // everywhere else. So an SCL appointed via this blank-field
      // auto-fill path, whose own profile had a lowercase/mixed-case
      // dept, got a role doc id like 'senior_campus_lead_Che' instead of
      // 'senior_campus_lead_CHE' — a doc that exists, just under the
      // wrong exact-case key — so isSCLFor's exists() check silently
      // came back false for their own correct department. Both branches
      // must agree on case; uppercase-ing here too is the fix, not the
      // rules (the rules side is the one consistent source of truth —
      // deptOfGroup — everything else must match it).
      const dept = (newSclDept.trim() || info.dept || '').toUpperCase();
      if (!dept) {
        setAppointError('Enter a department before appointing.');
        return;
      }
      await assignRole(newSclUid.trim(), 'senior_campus_lead', { type: 'dept', dept });
      setNewSclUid(''); setNewSclDept('');
      listStaffByRole('senior_campus_lead').then(setScls);
    } catch (err) {
      console.error('[HeadOfOps] appoint SCL failed:', err);
      setAppointError(err?.message || 'Failed to appoint SCL.');
    }
  };

  return (
    <Section wide title="Head of Operations">
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
        Pending Question Bank delete requests
      </div>
      <DeleteRequestQueue />

      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, marginTop: 14 }}>
        Pending email flags (fallback — covers depts with no SCL/CL, or any dept)
      </div>
      <EmailFlagReviewBlock />

      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
        Every pending Campus Lead application (fallback — covers depts with no Senior Campus Lead yet)
      </div>
      {allApplications.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>Nothing pending.</div>}
      {allApplications.map((a) => (
        <div key={a.id} className="card" style={{ padding: 8, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 13, minWidth: 0, wordBreak: 'break-word' }}>{a.name} ({a.roll}) — {a.groupId} {a.bundledCRClaim && <em>(+ CR)</em>}</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <button className="btn btn-sm btn-primary" onClick={() => approveCLApplication(a.id)}>Approve</button>
            <button className="btn btn-sm btn-secondary" onClick={() => rejectCLApplication(a.id)}>Reject</button>
          </div>
        </div>
      ))}

      <div style={{ fontSize: 12, fontWeight: 700, margin: '14px 0 6px' }}>Senior Campus Leads</div>
      {scls === null && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Loading…</div>}
      {scls?.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>None appointed yet.</div>}
      {scls?.map((s) => (
        <div key={s.id} style={{ fontSize: 13, padding: '4px 0', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ minWidth: 0, wordBreak: 'break-all' }}>{s.scope?.dept} — uid: {s.uid}</span>
          <button className="btn btn-sm btn-secondary" onClick={() => removeRole(s.uid, 'senior_campus_lead', s.scope)}>Remove</button>
        </div>
      ))}
      <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <input placeholder="New SCL's uid" value={newSclUid} onChange={(e) => setNewSclUid(e.target.value)}
          style={{ flex: '1 1 160px', minWidth: 0, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)' }} />
        <input placeholder="Dept (blank = auto from user)" value={newSclDept} onChange={(e) => setNewSclDept(e.target.value)}
          style={{ width: 160, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)' }} />
        <button className="btn btn-sm btn-primary" onClick={appoint}>Appoint</button>
      </div>
      {appointError && (
        <p style={{ fontSize: 12, color: 'var(--danger, #dc2626)', marginTop: 6 }}>{appointError}</p>
      )}
      <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
        Every request escalates up the chain automatically — a department with no Senior Campus Lead
        never gets stuck, its Campus Lead applications simply show up here instead.
      </p>
    </Section>
  );
}

// ---------------------------------------------------------------------
// Content Lead section — stub, pending integration with the existing
// Question Bank system (see groupSync.js's note on why there's no
// separate "Resources" moderation queue)
// ---------------------------------------------------------------------
function ContentLeadSection() {
  return (
    <Section wide title="Content moderation">
      <p style={{ fontSize: 12, color: 'var(--muted)', maxWidth: 640 }}>
        Question bank/notes moderation lives in KUETx's existing Question Bank system, not a separate
        queue here. Wiring your review step into that system is a follow-up task.
      </p>
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
    <Section wide title="Growth — class activity">
      {groups === null && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Loading…</div>}
      {groups?.map((g) => (
        <div key={g.id} style={{ fontSize: 13, padding: '4px 0', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ minWidth: 0, wordBreak: 'break-word' }}>{g.id}</span>
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
// Role tab bar — when a person holds more than one KUETx role, each
// role gets its own tab instead of every section stacking into one long
// flat page. A Founder who is also a CL/SCL, for example, would
// otherwise see the Founder-wide fallback sections and their personal
// CL/SCL sections all mixed together in one scroll.
// ---------------------------------------------------------------------
function RoleTabBar({ tabs, active, onChange }) {
  if (tabs.length <= 1) return null;
  return (
    <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, marginBottom: 10, borderBottom: '1px solid var(--border)' }}>
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className="btn btn-sm"
          style={{
            whiteSpace: 'nowrap',
            background: active === t.key ? 'var(--accentBg, #eef2ff)' : 'transparent',
            color: active === t.key ? 'var(--accent, #4f46e5)' : 'var(--muted)',
            border: active === t.key ? '1px solid var(--accent, #4f46e5)' : '1px solid var(--border)',
            fontWeight: active === t.key ? 700 : 500,
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------
// Main dashboard
// ---------------------------------------------------------------------
export default function StaffDashboard({ activeTab: activeTabProp, onTabChange } = {}) {
  const [roles, setRoles] = useState(null);
  // BUGFIX (multi-role tab flicker / wrong initial tab): default is now
  // `null` ("not yet known") instead of `false`. `roles`
  // (staff/{uid}/roles) and admin status (admins/{uid}) resolve from two
  // independent async listeners, and `roles` usually settles first. With
  // a `false` default, the tab-list effect below ran once with
  // isAdminUser still `false` — for a Founder who is ALSO e.g. Campus
  // Lead, that produced a tabs list of just [{key:'cl'}] and wrote
  // `?tab=cl` into the URL before the Founder tab even existed. `null`
  // lets the render wait for both roles AND admin status before
  // computing tabs even once, so the tab list is correct from the start.
  const [isAdminUser, setIsAdminUser] = useState(null);
  // BUGFIX (back-button skips whole page): activeTab is now a controlled
  // prop driven by TeamDashboard's ?tab= URL param (falls back to local
  // state only if this component is ever used standalone without the
  // prop). Previously this owned its own useState, so tab switches never
  // became real history entries — Back from inside a tab left the whole
  // /team page instead of returning to the tab list.
  const [localActiveTab, setLocalActiveTab] = useState(null);
  const activeTab = activeTabProp !== undefined ? activeTabProp : localActiveTab;
  const [rolesLoadWarning, setRolesLoadWarning] = useState('');

  useEffect(() => withTimeout(
    (cb) => subscribeMyRoles(cb),
    setRoles,
    { fallbackValue: [], onTimeout: () => setRolesLoadWarning('Taking longer than usual to load your roles — refresh in a minute if this stays empty.') }
  ), []);
  useEffect(() => {
    let unsubAdmin;
    const unsubAuth = auth.onAuthStateChanged((user) => {
      unsubAdmin?.();
      if (!user) { setIsAdminUser(false); return; }
      unsubAdmin = subscribeIsAdmin(user.uid, setIsAdminUser);
    });
    return () => { unsubAdmin?.(); unsubAuth(); };
  }, []);

  // NOTE: tabs/currentTab are recomputed below (after the early-return
  // guards), but this useEffect itself MUST stay above any early return —
  // otherwise the "loading" and "no roles" renders skip this hook entirely
  // while the "roles loaded" render calls it, giving React a different
  // hook count between renders and throwing invariant #310 (minified
  // "Rendered more hooks than during the previous render"). We recompute
  // currentTab inline here so the effect can stay unconditional; the
  // second computation below (used for actual rendering) is intentionally
  // kept in sync with this one.
  useEffect(() => {
    // Wait for BOTH sources before computing tabs even once. `roles`
    // (staff/{uid}/roles) and `isAdminUser` (admins/{uid}) are two
    // independent listeners that don't resolve at the same time — running
    // this with one of them still unknown produces an incomplete tabs
    // list (e.g. Founder tab missing) that then has to self-correct on a
    // later render, which is what caused the "wrong tab locked in" bug.
    if (!roles) return;
    if (isAdminUser === null) return;
    // BUGFIX (missing CL chip/tab despite "Your roles" text showing
    // Campus Lead): a campus_lead role doc is only useful here if
    // scope.groupId survived intact — but some role docs (older manual
    // grants, or writes from before scope was required) only have it
    // baked into the doc's OWN id (`campus_lead_${groupId}`, see
    // roleDocId() in staffSync.js) with scope.groupId itself empty or
    // missing. Previously this silently produced clGroups: [] — the
    // Founder holds the role (rolesRaw shows it, "Your roles:" text
    // shows it) but gets no CL tab and no role-switcher chip, because
    // this filter only ever trusted scope.groupId. Falling back to
    // parsing the id (`campus_lead_2K23_ESE` -> `2K23_ESE`) recovers the
    // groupId from the one place it's guaranteed to be, without needing
    // a data migration.
    //
    // BUGFIX (Campus Lead chip silently missing for an unassigned-group
    // grant): a campus_lead role doc can exist with NO usable groupId at
    // all — id `campus_lead_` (trailing underscore, empty suffix) and
    // scope.groupId === '' — if it was ever assigned without picking a
    // group/batch. Both the scope fallback AND the id-parse fallback
    // then produce '' , which .filter(Boolean) drops, so clGroups came
    // out empty and the whole Campus Lead tab (and the multi-role chip
    // bar with it) silently vanished — even though "Your roles:" text
    // below still correctly listed Campus Lead from the unfiltered
    // `roles` array. hasUnassignedCampusLead flags this case separately
    // so the tab can still render with a "needs a group" state instead
    // of disappearing outright.
    const hasUnassignedCampusLead = roles.some(
      (r) => r.role === 'campus_lead' && !(r.scope?.groupId || r.id?.replace(/^campus_lead_/, ''))
    );
    const clGroups = roles
      .filter((r) => r.role === 'campus_lead')
      .map((r) => r.scope?.groupId || r.id?.replace(/^campus_lead_/, ''))
      .filter(Boolean);
    const sclDepts = roles
      .filter((r) => r.role === 'senior_campus_lead')
      .map((r) => r.scope?.dept || r.id?.replace(/^senior_campus_lead_/, ''))
      .filter(Boolean);
    const isHeadOfOps = roles.some((r) => r.role === 'head_of_ops');
    const isContentLead = roles.some((r) => r.role === 'content_lead');
    const isHeadOfGrowth = roles.some((r) => r.role === 'head_of_growth');
    const otherRoles = roles.filter((r) => !['campus_lead', 'senior_campus_lead'].includes(r.role));
    const hasFinanceOrLegal = otherRoles.filter((r) => ['finance_lead', 'legal_partnerships'].includes(r.role)).length > 0;

    const tabs = [];
    if (isAdminUser) tabs.push({ key: 'founder' });
    if (isHeadOfOps) tabs.push({ key: 'ops' });
    if (sclDepts.length > 0) tabs.push({ key: 'scl' });
    if (clGroups.length > 0 || hasUnassignedCampusLead) tabs.push({ key: 'cl' });
    if (isContentLead) tabs.push({ key: 'content' });
    if (isHeadOfGrowth) tabs.push({ key: 'growth' });
    if (hasFinanceOrLegal) tabs.push({ key: 'finance' });

    const nextTab = activeTab && tabs.some((t) => t.key === activeTab) ? activeTab : tabs[0]?.key;
    // Only notify the parent when the resolved tab actually differs from
    // what it already has — otherwise this fires on every render where
    // onTabChange gets a new identity (useSearchParams's setter isn't
    // stable across renders), which pushes a new ?tab= history entry each
    // time and triggers Chrome's "Throttling navigation" protection.
    if (nextTab !== activeTab) onTabChange?.(nextTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles, isAdminUser, activeTab]);

  if (roles === null || isAdminUser === null) return <div style={{ padding: 20, color: 'var(--muted)' }}>{rolesLoadWarning || 'Loading…'}</div>;
  if (roles.length === 0 && !isAdminUser) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '12px 0 20px' }}>
        You don't hold any KUETx staff role yet.
      </div>
    );
  }


  const hasUnassignedCampusLead = roles.some(
    (r) => r.role === 'campus_lead' && !(r.scope?.groupId || r.id?.replace(/^campus_lead_/, ''))
  );
  const clGroups = roles
    .filter((r) => r.role === 'campus_lead')
    .map((r) => r.scope?.groupId || r.id?.replace(/^campus_lead_/, ''))
    .filter(Boolean);
  // Defensive uppercase for DISPLAY/query purposes only — does NOT fix an
  // already-mismatched role doc. If this SCL was appointed before the
  // fix in HeadOfOpsSection's appoint() above, their actual Firestore
  // doc id (staff/{uid}/roles/senior_campus_lead_{dept}) may still be
  // stored with the wrong case, and firestore.rules' isSCLFor() checks
  // that exact doc id server-side — a client-side .toUpperCase() here
  // can't retroactively rename it. For an SCL already stuck with a
  // mismatched-case doc (the actual bug the person reported — they
  // couldn't see their own CLs), the real fix is re-appointing them from
  // Head of Ops' panel now that appoint() always uppercases; that
  // creates a fresh, correctly-cased doc. This uppercase here just keeps
  // the dept label/query consistent for anyone whose doc was already
  // correct to begin with.
  const sclDepts = roles
    .filter((r) => r.role === 'senior_campus_lead')
    .map((r) => (r.scope?.dept || r.id?.replace(/^senior_campus_lead_/, '') || '').toUpperCase())
    .filter(Boolean);
  const isHeadOfOps = roles.some((r) => r.role === 'head_of_ops');
  const isContentLead = roles.some((r) => r.role === 'content_lead');
  const isHeadOfGrowth = roles.some((r) => r.role === 'head_of_growth');
  const otherRoles = roles.filter((r) => !['campus_lead', 'senior_campus_lead'].includes(r.role));
  const hasFinanceOrLegal = otherRoles.filter((r) => ['finance_lead', 'legal_partnerships'].includes(r.role)).length > 0;

  // Build the list of tabs this person actually has, in a fixed seniority order.
  const tabs = [];
  if (isAdminUser) tabs.push({ key: 'founder', label: 'Founder' });
  if (isHeadOfOps) tabs.push({ key: 'ops', label: 'Head of ops' });
  if (sclDepts.length > 0) tabs.push({ key: 'scl', label: 'Senior campus lead' });
  if (clGroups.length > 0 || hasUnassignedCampusLead) tabs.push({ key: 'cl', label: 'Campus lead' });
  if (isContentLead) tabs.push({ key: 'content', label: 'Content lead' });
  if (isHeadOfGrowth) tabs.push({ key: 'growth', label: 'Growth' });
  if (hasFinanceOrLegal) tabs.push({ key: 'finance', label: 'Finance & legal' });

  const currentTab = activeTab && tabs.some((t) => t.key === activeTab) ? activeTab : tabs[0]?.key;
  const show = (key) => tabs.length <= 1 || currentTab === key;

  const handleTabChange = (key) => {
    if (activeTabProp === undefined) setLocalActiveTab(key);
    onTabChange?.(key);
  };

  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
        {(() => {
          // BUGFIX: this used to be built only from `roles`
          // (staff/{uid}/roles — CL/SCL/Content/Growth/Finance), so an
          // account that's ALSO Founder (admins/{uid}, tracked
          // separately in isAdminUser) still showed only its non-Founder
          // roles here — e.g. "Your roles: Campus Lead" even while
          // holding Founder too, even though RoleTabBar below correctly
          // showed both chips. Founder is now included first, matching
          // the seniority order the tabs list already uses.
          const labels = [
            ...(isAdminUser ? ['Founder'] : []),
            ...roles.map((r) => ROLE_LABELS[r.role] || r.role),
          ];
          return labels.length > 0 ? `Your roles: ${labels.join(' · ')}` : 'No staff role yet';
        })()}
      </p>

      <RoleTabBar tabs={tabs} active={currentTab} onChange={handleTabChange} />

      {/* Founder tab content: intentionally empty here. The Founder's
          command center (Approvals, Staff & Roles, Classes & Students,
          Trust & Safety, Communication — including roll unlocks and
          email flags) lives entirely in AdminDashboard's card grid,
          which TeamDashboard.jsx mounts below this component via
          AdminEntryPoint when the Founder tab is active. Rendering the
          old flat-scroll blocks here too was duplicate UI showing the
          same data in two different, disconnected layouts — removed. */}

      {show('ops') && isHeadOfOps && (
        <>
          <GroupHeading first={!(show('founder') && isAdminUser)}>Head of Operations</GroupHeading>
          <div className="staff-dashboard-grid">
            <HeadOfOpsSection />
            <AdminAllGroupsSection />
          </div>
        </>
      )}

      {show('scl') && sclDepts.length > 0 && (
        <>
          <GroupHeading>Senior Campus Lead</GroupHeading>
          <div className="staff-dashboard-grid">
            <Section wide title="Your departments">
              {sclDepts.map((d) => <SeniorCampusLeadBlock key={d} dept={d} />)}
            </Section>
          </div>
        </>
      )}

      {show('cl') && clGroups.length > 0 && (
        <>
          <GroupHeading>Campus Lead</GroupHeading>
          <div className="staff-dashboard-grid">
            <Section wide title="Your classes">
              {clGroups.map((g) => <CampusLeadBlock key={g} groupId={g} />)}
            </Section>
          </div>
        </>
      )}

      {show('cl') && clGroups.length === 0 && hasUnassignedCampusLead && (
        <>
          <GroupHeading>Campus Lead</GroupHeading>
          <div style={{
            padding: 16, borderRadius: 10, border: '1px dashed var(--border)',
            color: 'var(--muted)', fontSize: 13, lineHeight: 1.6,
          }}>
            Your Campus Lead role isn't linked to a class/batch yet — ask a
            Head of Ops or Founder to re-assign it with a group selected
            from Staff & Roles.
          </div>
        </>
      )}

      {show('content') && isContentLead && (
        <>
          <GroupHeading>Content Lead</GroupHeading>
          <div className="staff-dashboard-grid">
            <ContentLeadSection />
          </div>
        </>
      )}

      {show('growth') && isHeadOfGrowth && (
        <>
          <GroupHeading>Growth</GroupHeading>
          <div className="staff-dashboard-grid">
            <GrowthSection />
          </div>
        </>
      )}

      {show('finance') && hasFinanceOrLegal && (
        <>
          <GroupHeading>Finance &amp; Legal</GroupHeading>
          <div className="staff-dashboard-grid">
            <Section wide title="Finance & Legal">
              <p style={{ fontSize: 12, color: 'var(--muted)', maxWidth: 640 }}>
                Sponsorship and compliance record-keeping tools are lightweight and mostly external
                (spreadsheets, documents) per the manifesto — nothing app-specific needed here yet.
              </p>
            </Section>
          </div>
        </>
      )}
    </div>
  );
}