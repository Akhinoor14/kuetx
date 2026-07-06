import { useState } from 'react';
import * as Icons from 'lucide-react';
import Modal from './Modal';

/**
 * Replaces the old window.prompt() dead-end for the cross-device case:
 * the person clicked their KUET-verification link in a browser/profile/
 * tab that has no record of which email it was sent to (Firebase can't
 * recover that from the link itself, for security reasons), so we ask —
 * but with a real UI instead of a native prompt.
 */
export default function KuetVerifyEmailConfirmModal({ onConfirm, onCancel, busy, error }) {
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
            <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text)' }}>Email confirm করো</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3, lineHeight: 1.5 }}>
              এই link-টা অন্য একটা browser/device-এ খোলা হয়েছে, তাই যে KUET email-এ link পাঠানো হয়েছিল সেটা আবার লিখতে হবে।
            </div>
          </div>
        </div>

        <input
          type="email"
          autoFocus
          placeholder="islam2313014@stud.kuet.ac.bd"
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
            বাতিল
          </button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !email.trim()} style={{ background: '#1d9bf0' }}>
            {busy ? 'Confirm হচ্ছে…' : 'Confirm করো'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
