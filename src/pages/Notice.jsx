import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Crown, Megaphone, Users, GraduationCap, UserCircle2, AlertTriangle, Info, Search, Pin, CheckCircle2 } from 'lucide-react';
import * as noticeApi from '../lib/noticeUtils';
import { getProfile } from '../store/store';
import { getGroupId } from '../lib/groupUtils';
import { renderFormattedNoticeBody, flattenNoticePreview } from '../lib/noticeFormat';
import { auth } from '../lib/firebase';
import { subscribeMyRole } from '../lib/groupSync';

function timeAgo(ms) {
  if (!ms) return '';
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ms).toLocaleDateString();
}

// Phase 4 of the Notice upgrade: notices have an optional `priority`
// field ('urgent' | 'normal' | 'info'), stamped at send time by all 3
// composers (see NoticePrioritySelector.jsx). Old notices written before
// this phase have no `priority` field at all — treated as 'normal',
// matching the exact pre-Phase-4 visual, so nothing already in the
// database changes appearance.
const PRIORITY_META = {
  urgent: { color: 'var(--danger)', label: 'Urgent', Icon: AlertTriangle },
  info: { color: 'var(--muted)', label: 'Info', Icon: Info },
};

// A notice body renders as one <div> per paragraph (see
// renderFormattedNoticeBody in noticeFormat.jsx) — used to decide
// whether a card's body should start collapsed behind "Read more".
function countParagraphs(text) {
  if (!text) return 0;
  return String(text).replace(/\r\n/g, '\n').trim().split(/\n{2,}/).filter((p) => p.trim()).length;
}

const READ_MORE_PARAGRAPH_THRESHOLD = 3;

