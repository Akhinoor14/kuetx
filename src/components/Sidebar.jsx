import { Link, useLocation } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { NAV } from '../nav';
import { Wordmark } from './Logo';
import { store } from '../store/store';

export function Sidebar({ open, onClose }) {
  const location = useLocation();
  const profile = store.get('profile') || {};

  return (
    <>
      {open && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 30, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}
          className="md:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`sidebar ${open ? 'open' : ''}`}>
        {/* Logo */}
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid var(--border)' }}>
          <Wordmark height={28} />
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Student Life OS for KUET</div>
        </div>

        {/* Student chip */}
        {profile.name && (
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--accent)', color: 'var(--accentFg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
              {profile.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.name.split(' ')[0]}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{profile.dept} · {profile.session}</div>
            </div>
            {profile.isCR && <span className="tag tag-green" style={{ fontSize: 10, flexShrink: 0 }}>CR</span>}
          </div>
        )}

        {/* Nav groups */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 10px 16px' }}>
          {NAV.map(section => (
            <div key={section.group}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.09em', padding: '16px 6px 6px' }}>
                {section.group}
              </div>
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
                  >
                    <Icon size={16} strokeWidth={active ? 2.5 : 1.8} style={{ flexShrink: 0 }} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>
          KUETx v1.0 · All data stored locally
        </div>
      </aside>
    </>
  );
}
