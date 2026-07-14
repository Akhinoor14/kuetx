import { useState } from 'react';
import { X, ExternalLink } from 'lucide-react';

// Public "Upload Question / Solution" entry point — used from both the
// Question Bank page and the Solution Bank page's "Contribute" button.
// This is a genuinely public, anonymous-contribution form (no login, no
// role check), which is why it's a Google Form rather than the
// Campus-Lead-gated submitQBUpload() -> R2 pipeline: that pipeline is
// role-restricted by design (only Campus Leads can submit, only Senior
// Campus Leads can approve), and opening it up to arbitrary public
// submissions would be an access-control change, not a bug fix. The old
// custom form here used to POST to a Google Apps Script endpoint that was
// never actually deployed (VITE_UPLOAD_SCRIPT_URL was never set) — this
// restores the originally-configured Google Form instead, which was set
// up and working before.
const FORM_EMBED_URL = 'https://docs.google.com/forms/d/e/1FAIpQLScE5eujz_Vu5LFgkZkiGtWurliPsOiGLmUYTKftBZNSkYTPmg/viewform?embedded=true';
const FORM_FALLBACK_URL = 'https://forms.gle/9NahxuzSeeU6NTLw6';

export default function UploadQuestionModal({ onClose }) {
  // Some browsers/networks block Google Forms inside an <iframe> (privacy
  // extensions, some campus wifi, embedded-cookie restrictions) — if the
  // iframe fails to load within a few seconds, fall back to a plain "open
  // in new tab" link instead of leaving the user staring at a blank box.
  const [iframeFailed, setIframeFailed] = useState(false);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>Upload Question / Solution</h2>
          <button style={styles.closeBtn} onClick={onClose}><X size={20} /></button>
        </div>

        {iframeFailed ? (
          <div style={styles.fallbackBox}>
            <p style={{ fontSize: 13, opacity: 0.75, margin: '0 0 14px' }}>
              The form couldn't load in this view. Open it in a new tab instead:
            </p>
            <a
              href={FORM_FALLBACK_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.fallbackLink}
            >
              <ExternalLink size={16} /> Open contribution form
            </a>
          </div>
        ) : (
          <iframe
            title="Upload Question / Solution"
            src={FORM_EMBED_URL}
            style={styles.iframe}
            onError={() => setIframeFailed(true)}
          >
            Loading…
          </iframe>
        )}
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16,
  },
  modal: {
    background: 'var(--surface)', color: 'var(--text)',
    borderRadius: 16, width: '100%', maxWidth: 640,
    maxHeight: '90vh', overflow: 'hidden', padding: 0,
    display: 'flex', flexDirection: 'column',
  },
  modalHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0,
  },
  modalTitle: { fontSize: 17, fontWeight: 700, margin: 0 },
  closeBtn: {
    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', opacity: 0.6,
  },
  iframe: {
    width: '100%', flex: 1, minHeight: 520, border: 'none', background: '#fff',
  },
  fallbackBox: {
    padding: 24, textAlign: 'center',
  },
  fallbackLink: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    background: 'var(--accent)', color: '#fff', textDecoration: 'none',
    borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 700,
  },
};
