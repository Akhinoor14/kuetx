import { useState, useEffect } from 'react';
import { useTheme, THEMES } from '../hooks/useTheme';
import { store } from '../store/store';
import { Download, Upload, Trash2, HardDrive, RefreshCw, Shield, Database, Wifi, WifiOff } from 'lucide-react';

// ── Auto-backup to localStorage snapshot ─────────────────────────────────────
const BACKUP_KEY = 'kuetx_autobackup_';

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

  useEffect(() => {
    const on  = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Calculate localStorage/IndexedDB usage
  useEffect(() => {
    (async () => {
      try {
        const used = await store.getStorageUsage();
        setStorageInfo({ used, max: '50000' }); // 50MB IndexedDB limit
      } catch {
        setStorageInfo({ used: '0', max: '50000' });
      }
    })();
  }, []);

  const flash = (m, type = 'success') => { setMsg(m); setMsgType(type); setTimeout(() => setMsg(''), 3000); };

  // Manual export
  const exportData = () => {
    const data = store.exportAll();
    const ts = new Date().toISOString().split('T')[0];
    downloadJSON({ ...data, _exportedAt: new Date().toISOString(), _version: '1.0' }, `kuetx-backup-${ts}.json`);
    store.set('lastBackupTime', new Date().toISOString());
    setLastBackup(new Date().toISOString());
    flash('✓ Backup downloaded! Keep it safe.');
  };

  // Import
  const importData = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.json')) { flash('✗ Please select a .json backup file', 'error'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        // Validate it's a KUETx backup
        const hasKuetxKeys = Object.keys(data).some(k => k.startsWith('kuetx_'));
        if (!hasKuetxKeys) { flash('✗ This doesn\'t look like a KUETx backup file', 'error'); return; }
        store.importAll(data);
        flash('✓ Data restored! Reloading...');
        setTimeout(() => window.location.reload(), 1200);
      } catch { flash('✗ Could not read backup file', 'error'); }
    };
    reader.readAsText(file);
    e.target.value = '';
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

  return (
    <div className="page-enter page-container">
      <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Settings</h1>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>Theme, data storage, backup and restore</p>

      {msg && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13,
          background: msgType === 'error' ? 'var(--dangerBg)' : 'var(--successBg)',
          color: msgType === 'error' ? 'var(--danger)' : 'var(--success)',
          border: `1px solid ${msgType === 'error' ? 'color-mix(in srgb, var(--danger) 28%, var(--border))' : 'color-mix(in srgb, var(--success) 28%, var(--border))'}`,
        }}>{msg}</div>
      )}

      {/* Theme */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Theme</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {Object.values(THEMES).map(t => (
            <button key={t.id} onClick={() => setTheme(t.id)} style={{
              flex: 1, padding: '10px 0', borderRadius: 8,
              border: `2px solid ${themeId === t.id ? 'var(--accent)' : 'var(--border)'}`,
              background: themeId === t.id ? (t.id === 'dark' ? 'rgba(74, 222, 128, 0.12)' : t.id === 'milky' ? 'var(--surfaceGlassStrong)' : 'var(--successBg)') : 'transparent',
              cursor: 'pointer', fontSize: 13, fontWeight: themeId === t.id ? 700 : 400,
              color: themeId === t.id ? 'var(--accent)' : 'var(--muted)', fontFamily: 'Sora, sans-serif',
            }}>
              {t.id === 'light' ? '☀️' : t.id === 'milky' ? '🥛' : '🌙'} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Storage info */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Database size={14} /> Data Storage
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.6 }}>
          All your data lives in your browser's <code style={{ background: 'var(--bg)', padding: '1px 5px', borderRadius: 4 }}>IndexedDB</code>.
          It persists across sessions on the same device and browser — no server, no login, 50MB+ capacity.
        </div>
        {storageInfo && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
              <span style={{ color: 'var(--muted)' }}>Used</span>
              <span style={{ fontWeight: 600 }}>{storageInfo.used} KB / ~{storageInfo.max} KB</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${Math.min(100, (storageInfo.used / storageInfo.max) * 100)}%` }} />
            </div>
          </div>
        )}
        <div style={{ padding: '8px 12px', borderRadius: 7, background: 'var(--bg)', border: '1px solid var(--border)', fontSize: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            {isOnline ? <Wifi size={12} color="var(--success)" /> : <WifiOff size={12} color="var(--warning)" />}
            <span style={{ fontWeight: 500 }}>{isOnline ? 'Online' : 'Offline'} — app works either way</span>
          </div>
          <div style={{ color: 'var(--muted)' }}>
            ⚠️ Clearing browser data or switching browsers will erase your data. Always keep a backup.
          </div>
        </div>
      </div>

      {/* Backup & restore */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          <HardDrive size={14} /> Backup & Restore
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
          Last backup: <strong>{lastBackupAgo}</strong>.
          Download a JSON file to your phone/PC — upload it anytime to restore everything instantly.
        </div>

        {/* Auto-backup toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg)', borderRadius: 7, border: '1px solid var(--border)', marginBottom: 12 }}>
          <Shield size={13} color="var(--accent)" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>Weekly backup reminder</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Notify me to download backup once a week</div>
          </div>
          <button onClick={() => toggleAutoBackup(!autoBackup)} style={{
            width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
            background: autoBackup ? 'var(--accent)' : 'var(--border)',
            position: 'relative', transition: 'background 0.2s',
          }}>
            <span style={{
              position: 'absolute', top: 3, left: autoBackup ? 20 : 3,
              width: 16, height: 16, borderRadius: '50%', background: '#fff',
              transition: 'left 0.2s',
            }} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className="btn btn-primary" onClick={exportData} style={{ justifyContent: 'flex-start' }}>
            <Download size={14} /> Download Backup (JSON)
          </button>

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, border: '1px solid var(--border)', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--text)', background: 'transparent' }}>
            <Upload size={14} /> Restore from Backup
            <input type="file" accept=".json" onChange={importData} style={{ display: 'none' }} />
          </label>
        </div>

        <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 7, background: 'var(--bg)', fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>
          💡 <strong>Tip:</strong> Save backup to Google Drive / Telegram Saved Messages / Email yourself for safekeeping. When you restore, all courses, marks, attendance, diary entries come back exactly as they were.
        </div>
      </div>

      {/* Danger zone */}
      <div className="card" style={{ marginBottom: 14, borderColor: 'var(--danger)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--danger)' }}>⚠️ Danger Zone</div>
        {!confirmReset ? (
          <button className="btn btn-ghost" onClick={() => { setConfirmReset(true); setConfirmText(''); }}
            style={{ justifyContent: 'flex-start', color: 'var(--danger)', borderColor: 'var(--danger)' }}>
            <Trash2 size={14} /> Reset All Data
          </button>
        ) : (
          <div>
            <p style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>
              ⚠️ This will <strong>permanently erase everything</strong>. Download a backup first!
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

      {/* About */}
      <div className="card">
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>About KUETx</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.8 }}>
          <div><strong>Version:</strong> 3.2.0</div>
          <div><strong>Ordinance:</strong> KUET Academic Ordinance — effective 2nd Term, Session 2011-12</div>
          <div><strong>Approved:</strong> 18th & 19th Academic Council meetings (2012)</div>
          <div><strong>Storage:</strong> 100% localStorage — offline, private, free forever</div>
          <div><strong>PWA:</strong> Install from browser → "Add to Home Screen" for app experience</div>
        </div>
      </div>
    </div>
  );
}
