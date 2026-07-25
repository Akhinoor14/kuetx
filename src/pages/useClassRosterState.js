import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getProfile } from '../store/store';
import { getGroupId, getGroupLabel, canonicalize } from '../lib/groupUtils';
import { postGroupNotice, requestLeaveCR, subscribeMyRole, subscribeGroupNotices } from '../lib/groupSync';
import { subscribeMyRoles, hasRole } from '../lib/staffSync';
import { checkIsAdmin } from '../lib/adminAuth';
import { auth } from '../lib/firebase';
import { deleteNoticeSoft } from '../lib/noticeUtils';

/**
 * Shared state + handlers for the old ClassRoster.jsx (Roster / Notices /
 * My Role tabs). Extracted verbatim so the three new independent pages
 * (ClassRosterPage, ClassNotices, ClassMyRole) stay backed by exactly the
 * same Firestore subscriptions and logic as before the split.
 */
export function useClassRosterState() {
  const profile = getProfile();
  const groupId = getGroupId(profile);
  const groupLabel = getGroupLabel(profile);
  const uid = auth.currentUser?.uid;
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
  const [leaveState, setLeaveState] = useState('idle');
  const [leaveMsg, setLeaveMsg] = useState('');
  const [canSelfApprove, setCanSelfApprove] = useState(false);
  const [sentNotices, setSentNotices] = useState([]);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (!groupId) { setSentNotices([]); return; }
    return subscribeGroupNotices(groupId, (notices) => {
      setSentNotices(
        notices
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

  return {
    profile, groupId, groupLabel, uid, handoffIntent,
    myRole, title, setTitle, rosterCounts, setRosterCounts, body, setBody,
    showPreview, setShowPreview, noticeTextareaRef, priority, setPriority,
    sending, sendMsg, leaveState, leaveMsg, canSelfApprove,
    sentNotices, deletingId, handleDeleteNotice, handleSendNotice, handleRequestLeave,
  };
}
