import { store } from '../store/store';

/**
 * Notice system — separate from Alerts (lib/alertUtils.js).
 *
 * Alerts = academic signals computed from the student's own data
 * (attendance shortage, assignment deadlines, results, term-planner
 * flags). Lives under Academic Core now.
 *
 * Notice = a universal inbox for things OTHER people/systems push to the
 * student: admin broadcasts, CR/ACR announcements, Campus Lead / SCL
 * messages, anything cross-cutting that isn't tied to one specific
 * academic module. Lives behind the top-bar bell icon.
 *
 * This file is intentionally a thin, empty-by-default shell for now —
 * there is no sender/broadcast mechanism wired up yet (no admin panel
 * action, no Firestore collection). getNotices() returns [] until a
 * real source is connected. The read/unread + storage plumbing below
 * mirrors alertUtils.js's dismissed-id pattern so wiring in a real
 * source later is a drop-in: replace getNotices()'s body with a fetch
 * from wherever notices end up being written (Firestore collection,
 * RTDB path, etc.) and everything else — read state, badge count,
 * NoticePanel/Notice page — keeps working unchanged.
 *
 * Expected shape once wired, per notice:
 *   {
 *     id: string,          // stable unique id
 *     title: string,
 *     body: string,
 *     from: string,        // e.g. 'Admin', 'CR', 'Campus Lead'
 *     link: string | null, // optional deep link
 *     createdAt: number,   // epoch ms
 *   }
 */

export const NOTICE_READ_KEY = 'noticeReadIds_v1';

// TODO: wire to a real source (Firestore collection, RTDB path, etc.)
// once admin/CR broadcast is built. Returns [] for now — the Notice
// page will correctly show "All clear!" until then.
export const getNotices = () => {
  return [];
};

export const getReadNoticeIds = () => {
  const saved = store.get(NOTICE_READ_KEY);
  return new Set(Array.isArray(saved) ? saved : []);
};

export const setNoticeRead = (id, read = true) => {
  if (!id) return;
  const saved = store.get(NOTICE_READ_KEY);
  const next = new Set(Array.isArray(saved) ? saved : []);
  if (read) next.add(id);
  else next.delete(id);
  store.set(NOTICE_READ_KEY, [...next]);

  try {
    window.dispatchEvent(new Event('kuetx:store-updated'));
  } catch {}
};

export const getUnreadNotices = (notices, readIds) =>
  notices.filter(n => !readIds.has(n.id));
