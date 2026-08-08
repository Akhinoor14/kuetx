// DeleteAccountModal.jsx
//
// Self-service "delete my account, everywhere, permanently" — the
// destructive counterpart to RoleSelectScreen's "wrong account, sign out"
// escape hatch. Typing/pasting the account's own email into the text box
// is the confirmation gesture: no separate "yes/confirm" click-through,
// since a click is too easy to do on reflex for something irreversible.
// The typed text is checked against auth.currentUser.email client-side
// (fast feedback) AND independently re-checked server-side inside the
// deleteMyAccount Cloud Function itself (see functions/index.js) — this
// modal's check is a UX convenience, not the actual security boundary.

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { auth } from '../lib/firebase';
import { deleteMyAccount } from '../lib/accountDeletion';
import Modal from './Modal';

export default function DeleteAccountModal({ onClose, onDeleted }) {
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const email = auth.currentUser?.email || '';
  const matches = confirmText.trim().toLowerCase() === email.trim().toLowerCase();

  const handleDelete = async () => {
    if (!matches || deleting) return;
    setDeleting(true);
    setError('');
    try {
      await deleteMyAccount(confirmText);
      onDeleted?.();
    } catch (err) {
      setDeleting(false);
      setError(
        err?.message?.includes('Confirmation text')
          ? 'লেখাটা মিলছে না। আবার চেষ্টা করুন।'
          : 'অ্যাকাউন্ট ডিলিট করা যায়নি। আবার চেষ্টা করুন।'
      );
    }
  };

  return (
    <Modal
      onClose={deleting ? undefined : onClose}
      closeOnOverlayClick={!deleting}
      contentStyle={{
        background: 'var(--card)',
        borderRadius: 16,
        width: '100%',
        maxWidth: 440,
        padding: '26px 24px',
        border: '1px solid var(--border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <AlertTriangle size={20} color="var(--danger, #dc2626)" />
        <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--text)' }}>
          অ্যাকাউন্ট স্থায়ীভাবে মুছে ফেলুন
        </div>
      </div>

      <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 14 }}>
        এটা <strong style={{ color: 'var(--text)' }}>{email}</strong> অ্যাকাউন্টের সব ডেটা —
        প্রোফাইল, নোট, ডায়েরি, গ্রুপ মেম্বারশিপ, সবকিছু — সব জায়গা থেকে স্থায়ীভাবে মুছে দেবে।
        এটা ফেরানো যাবে না। পরে এই একই Gmail দিয়ে আবার সাইন-ইন করলে সম্পূর্ণ নতুন অ্যাকাউন্ট হিসেবে শুরু হবে।
      </div>

      <label style={{ fontSize: 12.5, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
        নিশ্চিত করতে নিচে আপনার ইমেইল <strong style={{ color: 'var(--text)' }}>{email}</strong> টাইপ বা পেস্ট করুন:
      </label>
      <textarea
        value={confirmText}
        onChange={(e) => { setConfirmText(e.target.value); setError(''); }}
        disabled={deleting}
        rows={2}
        placeholder={email}
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: 8,
          border: `1px solid ${matches ? 'var(--accent)' : 'var(--border)'}`,
          background: 'var(--bg)',
          color: 'var(--text)',
          fontSize: 13,
          fontFamily: 'inherit',
          resize: 'vertical',
        }}
      />

      {error && (
        <div style={{
          marginTop: 10, fontSize: 12.5, color: 'var(--danger, #dc2626)',
          padding: '8px 10px', background: 'rgba(220,38,38,0.08)', borderRadius: 6,
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button
          type="button"
          onClick={onClose}
          disabled={deleting}
          className="btn btn-sm"
          style={{ flex: 1 }}
        >
          বাতিল
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={!matches || deleting}
          style={{
            flex: 1,
            padding: '9px 14px',
            borderRadius: 8,
            border: 'none',
            background: matches ? 'var(--danger, #dc2626)' : 'var(--border)',
            color: '#fff',
            fontWeight: 700,
            fontSize: 13.5,
            cursor: matches && !deleting ? 'pointer' : 'not-allowed',
          }}
        >
          {deleting ? 'মুছে ফেলা হচ্ছে…' : 'স্থায়ীভাবে ডিলিট করুন'}
        </button>
      </div>
    </Modal>
  );
}
