import { useState } from 'react';
import * as Icons from 'lucide-react';
import { auth } from '../lib/firebase';
import { resolveEmailFlag } from '../lib/emailFlags';
import { store } from '../store/store';

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

/**
 * Shown to a user whose email address was flagged by a Campus Lead / SCL /
 * admin as looking fake or unreachable (see emailFlags.js). Deliberately
 * NOT a lockout — the account and its data stay fully usable. This just
 * asks the person to either fix their email (go to Settings and change
 * it, or re-verify) or, if they don't want to, download a backup so they
 * have a safety copy regardless of what happens to the account later.
 *
 * Parent renders this only while a flag with status 'pending' exists on
 * the signed-in user (via subscribeMyEmailFlag).
 */
export default function EmailFlagBanner({ flag, onGoToSettings }) {
  const [downloaded, setDownloaded] = useState(false);
  const email = auth.currentUser?.email || '';

  const handleBackup = () => {
    const data = store.exportAll();
    const ts = new Date().toISOString().slice(0, 10);
    downloadJSON({ exportedAt: new Date().toISOString(), data }, `kuetx-backup-${ts}.json`);
    setDownloaded(true);
  };

  return (
    <div style={{
      padding: '14px 16px', borderRadius: 12,
      background: 'color-mix(in srgb, var(--danger) 8%, var(--surface))',
      border: '1.5px solid color-mix(in srgb, var(--danger) 25%, var(--border))',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%', background: 'var(--danger)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
        }}>
          <Icons.AlertTriangle size={16} color="white" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>There is an issue with your account email</div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 1, lineHeight: 1.5 }}>
            <strong>{email || '(no email)'}</strong> — a class admin flagged this address because it does not look real or reachable.
            Go to Settings and fix the email, or at least download a backup so nothing is lost.
          </div>
        </div>
      </div>

      {flag?.reason && (
        <div style={{ fontSize: 11.5, color: 'var(--muted)', paddingLeft: 40 }}>
          Reason: {flag.reason}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', paddingLeft: 40 }}>
        <button type="button" onClick={onGoToSettings} className="btn btn-primary btn-sm" style={{ background: 'var(--danger)' }}>
          Fix email
        </button>
        <button type="button" onClick={handleBackup} className="btn btn-secondary btn-sm">
          {downloaded ? 'Backup downloaded ✓' : 'Download backup JSON'}
        </button>
      </div>
    </div>
  );
}
