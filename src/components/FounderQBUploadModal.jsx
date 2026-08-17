// FounderQBUploadModal.jsx
//
// Thin modal wrapper around QBUploadForm (isFounder mode), used by
// QuestionBank.jsx's "Upload (direct)" button. Founder already has this
// exact form embedded inline (no modal) in AdminDashboard.jsx's Question
// Bank tab — this component adds no new upload logic, it just lets the
// SAME form open as a popup from the public browsing page too, so a
// Founder doesn't have to leave the page they're browsing to upload.
//
// getProfile() is called here (not passed as a prop) because
// QuestionBank.jsx doesn't otherwise need the full profile object.

import { X } from 'lucide-react';
import QBUploadForm from './QBUploadForm';
import { getProfile } from '../store/store';

export default function FounderQBUploadModal({ onClose, onUploaded }) {
  const profile = getProfile();

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1300,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '40px 16px', overflowY: 'auto',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--card, #fff)', borderRadius: 14,
          width: '100%', maxWidth: 640, padding: 16,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Upload — direct to Question Bank</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        <QBUploadForm profile={profile} isFounder onUploaded={onUploaded} />
      </div>
    </div>
  );
}
