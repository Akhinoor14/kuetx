import { Link } from 'react-router-dom';
import { Wordmark } from './Logo';
import * as Icons from 'lucide-react';
import { useState } from 'react';

const footerButtonStyle = {
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
  border: 'none',
  cursor: 'pointer',
};

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '0, 0, 0';
}

export function Footer() {
  const [activeModal, setActiveModal] = useState(null);

  const developerInfo = {
    name: 'Md Akhinoor Islam',
    title: 'Lead Developer & Founder',
    institution: 'KUET',
    department: 'Energy Science & Engineering',
    email: 'mdakhinoorislam.official.2005@gmail.com',
    whatsapp: '8801724812042',
    portfolio: 'https://a3kmstudio.vercel.app/Portfolio_Clients/Mr_Akhinoor_Portfolio',
    social: [
      { icon: 'Github', url: 'https://github.com/Akhinoor14', label: 'GitHub', color: '#333' },
      { icon: 'Linkedin', url: 'https://www.linkedin.com/in/mdakhinoorislam/', label: 'LinkedIn', color: '#0A66C2' },
      { icon: 'Facebook', url: 'https://www.facebook.com/mdakhinoorislam', label: 'Facebook', color: '#1877F2' },
    ]
  };

  const handleButtonHover = (e, enter) => {
    if (enter) {
      e.currentTarget.style.transform = 'translateY(-1px)';
      e.currentTarget.style.boxShadow = '0 10px 16px rgba(15, 23, 42, 0.12)';
    } else {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = '0 6px 12px rgba(15, 23, 42, 0.08)';
    }
  };

  return (
    <>
      <footer style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div style={{ maxWidth: 1040, width: '100%', margin: '0 auto', padding: 'clamp(0.5rem, 2vw, 0.9rem) 1rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', boxSizing: 'border-box' }}>
          <Link to="/about" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, flex: '1 1 auto', textDecoration: 'none', color: 'inherit' }}>
            <Wordmark height={20} />
            <span style={{ fontSize: 'clamp(0.7rem, 2vw, 0.82rem)', color: 'var(--muted)', whiteSpace: 'nowrap' }}>Student Life OS</span>
          </Link>

          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              style={{...footerButtonStyle, fontSize: 'clamp(0.65rem, 1.5vw, 0.75rem)', padding: 'clamp(0.3rem, 1vw, 0.35rem) clamp(0.5rem, 1vw, 0.65rem)' }}
              onMouseEnter={e => handleButtonHover(e, true)}
              onMouseLeave={e => handleButtonHover(e, false)}
              onClick={() => window.dispatchEvent(new CustomEvent('kuetx:openGuide'))}
            >
              <Icons.BookOpen size={12} />
              Guide
            </button>

            <a
              href="https://www.facebook.com/kuetx"
              target="_blank"
              rel="noopener noreferrer"
              style={{...footerButtonStyle, fontSize: 'clamp(0.65rem, 1.5vw, 0.75rem)', padding: 'clamp(0.3rem, 1vw, 0.35rem) clamp(0.5rem, 1vw, 0.65rem)', background: '#1877F2', textDecoration: 'none' }}
              onMouseEnter={e => handleButtonHover(e, true)}
              onMouseLeave={e => handleButtonHover(e, false)}
            >
              <Icons.Facebook size={12} />
              Community
            </a>

            <Link
              to="/about"
              style={{...footerButtonStyle, fontSize: 'clamp(0.65rem, 1.5vw, 0.75rem)', padding: 'clamp(0.3rem, 1vw, 0.35rem) clamp(0.5rem, 1vw, 0.65rem)' }}
              onMouseEnter={e => handleButtonHover(e, true)}
              onMouseLeave={e => handleButtonHover(e, false)}
            >
              <Icons.Info size={12} />
              About
            </Link>

            <button
              style={{...footerButtonStyle, fontSize: 'clamp(0.65rem, 1.5vw, 0.75rem)', padding: 'clamp(0.3rem, 1vw, 0.35rem) clamp(0.5rem, 1vw, 0.65rem)' }}
              onMouseEnter={e => handleButtonHover(e, true)}
              onMouseLeave={e => handleButtonHover(e, false)}
              onClick={() => setActiveModal('contact')}
            >
              <Icons.Mail size={12} />
              Contact
            </button>
          </div>
        </div>

        <div style={{ maxWidth: 1040, width: '100%', margin: '0 auto', padding: '0 1rem clamp(0.5rem, 1.5vw, 0.9rem)', fontSize: 'clamp(0.65rem, 1.5vw, 0.72rem)', color: 'var(--muted)', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.5rem', boxSizing: 'border-box' }}>
          <span>© KUETx · Md Akhinoor Islam</span>
          <span>Offline · Local data</span>
        </div>
      </footer>

      {/* CONTACT Modal */}
      {activeModal === 'contact' && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '1rem',
              backdropFilter: 'blur(4px)',
              animation: 'fadeIn 0.2s ease'
            }}
            onClick={() => setActiveModal(null)}
          >
            <div
              style={{
                background: 'var(--surface)',
                borderRadius: '16px',
                border: '1px solid var(--border)',
                padding: 'clamp(1rem, 4vw, 1.5rem)',
                maxWidth: '380px',
                width: '100%',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                animation: 'slideUp 0.3s ease',
                position: 'relative'
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={() => setActiveModal(null)}
                style={{
                  position: 'absolute',
                  top: '0.75rem',
                  right: '0.75rem',
                  background: 'rgba(100, 116, 139, 0.1)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(100, 116, 139, 0.2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(100, 116, 139, 0.1)'}
              >
                <Icons.X size={16} />
              </button>

              {/* Profile Photo */}
              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <img 
                  src="/pp1.jpg" 
                  alt={developerInfo.name}
                  style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '12px',
                    objectFit: 'cover',
                    border: '2px solid var(--accent)',
                    margin: '0 auto'
                  }}
                />
              </div>

              {/* Header */}
              <div style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.2rem', color: 'var(--text)', margin: 0 }}>
                  {developerInfo.name}
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 700, margin: 0, marginBottom: '0.3rem' }}>
                  {developerInfo.title}
                </p>
                <p style={{ fontSize: '0.75rem', color: 'var(--muted)', margin: 0, lineHeight: 1.4 }}>
                  {developerInfo.department} • {developerInfo.institution}
                </p>
              </div>

              {/* Quick Links - Email & WhatsApp */}
              <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '1rem' }}>
                <a
                  href={`mailto:${developerInfo.email}`}
                  style={{
                    padding: '0.6rem 0.8rem',
                    borderRadius: '10px',
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    color: '#DC2626',
                    textDecoration: 'none',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    transition: 'all 0.2s ease',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.18)'; e.currentTarget.style.transform = 'translateX(2px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)'; e.currentTarget.style.transform = 'translateX(0)'; }}
                  title={developerInfo.email}
                >
                  <Icons.Mail size={14} style={{ flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Email</span>
                </a>

                <a
                  href={`https://wa.me/${developerInfo.whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '0.6rem 0.8rem',
                    borderRadius: '10px',
                    background: 'rgba(34, 197, 94, 0.12)',
                    border: '1px solid rgba(34, 197, 94, 0.25)',
                    color: '#16A34A',
                    textDecoration: 'none',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(34, 197, 94, 0.18)'; e.currentTarget.style.transform = 'translateX(2px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(34, 197, 94, 0.12)'; e.currentTarget.style.transform = 'translateX(0)'; }}
                >
                  <Icons.MessageCircle size={14} style={{ flexShrink: 0 }} />
                  WhatsApp
                </a>
              </div>

              {/* Portfolio & Social Links - 2x2 Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                <a
                  href={developerInfo.portfolio}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '0.6rem 0.8rem',
                    borderRadius: '10px',
                    border: '1px solid rgba(14, 165, 233, 0.25)',
                    background: 'rgba(14, 165, 233, 0.1)',
                    color: '#0284C7',
                    textDecoration: 'none',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.3rem',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(14, 165, 233, 0.18)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(14, 165, 233, 0.1)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  <Icons.Briefcase size={13} />
                  Portfolio
                </a>

                {developerInfo.social.map((link) => {
                  const IconComponent = Icons[link.icon];
                  return (
                    <a
                      key={link.label}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '0.6rem 0.8rem',
                        borderRadius: '10px',
                        border: `1px solid rgba(${hexToRgb(link.color)}, 0.25)`,
                        background: `rgba(${hexToRgb(link.color)}, 0.1)`,
                        color: link.color,
                        textDecoration: 'none',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.3rem',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = `rgba(${hexToRgb(link.color)}, 0.18)`; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = `rgba(${hexToRgb(link.color)}, 0.1)`; e.currentTarget.style.transform = 'translateY(0)'; }}
                    >
                      {IconComponent && <IconComponent size={13} />}
                      {link.label}
                    </a>
                  );
                })}
              </div>
            </div>
          </div>

          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes slideUp {
              from { opacity: 0; transform: translateY(20px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </>
      )}
    </>
  );
}
