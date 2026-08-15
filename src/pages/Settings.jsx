import { useState, useEffect } from 'react';
import { useTheme, THEMES } from '../hooks/useTheme';
import { store } from '../store/store';
import {
  Trash2,
  LogOut, User, ExternalLink, Lock, Settings as SettingsIcon, Sun, Droplets, Moon,
  UserX,
} from 'lucide-react';
import { onAuthChange, logout, loginWithGoogle, resetPassword, getAuthErrorMessage } from '../lib/firebaseAuth';
import { clearLocalDataOnLogout } from '../lib/accountLifecycle';
import DeleteAccountModal from '../components/DeleteAccountModal';
import { APP_VERSION } from '../version';
import { confirmDialog } from '../lib/dialog';
import { useIsProvider } from '../hooks/useIsProvider';
import { useIsFaculty } from '../hooks/useIsFaculty';
import { useProviderLang } from '../hooks/useProviderLang';
import { auth } from '../lib/firebase';
import { getErrandBroadcastOptOut, setErrandBroadcastOptOut } from '../lib/serviceSync';

const THEME_ICON = { light: Sun, milky: Droplets, dark: Moon };

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--muted)', marginBottom: 10 }}>
      {children}
    </div>
  );
}

function StatusDot({ color }) {
  return <span style={{ width: 7, height: 7, borderRadius: '50%', display: 'inline-block', flexShrink: 0, background: color }} />;
}

