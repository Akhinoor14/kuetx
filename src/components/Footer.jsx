import { Link } from 'react-router-dom';
import { Wordmark } from './Logo';
import * as Icons from 'lucide-react';

export function Footer() {
  return (
    <footer style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
      <div style={{ maxWidth: 1040, width: '100%', margin: '0 auto', padding: '0.9rem 1rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', boxSizing: 'border-box' }}>
        <Link to="/about" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, flex: '1 1 auto', textDecoration: 'none', color: 'inherit' }}>
          <Wordmark height={24} />
          <span style={{ fontSize: '0.82rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>Student Life OS</span>
        </Link>

        <Link
          to="/about"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '0.35rem 0.65rem',
            borderRadius: 999,
            background: 'var(--accent)',
            color: 'var(--accentFg)',
            textDecoration: 'none',
            fontSize: '0.75rem',
            fontWeight: 700,
            boxShadow: '0 6px 12px rgba(15, 23, 42, 0.08)',
            transition: 'transform .18s ease, box-shadow .18s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 10px 16px rgba(15, 23, 42, 0.12)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 6px 12px rgba(15, 23, 42, 0.08)'; }}
        >
          <Icons.Info size={12} />
          About
        </Link>
      </div>

      <div style={{ maxWidth: 1040, width: '100%', margin: '0 auto', padding: '0 1rem 0.9rem', fontSize: '0.72rem', color: 'var(--muted)', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.5rem', boxSizing: 'border-box' }}>
        <span>© KUETx · Md Akhinoor Islam</span>
        <span>Offline · Local data</span>
      </div>
    </footer>
  );
}
