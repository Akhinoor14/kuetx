import { Link, useLocation } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { NAV } from '../nav';
import { Logo, Wordmark } from './Logo';

export function Sidebar({ open, onClose, compact = false, onToggleCompact }) {
  const location = useLocation();

  return (
    <>
      {open && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 30, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}
          className="md:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`sidebar ${open ? 'open' : ''} ${compact ? 'compact' : ''}`}>
        {/* Logo */}
        <div style={{ padding: compact ? '16px 10px 12px' : '18px 16px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: compact ? 'center' : 'space-between', gap: 8 }}>
            {compact ? (
              <button
                onClick={onToggleCompact}
                className="hidden md:flex"
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: 0,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Expand sidebar"
              >
                <Logo size={40} />
              </button>
            ) : (
              <Wordmark height={32} />
            )}

            {!compact && (
              <button
                onClick={onToggleCompact}
                className="hidden md:flex"
                style={{
                  width: 28,
                  height: 28,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--muted)',
                }}
                title="Compact sidebar"
              >
                <Icons.PanelLeftClose size={14} />
              </button>
            )}
          </div>
          {!compact && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Student Life OS for KUET</div>}
        </div>

        {/* Nav groups */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 10px 16px' }}>
          {NAV.map((section, sectionIndex) => (
            <div key={section.group}>
              {compact && sectionIndex > 0 && (
                <div
                  style={{ height: 1, background: 'var(--border)', margin: '10px 12px', opacity: 0.55 }}
                  aria-hidden="true"
                />
              )}
              {!compact && (
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.09em', padding: '16px 6px 6px' }}>
                  {section.group}
                </div>
              )}
              {section.items.map(item => {
                const Icon = Icons[item.icon] || Icons.Circle;
                const active = location.pathname === item.path ||
                  (item.path !== '/' && location.pathname.startsWith(item.path));
                return (
                  <Link
                    key={item.id}
                    to={item.path}
                    onClick={onClose}
                    className={`nav-item ${active ? 'active' : ''}`}
                    title={item.label}
                    style={compact ? { justifyContent: 'center', padding: '9px 0' } : undefined}
                  >
                    <Icon size={16} strokeWidth={active ? 2.5 : 1.8} style={{ flexShrink: 0 }} />
                    {!compact && item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>
          {compact ? 'v1.0' : 'KUETx v1.0 · All data stored locally'}
        </div>
      </aside>
    </>
  );
}
