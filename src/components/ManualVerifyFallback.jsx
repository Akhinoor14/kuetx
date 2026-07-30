// ManualVerifyFallback.jsx
//
// AUTO-SUBMIT CHANGE: the manualVerifyRequests doc for this account
// already exists by the time this component renders — it was created
// silently in the background by ensureManualVerifyRequest() as soon as
// enough profile data existed (see manualVerifyRequests.js header), no
// click required. This component is now PURELY an optional, faster nudge:
// clicking the button just opens a pre-filled WhatsApp message to the
// Founder, pointing at a request that's already sitting in their
// Approvals tab. It does not create, and has never needed to create,
// that request itself.

import * as Icons from 'lucide-react';

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
 *   from the signup/profile form; only used to pre-fill the WhatsApp text.
 */
export default function ManualVerifyFallback({ role, details }) {
  const waMessage = buildWhatsAppMessage(role, details);
  const waLink = `https://wa.me/${FOUNDER_WHATSAPP_NUMBER}?text=${encodeURIComponent(waMessage)}`;

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
        Your details are already waiting for the Founder's review — no
        action needed. If you'd like a faster response, you can nudge them
        directly on WhatsApp.
      </p>

      <a
        href={waLink}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-primary"
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none' }}
      >
        <Icons.MessageCircle size={16} />
        Nudge the Founder on WhatsApp
      </a>
    </div>
  );
}
