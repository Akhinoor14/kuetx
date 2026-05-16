import { Link } from 'react-router-dom';
import { Wordmark } from '../components/Logo';
import * as Icons from 'lucide-react';

export default function About() {
  return (
    <div style={{ padding: '1rem', maxWidth: 900, margin: '0 auto' }}>
      {/* Compact hero */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Link to="/about" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit' }}>
          <Wordmark height={40} />
        </Link>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>About KUETx</h1>
          <div style={{ fontSize: '0.86rem', color: 'var(--muted)' }}>Minimal Student Life OS — offline-first, privacy respecting.</div>
        </div>
      </div>

      {/* One-line summary + CTA */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: '0.92rem', color: 'var(--muted)', lineHeight: 1.4 }}>
          KUETx helps students manage academics, attendance, marks, schedules and daily life — fully in the browser.
        </div>
        <Link to="/about" style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0.35rem 0.6rem', borderRadius: 999, background: 'var(--accent)', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: '0.78rem' }}>
          <Icons.Info size={12} />
          About
        </Link>
      </div>

      {/* Developer compact card */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 12, borderRadius: 10, background: 'var(--card)', border: '1px solid var(--border)', marginBottom: 12 }}>
        <div style={{ width: 56, height: 56, borderRadius: 12, background: 'linear-gradient(135deg,var(--accent),rgba(0,0,0,0.06))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icons.User size={28} style={{ color: '#fff' }} />
        </div>
        <div style={{ flex: '1 1 auto' }}>
          <div style={{ fontWeight: 800 }}>Md Akhinoor Islam</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>Undergraduate — Energy Science & Engineering, KUET</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <a href="tel:+8801724812042" style={{ fontSize: '0.8rem', color: 'var(--muted)', textDecoration: 'none' }}>01724812042</a>
            <a href="mailto:mdakhinoorislam.official.2005@gmail.com" style={{ fontSize: '0.8rem', color: 'var(--muted)', textDecoration: 'none' }}>Email</a>
            <a href="https://a3kmstudio.vercel.app/Portfolio_Clients/Mr_Akhinoor_Portfolio" target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8rem', color: 'var(--accent)', textDecoration: 'none' }}>Portfolio</a>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <a href="https://github.com/Akhinoor14" target="_blank" rel="noopener noreferrer" title="GitHub" style={{ color: 'var(--muted)' }}><Icons.GitHub size={18} /></a>
          <a href="https://www.youtube.com/@noor_academy_study" target="_blank" rel="noopener noreferrer" title="YouTube" style={{ color: 'var(--muted)' }}><Icons.Video size={18} /></a>
          <a href="https://www.facebook.com/mdakhinoorislam" target="_blank" rel="noopener noreferrer" title="Facebook" style={{ color: 'var(--muted)' }}><Icons.Facebook size={18} /></a>
          <a href="https://www.linkedin.com/in/mdakhinoorislam/" target="_blank" rel="noopener noreferrer" title="LinkedIn" style={{ color: 'var(--muted)' }}><Icons.Linkedin size={18} /></a>
        </div>
      </div>

      {/* Notable projects (compact) */}
      <div style={{ marginTop: 6, marginBottom: 10 }}>
        <div style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 8 }}>Selected projects</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 8 }}>
          <a href="https://textriva.vercel.app" target="_blank" rel="noopener noreferrer" style={{ padding: 10, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)', fontSize: '0.9rem' }}>Textriva — Study tools</a>
          <a href="https://foylxnote.vercel.app/" target="_blank" rel="noopener noreferrer" style={{ padding: 10, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)', fontSize: '0.9rem' }}>Foylx Note — Notes</a>
          <a href="https://bloodsync-dream.vercel.app/" target="_blank" rel="noopener noreferrer" style={{ padding: 10, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)', fontSize: '0.9rem' }}>BloodSync — Dream Club</a>
          <a href="https://fx991ex-calculator.vercel.app/" target="_blank" rel="noopener noreferrer" style={{ padding: 10, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)', fontSize: '0.9rem' }}>FX-991EX Calculator</a>
        </div>
      </div>

      {/* Short notes + ethos */}
      <div style={{ marginTop: 12, fontSize: '0.84rem', color: 'var(--muted)', lineHeight: 1.45 }}>
        <div style={{ marginBottom: 8 }}><strong>Design intent:</strong> compact, offline-first, minimal UI focused on fast access to student tools.</div>
        <div><strong>Privacy:</strong> no servers, data stays in the browser unless you explicitly export or share it.</div>
      </div>
    </div>
  );
}
