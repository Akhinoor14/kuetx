import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Users } from 'lucide-react';
import { getProfile } from '../store/store';
import { getGroupId, getGroupLabel, canonicalize } from '../lib/groupUtils';
import { postGroupNotice, requestLeaveCR, subscribeMyRole } from '../lib/groupSync';
import { subscribeMyRoles, hasRole } from '../lib/staffSync';
import { checkIsAdmin } from '../lib/adminAuth';
import { auth } from '../lib/firebase';
import ClassmatesList from '../components/ClassmatesList';
import { renderFormattedNoticeBody } from '../lib/noticeFormat';

/**
 * CR/ACR-only page (route-gated by <RequireCR> in App.jsx — the live,
 * server-verified role check via subscribeMyRole, never profile.isCR).
 * Gives CR/ACR the same member-management power Campus Lead has in
 * StaffDashboard.jsx's CampusLeadBlock over the roster itself (verify,
 * promote, remove members via ClassmatesList), plus a notice form scoped
 * to their own class.
 *
 * Deliberately does NOT include fresh-CR-request approve/reject — that is
 * a Campus Lead action, not a CR action (see clApproveCRRequest/
 * clRejectCRRequest's doc comments and the crRequests Firestore rule —
 * `allow update: if isAdmin() || isCLFor(groupId) || isHeadOfOps() ||
 * isSCLForGroup(groupId)`, a plain group CR is never in that list). CL is
 * one person per exact batch+dept group and only that CL (or the SCL/
 * Head of Ops/Admin fallback chain) can approve/reject a CR claim OR a
 * CR's own leave request for their group; a CR revoking another CR
 * likewise needs that same fallback chain (clRevokeCR is a CL-authority
 * action), not this page. Both request queues stay exclusively in
 * StaffDashboard.jsx's CampusLeadBlock, which is only ever rendered for
 * the groups a given CL actually leads.
 *
 * A CR who wants to step down WITHOUT naming a specific successor uses
 * requestLeaveCR here (CL approval required, same as a fresh claim). A
 * CR who wants to hand their slot directly to someone does that from the
 * roster below instead (handoffCR via ClassmatesList's "Hand off CR"
 * button — no CL approval needed for that path).
 */
