import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X } from 'lucide-react';
import { subscribeAllNotices } from '../lib/noticeUtils';
import { subscribeMyRole } from '../lib/groupSync';
import { getProfile } from '../store/store';
import { getGroupId } from '../lib/groupUtils';
import { auth } from '../lib/firebase';

// Popup (toast) for brand-new notices — separate from GlobalToasts.jsx
// (which is a generic bottom-center action-feedback toast used by
// notify(), e.g. "Saved", "Error"). This one is specifically for new
// Notice items: bigger card, title + 1-line preview, tap-to-open,
// stacks up to 3 with the rest queued, auto-dismiss ~5.5s.
//
// "New" detection: subscribeAllNotices() gives the live merged list on
// every change. We keep a localStorage set of notice IDs we've already
// either shown-as-toast-or-seen-at-boot. On the very FIRST snapshot
// after mount, every id currently in the list is marked seen silently
// (no popup flood for pre-existing notices) — from then on, any id that
// appears that wasn't in that seen-set is genuinely new and gets a toast.

const SEEN_KEY = 'noticeToastSeenIds_v1';
const MAX_VISIBLE = 3;
const AUTO_DISMISS_MS = 5500;

function loadSeen() {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveSeen(set) {
  try {
    // Cap stored ids so this never grows unbounded over a long-lived tab.
    const arr = [...set].slice(-500);
    localStorage.setItem(SEEN_KEY, JSON.stringify(arr));
  } catch {}
}

export default function NoticeToast() {
  const [queue, setQueue] = useState([]); // pending, not yet shown
  const [visible, setVisible] = useState([]); // currently shown (max 3)
  const seenRef = useRef(loadSeen());
  const bootedRef = useRef(false);
  const navigate = useNavigate();

  const [isViewerCR, setIsViewerCR] = useState(false);
  const profileRef = useRef(getProfile());
  const groupIdRef = useRef(getGroupId(profileRef.current));

  useEffect(() => {
    const gid = groupIdRef.current;
    if (!gid || !auth.currentUser?.uid) { setIsViewerCR(false); return; }
    return subscribeMyRole(gid, auth.currentUser.uid, (role) => {
      setIsViewerCR(role === 'cr' || role === 'acr');
    });
  }, []);

  useEffect(() => {
    const profile = profileRef.current;
    const gid = groupIdRef.current;
    const unsub = subscribeAllNotices(profile, gid, (notices) => {
      if (!bootedRef.current) {
        // First snapshot: baseline everything as "seen", no popups.
        bootedRef.current = true;
        notices.forEach((n) => seenRef.current.add(n.id));
        saveSeen(seenRef.current);
        return;
      }
      const fresh = notices.filter((n) => !seenRef.current.has(n.id));
      if (fresh.length === 0) return;
      fresh.forEach((n) => seenRef.current.add(n.id));
      saveSeen(seenRef.current);
      // Newest first into the queue.
      setQueue((q) => [...fresh.sort((a, b) => b.createdAt - a.createdAt), ...q]);
    }, 'student', { isViewerCR });
    return unsub;
  }, [isViewerCR]);

  // Move queued items into the visible stack whenever there's room.
  useEffect(() => {
    if (queue.length === 0 || visible.length >= MAX_VISIBLE) return;
    const room = MAX_VISIBLE - visible.length;
    const next = queue.slice(0, room);
    setVisible((v) => [...v, ...next]);
    setQueue((q) => q.slice(room));
  }, [queue, visible.length]);

  const dismiss = (id) => setVisible((v) => v.filter((n) => n.id !== id));

  useEffect(() => {
    const timers = visible.map((n) =>
      window.setTimeout(() => dismiss(n.id), AUTO_DISMISS_MS)
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (visible.length === 0) return null;

  return (
    <div className="kuetx-notice-toasts" aria-live="polite" aria-atomic="true">
      {visible.map((n) => (
        <div
          key={n.id}
          className="kuetx-notice-toast"
          role="status"
          onClick={() => {
            dismiss(n.id);
            navigate('/notice');
          }}
        >
          <Bell size={15} className="kuetx-notice-toast-icon" />
          <div className="kuetx-notice-toast-body">
            <div className="kuetx-notice-toast-title">{n.title}</div>
            <div className="kuetx-notice-toast-preview">{n.body}</div>
          </div>
          <button
            className="kuetx-notice-toast-close"
            aria-label="Close"
            onClick={(e) => {
              e.stopPropagation();
              dismiss(n.id);
            }}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
