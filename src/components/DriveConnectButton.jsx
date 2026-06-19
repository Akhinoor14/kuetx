/**
 * DriveConnectButton.jsx
 * Reusable component — shows Drive connection status + connect/disconnect actions.
 * Used in: Settings.jsx, ProfileSetupModal.jsx, Sidebar.jsx
 */

import { useState, useEffect, useCallback } from 'react';
import { Cloud, CloudOff, CloudUpload, RotateCcw, LogOut } from 'lucide-react';
import {
  isDriveConnected,
  getDriveToken,
  getDriveEmail,
  getDriveLastBackup,
  signInWithGoogle,
  signOutFromDrive,
  uploadToDrive,
  downloadFromDrive,
} from '../lib/driveSync';
import { store } from '../store/store';
import { notify } from '../lib/notify';

const formatRelativeTime = (isoString) => {
  if (!isoString) return 'Never';
  const diff = (Date.now() - new Date(isoString)) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

/**
 * @param {'full' | 'compact' | 'badge'} variant
 *   full    — Settings page card (all controls)
 *   compact — ProfileSetupModal step (connect + skip)
 *   badge   — Sidebar / BottomNav one-liner status
 */
export default function DriveConnectButton({ variant = 'full', onConnected }) {
  const [connected, setConnected] = useState(isDriveConnected);
  const [email, setEmail] = useState(() => localStorage.getItem('kuetx_drive_email') || '');
  const [lastBackup, setLastBackup] = useState(getDriveLastBackup);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // Sync state when localStorage changes (other tabs / same session)
  const syncState = useCallback(() => {
    setConnected(isDriveConnected());
    setEmail(localStorage.getItem('kuetx_drive_email') || '');
    setLastBackup(getDriveLastBackup());
  }, []);

  useEffect(() => {
    window.addEventListener('kuetx:drive-updated', syncState);
    return () => window.removeEventListener('kuetx:drive-updated', syncState);
  }, [syncState]);

  const emitUpdate = () => window.dispatchEvent(new Event('kuetx:drive-updated'));

  // ── Connect ──────────────────────────────────────────────────────────────
  const handleConnect = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      syncState();
      emitUpdate();
      notify('✅ Google Drive connected!', 'success');

      // Trigger first backup immediately
      try {
        const data = store.exportAll();
        await uploadToDrive(data);
        syncState();
        notify('☁️ First backup uploaded to Drive', 'success');
      } catch (e) {
        notify('Connected but first backup failed — try manually', 'error');
      }

      onConnected?.();
    } catch (err) {
      if (err.message !== 'popup_closed_by_user') {
        notify(`Drive connect failed: ${err.message}`, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Disconnect ───────────────────────────────────────────────────────────
  const handleDisconnect = () => {
    signOutFromDrive();
    syncState();
    emitUpdate();
    notify('Drive disconnected. Your Drive file is untouched.', 'info');
  };

  // ── Backup now ───────────────────────────────────────────────────────────
  const handleBackupNow = async () => {
    setLoading(true);
    try {
      const data = store.exportAll();
      await uploadToDrive(data);
      syncState();
      emitUpdate();
      notify('☁️ Backup uploaded to Drive!', 'success');
    } catch (err) {
      notify(`Backup failed: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Restore from Drive ───────────────────────────────────────────────────
  const handleRestore = async () => {
    if (!window.confirm('Restore will overwrite all current data with Drive backup. Continue?')) return;
    setRestoring(true);
    try {
      const { data, modifiedTime } = await downloadFromDrive();
      const keys = Object.keys(data).filter(k => k.startsWith('kuetx_'));
      if (keys.length === 0) throw new Error('No valid KUETx data in backup');

      await store.importAllReport(
        Object.fromEntries(keys.map(k => [k, data[k]]))
      );
      notify('✅ Data restored from Drive! Reloading...', 'success');
      setTimeout(() => window.location.reload(), 1400);
    } catch (err) {
      notify(`Restore failed: ${err.message}`, 'error');
    } finally {
      setRestoring(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // VARIANT: badge — one-liner for Sidebar bottom / BottomNav
  // ─────────────────────────────────────────────────────────────────────────
  if (variant === 'badge') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          color: connected ? 'var(--accent)' : 'var(--muted)',
          cursor: connected ? 'default' : 'pointer',
          padding: '4px 0',
        }}
        onClick={!connected ? handleConnect : undefined}
        title={connected ? `Drive: ${email || 'connected'} · Last: ${formatRelativeTime(lastBackup)}` : 'Click to connect Google Drive'}
      >
        {connected
          ? <Cloud size={12} strokeWidth={2} />
          : <CloudOff size={12} strokeWidth={2} />}
        <span>
          {connected
            ? `Drive · ${formatRelativeTime(lastBackup)}`
            : 'Connect Drive'}
        </span>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VARIANT: compact — ProfileSetupModal optional step
  // ─────────────────────────────────────────────────────────────────────────
  if (variant === 'compact') {
    if (connected) {
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          borderRadius: 10,
          border: '1px solid rgba(34,197,94,0.35)',
          background: 'rgba(34,197,94,0.07)',
        }}>
          <Cloud size={16} color="var(--accent)" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>Drive Connected</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{email || 'Backup active'}</div>
          </div>
          <button
            onClick={handleDisconnect}
            style={{ fontSize: 11, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Disconnect
          </button>
        </div>
      );
    }

    return (
      <div style={{
        padding: '14px',
        borderRadius: 10,
        border: '1px solid var(--border)',
        background: 'var(--bg)',
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>☁️ Backup to Google Drive <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(optional)</span></div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.5 }}>
          Your data stays in your own Drive. No server. You can set this up later in Settings.
        </div>
        <button
          onClick={handleConnect}
          disabled={loading}
          className="btn btn-primary btn-sm"
          style={{ fontSize: 12 }}
        >
          <Cloud size={13} />
          {loading ? 'Connecting...' : 'Connect Google Drive'}
        </button>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VARIANT: full — Settings page card
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Status row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 8,
        border: `1px solid ${connected ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
        background: connected ? 'rgba(34,197,94,0.06)' : 'var(--bg)',
        marginBottom: 12,
      }}>
        {connected
          ? <Cloud size={16} color="var(--accent)" />
          : <CloudOff size={16} color="var(--muted)" />}
        <div style={{ flex: 1 }}>
          {connected ? (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>Connected</div>
              {email && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{email}</div>}
            </>
          ) : (
            <>
              <div style={{ fontSize: 12, fontWeight: 600 }}>Not connected</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Connect to auto-backup your data</div>
            </>
          )}
        </div>
        {connected && (
          <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'right' }}>
            <div>Last backup</div>
            <div style={{ fontWeight: 600, color: 'var(--text)' }}>{formatRelativeTime(lastBackup)}</div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {!connected ? (
          <button
            className="btn btn-primary"
            onClick={handleConnect}
            disabled={loading}
            style={{ justifyContent: 'flex-start' }}
          >
            <Cloud size={14} />
            {loading ? 'Connecting...' : 'Connect Google Drive'}
          </button>
        ) : (
          <>
            <button
              className="btn btn-primary"
              onClick={handleBackupNow}
              disabled={loading}
              style={{ justifyContent: 'flex-start' }}
            >
              <CloudUpload size={14} />
              {loading ? 'Uploading...' : 'Backup Now'}
            </button>

            <button
              className="btn btn-ghost"
              onClick={handleRestore}
              disabled={restoring}
              style={{ justifyContent: 'flex-start' }}
            >
              <RotateCcw size={14} />
              {restoring ? 'Restoring...' : 'Restore from Drive'}
            </button>

            <button
              className="btn btn-ghost"
              onClick={handleDisconnect}
              style={{ justifyContent: 'flex-start', color: 'var(--danger)', borderColor: 'var(--danger)' }}
            >
              <LogOut size={14} />
              Disconnect Drive
            </button>
          </>
        )}
      </div>

      {/* Info note */}
      <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 7, background: 'var(--bg)', fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>
        🔒 <strong>Privacy:</strong> Data goes directly to <em>your</em> Google Drive under "KUETx Backups/kuetx-backup.json".
        KUETx has no server access. Only you can see it.
      </div>
    </div>
  );
}
