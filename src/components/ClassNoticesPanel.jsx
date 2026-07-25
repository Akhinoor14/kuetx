import { useEffect, useMemo, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { getProfile, store } from '../store/store';
import { getGroupId, getGroupLabel } from '../lib/groupUtils';
import { subscribeGroupNotices, subscribeGlobalNotices, noticeAppliesTo, subscribeMyRole, subscribeIsOwnMember } from '../lib/groupSync';
import { filterStudentFacingNotices } from '../lib/noticeUtils';
import { renderFormattedNoticeBody } from '../lib/noticeFormat';
import { auth } from '../lib/firebase';

function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts?.toMillis === 'function') return ts.toMillis();
  if (typeof ts?.toDate === 'function') return ts.toDate().getTime();
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

export default function ClassNoticesPanel() {
  const profile = getProfile();
  const groupId = getGroupId(profile);
  const groupLabel = getGroupLabel(profile);

  const [groupNoticesRaw, setGroupNoticesRaw] = useState([]);
  const [globalNotices, setGlobalNotices] = useState([]);
  const [lastSeen, setLastSeen] = useState(() => store.get('lastSeenNoticeAt') || 0);
  const [isViewerCR, setIsViewerCR] = useState(false);
  // Class notices (groups/{groupId}/notices) are Firestore-rule-gated to
  // isVerifiedMember(groupId) — a pending join request is NOT enough.
  // subscribeIsOwnMember reports a real boolean (doc exists or not),
  // unlike subscribeMyRole which defaults to the string 'member' even
  // for a non-member — so this never even attempts the class-notices
  // subscription for someone still waiting on CR/ACR approval, instead
  // of relying on the listener's permission-denied retry/backoff path.
  const [isOwnMember, setIsOwnMember] = useState(false);

  useEffect(() => subscribeGlobalNotices(setGlobalNotices), []);
  useEffect(() => {
    if (!groupId || !auth.currentUser?.uid) { setIsOwnMember(false); return; }
    return subscribeIsOwnMember(groupId, auth.currentUser.uid, setIsOwnMember);
  }, [groupId]);
  useEffect(() => {
    if (!groupId || !isOwnMember) { setGroupNoticesRaw([]); return; }
    return subscribeGroupNotices(groupId, setGroupNoticesRaw);
  }, [groupId, isOwnMember]);
  useEffect(() => {
    if (!groupId || !auth.currentUser?.uid) { setIsViewerCR(false); return; }
    return subscribeMyRole(groupId, auth.currentUser.uid, (role) => {
      setIsViewerCR(role === 'cr' || role === 'acr');
    });
  }, [groupId]);

  const groupNotices = useMemo(
    () => filterStudentFacingNotices(groupNoticesRaw, isViewerCR),
    [groupNoticesRaw, isViewerCR],
  );

  const combined = useMemo(() => {
    // Handoff item 2: pass the current uid so a student_uids-targeted
    // notice actually shows up here for its target (see noticeUtils.js's
    // subscribeAllNotices for the fuller explanation of why this was missing).
    const applicableGlobal = globalNotices.filter((n) => noticeAppliesTo(n, profile, groupId, auth.currentUser?.uid));
    const merged = [
      ...groupNotices.map((n) => ({ ...n, _source: 'class', _title: n.title, _body: n.body, _by: n.postedBy, _at: n.createdAt })),
      ...applicableGlobal.map((n) => ({ ...n, _source: 'global', _title: n.title, _body: n.body, _by: n.createdBy, _at: n.createdAt })),
    ];
    return merged.sort((a, b) => toMillis(b._at) - toMillis(a._at));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupNotices, globalNotices, groupId]);

  const unreadCount = combined.filter((n) => toMillis(n._at) > lastSeen).length;

  const markAllRead = () => {
    const now = Date.now();
    store.set('lastSeenNoticeAt', now);
    setLastSeen(now);
  };

  if (combined.length === 0) return null;

  return (
    <div style={{
      marginBottom: 16, padding: 16, borderRadius: 18, border: '1px solid var(--border)',
      background: 'linear-gradient(180deg, var(--surfaceGlassStrong), var(--surfaceGlass))',
      boxShadow: '0 10px 28px rgba(0,0,0,0.10)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Megaphone size={14} color="var(--accent)" /> Notices {unreadCount > 0 && <span style={{ color: 'var(--accent)' }}>({unreadCount} new)</span>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Admin announcements{groupId ? <> and updates from {groupLabel}</> : ''}
          </div>
        </div>
        {unreadCount > 0 && (
          <button className="btn btn-sm btn-secondary" onClick={markAllRead}>Mark all read</button>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {combined.slice(0, 20).map((n) => (
          <div key={`${n._source}-${n.id}`} style={{
            padding: '10px 12px', borderRadius: 12, border: '1px solid var(--border)',
            background: toMillis(n._at) > lastSeen ? 'var(--accentSoft)' : 'var(--surface)', fontSize: 12,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontWeight: 700 }}>{n._title}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
                {n._source === 'global' ? 'Admin' : 'Class'}
              </span>
            </div>
            <div style={{ color: 'var(--muted)', marginTop: 4 }}>{renderFormattedNoticeBody(n._body)}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
              — {n._by?.name || 'Unknown'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