export default function ClassRoster() {
  const profile = getProfile();
  const groupId = getGroupId(profile);
  const groupLabel = getGroupLabel(profile);
  const uid = auth.currentUser?.uid;
  // Profile's "Hand over CR" button links here with { state: { intent:
  // 'handoff' } } — used only to surface a one-line hint above the roster
  // pointing at the per-row "Hand off CR" button below, since that action
  // lives inline in the roster rather than as its own separate flow.
  const location = useLocation();
  const handoffIntent = location.state?.intent === 'handoff';

  const [myRole, setMyRole] = useState('member');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState('');
  const [leaveState, setLeaveState] = useState('idle'); // idle | sending | sent | error
  const [leaveMsg, setLeaveMsg] = useState('');
  // Is this CR ALSO the person (or one of the people) who'd approve their
  // own leave request — Admin/Founder, Head of Ops, this group's Campus
  // Lead, or this dept's Senior Campus Lead? None of that is a bug (the
  // Founder/Head-of-Ops "All Classes" view exists specifically so a
  // request never gets stuck with no eligible approver), but the CL-
  // approval-gated flow reads confusingly if you never learn you're the
  // one who has to go approve it. This just makes that visible.
  const [canSelfApprove, setCanSelfApprove] = useState(false);

  useEffect(() => {
    if (!groupId || !uid) return;
    return subscribeMyRole(groupId, uid, setMyRole);
  }, [groupId, uid]);

  useEffect(() => {
    if (!groupId || !uid) return;
    let cancelled = false;
    let unsubRoles = () => {};
    checkIsAdmin(uid).then((isFounder) => {
      if (cancelled) return;
      if (isFounder) { setCanSelfApprove(true); return; }
      unsubRoles = subscribeMyRoles((roles) => {
        if (cancelled) return;
        setCanSelfApprove(
          hasRole(roles, 'head_of_ops', { type: 'global' }) ||
          hasRole(roles, 'campus_lead', { type: 'group', groupId }) ||
          (profile?.dept && hasRole(roles, 'senior_campus_lead', { type: 'dept', dept: canonicalize(profile.dept) }))
        );
      });
    });
    return () => { cancelled = true; unsubRoles(); };
  }, [groupId, uid]);

  const handleSendNotice = async (e) => {
    e.preventDefault();
    if (!title.trim() || !body.trim() || !groupId) return;
    setSending(true);
    setSendMsg('');
    try {
      await postGroupNotice(groupId, profile, { title: title.trim(), body: body.trim() });
      setTitle('');
      setBody('');
      setShowPreview(false);
      setSendMsg('Notice sent.');
    } catch (err) {
      setSendMsg(`Failed: ${err?.message || err}`);
    } finally {
      setSending(false);
    }
  };

  const handleRequestLeave = async () => {
    if (!window.confirm('Send a request to your Class Lead to step down as CR? You\'ll remain CR until it\'s approved.')) return;
    setLeaveState('sending');
    setLeaveMsg('');
    try {
      await requestLeaveCR(groupId, profile);
      setLeaveMsg('Request sent to your Class Lead. You\'ll stop being CR once they approve it.');
      setLeaveState('sent');
    } catch (err) {
      setLeaveMsg(`Failed: ${err?.message || err}`);
      setLeaveState('error');
    }
  };

  return (
    <div className="content-page-bg" style={{ width: 'min(95vw, 1560px)', margin: '0 auto', padding: '16px 14px' }}>
      <div className="roster-hero">
        <div className="content-page-hero-icon">
          <Users size={18} color="var(--accent)" />
        </div>
        <div style={{ minWidth: 0 }}>
          <h1 className="content-page-hero-title">Class Roster</h1>
          {groupId && (
            <p className="content-page-hero-subtitle">
              Manage <strong>{groupLabel}</strong> — verify members, appoint ACR or hand off CR, remove members, and send notices to your class.
            </p>
          )}
        </div>
      </div>

      {!groupId ? (
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>
          Add your department and batch in Profile to manage your class roster.
        </p>
      ) : (
        <>
          {handoffIntent && myRole === 'cr' && (
            <div style={{
              padding: '10px 14px', borderRadius: 10, marginBottom: 14,
              background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)',
              fontSize: 12.5, color: 'var(--text)',
            }}>
              Pick a classmate below and use their <strong>"Hand off CR"</strong> button to transfer your slot directly — no Campus Lead approval needed.
            </div>
          )}

          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Roster</div>
          <div style={{ marginBottom: 20 }}>
            <ClassmatesList groupId={groupId} showActions viewerRole="cr" currentUid={uid} />
          </div>

          {myRole === 'cr' && (
            <div className="card" style={{ padding: 14, marginBottom: 16 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Step down as CR</h2>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
                Want to stop being CR without handing off to someone specific? This sends a request to your
                Class Lead. You'll remain CR until they approve it.
              </p>
              {canSelfApprove && (
                <p style={{ fontSize: 12, color: 'var(--accent)', marginBottom: 10 }}>
                  You also hold Campus Lead / Senior Campus Lead / Head of Ops / Founder access for this class,
                  so you can approve this request yourself afterward from the Founder or Staff dashboard.
                </p>
              )}
              {leaveState === 'sent' ? (
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{leaveMsg}</div>
              ) : (
                <>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={handleRequestLeave}
                    disabled={leaveState === 'sending'}
                  >
                    {leaveState === 'sending' ? 'Sending…' : 'Request to leave CR'}
                  </button>
                  {leaveState === 'error' && (
                    <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 6 }}>{leaveMsg}</div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="card" style={{ padding: 14 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Send a notice to your class</h2>
            <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '0 0 10px', lineHeight: 1.5 }}>
              Tip: leave a blank line between points to start a new paragraph — it'll show up nicely spaced for your classmates.
            </p>
            <form onSubmit={handleSendNotice} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                type="text"
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input"
                style={{ width: '100%' }}
              />

              {!showPreview ? (
                <textarea
                  placeholder={'Notice details...\n\nLeave a blank line to start a new paragraph.'}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="input"
                  rows={6}
                  style={{ width: '100%', resize: 'vertical', lineHeight: 1.55 }}
                />
              ) : (
                <div style={{
                  padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)',
                  background: 'var(--surface)', fontSize: 13, color: 'var(--text)', lineHeight: 1.55,
                  minHeight: 96,
                }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>{title.trim() || <span style={{ color: 'var(--muted)' }}>(no title)</span>}</div>
                  {body.trim()
                    ? renderFormattedNoticeBody(body)
                    : <span style={{ color: 'var(--muted)' }}>(nothing written yet)</span>}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={sending || !title.trim() || !body.trim()}
                >
                  {sending ? 'Sending...' : 'Send notice'}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setShowPreview((v) => !v)}
                  disabled={!title.trim() && !body.trim()}
                >
                  {showPreview ? 'Back to edit' : 'Preview'}
                </button>
              </div>
              {sendMsg && (
                <div style={{ fontSize: 12, color: sendMsg.startsWith('Failed') ? 'var(--danger)' : 'var(--success)' }}>
                  {sendMsg}
                </div>
              )}
            </form>
          </div>
        </>
      )}
    </div>
  );
}