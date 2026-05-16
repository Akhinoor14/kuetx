import { Wordmark } from '../components/Logo';
import * as Icons from 'lucide-react';

export default function About() {
  return (
    <div style={{ padding: '1.5rem 1rem', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Hero Section */}
      <div style={{
        textAlign: 'center',
        marginBottom: '3rem',
        paddingBottom: '2rem',
        borderBottom: '1px solid var(--border)'
      }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
          <div>
            <Wordmark height={56} />
          </div>
          <h1 style={{ fontSize: '3rem', fontWeight: 900, margin: '1.1rem 0 0.5rem', color: 'var(--text)', lineHeight: 1.05, maxWidth: '820px' }}>
            Student Life, Simplified.
          </h1>
          <p style={{ maxWidth: '720px', textAlign: 'center', fontSize: '1.05rem', color: 'var(--muted)', lineHeight: 1.7, margin: 0, fontWeight: 500 }}>
            All‑in‑one Student Life OS for KUET — academics, finance, wellbeing, events, and campus life.
          </p>

          <div style={{ marginTop: '1.2rem', display: 'flex', gap: '1rem', color: 'var(--muted)', fontSize: '0.95rem', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.65rem 1rem', borderRadius: '14px', background: 'rgba(22,163,74,0.08)' }}>
              <Icons.Users size={16} style={{ color: 'var(--accent)' }} />
              <span>Trusted at KUET</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.65rem 1rem', borderRadius: '14px', background: 'rgba(14,165,233,0.08)' }}>
              <Icons.Building2 size={16} style={{ color: 'var(--accent)' }} />
              <span>Dept‑integrated</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.65rem 1rem', borderRadius: '14px', background: 'rgba(15,23,42,0.06)' }}>
              <Icons.ShieldCheck size={16} style={{ color: 'var(--accent)' }} />
              <span>Privacy‑first</span>
            </div>
          </div>
        </div>
      </div>

      {/* Overview Section */}
      <div style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text)' }}>
          What is KUETX?
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          {[
            { icon: 'Zap', title: 'Fast & Responsive', desc: 'Lightning-quick interface optimized for all devices' },
            { icon: 'Lock', title: '100% Offline', desc: 'All your data stays local. No server, no tracking.' },
            { icon: 'Database', title: 'Powerful Storage', desc: 'Browser localStorage for persistent data management' },
            { icon: 'Palette', title: 'Beautiful Design', desc: 'Dark/light themes with stunning UI components' },
          ].map((item, i) => {
            const Icon = Icons[item.icon] || Icons.Zap;
            return (
              <div key={i} style={{
                padding: '1.5rem',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                background: 'var(--card)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
              }}>
                <div style={{ marginBottom: '0.75rem' }}>
                  <Icon size={32} style={{ color: 'var(--accent)' }} />
                </div>
                <h3 style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '1rem' }}>{item.title}</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--muted)', lineHeight: 1.5 }}>{item.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Features Section */}
      <div style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text)' }}>
          Key Features
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '1rem'
        }}>
          {[
            {
              category: 'Academics',
              items: ['Course Management', 'Attendance Tracking', 'Marks & Results', 'Class Schedule', 'Syllabus Browser', 'Teacher Directory']
            },
            {
              category: 'Daily Life',
              items: ['Class Diary', 'Assignment Tracker', 'Self-Study Logs', 'Time Tracking', 'Namaz Reminder', 'Self Evaluation']
            },
            {
              category: 'Finance & Activities',
              items: ['Money Management', 'Tuition Tracker', 'Food & Health', 'Club Memberships', 'Project Portfolio', 'Event Calendar']
            },
            {
              category: 'Tools & Analytics',
              items: ['Smart Score', 'Alert System', 'Report Generation', 'Notes Manager', 'Profile Settings', 'Data Export']
            }
          ].map((section, i) => (
            <div key={i} style={{
              padding: '1.5rem',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              background: 'var(--card)'
            }}>
              <h3 style={{ fontWeight: 700, marginBottom: '1rem', color: 'var(--accent)', fontSize: '1.1rem' }}>
                {section.category}
              </h3>
              <ul style={{ listStyle: 'none', display: 'grid', gap: '0.6rem' }}>
                {section.items.map((item, j) => (
                  <li key={j} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem', color: 'var(--muted)' }}>
                    <Icons.CheckCircle size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Developer Section */}
      <div style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text)' }}>
          About the Developer
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.5rem'
        }}>
          {/* Main Developer Card */}
          <div style={{
            padding: '2rem',
            border: '1.5px solid var(--accent)',
            borderRadius: '12px',
            background: 'var(--card)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
              <img src="/pp1.jpg" alt="Md Akhinoor Islam" style={{ width: '100px', height: '100px', borderRadius: '24px', objectFit: 'cover', border: '3px solid var(--accent)' }} />
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                  Md Akhinoor Islam
                </h3>
                <p style={{ fontSize: '0.95rem', color: 'var(--accent)', fontWeight: 600, margin: 0 }}>
                  Lead Developer & Founder
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.95rem', color: 'var(--muted)' }}>
                <strong>Status:</strong> Undergraduate Student
              </div>
              <div style={{ fontSize: '0.95rem', color: 'var(--muted)' }}>
                <strong>Institution:</strong> Khulna University of Engineering & Technology (KUET)
              </div>
              <div style={{ fontSize: '0.95rem', color: 'var(--muted)' }}>
                <strong>Department:</strong> Energy Science & Engineering (ESE)
              </div>
              <div style={{ fontSize: '0.95rem', color: 'var(--muted)' }}>
                <strong>Studio:</strong> Owner of A3KM Studio
              </div>
            </div>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                <a href="mailto:mdakhinoorislam.official.2005@gmail.com" title="Email"
                  style={{ padding: '0.8rem 1rem', borderRadius: '16px', background: 'rgba(255,243,244,.95)', border: '1px solid rgba(239,68,68,.2)', color: '#b91c1c', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 700, minWidth: '120px', textAlign: 'center' }}>
                  Email
                </a>
                <a href="https://wa.me/8801724812042" target="_blank" rel="noopener noreferrer" title="WhatsApp"
                  style={{ padding: '0.8rem 1rem', borderRadius: '16px', background: 'rgba(34,197,94,.14)', border: '1px solid rgba(34,197,94,.25)', color: 'var(--text)', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 700, minWidth: '120px', textAlign: 'center' }}>
                  WhatsApp
                </a>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem' }}>
                <a href="https://a3kmstudio.vercel.app/Portfolio_Clients/Mr_Akhinoor_Portfolio" target="_blank" rel="noopener noreferrer" style={{ padding: '0.8rem 1rem', borderRadius: '16px', background: 'rgba(14,165,233,.12)', border: '1px solid rgba(14,165,233,.2)', color: 'var(--text)', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 700, textAlign: 'center', minHeight: '56px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  Portfolio
                </a>
                <a href="https://github.com/Akhinoor14" target="_blank" rel="noopener noreferrer" style={{ padding: '0.8rem 1rem', borderRadius: '16px', background: 'rgba(51,65,85,.12)', border: '1px solid rgba(51,65,85,.18)', color: 'var(--text)', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 700, textAlign: 'center', minHeight: '56px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  GitHub
                </a>
                <a href="https://www.youtube.com/@noor_academy_study" target="_blank" rel="noopener noreferrer" style={{ padding: '0.8rem 1rem', borderRadius: '16px', background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.2)', color: 'var(--text)', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 700, textAlign: 'center', minHeight: '56px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  YouTube
                </a>
                <a href="https://www.facebook.com/mdakhinoorislam" target="_blank" rel="noopener noreferrer" style={{ padding: '0.8rem 1rem', borderRadius: '16px', background: 'rgba(59,89,152,.12)', border: '1px solid rgba(59,89,152,.2)', color: 'var(--text)', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 700, textAlign: 'center', minHeight: '56px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  Facebook
                </a>
              </div>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.95rem' }}>
                  Other Projects
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem' }}>
                  <a href="https://textriva.vercel.app" target="_blank" rel="noopener noreferrer" style={{ padding: '0.85rem 1rem', borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 700, textAlign: 'center', minHeight: '60px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 24px rgba(15,23,42,0.04)' }}>
                    TextRiva
                  </a>
                  <a href="https://foylxnote.vercel.app/" target="_blank" rel="noopener noreferrer" style={{ padding: '0.85rem 1rem', borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 700, textAlign: 'center', minHeight: '60px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 24px rgba(15,23,42,0.04)' }}>
                    FoylxNote
                  </a>
                  <a href="https://bloodsync-dream.vercel.app/" target="_blank" rel="noopener noreferrer" style={{ padding: '0.85rem 1rem', borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 700, textAlign: 'center', minHeight: '60px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 24px rgba(15,23,42,0.04)' }}>
                    BloodSync
                  </a>
                  <a href="https://fx991ex-calculator.vercel.app/" target="_blank" rel="noopener noreferrer" style={{ padding: '0.85rem 1rem', borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 700, textAlign: 'center', minHeight: '60px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 24px rgba(15,23,42,0.04)' }}>
                    FX991EX Calculator
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Vision & Mission */}
          <div style={{
            padding: '2rem',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            background: 'var(--card)'
          }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text)' }}>
              Vision & Mission
            </h3>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent)', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                  Vision
                </div>
                <p style={{ fontSize: '0.95rem', color: 'var(--muted)', lineHeight: 1.6 }}>
                  To empower KUET students with an all-in-one digital platform that simplifies academic and personal life management.
                </p>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent)', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                  Mission
                </div>
                <p style={{ fontSize: '0.95rem', color: 'var(--muted)', lineHeight: 1.6 }}>
                  Provide a free, offline-first, privacy-respecting application that enhances productivity and wellbeing for every KUET student.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tech Stack */}
      <div style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text)' }}>
          Built With
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '1rem'
        }}>
          {[
            { name: 'React', color: '#61dafb' },
            { name: 'Vite', color: '#646cff' },
            { name: 'JavaScript', color: '#f7df1e' },
            { name: 'Tailwind CSS', color: '#06b6d4' },
            { name: 'localStorage API', color: '#000' },
            { name: 'Lucide Icons', color: 'var(--accent)' },
          ].map((tech, i) => (
            <div key={i} style={{
              padding: '1rem',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              background: 'var(--surface)',
              textAlign: 'center',
              fontSize: '0.9rem',
              fontWeight: 600,
              color: 'var(--muted)'
            }}>
              {tech.name}
            </div>
          ))}
        </div>
      </div>

        {/* History Placeholder (to be filled later) */}
        <div style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text)' }}>Project History</h2>
          <p style={{ fontSize: '0.95rem', color: 'var(--muted)', lineHeight: 1.6 }}>
            Developer's personal story and reasons behind building KUETx will be added here when provided.
          </p>
        </div>

      {/* License & Credits */}
      <div style={{
        padding: '2rem',
        border: '1px solid var(--border)',
        borderRadius: '14px',
        background: 'var(--card)',
        textAlign: 'center'
      }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '1rem', color: 'var(--text)' }}>
          License & Acknowledgments
        </h3>
        <p style={{ maxWidth: '680px', margin: '0 auto 1rem', fontSize: '0.97rem', color: 'var(--muted)', lineHeight: 1.75 }}>
          KUETX is built with love for KUET students. It follows KUET guidelines and student data best practices so the experience stays safe, private, and supportive.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', alignItems: 'center', justifyContent: 'center' }}>
          <a href="https://a3kmstudio.vercel.app" target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 700, background: 'rgba(22,163,74,0.08)', padding: '0.7rem 1rem', borderRadius: '12px', border: '1px solid rgba(22,163,74,0.18)' }}>
            Built by A3KM Studio
          </a>
          <span style={{ fontSize: '0.95rem', color: 'var(--muted)' }}>© 2026 All Rights Reserved</span>
        </div>
      </div>
    </div>
  </div>
  );
}
