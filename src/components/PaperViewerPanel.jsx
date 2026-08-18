// PaperViewerPanel.jsx
//
// Shared full-screen "view this paper inside the app" panel — extracted
// from TeacherDetailModal.jsx so both TeacherDetailModal.jsx (the "View"
// modal) and PublicationsBrowse.jsx (the main list's "Paper" button) can
// reuse the exact same in-app-first / external-tab-fallback behavior
// instead of maintaining two copies of the iframe-blocked-detection
// heuristic.
//
// This component only owns the DISPLAY of a paper (iframe + fallback UI).
// It does NOT own "which paper is currently selected" — that's caller
// state (see openPaperInApp/closePaperPanel in each caller), because
// that's inherently caller-specific (a row click in a list vs. a row
// click inside a modal).
//
// Renders nothing when `paper` is null — same as the original
// `{viewingPaper && (...)}` guard this replaced.

import { useEffect, useRef, useState } from 'react';
import * as Icons from 'lucide-react';

// How long we give an embedded paper iframe to actually paint something
// before assuming the source blocks embedding (X-Frame-Options/CSP) and
// falling back to an external tab. There's no reliable client-side way
// to detect a blocked iframe directly (the browser silently blank-pages
// it, no onError fires for CSP/X-Frame-Options denials) — this timeout
// is a heuristic, not a guarantee. A same-origin load fires onLoad well
// under this, so it doesn't meaningfully slow down the working case.
const IFRAME_LOAD_TIMEOUT_MS = 4000;

/**
 * @param {{title: string, link: string} | null} paper - the paper
 *   currently being viewed, or null to render nothing.
 * @param {() => void} onClose
 */
export default function PaperViewerPanel({ paper, onClose }) {
  const [iframeStatus, setIframeStatus] = useState('loading');
  const iframeTimerRef = useRef(null);

  useEffect(() => {
    clearTimeout(iframeTimerRef.current);
    if (!paper) return;
    setIframeStatus('loading');
    iframeTimerRef.current = setTimeout(() => setIframeStatus('blocked'), IFRAME_LOAD_TIMEOUT_MS);
    return () => clearTimeout(iframeTimerRef.current);
  }, [paper]);

  function handleIframeLoad() {
    clearTimeout(iframeTimerRef.current);
    setIframeStatus('loaded');
  }

  if (!paper) return null;

  return (
    // In-app paper panel — opens INSIDE the caller instead of a new
    // browser tab. Tries an embedded iframe first; if it hasn't loaded
    // within IFRAME_LOAD_TIMEOUT_MS (likely blocked by the source's
    // X-Frame-Options/CSP, or it's a non-embeddable PDF), falls back to
    // an "open in new tab" prompt — external is the fallback, not the
    // default.
    <div
      style={{
        position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 100001,
        display: 'flex', flexDirection: 'column',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
        borderBottom: '1px solid var(--border)', background: 'var(--card)',
      }}>
        <button
          onClick={onClose}
          style={{
            background: 'transparent', border: '1px solid var(--border)', borderRadius: 8,
            color: 'var(--text)', cursor: 'pointer', padding: 7, display: 'flex',
          }}
          aria-label="Back"
        >
          <Icons.ArrowLeft size={16} />
        </button>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {paper.title}
        </div>
        <a
          href={paper.link}
          target="_blank"
          rel="noreferrer"
          style={{
            fontSize: 11.5, color: 'var(--muted)', fontWeight: 700, display: 'inline-flex',
            alignItems: 'center', gap: 5, textDecoration: 'none', border: '1px solid var(--border)',
            borderRadius: 6, padding: '5px 10px', flexShrink: 0,
          }}
          title="Open in a new tab"
        >
          <Icons.ExternalLink size={12} />
        </a>
      </div>

      {iframeStatus === 'blocked' ? (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 12, padding: 24, textAlign: 'center',
        }}>
          <Icons.ShieldAlert size={28} color="var(--muted)" />
          <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 320 }}>
            This source doesn't allow in-app viewing. Open it in a new tab instead.
          </div>
          <a
            href={paper.link}
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: 13, fontWeight: 700, color: '#fff', background: 'var(--accent)',
              border: 'none', borderRadius: 10, padding: '9px 16px', textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <Icons.ExternalLink size={14} /> Open in new tab
          </a>
        </div>
      ) : (
        <>
          {iframeStatus === 'loading' && (
            <div style={{ padding: '10px 16px', fontSize: 12, color: 'var(--muted)' }}>Loading…</div>
          )}
          <iframe
            key={paper.link}
            src={paper.link}
            title={paper.title}
            onLoad={handleIframeLoad}
            style={{ flex: 1, width: '100%', border: 'none' }}
          />
        </>
      )}
    </div>
  );
}