function NoticeCard({ n, isUnread, onOpen, isAcknowledged, onAcknowledge }) {
  const [expanded, setExpanded] = useState(false);
  const isFounder = n.isFounder;
  const priority = n.priority || 'normal';
  const priorityMeta = PRIORITY_META[priority];
  const isUrgent = priority === 'urgent';
  const isInfo = priority === 'info';

  const paragraphCount = countParagraphs(n.body);
  const isLong = paragraphCount > READ_MORE_PARAGRAPH_THRESHOLD;

  // Founder styling still wins visually over priority (Founder notices
  // are rare and already maximally emphasized) — priority styling applies
  // to every other card, urgent taking precedence over the founder-less
  // default border/background treatment.
  const borderColor = isFounder
    ? 'color-mix(in srgb, var(--accent) 55%, var(--border))'
    : isUrgent
      ? 'color-mix(in srgb, var(--danger) 55%, var(--border))'
      : isUnread ? 'color-mix(in srgb, var(--accent) 30%, var(--border))' : 'var(--border)';

  const background = isFounder
    ? 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 12%, var(--surface)), var(--surface))'
    : isUrgent
      ? 'color-mix(in srgb, var(--danger) 7%, var(--surface))'
      : isUnread ? 'color-mix(in srgb, var(--accent) 6%, var(--surface))' : 'var(--surface)';

  const content = (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: isFounder ? '16px 16px' : '13px 14px',
      borderRadius: 14,
      position: 'relative',
      borderLeft: isUrgent && !isFounder ? '3.5px solid var(--danger)' : undefined,
      border: isFounder
        ? '1.5px solid ' + borderColor
        : isUrgent
          ? `1px solid ${borderColor}`
          : `1px solid ${borderColor}`,
      background,
      boxShadow: isFounder ? '0 2px 10px color-mix(in srgb, var(--accent) 18%, transparent)' : 'none',
      opacity: isInfo && !isUnread ? 0.85 : 1,
    }}>
      {isUnread && (
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: isUrgent ? 'var(--danger)' : 'var(--accent)', flexShrink: 0, marginTop: 6 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        {isFounder && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 10, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase',
            color: '#fff', background: 'var(--accent)',
            borderRadius: 999, padding: '2px 8px', marginBottom: 6,
          }}>
            <Crown size={11} /> Founder
          </div>
        )}
        {!isFounder && priorityMeta && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 10, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase',
            color: isUrgent ? '#fff' : priorityMeta.color,
            background: isUrgent ? priorityMeta.color : 'color-mix(in srgb, ' + priorityMeta.color + ' 16%, transparent)',
            borderRadius: 999, padding: '2px 8px', marginBottom: 6,
          }}>
            <priorityMeta.Icon size={11} /> {priorityMeta.label}
          </div>
        )}
        {n.isPersonal && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 10, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase',
            color: '#0891b2', background: 'rgba(8,145,178,0.14)',
            borderRadius: 999, padding: '2px 8px', marginBottom: 6, marginLeft: (isFounder || (!isFounder && priorityMeta)) ? 6 : 0,
          }}>
            Just for you
          </div>
        )}
        <div style={{
          fontSize: isFounder ? 15 : 13,
          fontWeight: isFounder ? 800 : 700,
          color: isFounder ? 'var(--accent)' : isUrgent ? 'var(--danger)' : 'var(--text)',
        }}>
          {n.title}
        </div>
        <div
          style={{
            fontSize: 12.5, color: 'var(--muted)', marginTop: 3, lineHeight: 1.45,
            ...(isLong && !expanded ? {
              maxHeight: '4.5em', overflow: 'hidden',
              maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
            } : {}),
          }}
        >
          {renderFormattedNoticeBody(n.body)}
        </div>
        {isLong && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExpanded((v) => !v); }}
            style={{
              fontSize: 11, fontWeight: 700, color: 'var(--accent)', background: 'none', border: 'none',
              padding: 0, marginTop: 4, cursor: 'pointer',
            }}
          >
            {expanded ? 'Show less' : 'Read more'}
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 9 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 11.5, fontWeight: 700, color: 'var(--text)',
          }}>
            {n.roleTag === 'Teacher' ? (
              <GraduationCap size={13} color="var(--accent)" />
            ) : n.roleTag === 'CR' ? (
              <UserCircle2 size={13} color="var(--muted)" />
            ) : (
              <Megaphone size={13} color="var(--muted)" />
            )}
            {n.from}
          </div>
          {n.courseCode && (
            <span style={{
              fontSize: 10.5, fontWeight: 700, letterSpacing: 0.2,
              color: 'var(--accent)',
              background: 'color-mix(in srgb, var(--accent) 14%, transparent)',
              borderRadius: 999, padding: '2px 8px',
            }}>
              {n.courseCode}
            </span>
          )}
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>·</span>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{timeAgo(n.createdAt)}</span>
        </div>
        {n.section === 'class' && (
          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAcknowledge(); }}
              disabled={isAcknowledged}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
                border: `1px solid ${isAcknowledged ? 'var(--accent)' : 'var(--border)'}`,
                background: isAcknowledged ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'var(--surface)',
                color: isAcknowledged ? 'var(--accent)' : 'var(--muted)',
                cursor: isAcknowledged ? 'default' : 'pointer',
              }}
            >
              <CheckCircle2 size={12} />
              {isAcknowledged ? 'Got it' : 'Mark as Got it'}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return n.link ? (
    <Link to={n.link} onClick={onOpen} style={{ textDecoration: 'none', display: 'block' }}>
      {content}
    </Link>
  ) : (
    <div onClick={onOpen} style={{ cursor: 'pointer' }}>
      {content}
    </div>
  );
}

function Section({ icon: Icon, title, count, children }) {
  if (!children || (Array.isArray(children) && children.length === 0)) return null;
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '0 2px' }}>
        <Icon size={14} color="var(--muted)" />
        <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>
          {title}
        </span>
        {count > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)' }}>({count})</span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {children}
      </div>
    </div>
  );
}

// Phase 4: "All | Founder | Admin | My Class | Unread" — client-side
// filter over the already-fetched notices array (no new Firestore
// query). 'Unread' needs isUnread passed in since read state lives in
// localStorage, not on the notice doc itself.
const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'founder', label: 'Founder' },
  { key: 'admin', label: 'Admin' },
  { key: 'class', label: 'My Class' },
  { key: 'unread', label: 'Unread' },
];

function applyFilterTab(notices, tab, isUnread) {
  switch (tab) {
    case 'founder': return notices.filter((n) => n.section === 'admin' && n.isFounder);
    case 'admin': return notices.filter((n) => n.section === 'admin' && !n.isFounder);
    case 'class': return notices.filter((n) => n.section === 'class');
    case 'unread': return notices.filter((n) => isUnread(n.id));
    default: return notices;
  }
}

function applySearch(notices, query) {
  const q = query.trim().toLowerCase();
  if (!q) return notices;
  return notices.filter((n) => {
    const title = (n.title || '').toLowerCase();
    const body = flattenNoticePreview(n.body || '').toLowerCase();
    return title.includes(q) || body.includes(q);
  });
}

