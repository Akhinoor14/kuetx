import { useEffect, useMemo, useState } from 'react';
import { Bell, Search, X } from 'lucide-react';
import * as noticeApi from '../lib/noticeUtils';
import { getProfile } from '../store/store';
import { getGroupId } from '../lib/groupUtils';
import { flattenNoticePreview } from '../lib/noticeFormat';
import { auth } from '../lib/firebase';
import { subscribeMyRole } from '../lib/groupSync';
import NoticeTimeline from '../components/NoticeTimeline';
import NoticeReader from '../components/NoticeReader';

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

// Merges Founder → Admin → Class into one newest-first "Recent" timeline
// (the redesign intentionally drops the old tabbed-by-role sections in
// favor of a single mixed feed — role is now conveyed per-item via the
// left-edge color bar instead of a section header).
function mergeRecent(notices) {
  return [...notices].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

function useIsMobile(breakpoint = 860) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < breakpoint
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handle = () => setIsMobile(mq.matches);
    handle();
    mq.addEventListener('change', handle);
    return () => mq.removeEventListener('change', handle);
  }, [breakpoint]);
  return isMobile;
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

  // This route is student-only (see NOTICE_BELL_ROUTING_PLAN.md — faculty
  // and Founder are routed elsewhere by the bell/NotificationPanel before
  // they ever land here).
  //
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

  // Live notice feed: global admin broadcasts + group CR/ACR notices.
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

  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Search + tab filter both apply on top of the merged `notices` array
  // (client-side, no new Firestore query — the feed is already capped at
  // ~50 by subscribeAllNotices's underlying queries) — search first, then
  // narrow by tab, matching how a person reads the two controls together
  // ("find X" then "only show me unread X").
  const searched = applySearch(notices, searchQuery);
  const filtered = applyFilterTab(searched, activeTab, isUnread);
  const recent = mergeRecent(filtered);

  const isMobile = useIsMobile();

  // Selected notice for the reading pane / bottom sheet. Newest notice
  // open by default on desktop; nothing selected (list-only) on mobile
  // until tapped.
  const [selectedId, setSelectedId] = useState(null);
  useEffect(() => {
    // Reset selection if it fell out of the filtered set, or seed it
    // with the newest item on desktop.
    if (selectedId && !recent.some((n) => n.id === selectedId)) {
      setSelectedId(isMobile ? null : (recent[0]?.id ?? null));
    } else if (!isMobile && !selectedId && recent.length > 0) {
      setSelectedId(recent[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recent, isMobile]);

  const selected = recent.find((n) => n.id === selectedId) || null;
  const sheetOpen = isMobile && !!selected;

  const handleSelect = (n) => {
    setSelectedId(n.id);
    markRead(n.id);
  };

  const closeSheet = () => setSelectedId(null);

  const refCodeFor = (n) => (n?.id ? String(n.id).slice(-3).padStart(3, '0') : '');

  return (
    <div className="page-enter page-container content-page-bg" style={{ paddingBottom: 48 }}>
      <div className="content-page-hero">
        <div className="content-page-hero-main">
          <div className="content-page-hero-head">
            <div className="content-page-hero-icon">
              <Bell size={24} color="var(--accent)" />
            </div>
            <h1 className="content-page-hero-title">Notice</h1>
          </div>
          <p className="content-page-hero-subtitle">
            Announcements from Founder/Admin, and CR/ACR land here.
          </p>
        </div>
      </div>

      {/* Search + filter chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 16 }}>
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
      ) : recent.length === 0 ? (
        <div style={{
          padding: '48px 20px', textAlign: 'center',
          border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)',
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>No matches.</div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Try a different search term or filter.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          {/* Left: mixed "Recent" timeline, independently scrollable on desktop */}
          <div style={{ width: isMobile ? '100%' : 280, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '0 2px' }}>
              <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>
                Recent
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)' }}>({recent.length})</span>
            </div>
            <div
              style={!isMobile ? { maxHeight: 'calc(100vh - 260px)', overflowY: 'auto', paddingRight: 4 } : undefined}
            >
              <NoticeTimeline
                notices={recent}
                activeId={isMobile ? null : selectedId}
                isUnread={isUnread}
                onSelect={handleSelect}
              />
            </div>
          </div>

          {/* Right: reading pane — desktop only, fills remaining width */}
          {!isMobile && (
            <div style={{ flex: 1, minWidth: 0 }}>
              {selected ? (
                <NoticeReader
                  notice={selected}
                  isAcknowledged={isAcknowledged(selected.id)}
                  onAcknowledge={() => handleAcknowledge(selected.id)}
                  refCode={refCodeFor(selected)}
                />
              ) : (
                <div style={{
                  padding: '48px 20px', textAlign: 'center',
                  border: '1px dashed var(--letter-paperBorder)', borderRadius: 16,
                }}>
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>Select a notice to read it here.</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Mobile bottom sheet */}
      {sheetOpen && (
        <div
          className="notice-sheet-backdrop"
          onClick={closeSheet}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)' }}
        >
          <div
            className="notice-sheet-container"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute', left: 0, right: 0, bottom: 0,
              maxHeight: '86vh',
              display: 'flex', flexDirection: 'column',
              borderTopLeftRadius: 20, borderTopRightRadius: 20,
              overflow: 'hidden',
              background: 'var(--letter-paper)',
              boxShadow: '0 -12px 40px rgba(0,0,0,0.25)',
            }}
          >
            {/* Subtle rolled-scroll hint — mobile-sheet-only */}
            <div className="letter-scroll-hint" />
            <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 4px' }}>
              <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--letter-paperDashed)' }} />
            </div>
            <button
              type="button"
              onClick={closeSheet}
              aria-label="Close"
              style={{
                position: 'absolute', top: 14, right: 14,
                width: 28, height: 28, borderRadius: '50%', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'color-mix(in srgb, var(--letter-ink) 8%, transparent)',
                color: 'var(--letter-inkMuted)', cursor: 'pointer',
              }}
            >
              <X size={15} />
            </button>
            <div style={{ overflowY: 'auto', padding: '4px 14px 24px' }}>
              <NoticeReader
                notice={selected}
                isAcknowledged={isAcknowledged(selected.id)}
                onAcknowledge={() => handleAcknowledge(selected.id)}
                refCode={refCodeFor(selected)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
