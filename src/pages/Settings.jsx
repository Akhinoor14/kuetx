import { useState, useEffect } from 'react';
import { useTheme, THEMES } from '../hooks/useTheme';
import { store } from '../store/store';
import {
  Download, Upload, Trash2, Shield,
  LogOut, User, ExternalLink, Lock, Settings as SettingsIcon, Sun, Droplets, Moon,
} from 'lucide-react';
import { onAuthChange, logout, loginWithGoogle, resetPassword, getAuthErrorMessage } from '../lib/firebaseAuth';
import { clearLocalDataOnLogout } from '../lib/accountLifecycle';
import { APP_VERSION } from '../version';

// ── Auto-backup to localStorage snapshot ─────────────────────────────────────
function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

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
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('success');
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const CONFIRM_PHRASE = 'delete all my data';
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [autoBackup, setAutoBackupState] = useState(() => store.get('autoBackup') ?? true);
  const [lastBackup, setLastBackup] = useState(() => store.get('lastBackupTime') || null);
  const [storageInfo, setStorageInfo] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewInfo, setPreviewInfo] = useState(null);
  const [importReport, setImportReport] = useState(null);
  const [selectedKeys, setSelectedKeys] = useState(null);
  const [firebaseUser, setFbUser] = useState(null);
  const [fbSyncStatus, setFbSyncStatus] = useState('idle');
  const [fbLastSynced, setFbLastSynced] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  const handleSignOut = async () => {
    if (!window.confirm('Sign out? This device will be cleared — log back in anytime and everything comes right back from the cloud.')) return;
    setLoggingOut(true);
    try {
      await logout();
      await clearLocalDataOnLogout();
      flash('✓ Signed out. This device has been cleared.');
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      flash('✗ Sign out failed: ' + err.message, 'error');
    } finally {
      setLoggingOut(false);
    }
  };

  const handleChangePassword = async () => {
    if (!firebaseUser?.email) return;
    setSendingReset(true);
    try {
      await resetPassword(firebaseUser.email);
      flash(`✓ A password reset link was sent to ${firebaseUser.email}. Check your inbox.`);
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

  async function sha256Hex(str) {
    const buf = new TextEncoder().encode(str);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  const exportData = async () => {
    const data = store.exportAll();
    const payload = { ...data, _exportedAt: new Date().toISOString(), _version: '1.0' };
    try {
      const json = JSON.stringify(payload);
      const checksum = await sha256Hex(json);
      payload._checksum = checksum;
    } catch (err) {
      console.warn('Could not compute checksum', err);
    }
    const _td = new Date();
    const ts = `${_td.getFullYear()}-${String(_td.getMonth() + 1).padStart(2, '0')}-${String(_td.getDate()).padStart(2, '0')}`;
    downloadJSON(payload, `kuetx-backup-${ts}.json`);
    store.set('lastBackupTime', new Date().toISOString());
    setLastBackup(new Date().toISOString());
    flash('✓ Backup downloaded! Keep it safe.');
  };

  const importData = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.json')) { flash('✗ Please select a .json backup file', 'error'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        const keys = Object.keys(data || {});
        const kuetxKeys = keys.filter(k => k.startsWith('kuetx_'));
        if (kuetxKeys.length === 0) { flash('✗ This doesn\'t look like a KUETx backup file', 'error'); return; }

        const items = kuetxKeys.map(k => {
          const raw = JSON.stringify(data[k]);
          return { key: k, sizeKB: (new Blob([raw]).size / 1024).toFixed(2) };
        }).sort((a, b) => b.sizeKB - a.sizeKB);
        const totalKB = items.reduce((s, it) => s + parseFloat(it.sizeKB), 0).toFixed(2);

        setPreviewInfo({ fileName: file.name, ts: data._exportedAt || null, version: data._version || null, items, totalKB, rawData: data });
        setSelectedKeys(items.map(i => i.key));
        setPreviewOpen(true);
      } catch (err) { console.error(err); flash('✗ Could not read backup file', 'error'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const confirmImport = async () => {
    if (!previewInfo) return;
    setPreviewOpen(false);
    const data = previewInfo.rawData;
    if (data._version && data._version !== '1.0') {
      flash('⚠️ Backup version mismatch — proceeding may cause issues', 'error');
    }
    const keysToImport = Array.isArray(selectedKeys) && selectedKeys.length > 0 ? selectedKeys : Object.keys(data).filter(k => k.startsWith('kuetx_'));
    const payload = {};
    for (const k of keysToImport) payload[k] = data[k];

    if (data._checksum && keysToImport.length === Object.keys(data).filter(k => k.startsWith('kuetx_')).length) {
      try {
        const copy = { ...data };
        delete copy._checksum;
        const json = JSON.stringify(copy);
        const c = await sha256Hex(json);
        if (c !== data._checksum) {
          flash('✗ Backup integrity check failed (checksum mismatch)', 'error');
          return;
        }
      } catch (err) {
        console.warn('Checksum verify failed', err);
      }
    }

    try {
      const report = await store.importAllReport(payload);
      setImportReport(report);
      if (report.failed.length === 0) {
        flash('✓ Data restored! Reloading...');
        setTimeout(() => window.location.reload(), 1200);
      } else {
        flash(`⚠️ Some keys failed to restore (${report.failed.length})`, 'error');
      }
    } catch (err) {
      console.error(err);
      flash('✗ Import failed', 'error');
    }
  };

  const resetAll = () => {
    store.clearAll();
    flash('✓ All data cleared. Reloading...');
    setConfirmReset(false);
    setConfirmText('');
    setTimeout(() => window.location.reload(), 1200);
  };

  const toggleAutoBackup = (v) => {
    setAutoBackupState(v);
    store.set('autoBackup', v);
    flash(v ? '✓ Auto-backup reminders enabled' : 'Auto-backup reminders off');
  };

  const lastBackupAgo = lastBackup
    ? (() => {
        const diff = (Date.now() - new Date(lastBackup)) / 86400000;
        if (diff < 1) return 'today';
        if (diff < 2) return 'yesterday';
        return `${Math.floor(diff)} days ago`;
      })()
    : 'Never';

  const isSignedIn = firebaseUser && !firebaseUser.isAnonymous;
  const canChangePassword = isSignedIn && firebaseUser.providerData?.some(p => p.providerId === 'password');

  return (
    <div className="page-enter page-container content-page-bg">
      <div className="content-page-hero" style={{ marginBottom: 16 }}>
        <div className="content-page-hero-icon">
          <SettingsIcon size={18} color="var(--accent)" />
        </div>
        <div>
          <h1 className="content-page-hero-title">Settings</h1>
          <p className="content-page-hero-subtitle">Theme, backup, and storage</p>
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
                  try { await loginWithGoogle(); flash('✓ Signed in with Google successfully!'); }
                  catch (err) { flash('✗ ' + (err.message || 'Login failed'), 'error'); }
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
        <SectionLabel>Data & Backup</SectionLabel>

        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 14 }}>
          Last backup: <strong style={{ color: 'var(--text)' }}>{lastBackupAgo}</strong>
        </div>

        {storageInfo && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, color: 'var(--muted)' }}>
              <span>Storage used</span>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>{storageInfo.used} KB / ~{storageInfo.max} KB</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${Math.min(100, (storageInfo.used / storageInfo.max) * 100)}%` }} />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 14 }}>
          <Shield size={14} color="var(--accent)" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>Weekly backup reminder</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Notify me to download a backup once a week</div>
          </div>
          <button onClick={() => toggleAutoBackup(!autoBackup)} style={{
            width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
            background: autoBackup ? 'var(--accent)' : 'var(--border)',
            position: 'relative', transition: 'background 0.2s', flexShrink: 0,
          }}>
            <span style={{
              position: 'absolute', top: 3, left: autoBackup ? 20 : 3,
              width: 16, height: 16, borderRadius: '50%', background: '#fff',
              transition: 'left 0.2s',
            }} />
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button className="btn btn-primary" onClick={exportData}>
            <Download size={14} /> Download Backup
          </button>
          <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
            <Upload size={14} /> Restore from file
            <input type="file" accept=".json" onChange={importData} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {previewOpen && previewInfo && (
        <div className="settings-modal-backdrop">
          <div className="settings-modal-panel">
            <div className="settings-modal-header">
              <div>
                <div style={{ fontWeight: 700 }}>Restore preview</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                  <span title={previewInfo.fileName}>{previewInfo.fileName}</span> • {previewInfo.items.length} keys • ~{previewInfo.totalKB} KB
                </div>
                {previewInfo.version && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Backup version: {previewInfo.version}</div>}
              </div>
              <div className="settings-modal-actions">
                <button className="btn btn-ghost" onClick={() => { setPreviewOpen(false); setPreviewInfo(null); }}>Cancel</button>
                <button className="btn btn-primary" onClick={confirmImport}>Confirm Restore</button>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <div className="settings-modal-subheader">
                <div style={{ fontSize: 13, fontWeight: 600 }}>Keys (largest first)</div>
                <div style={{ fontSize: 12 }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={selectedKeys?.length === previewInfo.items.length} onChange={(e) => {
                      if (e.target.checked) setSelectedKeys(previewInfo.items.map(i => i.key)); else setSelectedKeys([]);
                    }} />
                    Select all
                  </label>
                </div>
              </div>
              <div className="settings-restore-grid">
                {previewInfo.items.map(it => (
                  <div key={it.key} style={{ display: 'contents' }}>
                    <div className="settings-restore-key">
                      <input type="checkbox" checked={selectedKeys?.includes(it.key)} onChange={(e) => {
                        setSelectedKeys(s => {
                          const next = new Set(s || []);
                          if (e.target.checked) next.add(it.key); else next.delete(it.key);
                          return Array.from(next);
                        });
                      }} />
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.key}</div>
                    </div>
                    <div className="settings-restore-size">{it.sizeKB} KB</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {importReport && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Restore report</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
            Imported: <strong>{importReport.imported.length}</strong> keys. Failed: <strong>{importReport.failed.length}</strong> keys.
          </div>
          {importReport.failed.length > 0 && (
            <div style={{ fontSize: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Failures</div>
              <ul style={{ marginLeft: 16 }}>
                {importReport.failed.map(f => <li key={f.key}><strong>{f.key}</strong>: {f.error}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

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
            Signing out stops sync but doesn't delete cloud data — remove local data in the Danger Zone below, or cloud data in the Console.
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
              This will <strong>permanently erase everything</strong>. Download a backup first!
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

      <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted)', padding: '8px 0 4px' }}>
        KUETx v{APP_VERSION}
      </div>
    </div>
  );
}
