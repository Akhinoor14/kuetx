// FacultyNoticeBroadcast.jsx
//
// Sidebar "Broadcast Notice" page — replaces the old FacultyNotices.jsx at
// /faculty/notices. This is deliberately the ONLY place a teacher can send
// to MULTIPLE classes at once (see postFacultyNoticeMulti in
// facultyNoticeSync.js). The single-class notice tab living inside My
// Classes -> Class Detail is a separate, always-single-class surface —
// this page does not replace that one, only the old sidebar hub.
//
// Recipient model:
//   - Pick one or more classes (checkboxes) the teacher currently teaches.
//   - Choose "All Students" (every student in every selected class) or
//     "Select CR/ACR" (pick specific CR/ACR people, pulled per-class from
//     groups/{groupId}/members where role is 'cr' or 'acr').
//   - Send fans out one notice doc per selected class via
//     postFacultyNoticeMulti, tagged targetType 'broadcast' or 'cr_only'
//     accordingly — same per-class semantics the rest of the app already
//     understands, just applied across many classes in one action.
//
// This page shows the teacher's own SENT notices below the composer, using
// subscribeAllNotices(..., 'faculty') — the audience filter that keeps
// CR/ACR-authored class notices out of a teacher's own sent-history view.

import { useEffect, useMemo, useRef, useState } from 'react';
import * as Icons from 'lucide-react';
import { Link } from 'react-router-dom';
import { auth } from '../../lib/firebase';
import { subscribeMyClassIndex } from '../../lib/facultyClassSync';
import { getFacultyDoc } from '../../lib/facultySync';
import { getGroupMembersOnce } from '../../lib/groupSync';
import * as noticeApi from '../../lib/noticeUtils';
import { postFacultyNoticeMulti } from '../../lib/facultyNoticeSync';
import { notify } from '../../lib/notify';
import { useIsFaculty } from '../../hooks/useIsFaculty';
import NoticeInsightsPanel from '../../components/NoticeInsightsPanel';
import NoticeComposerToolbar from '../../components/NoticeComposerToolbar';
import NoticePrioritySelector from '../../components/NoticePrioritySelector';
import { renderFormattedNoticeBody } from '../../lib/noticeFormat';

