import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import { NAV } from '../nav';
import { Logo, Wordmark } from './Logo';
import { store } from '../store/store';

export function Sidebar({ open, onClose, compact = false, onToggleCompact }) {
  const location = useLocation();
  const [notes, setNotes] = useState([]);
  const [profile, setProfile] = useState(() => store.get('profile') || {});
  const [showNotes, setShowNotes] = useState(false);

  useEffect(() => {
    const storedNotes = store.get('notes') || [];
    setNotes(storedNotes);
  }, []);

  useEffect(() => {
    const syncProfile = () => setProfile(store.get('profile') || {});
    window.addEventListener('kuetx:store-updated', syncProfile);
    syncProfile();
    return () => window.removeEventListener('kuetx:store-updated', syncProfile);
  }, []);

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
              <Link
                to="/about"
                onClick={onClose}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'inherit' }}
              >
                <Wordmark height={32} />
              </Link>
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
          {!compact && (
            <Link
              to="/about"
              onClick={onClose}
              style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, display: 'inline-block', textDecoration: 'none' }}
            >
              Student Life OS for KUET
            </Link>
          )}
        </div>

        {/* Nav groups */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 10px 16px' }}>
          {NAV.map((section, sectionIndex) => {
            // Check if any items in this section are visible
            const visibleItems = section.items.filter(item => !item.requiresCR || profile.isCR);
            
            // Skip section if no items are visible
            if (visibleItems.length === 0) return null;

            return (
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
                  // hide items that require CR unless user is CR
                  if (item.requiresCR) {
                    if (!profile.isCR) return null;
                  }
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
            );
          })}
        </nav>

        {/* Notes Overview */}
        {!compact && (
          <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
            <button
              onClick={() => setShowNotes(!showNotes)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text)',
                fontSize: 12,
                fontWeight: 600,
                padding: '8px 0',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icons.FileText size={14} style={{ color: 'var(--accent)' }} />
                Notes Overview
              </span>
              <Icons.ChevronDown size={14} style={{ transform: showNotes ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
            </button>

            {showNotes && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, color: 'var(--muted)' }}>
                  <span>Total Notes</span>
                  <span style={{ fontWeight: 600, color: 'var(--text)' }}>{notes.length}</span>
                </div>

                {notes.filter(n => n.pinned).length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase' }}>Pinned</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {notes.filter(n => n.pinned).slice(0, 3).map(note => (
                        <Link
                          key={note.id}
                          to="/notes"
                          onClick={onClose}
                          style={{
                            padding: '6px 8px',
                            borderRadius: 4,
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                            textDecoration: 'none',
                            color: 'var(--text)',
                            fontSize: 11,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            display: 'block',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => e.target.style.borderColor = 'var(--accent)'}
                          onMouseLeave={(e) => e.target.style.borderColor = 'var(--border)'}
                        >
                          {note.title || '(untitled)'}
                        </Link>
                      ))}
                      {notes.filter(n => n.pinned).length > 3 && (
                        <div style={{ fontSize: 10, color: 'var(--muted)', padding: '4px 0' }}>
                          +{notes.filter(n => n.pinned).length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <Link
                  to="/notes"
                  onClick={() => {
                    onClose();
                    setShowNotes(false);
                  }}
                  style={{
                    display: 'block',
                    padding: '8px 0',
                    color: 'var(--accent)',
                    textDecoration: 'none',
                    fontSize: 11,
                    fontWeight: 600,
                    marginTop: 8,
                    borderTop: '1px solid var(--border)',
                    paddingTop: 10,
                  }}
                >
                  View All Notes →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Bottom */}
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>
          {compact ? 'v3.0' : 'KUETx v3.0 · All data stored locally'}
        </div>
      </aside>
    </>
  );
}
