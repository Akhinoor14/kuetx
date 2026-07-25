import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Users, Trash2 } from 'lucide-react';
import { getProfile } from '../store/store';
import { getGroupId, getGroupLabel, canonicalize } from '../lib/groupUtils';
import { postGroupNotice, requestLeaveCR, subscribeMyRole, subscribeGroupNotices } from '../lib/groupSync';
import { subscribeMyRoles, hasRole } from '../lib/staffSync';
import { checkIsAdmin } from '../lib/adminAuth';
import { auth } from '../lib/firebase';
import ClassmatesList from '../components/ClassmatesList';
import JoinRequestsPanel from '../components/JoinRequestsPanel';
import NoticeInsightsPanel from '../components/NoticeInsightsPanel';
import NoticeComposerToolbar from '../components/NoticeComposerToolbar';
import NoticePrioritySelector from '../components/NoticePrioritySelector';
import SectionTabs from '../components/SectionTabs';
import { renderFormattedNoticeBody } from '../lib/noticeFormat';
import { deleteNoticeSoft } from '../lib/noticeUtils';

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
 * roster below instead — ClassmatesList's "Class Roles" section, via its
 * "Hand off CR to them" action (handoffCR — no CL approval needed for
 * that path).
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
  const [rosterCounts, setRosterCounts] = useState(null);
  const [body, setBody] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const noticeTextareaRef = useRef(null);
  const [priority, setPriority] = useState('normal');
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

  // Phase 2 of the Notice upgrade: this CR/ACR's own sent notices (from
  // this group's notices subcollection), so they can see reach/read
  // stats and delete a notice they posted. Deliberately NOT filtered to
  // "posted by me only" here — any CR/ACR who can send to this class can
  // also see/manage the class's full notice history, matching the
  // firestore.rules update in Phase 2 (isCLFor/isAdmin can update ANY
  // notice in the group; only a plain non-CR sender is restricted to
  // their own postedBy.uid). Teacher-authored notices are excluded (this
  // is the CR/ACR's own management surface, not the class's full notice
  // feed — see Notice.jsx for that).
  const [sentNotices, setSentNotices] = useState([]);
  const [deletingId, setDeletingId] = useState(null);

  // Tabs replace the old single-scroll layout (Roster / Notices / My
  // Role). Defaults to the roster since that's what a CR/ACR checks most
  // often — except when arriving via the Profile page's "Hand over CR"
  // link (handoffIntent), where jumping straight to "My Role" means the
  // handoff hint is immediately visible instead of buried in a tab the
  // person has to think to open.
  const [activeTab, setActiveTab] = useState(handoffIntent ? 'myrole' : 'roster');

  useEffect(() => {
    if (!groupId) { setSentNotices([]); return; }
    return subscribeGroupNotices(groupId, (notices) => {
      setSentNotices(
        notices
          // Phase 2 follow-up: keep the sender's own soft-deleted notices
          // visible here (as an audit trail, with a "Deleted" tag in the
          // render below) rather than filtering them out — only the
          // student-facing merged feed (subscribeAllNotices's emit())
          // hides deleted:true notices.
          .filter((n) => n.from !== 'Teacher')
          .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)),
      );
    });
  }, [groupId]);

  const handleDeleteNotice = async (noticeId) => {
    if (!window.confirm('Delete this notice? It will be removed from your class\'s feed.')) return;
    setDeletingId(noticeId);
    try {
      await deleteNoticeSoft(noticeId, groupId);
    } catch (err) {
      window.alert(`Failed to delete: ${err?.message || err}`);
    } finally {
      setDeletingId(null);
    }
  };

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
      await postGroupNotice(groupId, profile, { title: title.trim(), body: body.trim(), priority });
      setTitle('');
      setBody('');
      setShowPreview(false);
      setPriority('normal');
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
    <div className="page-enter content-page-bg" style={{ width: 'min(95vw, 1560px)', margin: '0 auto', padding: '16px 14px', paddingBottom: 'calc(32px + env(safe-area-inset-bottom, 0px))' }}>
      <div className="content-page-hero">
        <div className="content-page-hero-main">
          <div className="content-page-hero-head">
            <div className="content-page-hero-icon">
              <Users size={24} color="var(--accent)" />
            </div>
            <h1 className="content-page-hero-title">Class Roster</h1>
          </div>
          {groupId && (
            <p className="content-page-hero-subtitle">
              Manage <strong>{groupLabel}</strong> members, roles, and join requests
            </p>
          )}
        </div>
        {groupId && rosterCounts && (
          <div className="content-page-hero-stats">
            <div className="content-page-hero-stat">
              <div className="content-page-hero-stat-n">{rosterCounts.total}</div>
              <div className="content-page-hero-stat-label">total</div>
            </div>
            <div className="content-page-hero-stat">
              <div className="content-page-hero-stat-n">{rosterCounts.verified}</div>
              <div className="content-page-hero-stat-label">verified</div>
            </div>
            <div className="content-page-hero-stat">
              <div className="content-page-hero-stat-n">{rosterCounts.cr}</div>
              <div className="content-page-hero-stat-label">CR</div>
            </div>
          </div>
        )}
      </div>

      {!groupId ? (
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>
          Add your department and batch in Profile to manage your class roster.
        </p>
      ) : (
        <>
          <SectionTabs
            tabs={[
              { key: 'roster', label: 'Roster' },
              { key: 'notices', label: 'Notices' },
              { key: 'myrole', label: 'My Role' },
            ]}
            active={activeTab}
            onChange={setActiveTab}
          />

          {activeTab === 'roster' && (
            <>
              {(myRole === 'cr' || myRole === 'acr') && (
                <JoinRequestsPanel groupId={groupId} />
              )}
              <div style={{ marginBottom: 20 }}>
                <ClassmatesList groupId={groupId} showActions viewerRole="cr" currentUid={uid} onCounts={setRosterCounts} />
              </div>
            </>
          )}

          {activeTab === 'myrole' && (
            <>
              {handoffIntent && myRole === 'cr' && (
                <div style={{
                  padding: '10px 14px', borderRadius: 10, marginBottom: 14,
                  background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)',
                  fontSize: 12.5, color: 'var(--text)',
                }}>
                  Go to the <strong>Roster</strong> tab, pick a classmate from the dropdown under <strong>"Class Roles"</strong>, and use <strong>"Hand off CR to them"</strong> to transfer your slot directly — no Campus Lead approval needed.
                </div>
              )}

              {myRole === 'cr' ? (
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
              ) : (
                <p style={{ color: 'var(--muted)', fontSize: 13 }}>
                  Role-specific actions (like stepping down as CR) show up here once you hold that role.
                </p>
              )}
            </>
          )}

          {activeTab === 'notices' && (myRole === 'cr' || myRole === 'acr') && (
            <>
              <div className="card" style={{ padding: 14, marginBottom: 16 }}>
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

                  <NoticePrioritySelector value={priority} onChange={setPriority} />

                  {!showPreview ? (
                    <>
                      <NoticeComposerToolbar
                        textareaRef={noticeTextareaRef}
                        value={body}
                        onChange={setBody}
                      />
                      <textarea
                        ref={noticeTextareaRef}
                        placeholder={'Notice details...\n\nLeave a blank line to start a new paragraph.'}
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        className="input"
                        rows={6}
                        style={{ width: '100%', resize: 'vertical', lineHeight: 1.55 }}
                      />
                    </>
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

              {sentNotices.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Sent notices</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {sentNotices.map((n) => (
                      <div key={n.id} className="card" style={{ padding: '10px 12px' }}>
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
                                display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                                fontSize: 11, fontWeight: 700, color: 'var(--danger)',
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
                          groupId={groupId}
                          audienceSize={n.audienceSize}
                          title={n.title}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'notices' && myRole !== 'cr' && myRole !== 'acr' && (
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>
              Only CR/ACR can send notices to the class.
            </p>
          )}
        </>
      )}
    </div>
  );
}