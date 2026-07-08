import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { getProfile } from '../store/store';
import { getGroupId, getGroupLabel } from '../lib/groupUtils';
import { postGroupNotice, requestLeaveCR, subscribeMyRole } from '../lib/groupSync';
import { auth } from '../lib/firebase';
import ClassmatesList from '../components/ClassmatesList';

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

  const [myRole, setMyRole] = useState('member');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState('');
  const [leaveState, setLeaveState] = useState('idle'); // idle | sending | sent | error
  const [leaveMsg, setLeaveMsg] = useState('');

  useEffect(() => {
    if (!groupId || !uid) return;
    return subscribeMyRole(groupId, uid, setMyRole);
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
      setSendMsg('Notice pathano hoyeche.');
    } catch (err) {
      setSendMsg(`Failed: ${err?.message || err}`);
    } finally {
      setSending(false);
    }
  };

  const handleRequestLeave = async () => {
    if (!window.confirm('CR thaka ceRe deyar request CL er kache pathate chao? Approve na howa porjonto tumi CR thakba.')) return;
    setLeaveState('sending');
    setLeaveMsg('');
    try {
      await requestLeaveCR(groupId, profile);
      setLeaveMsg('Request tomar Class Lead er kache pathano hoyeche. Approve korle tobe tumi ar CR thakba na.');
      setLeaveState('sent');
    } catch (err) {
      setLeaveMsg(`Failed: ${err?.message || err}`);
      setLeaveState('error');
    }
  };

  return (
    <div className="content-page-bg" style={{ maxWidth: 640, margin: '0 auto', padding: '16px 14px' }}>
      <div className="content-page-hero">
        <div className="content-page-hero-icon">
          <Users size={18} color="var(--accent)" />
        </div>
        <h1 className="content-page-hero-title">Class Roster</h1>
      </div>

      {!groupId ? (
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>
          Add your department and batch in Profile to manage your class roster.
        </p>
      ) : (
        <>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
            Manage <strong>{groupLabel}</strong> — verify members, appoint ACR or hand off CR, remove members, and send notices to your class.
          </p>

          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Roster</div>
          <div style={{ marginBottom: 20 }}>
            <ClassmatesList groupId={groupId} showActions viewerRole="cr" currentUid={uid} />
          </div>

          {myRole === 'cr' && (
            <div className="card" style={{ padding: 14, marginBottom: 16 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>CR thaka ceRe deya</h2>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
                Kauke direct hand off na kore shudhu CR thaka bad dite chaile, ei request tomar Class Lead er
                kache jabe. Approve na hoya porjonto tumi CR-e thakba.
              </p>
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
            <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Send a notice to your class</h2>
            <form onSubmit={handleSendNotice} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                type="text"
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input"
                style={{ width: '100%' }}
              />
              <textarea
                placeholder="Notice details..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="input"
                rows={4}
                style={{ width: '100%', resize: 'vertical' }}
              />
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={sending || !title.trim() || !body.trim()}
                style={{ alignSelf: 'flex-start' }}
              >
                {sending ? 'Sending...' : 'Send notice'}
              </button>
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
