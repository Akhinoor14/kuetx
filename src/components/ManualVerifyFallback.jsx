// ManualVerifyFallback.jsx
//
// Shown only when the automatic verification email fails to send with
// Firebase's auth/quota-exceeded error — never as a default option, and
// never mentions the underlying cause (no "quota", "limit", or "Firebase"
// language reaches the person). It reads as a normal, always-available
// backup path, not as evidence something broke.
//
// Submits a request to manualVerifyRequests (Firestore) so it shows up in
// the Founder's Approvals tab, and opens a pre-filled WhatsApp message as
// a faster, more direct nudge alongside that.

import { useState } from 'react';
import * as Icons from 'lucide-react';
import { submitManualVerifyRequest } from '../lib/manualVerifyRequests';

const FOUNDER_WHATSAPP_NUMBER = '8801724812042';

function buildWhatsAppMessage(role, { name, email, roll, dept }) {
  const lines = [
    'KUETx Verification Request',
    `Name: ${name || '-'}`,
    `Email: ${email || '-'}`,
    `Role: ${role === 'faculty' ? 'Faculty' : 'Student'}`,
  ];
  if (role === 'student' && roll) lines.push(`Roll: ${roll}`);
  if (role === 'faculty' && dept) lines.push(`Department: ${dept}`);
  return lines.join('\n');
}

/**
 * @param {'student'|'faculty'} role
 * @param {{ name, email, roll, dept }} details — whatever's already known
 *   at the point verification failed (from the signup/profile form).
 * @param {() => void} onDone — called once the request has been submitted.
 */
export default function ManualVerifyFallback({ role, details, onDone }) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const waMessage = buildWhatsAppMessage(role, details);
  const waLink = `https://wa.me/${FOUNDER_WHATSAPP_NUMBER}?text=${encodeURIComponent(waMessage)}`;

  const handleSend = async () => {
    setSubmitting(true);
    setError('');
    try {
      await submitManualVerifyRequest(role, details);
      setSubmitted(true);
      window.open(waLink, '_blank', 'noopener,noreferrer');
      onDone?.();
    } catch {
      setError('Could not send the request right now — please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="card"
      style={{
        padding: 16,
        borderRadius: 12,
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        maxWidth: 420,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Icons.ShieldCheck size={18} color="var(--accent)" />
        <span style={{ fontWeight: 700, fontSize: 14 }}>Verify manually</span>
      </div>

      <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, margin: '0 0 14px' }}>
        Automatic email verification isn't available right now. Send your
        details to the Founder for a quick manual verification instead.
      </p>

      {submitted ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
          <Icons.CheckCircle2 size={16} />
          Request sent — you'll be verified shortly.
        </div>
      ) : (
        <>
          <button
            className="btn btn-primary"
            onClick={handleSend}
            disabled={submitting}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <Icons.MessageCircle size={16} />
            {submitting ? 'Sending…' : 'Contact Founder on WhatsApp'}
          </button>
          {error && (
            <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 8 }}>{error}</div>
          )}
        </>
      )}
    </div>
  );
}
