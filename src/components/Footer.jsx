import { Link } from 'react-router-dom';
import { Wordmark } from './Logo';
import * as Icons from 'lucide-react';
import { useState, useEffect } from 'react';
import { getStorageUsage } from '../store/indexeddb-store';

export function Footer({ syncStatus, isAnonymous, displayName }) {
  const [activeModal, setActiveModal] = useState(null);
  const [storageKB, setStorageKB] = useState(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    getStorageUsage().then(kb => setStorageKB(parseFloat(kb)));
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const storageDisplay = storageKB == null ? '…'
    : storageKB < 1024 ? `${storageKB.toFixed(0)} KB`
    : `${(storageKB / 1024).toFixed(1)} MB`;

  const syncColor = {
    synced:  '#10b981',
    syncing: '#f59e0b',
    pending: '#f59e0b',
    error:   '#ef4444',
    idle:    'var(--muted)',
  }[syncStatus] || 'var(--muted)';

  const syncLabel = {
    synced:  'Synced',
    syncing: 'Syncing…',
    pending: 'Pending',
    error:   'Sync error',
    idle:    'Offline',
  }[syncStatus] || 'Offline';

  const SyncDot = () => (
    <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: syncColor, marginRight: 5, flexShrink: 0, boxShadow: syncStatus === 'synced' ? `0 0 0 2px ${syncColor}30` : 'none' }} />
  );

  const developerInfo = {
    name: 'Md Akhinoor Islam',
    title: 'Lead Developer & Founder',
    institution: 'KUET',
    department: 'Energy Science & Engineering',
    email: 'mdakhinoorislam.official.2005@gmail.com',
    whatsapp: '8801724812042',
    portfolio: 'https://a3kmstudio.vercel.app/Portfolio_Clients/Mr_Akhinoor_Portfolio',
    social: [
      { icon: 'Github',   url: 'https://github.com/Akhinoor14',                    label: 'GitHub',   color: '#333',    rgb: '51,51,51' },
      { icon: 'Linkedin', url: 'https://www.linkedin.com/in/mdakhinoorislam/',     label: 'LinkedIn', color: '#0A66C2', rgb: '10,102,194' },
      { icon: 'Facebook', url: 'https://www.facebook.com/mdakhinoorislam',         label: 'Facebook', color: '#1877F2', rgb: '24,119,242' },
    ],
  };

  return (
    <>
      <footer style={{ marginTop: '2rem', borderTop: '1px solid var(--border)', background: 'var(--surface)', width: '100%', boxSizing: 'border-box' }}>

        {/* ── Main row ── */}
        <div style={{ width: '100%', padding: '10px 24px 8px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, boxSizing: 'border-box' }}>

          {/* Left: logo */}
          <Link to="/about" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit' }}>
            <Wordmark height={22} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1 }}>KUETx</div>
              <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.1 }}>Student Life OS · v3.4</div>
            </div>
          </Link>

          {/* Center: nav */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
            {[
              { label: 'Guide',     icon: Icons.BookOpen, onClick: () => window.dispatchEvent(new CustomEvent('kuetx:openGuide')) },
              { label: 'Community', icon: Icons.Users,    href: 'https://www.facebook.com/kuetx' },
              { label: 'About',     icon: Icons.Info,     to: '/about' },
              { label: 'Contact',   icon: Icons.Mail,     onClick: () => setActiveModal('contact') },
            ].map(({ label, icon: Ic, onClick, href, to }) => {
              const style = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 8, background: 'transparent', color: 'var(--muted)', fontSize: 12, fontWeight: 500, border: '1px solid var(--border)', cursor: 'pointer', textDecoration: 'none', transition: 'all 0.12s' };
              const hoverIn  = e => { e.currentTarget.style.background = 'var(--inputBg)'; e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--muted) 50%, var(--border))'; };
              const hoverOut = e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border)'; };
              if (href) return <a key={label} href={href} target="_blank" rel="noopener noreferrer" style={style} onMouseEnter={hoverIn} onMouseLeave={hoverOut}><Ic size={12} />{label}</a>;
              if (to)   return <Link key={label} to={to} style={style} onMouseEnter={hoverIn} onMouseLeave={hoverOut}><Ic size={12} />{label}</Link>;
              return <button key={label} style={style} onMouseEnter={hoverIn} onMouseLeave={hoverOut} onClick={onClick}><Ic size={12} />{label}</button>;
            })}
          </div>

          {/* Right: status chip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 99, background: 'var(--inputBg)', border: '1px solid var(--border)', fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>
            <SyncDot />
            <span style={{ color: syncColor, fontWeight: 600 }}>{syncLabel}</span>
            {!isAnonymous && displayName && (
              <><span style={{ color: 'var(--border)', margin: '0 2px' }}>·</span><span style={{ maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</span></>
            )}
          </div>
        </div>

        {/* ── Bottom micro row ── */}
        <div style={{ width: '100%', padding: '7px 24px 10px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, borderTop: '1px solid var(--border)', boxSizing: 'border-box' }}>

          {/* Left: copyright */}
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
            © 2025 KUETx · <span style={{ color: 'var(--text)', fontWeight: 500 }}>Md Akhinoor Islam</span>
          </span>

          {/* Center: storage + data info */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--muted)' }}>
              <Icons.Database size={11} style={{ opacity: 0.5 }} />
              {storageDisplay} stored
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--muted)' }}>
              <Icons.HardDrive size={11} style={{ opacity: 0.5 }} />
              Local · IndexedDB
            </span>
          </div>

          {/* Right: social icons */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {developerInfo.social.map(({ icon, url, label }) => {
              const Ic = Icons[icon];
              return (
                <a key={label} href={url} target="_blank" rel="noopener noreferrer" title={label}
                  style={{ color: 'var(--muted)', display: 'flex', alignItems: 'center', textDecoration: 'none', transition: 'color 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--muted)'}
                >
                  {Ic && <Ic size={14} />}
                </a>
              );
            })}
          </div>
        </div>
      </footer>

      {/* Contact Modal */}
      {activeModal === 'contact' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem', backdropFilter: 'blur(4px)' }}
          onClick={() => setActiveModal(null)}>
          <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', padding: '1.5rem', maxWidth: 380, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', position: 'relative' }}
            onClick={e => e.stopPropagation()}>
            <button onClick={() => setActiveModal(null)}
              style={{ position: 'absolute', top: 12, right: 12, background: 'var(--inputBg)', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--muted)' }}>
              <Icons.X size={14} />
            </button>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <img src="/pp1.jpg" alt={developerInfo.name} style={{ width: 72, height: 72, borderRadius: 12, objectFit: 'cover', border: '2px solid var(--accent)', margin: '0 auto 10px' }} />
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 2 }}>{developerInfo.name}</div>
              <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, marginBottom: 2 }}>{developerInfo.title}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{developerInfo.department} · {developerInfo.institution}</div>
            </div>
            <div style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
              {[
                { href: `mailto:${developerInfo.email}`, icon: Icons.Mail, label: 'Email', color: '#ef4444', rgb: '239,68,68' },
                { href: `https://wa.me/${developerInfo.whatsapp}`, icon: Icons.MessageCircle, label: 'WhatsApp', color: '#16a34a', rgb: '22,163,74', blank: true },
              ].map(({ href, icon: Ic, label, color, rgb, blank }) => (
                <a key={label} href={href} {...(blank ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  style={{ padding: '9px 12px', borderRadius: 10, background: `rgba(${rgb},0.10)`, border: `1px solid rgba(${rgb},0.22)`, color, textDecoration: 'none', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = `rgba(${rgb},0.16)`}
                  onMouseLeave={e => e.currentTarget.style.background = `rgba(${rgb},0.10)`}
                >
                  <Ic size={14} style={{ flexShrink: 0 }} />{label}
                </a>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              <a href={developerInfo.portfolio} target="_blank" rel="noopener noreferrer"
                style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(14,165,233,0.22)', background: 'rgba(14,165,233,0.08)', color: '#0284C7', textDecoration: 'none', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'all 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(14,165,233,0.16)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(14,165,233,0.08)'}
              ><Icons.Briefcase size={13} /> Portfolio</a>
              {developerInfo.social.map(({ icon, url, label, color, rgb }) => {
                const Ic = Icons[icon];
                return (
                  <a key={label} href={url} target="_blank" rel="noopener noreferrer"
                    style={{ padding: '8px 10px', borderRadius: 10, border: `1px solid rgba(${rgb},0.22)`, background: `rgba(${rgb},0.08)`, color, textDecoration: 'none', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'all 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = `rgba(${rgb},0.16)`}
                    onMouseLeave={e => e.currentTarget.style.background = `rgba(${rgb},0.08)`}
                  >{Ic && <Ic size={13} />}{label}</a>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}