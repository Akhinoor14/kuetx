// DeleteAccountModal.jsx
//
// Self-service account deletion — permanent design, this project stays
// on Firebase Spark for good (see lib/accountDeletion.js and
// docs/ACCOUNT_DELETION_PLAN.md). Deletes what current firestore.rules
// let the owner delete directly, and files an
// accountDeleteRequests/{uid} doc for a Founder to finish manually.
// Copy below is written to be honest about that — "requested" language,
// not "instantly gone everywhere" — since claiming full immediate
// deletion here would be a genuinely false promise to the person.
//
// Typing/pasting the account's own email into the text box is the
// confirmation gesture: no separate "yes/confirm" click-through, since a
// click is too easy to do on reflex for something this consequential.

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
      const result = await deleteMyAccount(confirmText);
      onDeleted?.(result);
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
          অ্যাকাউন্ট ডিলিট করুন
        </div>
      </div>

      <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 14 }}>
        এতে <strong style={{ color: 'var(--text)' }}>{email}</strong> অ্যাকাউন্টের নোট, ডায়েরি,
        ওয়ালেট, ব্লাড ডোনার এন্ট্রি আর গ্রুপ মেম্বারশিপ (plain member হলে) সাথে সাথে মুছে যাবে,
        আর এই ডিভাইসও ক্লিয়ার হয়ে যাবে। বাকি অংশ — প্রোফাইল, রোল, ফ্যাকাল্টি/প্রোভাইডার তথ্য,
        আর আসল লগইন অ্যাকাউন্টটা — এখনই মুছবে না, একটা রিকোয়েস্ট জমা হবে, Founder সেটা রিভিউ করে
        ম্যানুয়ালি মুছে দেবেন। এটা ফেরানো যাবে না।
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
          {deleting ? 'প্রসেস হচ্ছে…' : 'ডিলিট করুন'}
        </button>
      </div>
    </Modal>
  );
}
