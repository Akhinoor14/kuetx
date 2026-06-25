import { X } from 'lucide-react';

/**
 * GuideModal — KUETx first-visit guide PDF popup.
 * Controlled externally via open + onClose props.
 */
export default function GuideModal({ open, onClose }) {
  if (!open) return null;

  return (
    <>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 5000,
        background: 'rgba(10,15,28,0.72)',
        backdropFilter: 'blur(6px)',
      }} onClick={onClose} />
      <div style={{
        position: 'fixed', inset: 0, zIndex: 5001,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, pointerEvents: 'none',
      }}>
        <div onClick={e => e.stopPropagation()} style={{
          pointerEvents: 'auto',
          width: '100%', maxWidth: 500,
          maxHeight: 'calc(100dvh - 40px)',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 18,
          boxShadow: '0 32px 80px rgba(0,0,0,0.28)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0,
          }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>👋 Welcome to KUETx!</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Quick guide to get you started.</div>
            </div>
            <button onClick={onClose} style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--muted)', padding: 6, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }} aria-label="Close">
              <X size={18} />
            </button>
          </div>

          {/* PDF */}
          <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
            <iframe
              src="/KUETx_Guide .pdf"
              title="KUETx Guide"
              style={{ width: '100%', height: '100%', minHeight: 380, border: 'none' }}
            />
          </div>

          {/* Footer */}
          <div style={{
            padding: '12px 18px', borderTop: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 12, flexWrap: 'wrap', flexShrink: 0, background: 'var(--bg)',
          }}>
            <a href="https://www.facebook.com/kuetx" target="_blank" rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '8px 14px', borderRadius: 9, textDecoration: 'none',
                background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)',
                color: 'var(--accent)', fontWeight: 700, fontSize: 13,
              }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.99 3.66 9.12 8.44 9.88v-6.99H7.9v-2.89h2.54V9.85c0-2.51 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.87h2.77l-.44 2.89h-2.33V21.9C18.34 21.12 22 17 22 12z"/></svg>
              Follow on Facebook
            </a>
            <button onClick={onClose} className="btn btn-primary" style={{ fontSize: 13 }}>
              Got it, let's go →
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
