import React from 'react';
import { AlertTriangle } from 'lucide-react';

const CHUNK_RELOAD_FLAG = 'chunk_reload_attempted';

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

      let alreadyAttempted = false;
      try {
        alreadyAttempted = sessionStorage.getItem(CHUNK_RELOAD_FLAG) === '1';
      } catch (e) {
        // sessionStorage unavailable (e.g. private mode) — fall back to normal error UI
        alreadyAttempted = true;
      }

      if (!alreadyAttempted) {
        try {
          sessionStorage.setItem(CHUNK_RELOAD_FLAG, '1');
        } catch (e) {
          // ignore — reload will still happen, just without loop protection
        }
        window.location.reload();
        return;
      }
      // already attempted once — fall through to normal error UI below
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
