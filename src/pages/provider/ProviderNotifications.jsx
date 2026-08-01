// ProviderNotifications.jsx
//
// Phase 5 (PROVIDER_SHELL_UX_OVERHAUL_PLAN.md): the provider shell's own
// notification page. Reachable only via the ProviderHamburgerPanel's
// "Notifications" button (see that file's TODO, now wired) — deliberately
// NOT a bottom-nav tab (already at 3: Dashboard/My Shop/Profile — no room,
// and the user explicitly said not to add a 4th) and NOT behind the bell
// icon (Navbar.jsx hides the bell entirely for a provider viewer; see that
// file's `!isProvider &&` gate around the bell button — this page doesn't
// change that, it's simply the only entry point instead).
//
// Lists notices targeting this provider account, newest first: either
// audience.type === 'provider_all' (every verified provider) or
// 'provider_uids' containing this account's own uid — via
// useProviderGlobalNotices (hooks/useProviderGlobalNotices.js), itself a
// direct clone of useFacultyGlobalNotices.js. No shop-level grouping, no
// per-notice read/unread state beyond what the list ordering already
// implies — the plan explicitly scoped targeting to the individual
// account level and left read-state as a "worth adding" judgment call;
// omitted here since noticeUtils.js's read-receipt mechanism is a root
// /notices/{id}/reads/{uid} write, and a provider account has no existing
// UI convention for a per-notice unread dot the way the student inbox
// does — a "Deleted"/audit-trail style follow-up is a separate feature to
// design later, not something this pass invents a parallel mechanism for.

import { Megaphone, Crown } from 'lucide-react';
import { useProviderGlobalNotices } from '../../hooks/useProviderGlobalNotices';
import { renderFormattedNoticeBody } from '../../lib/noticeFormat';
import { useProviderLang } from '../../hooks/useProviderLang';

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

export default function ProviderNotifications() {
  const { t } = useProviderLang();
  const notices = useProviderGlobalNotices();
  const stillLoading = notices === null;

  return (
    <div style={{ padding: '20px 16px', maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
        {t('notifications.title')}
      </div>

      {stillLoading && (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          {t('notifications.loading')}
        </div>
      )}

      {!stillLoading && notices.length === 0 && (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          {t('notifications.empty')}
        </div>
      )}

      {!stillLoading && notices.map((n) => (
        <div
          key={n.id}
          className="card"
          style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--accentSoft)',
            }}>
              {n.isFounder
                ? <Crown size={13} color="var(--accent)" />
                : <Megaphone size={13} color="var(--accent)" />}
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', flex: 1 }}>
              {n.isFounder ? t('notifications.fromFounder') : t('notifications.fromAdmin')}
            </div>
            {n.isPersonal && (
              <span style={{
                fontSize: 9.5, fontWeight: 700, color: 'var(--accent)',
                padding: '1px 6px', borderRadius: 4, border: '1px solid var(--accent)',
              }}>
                {t('notifications.justForYou')}
              </span>
            )}
            <div style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>
              {timeAgo(n.createdAt)}
            </div>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
            {n.title}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.55 }}>
            {renderFormattedNoticeBody(n.body)}
          </div>
        </div>
      ))}
    </div>
  );
}
