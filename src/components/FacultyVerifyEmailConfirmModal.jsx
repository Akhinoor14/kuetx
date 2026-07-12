import { useState } from 'react';
import * as Icons from 'lucide-react';
import Modal from './Modal';

/**
 * Faculty-side counterpart to KuetVerifyEmailConfirmModal.jsx — same
 * cross-device rescue pattern, English copy per Deviation 3 (faculty UI
 * has no Bangla except the pre-role-select screen).
 *
 * Shown when a faculty magic-link is opened in a browser/tab/device that
 * has no record of which email the link was sent to (e.g. clicked from a
 * phone's mail app while the account was created on a laptop, or the
 * original tab was closed/refreshed before the link was clicked). Without
 * this, that click would silently do nothing and the person would stay
 * stuck on "Verify your email to continue" forever despite having clicked
 * the right link — see BUGFIX_FACULTY_VERIFY_CROSS_DEVICE.md.
 */
export default function FacultyVerifyEmailConfirmModal({ onConfirm, onCancel, busy, error }) {
  const [email, setEmail] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  return (
    <Modal
      onClose={busy ? undefined : onCancel}
      contentStyle={{
        width: 'min(420px, 100%)',
        background: 'var(--surface)',
        borderRadius: 16,
        padding: 20,
        boxShadow: '0 20px 60px rgba(0,0,0,0.28)',
      }}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%', background: '#1d9bf0',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Icons.Mail size={16} color="white" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text)' }}>Confirm your email</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3, lineHeight: 1.5 }}>
              This link was opened on a different browser or device, so please re-enter the
              institutional email the verification link was sent to.
            </div>
          </div>
        </div>

        <input
          type="email"
          autoFocus
          placeholder="name@dept.kuet.ac.bd"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
          style={{
            padding: '10px 12px', borderRadius: 8, fontSize: 13.5,
            border: '1px solid var(--border)', background: 'var(--inputBg)',
            color: 'var(--text)', outline: 'none', width: '100%',
          }}
        />

        {error && (
          <div style={{
            fontSize: 12, color: 'var(--danger)', background: 'var(--dangerBg)',
            borderRadius: 8, padding: '8px 10px', lineHeight: 1.5,
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !email.trim()} style={{ background: '#1d9bf0' }}>
            {busy ? 'Confirming…' : 'Confirm'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
