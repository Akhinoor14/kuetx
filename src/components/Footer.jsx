import { Wordmark } from './Logo';

const Social = ({ href, label, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label}
    style={{
      width: 36, height: 36, borderRadius: '50%',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)',
      transition: 'color .18s, border-color .18s, transform .18s',
      cursor: 'pointer', textDecoration: 'none', flexShrink: 0,
    }}
    onMouseEnter={e => { e.currentTarget.style.color='var(--accent)'; e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.transform='translateY(-2px)'; }}
    onMouseLeave={e => { e.currentTarget.style.color='var(--muted)'; e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.transform='translateY(0)'; }}
  >{children}</a>
);

export function Footer() {
  return (
    <footer style={{ marginTop: '2rem', borderTop: '1px solid var(--border)', background: 'var(--surface)', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, var(--accent), transparent)', opacity: 0.7 }} />

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '1.2rem 1.5rem 1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>

        {/* Brand */}
        <div style={{ border: '1px solid var(--accent)', borderRadius: 10, padding: '0.9rem 1rem', background: 'var(--card)', boxShadow: '0 4px 14px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Wordmark height={28} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, marginBottom: '0.6rem' }}>
            A comprehensive Student Life OS for KUET — tracks academics, finance, wellbeing and more. 100% offline.
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
            {['Free & Offline','KUET Ordinance','localStorage'].map(b => (
              <span key={b} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, border: '1px solid var(--border)', color: 'var(--muted)' }}>{b}</span>
            ))}
          </div>
        </div>

        {/* Developer */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.9rem 1rem', background: 'var(--card)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.3rem' }}>Developer</div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: '0.2rem' }}>Md Akhinoor Islam</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: '0.5rem' }}>Undergraduate Student</div>
          <ul style={{ listStyle: 'none', display: 'grid', gap: '0.15rem' }}>
            {['Khulna University of Engineering & Technology','Dept. of Energy Science & Engineering','Owner of A3KM Studio'].map(l => (
              <li key={l} style={{ fontSize: 11, color: 'var(--muted)' }}>{l}</li>
            ))}
          </ul>
        </div>

        {/* Connect */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.9rem 1rem', background: 'var(--card)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.3rem' }}>Connect</div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: '0.2rem' }}>Social & Community</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: '0.65rem' }}>Reach out for ideas or collaboration.</div>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Email — special red style */}
            <a href="mailto:mdakhinoorislam.official.2005@gmail.com" title="Email"
              style={{ height: 36, padding: '0 12px', borderRadius: 10, display: 'inline-flex', alignItems: 'center', gap: 5, background: 'linear-gradient(180deg,rgba(239,68,68,.18),rgba(185,28,28,.28))', border: '1px solid rgba(239,68,68,.45)', color: '#ef4444', fontSize: 12, fontWeight: 500, textDecoration: 'none', flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 5c0-1 1-2 2-2h14c1 0 2 1 2 2v2l-8 5-8-5V5zm0 3.5v8.5c0 1 1 2 2 2h14c1 0 2-1 2-2V8.5l-8 5-8-5z"/></svg>
              Email
            </a>
            <Social href="https://wa.me/8801724812042" label="WhatsApp">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 3.5A10 10 0 0 0 3.2 18.6L2 22l3.5-1.1A10 10 0 1 0 20.5 3.5zm-8.5 17a8.1 8.1 0 0 1-4.1-1.1l-.3-.2-2.4.8.8-2.3-.2-.3A8.1 8.1 0 1 1 12 20.5zm4.6-5.7c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.6.1-.2.2-.7.8-.9 1-.1.2-.3.2-.5.1-1-.5-1.8-1.1-2.5-1.9-.7-.8-1-1.5-1.1-1.7 0-.2 0-.4.1-.5.1-.1.2-.2.3-.4.1-.1.2-.3.3-.4.1-.2.1-.4 0-.6-.1-.1-.6-1.5-.9-2-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2 0 1.2.9 2.4 1 2.6.1.2 1.8 2.8 4.4 3.9.6.3 1.1.5 1.5.6.6.2 1.1.2 1.5.1.5-.1 1.4-.6 1.6-1.1.2-.5.2-.9.1-1-.1-.2-.2-.2-.4-.3z"/></svg>
            </Social>
            <Social href="https://www.linkedin.com/in/mdakhinoorislam/" label="LinkedIn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M4.98 3.5A2.5 2.5 0 1 1 5 8.5a2.5 2.5 0 0 1-.02-5zM3.5 9h3v11h-3V9zm6.5 0h2.9v1.5h.1c.4-.8 1.5-1.7 3.1-1.7 3.3 0 3.9 2.1 3.9 4.9V20h-3v-5.1c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7V20h-3V9z"/></svg>
            </Social>
            <Social href="https://github.com/Akhinoor14" label="GitHub">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.8c-2.8.6-3.4-1.2-3.4-1.2-.5-1.1-1.1-1.4-1.1-1.4-.9-.6.1-.6.1-.6 1 .1 1.6 1 1.6 1 .9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.7-1.4-2.2-.3-4.6-1.1-4.6-5a4 4 0 0 1 1.1-2.8 3.7 3.7 0 0 1 .1-2.8s.9-.3 2.9 1.1a10 10 0 0 1 5.3 0c2-1.4 2.9-1.1 2.9-1.1a3.7 3.7 0 0 1 .1 2.8 4 4 0 0 1 1.1 2.8c0 3.9-2.4 4.7-4.7 5 .4.3.8 1 .8 2v3c0 .3.2.6.7.5A10 10 0 0 0 12 2z"/></svg>
            </Social>
            <Social href="https://www.facebook.com/mdakhinoorislam" label="Facebook">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 9H16l-.3 3h-2.2v8h-3v-8H8V9h2.5V7.2C10.5 5 11.6 4 13.7 4H16v3h-1.6c-.7 0-.9.3-.9.9V9z"/></svg>
            </Social>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0.65rem 1.5rem 1rem', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', fontSize: 11, color: 'var(--muted)' }}>
        <span>© KUETx · Built by Md Akhinoor Islam for KUET students</span>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <a href="https://a3kmstudio.vercel.app" target="_blank" rel="noopener" style={{ color: 'var(--accent)', textDecoration: 'none' }}>A3KM Studio</a>
          <span>·</span>
          <span>All data stored locally · No server</span>
        </div>
      </div>
    </footer>
  );
}