export default function FacultyNoticeBroadcast() {
  const [classes, setClasses] = useState(null);
  const [facultyDoc, setFacultyDoc] = useState(null);
  // Broadcasting a notice reaches every student in the selected classes —
  // a fake/unverified account doing this is exactly the kind of damage
  // the manual verification policy exists to prevent, and
  // firestore.rules already independently requires isVerifiedFaculty()
  // on the notices/{noticeId} create write. This UI gate just gives a
  // clear message instead of a raw permission-denied.
  const { isFounderBypass, facultyProfile } = useIsFaculty();
  const isVerified = isFounderBypass || !!facultyProfile?.verifiedAt;

  // Multi-class selection
  const [selectedGroupIds, setSelectedGroupIds] = useState(new Set());

  // Recipient mode: 'all' | 'cr'
  const [recipientMode, setRecipientMode] = useState('all');
  // CR/ACR roster per selected class, loaded on demand
  const [crRoster, setCrRoster] = useState({}); // groupId -> [{uid, name, role, groupId, label}]
  const [rosterLoading, setRosterLoading] = useState(false);
  const [selectedCrUids, setSelectedCrUids] = useState(new Set());

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const noticeTextareaRef = useRef(null);
  const [priority, setPriority] = useState('normal');
  const [sending, setSending] = useState(false);

  const [sentNotices, setSentNotices] = useState([]);
  // Phase 2 of the Notice upgrade (Manage/Delete).
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    getFacultyDoc(uid).then(setFacultyDoc);
    return subscribeMyClassIndex(uid, setClasses);
  }, []);

  const activeClasses = useMemo(
    () => (classes || []).filter((c) => c.status === 'active'),
    [classes],
  );
  const groupOptions = useMemo(
    () => [...new Map(activeClasses.map((c) => [c.groupId, c])).values()],
    [activeClasses],
  );

  // Sent-history feed: merge each selected... actually we want ALL of the
  // teacher's own sent notices across every class they teach, not just the
  // ones currently checked in the composer — so subscribe per taught class
  // and merge, filtered to 'from: Teacher' only.
  useEffect(() => {
    if (!groupOptions.length) { setSentNotices([]); return; }
    const perGroup = {};
    const unsubs = groupOptions.map((c) =>
      noticeApi.subscribeAllNotices({}, c.groupId, (list) => {
        perGroup[c.groupId] = list;
        const merged = Object.values(perGroup).flat();
        const seen = new Set();
        const deduped = [];
        for (const n of merged) {
          if (seen.has(n.id)) continue;
          seen.add(n.id);
          deduped.push(n);
        }
        deduped.sort((a, b) => b.createdAt - a.createdAt);
        setSentNotices(deduped);
      }, 'faculty', { viewerUid: auth.currentUser?.uid }),
    );
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupOptions.map((c) => c.groupId).join(',')]);

  const toggleGroup = (groupId) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  // Load CR/ACR roster for currently-selected classes when switching to
  // "Select CR/ACR" mode, or when the class selection changes while in
  // that mode.
  useEffect(() => {
    if (recipientMode !== 'cr' || selectedGroupIds.size === 0) return;
    let cancelled = false;
    setRosterLoading(true);
    (async () => {
      const entries = await Promise.all(
        [...selectedGroupIds].map(async (groupId) => {
          const cls = groupOptions.find((c) => c.groupId === groupId);
          const members = await getGroupMembersOnce(groupId);
          const crs = members.filter((m) => m.role === 'cr' || m.role === 'acr');
          return [groupId, crs.map((m) => ({
            uid: m.id,
            name: m.name || m.roll || 'Unknown',
            role: m.role,
            groupId,
            label: `${m.name || m.roll || 'Unknown'} — ${(cls?.batch || '').toUpperCase()} ${cls?.dept || ''} (${m.role.toUpperCase()})`,
          }))];
        }),
      );
      if (cancelled) return;
      setCrRoster(Object.fromEntries(entries));
      setRosterLoading(false);
    })();
    return () => { cancelled = true; };
  }, [recipientMode, [...selectedGroupIds].join(','), groupOptions]);

  const rosterFlat = useMemo(
    () => [...selectedGroupIds].flatMap((gid) => crRoster[gid] || []),
    [selectedGroupIds, crRoster],
  );

  const toggleCr = (uid) => {
    setSelectedCrUids((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const handleSend = async () => {
    if (!isVerified) {
      notify('Blue Tick verification is required before you can send notices.', 'error');
      return;
    }
    if (!title.trim() || !body.trim()) {
      notify('Please enter both a title and a message.', 'error');
      return;
    }
    if (selectedGroupIds.size === 0) {
      notify('Select at least one class.', 'error');
      return;
    }
    if (recipientMode === 'cr' && selectedCrUids.size === 0) {
      notify('Select at least one CR/ACR to notify.', 'error');
      return;
    }

    // In CR mode, only send to classes that actually have a selected
    // CR/ACR checked — a class with none checked is silently excluded
    // rather than accidentally broadcasting to its whole roster.
    const targetGroupIds = recipientMode === 'all'
      ? [...selectedGroupIds]
      : [...selectedGroupIds].filter((gid) => (crRoster[gid] || []).some((m) => selectedCrUids.has(m.uid)));

    if (targetGroupIds.length === 0) {
      notify('No selected CR/ACR belongs to the checked classes.', 'error');
      return;
    }

    setSending(true);
    try {
      await postFacultyNoticeMulti(targetGroupIds, facultyDoc, auth.currentUser.uid, {
        title: title.trim(),
        body: body.trim(),
        targetType: recipientMode === 'all' ? 'broadcast' : 'cr_only',
        priority,
      });
      setTitle('');
      setBody('');
      setShowPreview(false);
      setPriority('normal');
      notify(`Notice sent to ${targetGroupIds.length} class${targetGroupIds.length > 1 ? 'es' : ''}.`, 'success');
    } catch (e) {
      notify(e.message || 'Could not send this notice.', 'error');
    } finally {
      setSending(false);
    }
  };

  // Phase 2 of the Notice upgrade (Manage/Delete). Each sentNotices item
  // already carries its own groupId (see noticeUtils.js's subscribeAllNotices
  // — group notices are now stamped with groupId as of Phase 2), so a
  // single delete handler works even though this feed merges notices
  // across several different classes.
  const handleDeleteNotice = async (notice) => {
    if (!window.confirm('Delete this notice? It will be removed from that class\'s feed.')) return;
    setDeletingId(notice.id);
    try {
      await noticeApi.deleteNoticeSoft(notice.id, notice.groupId);
    } catch (err) {
      notify(err?.message || 'Could not delete this notice.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="hub-page-bg" style={{ minHeight: '100vh' }}>
      <div className="broadcast-notice-page page-container" style={{ padding: '16px 20px 32px' }}>
        <div className="hub-page-hero">
          <div className="hub-page-hero-main">
            <div className="hub-page-hero-head">
              <div className="hub-page-hero-icon">
                <Icons.Bell size={24} color="var(--accent)" />
              </div>
              <h1 className="hub-page-hero-title">Broadcast Notice</h1>
            </div>
            <div className="hub-page-hero-subtitle">
              Send one notice to several of your classes at once — pick classes, choose who should see it, then send
            </div>
          </div>
        </div>

        {groupOptions.length === 0 && (
          <div style={{ padding: 24, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--muted)', fontSize: 13.5, textAlign: 'center' }}>
            Add a class first to broadcast notices.
          </div>
        )}

        {groupOptions.length > 0 && (
          <>
            <div style={{ padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                1. Select classes
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {groupOptions.map((c) => {
                  const checked = selectedGroupIds.has(c.groupId);
                  return (
                    <label
                      key={c.groupId}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999,
                        border: `1px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
                        background: checked ? 'color-mix(in srgb, var(--accent) 12%, var(--surface))' : 'var(--surface)',
                        fontSize: 12, cursor: 'pointer', color: 'var(--text)',
                      }}
                    >
                      <input type="checkbox" checked={checked} onChange={() => toggleGroup(c.groupId)} style={{ margin: 0 }} />
                      {(c.batch || '').toUpperCase()} {c.dept}
                    </label>
                  );
                })}
              </div>
            </div>

            <div style={{ padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                2. Who should see this
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: recipientMode === 'cr' ? 10 : 0 }}>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="radio" checked={recipientMode === 'all'} onChange={() => setRecipientMode('all')} />
                  All students (of selected classes)
                </label>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="radio" checked={recipientMode === 'cr'} onChange={() => setRecipientMode('cr')} />
                  Select CR/ACR
                </label>
              </div>

              {recipientMode === 'cr' && (
                <div>
                  {selectedGroupIds.size === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Select a class above first.</div>
                  )}
                  {selectedGroupIds.size > 0 && rosterLoading && (
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Loading CR/ACR…</div>
                  )}
                  {selectedGroupIds.size > 0 && !rosterLoading && rosterFlat.length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>No verified CR/ACR found for the selected class(es).</div>
                  )}
                  {!rosterLoading && rosterFlat.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {rosterFlat.map((m) => {
                        const checked = selectedCrUids.has(m.uid);
                        return (
                          <label
                            key={`${m.groupId}-${m.uid}`}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8,
                              border: `1px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
                              background: checked ? 'color-mix(in srgb, var(--accent) 8%, var(--surface))' : 'var(--surface)',
                              fontSize: 12.5, cursor: 'pointer', color: 'var(--text)',
                            }}
                          >
                            <input type="checkbox" checked={checked} onChange={() => toggleCr(m.uid)} style={{ margin: 0 }} />
                            {m.label}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', marginBottom: 14, display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>3. Message</div>
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
              <input
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
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
                    placeholder="Message"
                    rows={3}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, resize: 'vertical' }}
                  />
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
              <button
                onClick={handleSend}
                disabled={sending || !isVerified}
                title={!isVerified ? 'Blue Tick verification needed before you can send notices' : undefined}
                style={{ padding: '9px 14px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: (sending || !isVerified) ? 'not-allowed' : 'pointer', opacity: (sending || !isVerified) ? 0.5 : 1 }}
              >
                {sending ? 'Sending…' : 'Send Notice'}
              </button>
              {!isVerified && (
                <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                  🔒 Needs Blue Tick verification. Visit <Link to="/faculty/contact">Contact</Link> if you need help getting verified.
                </div>
              )}
            </div>

            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
              Sent notices
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {sentNotices.length === 0 && (
                <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>No notices sent yet.</div>
              )}
              {sentNotices.map((n) => (
                <div key={n.id} style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)' }}>{n.title}</span>
                      {n.deleted && (
                        <span style={{
                          fontSize: 9.5, fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase',
                          border: '1px solid var(--danger)', borderRadius: 4, padding: '1px 5px', flexShrink: 0,
                        }}>
                          Deleted
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
                        {n.targetType === 'cr_only' ? 'CR/ACR only' : 'All students'}
                      </span>
                      {!n.deleted && (
                        <button
                          type="button"
                          onClick={() => handleDeleteNotice(n)}
                          disabled={deletingId === n.id}
                          aria-label={`Delete notice: ${n.title}`}
                          style={{
                            display: 'flex', alignItems: 'center', color: 'var(--danger)',
                            background: 'none', border: 'none', cursor: deletingId === n.id ? 'not-allowed' : 'pointer',
                            padding: 0, opacity: deletingId === n.id ? 0.5 : 1,
                          }}
                        >
                          <Icons.Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2, opacity: n.deleted ? 0.6 : 1 }}>{renderFormattedNoticeBody(n.body)}</div>
                  <NoticeInsightsPanel
                    noticeId={n.id}
                    groupId={n.groupId}
                    audienceSize={n.audienceSize}
                    title={n.title}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