export default function Notice() {
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const handle = () => setRefreshTick(t => t + 1);
    window.addEventListener('kuetx:store-updated', handle);
    return () => window.removeEventListener('kuetx:store-updated', handle);
  }, []);

  const profile = useMemo(() => getProfile() || {}, [refreshTick]);
  const groupId = useMemo(() => getGroupId(profile), [profile]);

  const readIds = useMemo(() => noticeApi.getReadNoticeIds(), [refreshTick]);

  // Phase 6: local (per-device) acknowledged-state, mirrors readIds
  // above so "✅ Got it" reflects instantly. setNoticeAcknowledgedLocal
  // already dispatches 'kuetx:store-updated' (same event this
  // component listens to via refreshTick), so no separate state/effect
  // is needed to pick up the change.
  const acknowledgedIds = useMemo(() => noticeApi.getAcknowledgedNoticeIds(), [refreshTick]);
  const isAcknowledged = (id) => acknowledgedIds.has(id);

  // Whether the signed-in student is CR/ACR in their own group — gates
  // whether a Teacher's cr_only notice shows up at all (see
  // filterStudentFacingNotices in noticeUtils.js).
  const [isViewerCR, setIsViewerCR] = useState(false);
  useEffect(() => {
    if (!groupId || !auth.currentUser?.uid) { setIsViewerCR(false); return; }
    return subscribeMyRole(groupId, auth.currentUser.uid, (role) => {
      setIsViewerCR(role === 'cr' || role === 'acr');
    });
  }, [groupId]);

  // Live notice feed (global admin broadcasts + group CR/ACR notices).
  const [notices, setNotices] = useState([]);
  useEffect(() => {
    return noticeApi.subscribeAllNotices(profile, groupId, setNotices, 'student', { isViewerCR, uid: auth.currentUser?.uid });
  }, [profile, groupId, isViewerCR]);

  const unread = noticeApi.getUnreadNotices(notices, readIds);
  const isUnread = (id) => unread.some(u => u.id === id);

  // markRead does BOTH: the existing local (localStorage) mark — which
  // drives the unread-dot UI exactly as before, offline included — AND
  // the new Firestore read-receipt (Phase 0), which is what lets a
  // sender see "who has read this" in their Insights panel later. The
  // Firestore call is fire-and-forget/best-effort; it never blocks or
  // affects the local unread-dot UI (see markNoticeReadInFirestore).
  const markRead = (id) => {
    noticeApi.setNoticeRead(id, true);
    const notice = notices.find(n => n.id === id);
    const uid = auth.currentUser?.uid;
    if (notice && uid) {
      // Global (admin/founder) notices have section 'admin' and live at
      // notices/{id}; group (CR/ACR/Teacher) notices have section
      // 'class' and live at groups/{groupId}/notices/{id} — see
      // subscribeAllNotices in noticeUtils.js for where these tags come
      // from.
      const noticeGroupId = notice.section === 'class' ? groupId : null;
      noticeApi.markNoticeReadInFirestore(id, noticeGroupId, profile, uid);
    }
  };

  // Phase 6: "✅ Got it" — same shape as markRead above (local mark +
  // best-effort Firestore write). Acknowledged is a SUBSET of read
  // (see acknowledgeNoticeInFirestore in noticeUtils.js), so this also
  // marks the notice as read first if it isn't already, since the
  // button is reachable without the card having been opened.
  const handleAcknowledge = (id) => {
    if (isAcknowledged(id)) return;
    if (isUnread(id)) markRead(id);
    noticeApi.setNoticeAcknowledgedLocal(id, true);
    const notice = notices.find(n => n.id === id);
    const uid = auth.currentUser?.uid;
    if (notice && uid) {
      const noticeGroupId = notice.section === 'class' ? groupId : null;
      noticeApi.acknowledgeNoticeInFirestore(id, noticeGroupId, profile, uid);
    }
  };

  // Founder notices always float to the top of the Admin section, then
  // remaining admin notices, then class (CR/ACR) notices — each section
  // keeps its own newest-first order.
  const founderNotices = notices.filter(n => n.section === 'admin' && n.isFounder);
  const adminNotices = notices.filter(n => n.section === 'admin' && !n.isFounder);
  const classNotices = notices.filter(n => n.section === 'class');

  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Search + tab filter both apply on top of the merged `notices` array
  // (client-side, no new Firestore query — the feed is already capped at
  // ~50 by subscribeAllNotices's underlying queries) — search first, then
  // narrow by tab, matching how a person reads the two controls together
  // ("find X" then "only show me unread X").
  const searched = applySearch(notices, searchQuery);
  const filtered = applyFilterTab(searched, activeTab, isUnread);

  // BUGFIX (audit finding): this used to filter from the raw `notices`
  // array instead of `filtered` — meaning an urgent notice stayed pinned
  // at the top regardless of the active search query or filter tab (e.g.
  // searching "exam" still pinned an unrelated urgent library notice, or
  // selecting the "My Class" tab still pinned an urgent Admin notice).
  // "Cross-cutting" in the original spec meant across sections (shown
  // above Founder too), not exempt from search/filter — every other
  // section already respects both, so the pinned strip should too.
  const pinnedNotices = filtered.filter((n) => n.priority === 'urgent' && !n.expired);

  const founderFiltered = filtered.filter(n => n.section === 'admin' && n.isFounder);
  const adminFiltered = filtered.filter(n => n.section === 'admin' && !n.isFounder);
  const classFiltered = filtered.filter(n => n.section === 'class');
  const isFiltering = activeTab !== 'all' || searchQuery.trim() !== '';

  return (
    <div className="page-enter page-container content-page-bg" style={{ paddingBottom: 48 }}>
      <div className="content-page-hero">
        <div className="content-page-hero-icon">
          <Bell size={18} color="var(--accent)" />
        </div>
        <div>
          <h1 className="content-page-hero-title">Notice</h1>
          <p className="content-page-hero-subtitle">Announcements from Founder/Admin, and CR/ACR land here.</p>
        </div>
      </div>

      {pinnedNotices.length > 0 && (
        <div style={{
          marginBottom: 18, padding: 12, borderRadius: 14, maxWidth: 1400,
          border: '1.5px solid var(--danger)',
          background: 'color-mix(in srgb, var(--danger) 8%, var(--surface))',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '0 2px' }}>
            <Pin size={13} color="var(--danger)" />
            <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--danger)' }}>
              Pinned — Urgent
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pinnedNotices.map((n) => (
              <NoticeCard key={`pinned-${n.id}`} n={n} isUnread={isUnread(n.id)} onOpen={() => markRead(n.id)} isAcknowledged={isAcknowledged(n.id)} onAcknowledge={() => handleAcknowledge(n.id)} />
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 18, maxWidth: 1400 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 220px', minWidth: 180, maxWidth: 320,
          padding: '7px 10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)',
        }}>
          <Search size={14} color="var(--muted)" style={{ flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search notices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              border: 'none', outline: 'none', background: 'transparent', fontSize: 12.5,
              color: 'var(--text)', width: '100%',
            }}
          />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {FILTER_TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                style={{
                  fontSize: 11.5, fontWeight: 700, padding: '6px 12px', borderRadius: 999,
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  background: active ? 'var(--accent)' : 'var(--surface)',
                  color: active ? '#fff' : 'var(--text)',
                  cursor: 'pointer', transition: 'background 0.15s ease, color 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {notices.length === 0 ? (
        <div style={{
          padding: '48px 20px', textAlign: 'center',
          border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)',
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>All clear!</div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>No notices yet.</div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          padding: '48px 20px', textAlign: 'center',
          border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)',
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>No matches.</div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            {isFiltering ? 'Try a different search term or filter.' : 'No notices yet.'}
          </div>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '0 24px',
          maxWidth: 1400,
        }}>
          <div>
            <Section icon={Crown} title="Founder" count={founderFiltered.length}>
              {founderFiltered.map(n => (
                <NoticeCard key={n.id} n={n} isUnread={isUnread(n.id)} onOpen={() => markRead(n.id)} isAcknowledged={isAcknowledged(n.id)} onAcknowledge={() => handleAcknowledge(n.id)} />
              ))}
            </Section>

            <Section icon={Megaphone} title="Admin" count={adminFiltered.length}>
              {adminFiltered.map(n => (
                <NoticeCard key={n.id} n={n} isUnread={isUnread(n.id)} onOpen={() => markRead(n.id)} isAcknowledged={isAcknowledged(n.id)} onAcknowledge={() => handleAcknowledge(n.id)} />
              ))}
            </Section>
          </div>

          <Section icon={Users} title="Class (CR / ACR)" count={classFiltered.length}>
            {classFiltered.map(n => (
              <NoticeCard key={n.id} n={n} isUnread={isUnread(n.id)} onOpen={() => markRead(n.id)} isAcknowledged={isAcknowledged(n.id)} onAcknowledge={() => handleAcknowledge(n.id)} />
            ))}
          </Section>
        </div>
      )}
    </div>
  );
}
