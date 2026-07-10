import { store } from '../store/store';
import { subscribeGlobalNotices, subscribeGroupNotices, noticeAppliesTo } from './groupSync';

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
 * Two real sources feed this now, both live via Firestore onSnapshot:
 *   (a) global admin broadcasts — root `notices` collection, filtered
 *       per-user client-side via noticeAppliesTo(notice, profile, groupId)
 *       (audience: {type:'all'|'batch'|'group'})
 *   (b) group-level CR/ACR notices — groups/{groupId}/notices
 * subscribeAllNotices() merges both into one live, sorted list. Use this
 * instead of the old synchronous getNotices() wherever possible.
 *
 * Expected shape, per notice:
 *   {
 *     id: string,          // stable unique id
 *     title: string,
 *     body: string,
 *     from: string,        // 'Admin' or 'CR'
 *     link: string | null, // optional deep link
 *     createdAt: number,   // epoch ms (converted from Firestore Timestamp)
 *   }
 */

export const NOTICE_READ_KEY = 'noticeReadIds_v1';

function toMillis(createdAt) {
  // Firestore Timestamp (serverTimestamp()) has .toMillis(); guard for the
  // brief window right after a write where local cache may not have
  // resolved the server value yet (serverTimestamp() placeholder is null).
  if (!createdAt) return 0;
  if (typeof createdAt.toMillis === 'function') return createdAt.toMillis();
  if (typeof createdAt === 'number') return createdAt;
  return 0;
}

/**
 * Live/reactive notice feed. Subscribes to both global (admin) and
 * group (CR/ACR) notices, merges, de-dupes by id, sorts newest-first,
 * and calls back with the combined array on every change from either
 * source. Returns a single combined unsubscribe function.
 */
export function subscribeAllNotices(profile, groupId, callback) {
  let globalList = [];
  let groupList = [];

  const emit = () => {
    const merged = [...globalList, ...groupList];
    const seen = new Set();
    const deduped = [];
    for (const n of merged) {
      if (seen.has(n.id)) continue;
      seen.add(n.id);
      deduped.push(n);
    }
    deduped.sort((a, b) => b.createdAt - a.createdAt);
    callback(deduped);
  };

  const unsubGlobal = subscribeGlobalNotices((notices) => {
    globalList = notices
      .filter((n) => noticeAppliesTo(n, profile, groupId))
      .map((n) => {
        const isFounder = n.createdBy?.name === 'Founder';
        return {
          ...n,
          from: isFounder ? 'Founder' : (n.createdBy?.name || 'Admin'),
          isFounder,
          section: 'admin',
          createdAt: toMillis(n.createdAt),
        };
      });
    emit();
  });

  const unsubGroup = groupId
    ? subscribeGroupNotices(groupId, (notices) => {
        groupList = notices.map((n) => ({
          ...n,
          from: n.postedBy?.name || 'CR',
          isFounder: false,
          section: 'class',
          createdAt: toMillis(n.createdAt),
        }));
        emit();
      })
    : () => {};

  return () => {
    unsubGlobal();
    unsubGroup();
  };
}

// Kept for backward compatibility — old synchronous callers (none left
// in this codebase as of this wiring) get an empty list rather than a
// crash. Prefer subscribeAllNotices for anything new.
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
