// FacultyContact.jsx
//
// Direct support contact for the Faculty Portal — WhatsApp (chat + call),
// phone call, and email, so a faculty member with an issue always has a
// real way to reach the developer instead of a generic placeholder.

import { ChevronRight, Mail, MessageCircle, Phone } from 'lucide-react';

const WHATSAPP_NUMBER = '01724812042';
const WHATSAPP_INTL = '8801724812042';
const EMAIL = 'mdakhinoorislam.official.2005@gmail.com';

const ContactAction = ({ icon, label, sub, href, color }) => (
  <a
    href={href}
    target={href.startsWith('http') ? '_blank' : undefined}
    rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
    style={{
      display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px',
      borderRadius: 14, textDecoration: 'none',
      background: `${color}0d`, border: `1px solid ${color}30`,
      transition: 'transform 0.15s, box-shadow 0.15s',
    }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 6px 18px ${color}22`; }}
    onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
  >
    <div style={{
      width: 44, height: 44, borderRadius: 12, flexShrink: 0,
      background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {icon}
    </div>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text)' }}>{label}</div>
      <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>
    </div>
    <ChevronRight size={16} color="var(--muted)" style={{ marginLeft: 'auto', flexShrink: 0 }} />
  </a>
);

export default function FacultyContact() {
  return (
    <div className="hub-page-bg" style={{ minHeight: '100vh' }}>
      <div style={{ padding: '20px 24px 40px', width: '100%', boxSizing: 'border-box', maxWidth: 560, margin: '0 auto' }}>
        <div className="hub-page-hero">
          <div className="hub-page-hero-icon">
            <Mail size={20} color="var(--accent)" />
          </div>
          <h1 className="hub-page-hero-title">Contact</h1>
        </div>

        <div style={{ padding: 20, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--card)' }}>
          <div style={{ fontSize: 13.5, color: 'var(--text)', marginBottom: 18, lineHeight: 1.6, textAlign: 'center' }}>
            For account issues, technical support, or feedback about the Faculty
            Portal, reach out directly — WhatsApp is fastest.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <ContactAction
              icon={<MessageCircle size={20} color="#22c55e" />}
              label="WhatsApp"
              sub={WHATSAPP_NUMBER}
              href={`https://wa.me/${WHATSAPP_INTL}`}
              color="#22c55e"
            />
            <ContactAction
              icon={<Phone size={19} color="#3b82f6" />}
              label="Phone Call"
              sub={WHATSAPP_NUMBER}
              href={`tel:+${WHATSAPP_INTL}`}
              color="#3b82f6"
            />
            <ContactAction
              icon={<Mail size={19} color="var(--accent)" />}
              label="Email"
              sub={EMAIL}
              href={`mailto:${EMAIL}`}
              color="var(--accentRGB, 22,163,74)"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
