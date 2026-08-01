// ProviderHamburgerPanel.jsx
//
// PHASE 2 (PROVIDER_SHELL_UX_OVERHAUL_PLAN.md): dedicated hamburger-panel
// body for a provider viewer, replacing the student-shaped panel that
// used to render unconditionally inside Navbar.jsx for every account
// type. Same "own component" philosophy already used for
// SidebarNavProvider.jsx / BottomNavProvider.js — Navbar.jsx is already
// 800+ lines, so this is a firm decision, not a judgment call.
//
// What this panel intentionally does NOT include, vs. the student panel:
//   - No "Connecting…" sync status strip — that's a student local-first
//     data-sync concept; providers don't have an equivalent mental model
//     to explain here.
//   - No Theme switcher — Settings.jsx is the single source of truth for
//     Theme (and Language) for a provider; duplicating it here caused the
//     exact "Theme in two places" bug this phase fixes.
//   - No "KUETx Guide" — that walkthrough is built entirely around
//     student features (attendance, GPA, question bank) and has no
//     provider-relevant content.
//   - No "Settings & Backup" download button — that's the student local
//     data export mechanism; a provider-specific equivalent (e.g.
//     exporting their offering list) is a separate, later feature, not
//     something this phase repurposes the old button into.
//   - No data-safety/privacy note — the student copy is written around
//     the local-first data model, which doesn't describe the provider
//     experience; omitting it entirely is an acceptable outcome for this
//     phase per the plan (rather than shipping copy that doesn't fit).
//
// What it DOES include: identity block (mirrors the student panel's,
// since that part is account-model-agnostic), a Notifications entry
// point (Phase 5 wires the destination route; this phase only adds the
// button since Phase 5 doesn't exist yet — see TODO below), and Sign Out.

import { User, LogOut, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useProviderLang } from '../hooks/useProviderLang';
import { getProfile } from '../store/store';

export default function ProviderHamburgerPanel({
  firebaseUser,
  loggingOut,
  onSignOut,
  onClose,
}) {
  const { t } = useProviderLang();

  return (
    <>
      {/* ── Account identity block — same visual treatment as the student
          panel's, since name/email display has nothing student-specific
          about it. No sync-status strip above it (see file doc comment). ── */}
      <div style={{
        borderRadius: 12,
        border: '1px solid var(--border)',
        overflow: 'hidden',
        background: 'var(--bg)',
        padding: '10px 12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {firebaseUser?.photoURL ? (
            <img src={firebaseUser.photoURL} alt="" style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
          ) : (
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <User size={16} color="#fff" />
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {getProfile()?.name || firebaseUser?.displayName || t('settings.defaultUser')}
            </div>
            {firebaseUser?.email && (
              <div style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {firebaseUser.email}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Quick actions ──
          PHASE 5 (PROVIDER_SHELL_UX_OVERHAUL_PLAN.md): now wired to the
          real ProviderNotifications.jsx route — this was a visible-but-
          inert placeholder (onClick={onClose} only) until Phase 5 built
          the destination, per that phase's own TODO note. */}
      <div style={{
        borderRadius: 12, border: '1px solid var(--border)',
        background: 'var(--bg)', overflow: 'hidden',
      }}>
        <Link
          to="/provider/notifications"
          onClick={onClose}
          style={{
            width: '100%', padding: '9px 12px',
            border: 'none', textDecoration: 'none',
            background: 'transparent', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 10,
            textAlign: 'left', boxSizing: 'border-box',
          }}
        >
          <Bell size={15} color="var(--text)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: 'var(--text)' }}>{t('hamburger.notifications')}</span>
        </Link>
      </div>

      {/* ── Sign Out ── */}
      <button
        onClick={onSignOut}
        disabled={loggingOut}
        style={{
          width: '100%', padding: '9px 12px', borderRadius: 12,
          border: '1px solid color-mix(in srgb, var(--danger) 35%, var(--border))',
          background: 'transparent', cursor: 'pointer',
          fontSize: 13, fontWeight: 600, color: 'var(--danger)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        <LogOut size={14} /> {loggingOut ? t('hamburger.signingOut') : t('hamburger.signOut')}
      </button>
    </>
  );
}
