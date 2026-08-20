import React from 'react';
import { AlertTriangle } from 'lucide-react';

// BUGFIX (deploy-time infinite reload loop): this used to be one single
// flag ('chunk_reload_attempted') shared by every chunk. That meant the
// FIRST chunk to fail (say Dashboard-*.js) consumed the one-and-only
// reload attempt for the whole session — so if a stale service worker (or
// any other transient cause) then made a SECOND, DIFFERENT chunk fail
// (say Schedule-*.js) right after that reload, this boundary saw
// alreadyAttempted=true and gave up immediately, even though a reload for
// THAT specific chunk had never actually been tried. Multiply that across
// however many lazy chunks a fresh deploy touches and the app could
// bounce through several genuinely-once-per-chunk reloads that, from the
// outside, looked and felt exactly like one continuous crash loop.
//
// Fix: key the "have we already tried reloading for this" flag by the
// failing chunk's own identity (extracted from the error message/stack
// below), not by a single shared constant — so each distinct chunk still
// gets its own one-time reload attempt, same as before, but a second
// DIFFERENT chunk failing isn't punished for the first one's retry. A
// session-wide cap on top (MAX_CHUNK_RELOADS_PER_SESSION) is the backstop
// for the genuinely pathological case (many chunks failing in sequence,
// e.g. a still-propagating bad deploy) so this can never turn into an
// unbounded reload loop regardless of how many distinct chunks are
// involved.
const CHUNK_RELOAD_KEY_PREFIX = 'chunk_reload_attempted:';
const CHUNK_RELOAD_COUNT_KEY = 'chunk_reload_count';
const MAX_CHUNK_RELOADS_PER_SESSION = 3;

// Best-effort extraction of "which chunk/module actually failed" from a
// ChunkLoadError's message or stack, so retries can be tracked per-chunk
// instead of globally. Falls back to a fixed key if nothing recognizable
// is found (e.g. a bare "Loading chunk 4 failed" with no filename) so
// this NEVER throws and always returns a usable, stable string.
function getChunkErrorKey(error) {
  try {
    const text = String(error?.message || '') + ' ' + String(error?.stack || '');
    // Vite/Rollup-hashed chunk filenames, e.g. "Dashboard-C4SLrqqy.js"
    const match = text.match(/([A-Za-z0-9_-]+-[A-Za-z0-9_]{6,})\.js/);
    if (match) return match[1];
    // webpack-style "Loading chunk 4 failed"
    const numMatch = text.match(/[Cc]hunk\s+(\d+)/);
    if (numMatch) return `chunk-${numMatch[1]}`;
    return 'unknown';
  } catch (e) {
    return 'unknown';
  }
}

function isChunkLoadError(error) {
  if (!error) return false;
  if (error.name === 'ChunkLoadError') return true;
  const message = String(error.message || '');
  return (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Loading chunk') ||
    message.includes('Loading CSS chunk')
  );
}

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, offlineChunkError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[KUETx ErrorBoundary] Component error:', error, errorInfo);

    if (isChunkLoadError(error)) {
      // Offline: a reload can't fetch the missing chunk either, so
      // reloading would just repeat this same failure (or loop once,
      // then land on the generic error UI) with no clue why. Skip the
      // reload and explain what actually happened instead.
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        this.setState({ offlineChunkError: true });
        return;
      }

      const chunkKey = getChunkErrorKey(error);
      const chunkFlag = CHUNK_RELOAD_KEY_PREFIX + chunkKey;

      let alreadyAttempted = false;
      let sessionCount = 0;
      try {
        alreadyAttempted = sessionStorage.getItem(chunkFlag) === '1';
        sessionCount = Number(sessionStorage.getItem(CHUNK_RELOAD_COUNT_KEY)) || 0;
      } catch (e) {
        // sessionStorage unavailable (e.g. private mode) — fall back to normal error UI
        alreadyAttempted = true;
      }

      // Per-chunk guard: this exact chunk gets one reload attempt.
      // Session-wide guard: no matter how many DIFFERENT chunks fail in
      // a row, cap total reload attempts so a still-propagating bad
      // deploy or a misbehaving cache can never turn into an unbounded
      // reload loop.
      if (!alreadyAttempted && sessionCount < MAX_CHUNK_RELOADS_PER_SESSION) {
        try {
          sessionStorage.setItem(chunkFlag, '1');
          sessionStorage.setItem(CHUNK_RELOAD_COUNT_KEY, String(sessionCount + 1));
        } catch (e) {
          // ignore — reload will still happen, just without loop protection
        }
        window.location.reload();
        return;
      }
      // this chunk already retried once, or the session-wide cap was hit —
      // fall through to normal error UI below instead of reloading again
    }
  }

  render() {
    if (this.state.offlineChunkError) {
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: 20,
          background: 'var(--surface)',
          color: 'var(--text)',
          flexDirection: 'column',
          gap: 16
        }}>
          <AlertTriangle size={48} color='var(--accent)' />
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px 0' }}>
              You're offline
            </h1>
            <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0, marginBottom: 12, maxWidth: 320 }}>
              This page needs an internet connection the first time you open it. Reconnect and try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--accent)',
                color: 'white',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: 20,
          background: 'var(--surface)',
          color: 'var(--text)',
          flexDirection: 'column',
          gap: 16
        }}>
          <AlertTriangle size={48} color='var(--danger)' />
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px 0' }}>
              Something went wrong
            </h1>
            <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0, marginBottom: 12 }}>
              The app encountered an error and needs to reload
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--accent)',
                color: 'white',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reload Page
            </button>
          </div>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <div style={{
              marginTop: 16,
              padding: 12,
              background: 'var(--surfaceGlass)',
              borderRadius: 8,
              border: '1px solid var(--border)',
              fontSize: 12,
              color: 'var(--muted)',
              maxWidth: '90vw',
              overflow: 'auto',
              maxHeight: 400,
              fontFamily: 'monospace'
            }}>
              <div style={{whiteSpace: 'pre-wrap', textAlign: 'left'}}>
                {this.state.error?.toString()}
                {this.state.error?.stack && ('\n\n' + this.state.error.stack)}
              </div>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