export default function Settings() {
  const { themeId, setTheme } = useTheme();
  const { isProvider } = useIsProvider();
  const { isFaculty, isFounderBypass } = useIsFaculty();
  const isFacultyViewer = isFaculty || isFounderBypass;
  const { t, lang, setLang } = useProviderLang();
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('success');
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const CONFIRM_PHRASE = 'delete all my data';
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [storageInfo, setStorageInfo] = useState(null);
  const [firebaseUser, setFbUser] = useState(null);
  const [fbSyncStatus, setFbSyncStatus] = useState('idle');
  const [fbLastSynced, setFbLastSynced] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  // MULTI_CATEGORY_SERVICES_PLAN.md Phase 7 — global "আমাকে পাঠাইও না"
  // toggle. Loaded once on mount (not a live subscription — this page
  // is the only writer, so there's no other-tab-changed-it case worth a
  // second listener here, same reasoning NotificationPanel.jsx used for
  // its own one-shot read of the same flag).
  const [errandBroadcastOptOut, setErrandBroadcastOptOutState] = useState(false);
  const [errandOptOutLoading, setErrandOptOutLoading] = useState(false);
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || isProvider || isFacultyViewer) return;
    getErrandBroadcastOptOut(uid).then(setErrandBroadcastOptOutState).catch(() => {});
  }, [isProvider, isFacultyViewer]);

  const handleToggleErrandBroadcastOptOut = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || errandOptOutLoading) return;
    const next = !errandBroadcastOptOut;
    setErrandOptOutLoading(true);
    setErrandBroadcastOptOutState(next); // optimistic
    try {
      await setErrandBroadcastOptOut(uid, next);
    } catch (err) {
      setErrandBroadcastOptOutState(!next); // revert on failure
      flash('✗ সেটিং সেভ করা যায়নি, আবার চেষ্টা করুন', 'error');
    } finally {
      setErrandOptOutLoading(false);
    }
  };

  const handleSignOut = async () => {
    const confirmMsg = isProvider
      ? t('settings.signOutConfirm')
      : 'Sign out? This device will be cleared — log back in anytime and everything comes right back from the cloud.';
    if (!(await confirmDialog(confirmMsg))) return;
    setLoggingOut(true);
    try {
      await logout();
      await clearLocalDataOnLogout();
      flash(isProvider ? t('settings.signOutSuccess') : '✓ Signed out. This device has been cleared.');
      // Redirect to root (Guest Room landing page), not a reload of the
      // current route — /settings is a protected page a signed-out user
      // shouldn't stay on. Same pattern used in Navbar.jsx and Profile.jsx.
      setTimeout(() => { window.location.href = '/'; }, 800);
    } catch (err) {
      flash((isProvider ? `${t('settings.signOutFailed')} ` : '✗ Sign out failed: ') + err.message, 'error');
    } finally {
      setLoggingOut(false);
    }
  };

  const handleChangePassword = async () => {
    if (!firebaseUser?.email) return;
    setSendingReset(true);
    try {
      await resetPassword(firebaseUser.email);
      flash(isProvider ? t('settings.passwordResetSent')(firebaseUser.email) : `✓ A password reset link was sent to ${firebaseUser.email}. Check your inbox.`);
    } catch (err) {
      flash('✗ ' + getAuthErrorMessage(err.code), 'error');
    } finally {
      setSendingReset(false);
    }
  };

  useEffect(() => {
    const unsub = onAuthChange((u) => setFbUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    const handler = (e) => {
      const s = e.detail?.status;
      if (s) setFbSyncStatus(s);
      if (s === 'synced' && e.detail?.at) setFbLastSynced(e.detail.at);
    };
    window.addEventListener('kuetx:firebase-sync', handler);
    return () => window.removeEventListener('kuetx:firebase-sync', handler);
  }, []);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const used = await store.getStorageUsage();
        setStorageInfo({ used, max: '50000' });
      } catch {
        setStorageInfo({ used: '0', max: '50000' });
      }
    })();
  }, []);

  const flash = (m, type = 'success') => { setMsg(m); setMsgType(type); setTimeout(() => setMsg(''), 3000); };

  const resetAll = () => {
    store.clearAll();
    flash('✓ All data cleared. Reloading...');
    setConfirmReset(false);
    setConfirmText('');
    setTimeout(() => window.location.reload(), 1200);
  };

  const isSignedIn = firebaseUser && !firebaseUser.isAnonymous;
  const canChangePassword = isSignedIn && firebaseUser.providerData?.some(p => p.providerId === 'password');

  // BUGFIX (provider account seeing student-only Settings sections): a
  // verified provider's "Profile" bottom-nav button points here (see
  // BottomNav.jsx's ProviderProfileButton), but this page was always the
  // full student version — "Storage" (local-first student data usage),
  // "Danger Zone / Reset All Data" (wipes the local KUETx student store,
  // meaningless and confusing for a provider account, which has no local
  // student data to reset), and the Firebase Console link (student cloud
  // data). A provider only needs Theme + their own Account/Sign-out. Kept
  // as an early branch rather than littering isProvider checks through
  // the student JSX below, since the two versions share almost nothing
  // once Storage/Danger Zone are removed.
  if (isProvider) {
    return (
      <div className="page-enter page-container content-page-bg">
        <div className="content-page-hero">
          <div className="content-page-hero-main">
            <div className="content-page-hero-head">
              <div className="content-page-hero-icon">
                <SettingsIcon size={24} color="var(--accent)" />
              </div>
              <h1 className="content-page-hero-title">{t('settings.title')}</h1>
            </div>
            <p className="content-page-hero-subtitle">{t('settings.subtitle')}</p>
          </div>
        </div>

        {msg && (
          <div style={{
            padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13,
            background: msgType === 'error' ? 'var(--dangerBg)' : 'var(--successBg)',
            color: msgType === 'error' ? 'var(--danger)' : 'var(--success)',
            border: `1px solid ${msgType === 'error' ? 'color-mix(in srgb, var(--danger) 28%, var(--border))' : 'color-mix(in srgb, var(--success) 28%, var(--border))'}`,
          }}>{msg}</div>
        )}

        <div className="card" style={{ marginBottom: 12 }}>
          <SectionLabel>{t('settings.theme')}</SectionLabel>
          <div style={{ display: 'flex', gap: 8 }}>
            {Object.values(THEMES).map(t => {
              const Icon = THEME_ICON[t.id] || Sun;
              const active = themeId === t.id;
              return (
                <button key={t.id} onClick={() => setTheme(t.id)} style={{
                  flex: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '10px 0',
                  borderRadius: 8,
                  border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  background: active ? 'color-mix(in srgb, var(--accent) 10%, var(--bg))' : 'transparent',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  color: active ? 'var(--accent)' : 'var(--muted)',
                  fontFamily: 'Sora, sans-serif',
                }}>
                  <Icon size={16} color={active ? 'var(--accent)' : 'var(--muted)'} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="card" style={{ marginBottom: 12 }}>
          <SectionLabel>{t('settings.languageSectionLabel')}</SectionLabel>
          <div style={{ display: 'flex', gap: 8 }}>
            {[{ id: 'bn', label: 'বাংলা' }, { id: 'en', label: 'English' }].map(opt => {
              const active = lang === opt.id;
              return (
                <button key={opt.id} onClick={() => setLang(opt.id)} style={{
                  flex: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '10px 0',
                  borderRadius: 8,
                  border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  background: active ? 'color-mix(in srgb, var(--accent) 10%, var(--bg))' : 'transparent',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  color: active ? 'var(--accent)' : 'var(--muted)',
                  fontFamily: 'Sora, sans-serif',
                }}>
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="card" style={{ marginBottom: 12 }}>
          <SectionLabel>{t('settings.account')}</SectionLabel>
          {isSignedIn && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                {firebaseUser.photoURL ? (
                  <img src={firebaseUser.photoURL} alt="" style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <User size={18} color="#fff" />
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {firebaseUser.displayName || t('settings.defaultUser')}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {firebaseUser.email}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                {canChangePassword && (
                  <button
                    onClick={handleChangePassword}
                    disabled={sendingReset}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <Lock size={13} /> {sendingReset ? t('settings.sending') : t('settings.changePassword')}
                  </button>
                )}
                <button
                  onClick={handleSignOut}
                  disabled={loggingOut}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, fontSize: 12.5, fontWeight: 600, color: 'var(--danger)', cursor: 'pointer', textAlign: 'left' }}
                >
                  <LogOut size={13} /> {loggingOut ? t('settings.signingOut') : t('settings.signOut')}
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted)', padding: '8px 0 4px' }}>
          KUETx v{APP_VERSION}
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter page-container content-page-bg">
      <div className="content-page-hero">
        <div className="content-page-hero-main">
          <div className="content-page-hero-head">
            <div className="content-page-hero-icon">
              <SettingsIcon size={24} color="var(--accent)" />
            </div>
            <h1 className="content-page-hero-title">Settings</h1>
          </div>
          <p className="content-page-hero-subtitle">Theme, account, and storage</p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px 14px', fontSize: 12.5 }}>
        <StatusDot color={isOnline ? 'var(--success)' : '#f59e0b'} />
        <span style={{ color: 'var(--muted)' }}>
          {isOnline ? 'Online' : 'Offline — changes save locally'}
        </span>
      </div>

      {msg && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13,
          background: msgType === 'error' ? 'var(--dangerBg)' : 'var(--successBg)',
          color: msgType === 'error' ? 'var(--danger)' : 'var(--success)',
          border: `1px solid ${msgType === 'error' ? 'color-mix(in srgb, var(--danger) 28%, var(--border))' : 'color-mix(in srgb, var(--success) 28%, var(--border))'}`,
        }}>{msg}</div>
      )}

      <div className="card" style={{ marginBottom: 12 }}>
        <SectionLabel>Theme</SectionLabel>
        <div style={{ display: 'flex', gap: 8 }}>
          {Object.values(THEMES).map(t => {
            const Icon = THEME_ICON[t.id] || Sun;
            const active = themeId === t.id;
            return (
              <button key={t.id} onClick={() => setTheme(t.id)} style={{
                flex: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '10px 0',
                borderRadius: 8,
                border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                background: active ? 'color-mix(in srgb, var(--accent) 10%, var(--bg))' : 'transparent',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                color: active ? 'var(--accent)' : 'var(--muted)',
                fontFamily: 'Sora, sans-serif',
              }}>
                <Icon size={16} color={active ? 'var(--accent)' : 'var(--muted)'} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {!isFacultyViewer && (
        <div className="card" style={{ marginBottom: 12 }}>
          <SectionLabel>Notifications</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>Runner broadcasts</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                যখন কোনো Runner (Pick and Drop) open থাকে, তার একটা card/notification দেখাও। বন্ধ করলে সব Runner-এর broadcast-ই বন্ধ হয়ে যাবে।
              </div>
            </div>
            <button
              onClick={handleToggleErrandBroadcastOptOut}
              disabled={errandOptOutLoading}
              aria-pressed={!errandBroadcastOptOut}
              style={{
                flexShrink: 0,
                width: 44, height: 26, borderRadius: 999, border: 'none', cursor: errandOptOutLoading ? 'default' : 'pointer',
                background: errandBroadcastOptOut ? 'var(--border)' : 'var(--accent)',
                position: 'relative', transition: 'background 0.15s ease',
                opacity: errandOptOutLoading ? 0.6 : 1,
              }}
            >
              <span style={{
                position: 'absolute', top: 3, left: errandBroadcastOptOut ? 3 : 21,
                width: 20, height: 20, borderRadius: '50%', background: '#fff',
                transition: 'left 0.15s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
              }} />
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 12 }}>

        <div className="card">
          <SectionLabel>Account</SectionLabel>

          {!isSignedIn ? (
            <div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.6 }}>
                You're in offline mode. Sign in to sync across devices.
              </div>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  // Popup-first now (see firebaseAuth.js) — usually
                  // resolves right here with the signed-in user, picked
                  // up by onAuthChange above. Falls back to a full-page
                  // redirect only if the popup is blocked/unsupported; in
                  // that case this call returns null and the sign-in
                  // completes after the page reloads instead, picked up
                  // the same way via handleGoogleRedirectResult() in
                  // useFirebaseAuth.js.
                  try { await loginWithGoogle(); }
                  catch (err) { flash('✗ ' + (err.message || 'Could not start Google sign-in.'), 'error'); }
                }}
                style={{ justifyContent: 'flex-start', width: '100%' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Sign in with Google
              </button>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                {firebaseUser.photoURL ? (
                  <img src={firebaseUser.photoURL} alt="" style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <User size={18} color="#fff" />
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {firebaseUser.displayName || 'User'}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {firebaseUser.email}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--success)', marginBottom: 14 }}>
                <StatusDot color="var(--success)" /> Cloud sync on
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                {canChangePassword && (
                  <button
                    onClick={handleChangePassword}
                    disabled={sendingReset}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <Lock size={13} /> {sendingReset ? 'Sending...' : 'Change password'}
                  </button>
                )}
                <button
                  onClick={handleSignOut}
                  disabled={loggingOut}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, fontSize: 12.5, fontWeight: 600, color: 'var(--danger)', cursor: 'pointer', textAlign: 'left' }}
                >
                  <LogOut size={13} /> {loggingOut ? 'Signing out...' : 'Sign Out'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <SectionLabel>Cloud Sync</SectionLabel>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            {!isSignedIn ? (
              <>
                <StatusDot color="#f59e0b" />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Offline</span>
              </>
            ) : (
              <>
                <StatusDot color={fbSyncStatus === 'synced' ? '#22c55e' : fbSyncStatus === 'error' ? '#ef4444' : '#f59e0b'} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                  {fbSyncStatus === 'synced' ? 'Connected' : fbSyncStatus === 'syncing' ? 'Syncing…' : fbSyncStatus === 'error' ? 'Sync error' : 'Connecting…'}
                </span>
              </>
            )}
          </div>

          {isSignedIn && fbLastSynced && (
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 12 }}>
              Last synced: {new Date(fbLastSynced).toLocaleString('en-BD', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
            <div>Auto-syncs across devices signed into the same account</div>
            <div>Changes usually appear elsewhere within seconds</div>
            <div>Only you can see your data</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <SectionLabel>Storage</SectionLabel>

        {storageInfo && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, color: 'var(--muted)' }}>
              <span>Storage used</span>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>{storageInfo.used} KB / ~{storageInfo.max} KB</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${Math.min(100, (storageInfo.used / storageInfo.max) * 100)}%` }} />
            </div>
          </div>
        )}
      </div>

      {isSignedIn && (
        <div className="card" style={{ marginBottom: 12 }}>
          <SectionLabel>Firebase Data</SectionLabel>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.7 }}>
            You can view or delete your cloud data anytime from{' '}
            <a
              href="https://console.firebase.google.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}
            >
              Firebase Console <ExternalLink size={11} />
            </a>.
            <br />
            Signing out stops sync but doesn't delete cloud data. "Reset All Data" below only clears this device — use "Delete Account" further down to permanently remove your cloud account and data.
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 12, border: '1.5px solid var(--danger)', background: 'transparent' }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'var(--danger)' }}>Danger Zone</div>
        {!confirmReset ? (
          <button className="btn btn-ghost" onClick={() => { setConfirmReset(true); setConfirmText(''); }}
            style={{ justifyContent: 'flex-start', color: 'var(--danger)', borderColor: 'var(--danger)' }}>
            <Trash2 size={14} /> Reset All Data
          </button>
        ) : (
          <div>
            <p style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>
              This will <strong>permanently erase everything</strong>.
            </p>
            <div style={{ marginBottom: 12, padding: '10px 12px', background: 'rgba(239, 68, 68, 0.05)', borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.15)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--danger)' }}>Type to confirm:</div>
              <input
                type="text"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                onPaste={e => e.preventDefault()}
                placeholder={`Type: "${CONFIRM_PHRASE}"`}
                style={{
                  width: '100%',
                  minHeight: '44px',
                  fontSize: '14px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: confirmText === CONFIRM_PHRASE ? '2px solid var(--success)' : '1.5px solid var(--border)',
                  background: '#fff',
                  marginBottom: 8,
                }}
              />
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                Type <code style={{ background: 'var(--bg)', padding: '2px 6px', borderRadius: 4 }}>"{CONFIRM_PHRASE}"</code> exactly. Copy-paste is blocked for security.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-danger"
                onClick={resetAll}
                disabled={confirmText !== CONFIRM_PHRASE}
                style={{
                  opacity: confirmText === CONFIRM_PHRASE ? 1 : 0.5,
                  cursor: confirmText === CONFIRM_PHRASE ? 'pointer' : 'not-allowed',
                }}
              >
                Yes, delete everything
              </button>
              <button className="btn btn-ghost" onClick={() => { setConfirmReset(false); setConfirmText(''); }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {isSignedIn && (
        <div className="card" style={{ marginBottom: 12, border: '1.5px solid var(--danger)', background: 'transparent' }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: 'var(--danger)' }}>Delete Account</div>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.6 }}>
            Clears your personal data (notes, diary, wallet, etc.) and this device immediately,
            and requests full account removal — profile, role, and login — which a Founder
            completes shortly after. This cannot be undone.
          </p>
          <button
            className="btn btn-ghost"
            onClick={() => setShowDeleteAccount(true)}
            style={{ justifyContent: 'flex-start', color: 'var(--danger)', borderColor: 'var(--danger)' }}
          >
            <UserX size={14} /> Delete Account
          </button>
        </div>
      )}

      {showDeleteAccount && (
        <DeleteAccountModal
          onClose={() => setShowDeleteAccount(false)}
          onDeleted={(result) => {
            flash(
              result?.groupLeaveBlocked
                ? '✓ Requested. Note: your CR/ACR role needs a hand-off before that part can be removed — see the request for details.'
                : '✓ This device is cleared and your account deletion has been requested.'
            );
            setTimeout(() => window.location.reload(), 1400);
          }}
        />
      )}

      <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted)', padding: '8px 0 4px' }}>
        KUETx v{APP_VERSION}
      </div>
    </div>
  );
}
