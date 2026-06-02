import React from 'react';
import { AlertTriangle } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[KUETx ErrorBoundary] Component error:', error, errorInfo);
  }

  render() {
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
              maxHeight: 200,
              fontFamily: 'monospace'
            }}>
              {this.state.error?.toString()}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
