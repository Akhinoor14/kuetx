import { useState } from 'react';
import { Compass } from 'lucide-react';
import AuthModal from '../AuthModal';

// GUEST MODE (Phase 2.4) — persistent "you're viewing a demo" banner.
// Fixed to the top of every /guest/* page. Reappears on every page load
// (no dismiss-forever option) per the plan's spec. Sign Up opens the same
// AuthModal every other entry point in the app uses — no parallel modal.
export default function GuestBanner() {
  const [showAuthModal, setShowAuthModal] = useState(false);

  return (
    <>
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: '0.6rem', flexWrap: 'wrap',
        padding: '0.6rem 1rem',
        background: 'color-mix(in srgb, var(--accent) 14%, var(--surface))',
        borderBottom: '1px solid color-mix(in srgb, var(--accent) 28%, var(--border))',
        fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)',
        textAlign: 'center',
      }}>
        <Compass size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <span>You're viewing a demo with sample data.</span>
        <button
          type="button"
          onClick={() => setShowAuthModal(true)}
          style={{
            padding: '0.3rem 0.75rem', borderRadius: 999,
            background: 'var(--accent)', color: '#fff', border: 'none',
            fontSize: '0.82rem', fontWeight: 800, cursor: 'pointer',
          }}
        >
          Sign Up — it's free
        </button>
      </div>
      {showAuthModal && (
        <AuthModal
          mode="login"
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => setShowAuthModal(false)}
        />
      )}
    </>
  );
}
