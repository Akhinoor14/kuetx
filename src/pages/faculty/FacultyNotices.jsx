// FacultyNotices.jsx
//
// §8.10 — reuses noticeUtils.js's subscribeAllNotices (same feed students/
// CRs already see) scoped to whichever class group the teacher picks, plus
// a compose box that writes via facultyNoticeSync.js's postFacultyNotice.
// A teacher can teach multiple groups (different dept/batch), so this page
// needs an explicit class picker rather than assuming a single group like
// the student-side Notice.jsx (which only ever has one group: the
// student's own).

import { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { auth } from '../../lib/firebase';
import { subscribeMyClassIndex } from '../../lib/facultyClassSync';
import { getFacultyDoc } from '../../lib/facultySync';
import * as noticeApi from '../../lib/noticeUtils';
import { postFacultyNotice } from '../../lib/facultyNoticeSync';
import { notify } from '../../lib/notify';

export default function FacultyNotices() {
  const [classes, setClasses] = useState(null);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [notices, setNotices] = useState([]);
  const [facultyDoc, setFacultyDoc] = useState(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetType, setTargetType] = useState('broadcast');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    getFacultyDoc(uid).then(setFacultyDoc);
    return subscribeMyClassIndex(uid, (list) => {
      setClasses(list);
      const active = list.filter((c) => c.status === 'active');
      if (!selectedGroupId && active.length) setSelectedGroupId(active[0].groupId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedGroupId) { setNotices([]); return; }
    // profile arg only matters for the student-only merge branches inside
    // subscribeAllNotices (CR/global audience filtering) — passing an empty
    // profile here is fine since we're explicitly scoping by groupId, not
    // relying on profile-derived group resolution.
    return noticeApi.subscribeAllNotices({}, selectedGroupId, setNotices);
  }, [selectedGroupId]);

  const activeClasses = (classes || []).filter((c) => c.status === 'active');
  const groupOptions = [...new Map(activeClasses.map((c) => [c.groupId, c])).values()];

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      notify('Please enter both a title and a message.', 'error');
      return;
    }
    setSending(true);
    try {
      const selectedClass = groupOptions.find((c) => c.groupId === selectedGroupId);
      await postFacultyNotice(selectedGroupId, facultyDoc, auth.currentUser.uid, {
        title: title.trim(), body: body.trim(), targetType,
        courseCode: selectedClass?.courseCode || '',
      });
      setTitle('');
      setBody('');
      notify('Notice sent.', 'success');
    } catch (e) {
      notify(e.message || 'Could not send this notice.', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="hub-page-bg" style={{ minHeight: '100vh' }}>
      <div className="page-container" style={{ padding: '20px 24px 40px' }}>
        <div className="hub-page-hero">
          <div className="hub-page-hero-main">
            <div className="hub-page-hero-head">
              <div className="hub-page-hero-icon">
                <Icons.Bell size={24} color="var(--accent)" />
              </div>
              <h1 className="hub-page-hero-title">Notices</h1>
            </div>
            <div className="hub-page-hero-subtitle">Post announcements to your classes</div>
          </div>
          {selectedGroupId && (
            <div className="hub-page-hero-stats">
              <div className="hub-page-hero-stat">
                <div className="hub-page-hero-stat-n">{notices.length}</div>
                <div className="hub-page-hero-stat-label">notices</div>
              </div>
            </div>
          )}
        </div>

        {groupOptions.length > 1 && (
          <select
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13.5, marginBottom: 16 }}
          >
            {groupOptions.map((c) => <option key={c.groupId} value={c.groupId}>{c.batch?.toUpperCase()} {c.dept}</option>)}
          </select>
        )}

        {!selectedGroupId && (
          <div style={{ padding: 24, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--muted)', fontSize: 13.5, textAlign: 'center' }}>
            Add a class first to post notices to it.
          </div>
        )}

        {selectedGroupId && (
          <>
            <div style={{ padding: 16, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--card)', marginBottom: 20, display: 'grid', gap: 10 }}>
              <input
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13.5 }}
              />
              <textarea
                placeholder="Message"
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                style={{ padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13.5, resize: 'vertical' }}
              />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="radio" checked={targetType === 'broadcast'} onChange={() => setTargetType('broadcast')} />
                  All students
                </label>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="radio" checked={targetType === 'cr_only'} onChange={() => setTargetType('cr_only')} />
                  CR only
                </label>
              </div>
              <button
                className="accent-fill-glass"
                onClick={handleSend}
                disabled={sending}
                style={{ padding: '10px 16px', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: sending ? 0.6 : 1 }}
              >
                {sending ? 'Sending…' : 'Send Notice'}
              </button>
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              {notices.map((n) => (
                <div key={n.id} style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)' }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)' }}>{n.title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{n.body}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
