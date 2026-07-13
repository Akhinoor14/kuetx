// FacultyContact.jsx
//
// §8's route table calls for reusing Footer.jsx's contact modal content as
// a standalone page. Footer.jsx's `developerInfo` object (name, email,
// WhatsApp, socials) is defined inline inside that component, not
// exported — duplicating it here verbatim would drift the moment one copy
// is updated and the other isn't. Rather than either extracting
// developerInfo into its own module (an edit to Footer.jsx outside this
// module's stated scope) or copy-pasting the data, this page instead
// re-triggers Footer's own modal via the same activeModal state pattern is
// NOT possible without prop-drilling into a component that doesn't expose
// it — so for now this is a simple, honest standalone version with just
// the KUETx support email, flagged here as a known simplification rather
// than a silent one.

import * as Icons from 'lucide-react';

export default function FacultyContact() {
  return (
    <div className="hub-page-bg" style={{ minHeight: '100vh' }}>
      <div style={{ padding: '20px 24px 40px', width: '97%', maxWidth: 'none', margin: '0 auto' }}>
        <div className="hub-page-hero">
          <div className="hub-page-hero-icon">
            <Icons.Mail size={20} color="var(--accent)" />
          </div>
          <h1 className="hub-page-hero-title">Contact</h1>
        </div>

        <div style={{ padding: 20, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--card)', textAlign: 'center' }}>
          <div style={{ fontSize: 13.5, color: 'var(--text)', marginBottom: 16, lineHeight: 1.6 }}>
            For account issues, technical support, or feedback about the Faculty
            Portal, reach out to the KUETx team directly.
          </div>
          <a
            href="mailto:support@kuetx.app"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px',
              borderRadius: 10, background: 'color-mix(in srgb, var(--accent) 10%, var(--card))',
              border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
              color: 'var(--accent)', fontWeight: 700, fontSize: 13, textDecoration: 'none',
            }}
          >
            <Icons.Mail size={15} /> support@kuetx.app
          </a>
        </div>
      </div>
    </div>
  );
}
