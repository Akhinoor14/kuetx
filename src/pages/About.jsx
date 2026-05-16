import { Wordmark } from '../components/Logo';
import * as Icons from 'lucide-react';

export default function About() {
  return (
    <div style={{ padding: '1.5rem 1rem', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Hero Section */}
      <div style={{
        marginBottom: '3rem',
        padding: 'clamp(1.25rem, 3vw, 2rem)',
        border: '1px solid var(--border)',
        borderRadius: '24px',
        background: 'radial-gradient(circle at top left, rgba(22,163,74,0.10), transparent 34%), linear-gradient(180deg, rgba(255,255,255,0.96), rgba(247,253,250,0.92))',
        boxShadow: '0 18px 48px rgba(12, 34, 64, 0.07)'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.3fr) minmax(260px, 0.9fr)',
          gap: '1.5rem',
          alignItems: 'center'
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.9rem' }}>
              <div style={{ padding: '0.45rem 0.7rem', borderRadius: '14px', background: 'rgba(22,163,74,0.10)', border: '1px solid rgba(22,163,74,0.14)' }}>
                <Wordmark height={40} />
              </div>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                About KUETX
              </div>
            </div>

            <h1 style={{ fontSize: 'clamp(2.25rem, 5vw, 3.4rem)', fontWeight: 900, margin: '0 0 0.75rem', color: 'var(--text)', lineHeight: 1.02, maxWidth: '12ch', letterSpacing: '-0.06em' }}>
              Student life, simplified.
            </h1>

            <p style={{ maxWidth: '48rem', fontSize: '1.05rem', color: 'var(--muted)', lineHeight: 1.75, margin: 0, fontWeight: 500 }}>
              KUETX is an all-in-one student life platform for KUET, bringing academics, finance, wellbeing, events, and daily campus tasks into one focused experience.
            </p>

            <div style={{ marginTop: '1.35rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1rem', borderRadius: '14px', background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.12)', color: 'var(--text)', fontSize: '0.92rem', fontWeight: 600 }}>
                <Icons.Users size={16} style={{ color: 'var(--accent)' }} />
                Built for KUET students
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1rem', borderRadius: '14px', background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.12)', color: 'var(--text)', fontSize: '0.92rem', fontWeight: 600 }}>
                <Icons.Building2 size={16} style={{ color: 'var(--accent)' }} />
                Department-aware design
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1rem', borderRadius: '14px', background: 'rgba(15,23,42,0.06)', border: '1px solid rgba(15,23,42,0.08)', color: 'var(--text)', fontSize: '0.92rem', fontWeight: 600 }}>
                <Icons.ShieldCheck size={16} style={{ color: 'var(--accent)' }} />
                Privacy-first by default
              </div>
            </div>
          </div>

          <div style={{
            padding: '1.1rem',
            borderRadius: '20px',
            border: '1px solid rgba(var(--accentRGB), 0.14)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,250,252,0.92))',
            boxShadow: '0 10px 28px rgba(15, 23, 42, 0.06)'
          }}>
            <div style={{
              display: 'grid',
              gap: '0.8rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.95rem 1rem', borderRadius: '16px', background: 'rgba(var(--accentRGB), 0.06)', border: '1px solid rgba(var(--accentRGB), 0.10)' }}>
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '0.25rem' }}>Focus</div>
                  <div style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text)' }}>Student productivity and clarity</div>
                </div>
                <Icons.Sparkles size={20} style={{ color: 'var(--accent)' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
                <div style={{ padding: '0.9rem 0.95rem', borderRadius: '16px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.75)' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text)', marginBottom: '0.15rem' }}>100%</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.5 }}>Local-first data handling</div>
                </div>
                <div style={{ padding: '0.9rem 0.95rem', borderRadius: '16px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.75)' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text)', marginBottom: '0.15rem' }}>KUET</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.5 }}>Context-aware workflows</div>
                </div>
              </div>

              <div style={{ padding: '0.95rem 1rem', borderRadius: '16px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.75)' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '0.35rem' }}>Purpose</div>
                <div style={{ fontSize: '0.95rem', color: 'var(--text)', lineHeight: 1.7 }}>
                  To keep essential academic and student-life tools in one dependable place, without unnecessary complexity.
                </div>
              </div>
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
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.35rem 0.75rem',
          marginBottom: '0.9rem',
          borderRadius: '999px',
          border: '1px solid var(--border)',
          background: 'rgba(255,255,255,0.04)',
          fontSize: '0.8rem',
          fontWeight: 700,
          color: 'var(--muted)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase'
        }}>
          License & Acknowledgments
        </div>

        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '0.9rem', color: 'var(--text)' }}>
          Responsible by design, built for KUET students
        </h3>

        <p style={{ maxWidth: '720px', margin: '0 auto 1rem', fontSize: '0.97rem', color: 'var(--muted)', lineHeight: 1.75 }}>
          KUETX is developed to support the academic and daily needs of KUET students with a strong focus on privacy, clarity, and responsible use. The experience is designed to align with KUET guidelines and student data best practices.
        </p>

        <div style={{
          maxWidth: '760px',
          margin: '0 auto 1.25rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.75rem',
          textAlign: 'left'
        }}>
          <div style={{ padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.03)' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.25rem' }}>Privacy-first</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--muted)', lineHeight: 1.6 }}>Designed to keep student information handled with care and minimal exposure.</div>
          </div>
          <div style={{ padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.03)' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.25rem' }}>Student-focused</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--muted)', lineHeight: 1.6 }}>Built to make academic tracking simpler, faster, and more dependable.</div>
          </div>
          <div style={{ padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.03)' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.25rem' }}>Acknowledgment</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--muted)', lineHeight: 1.6 }}>Developed and maintained by A3KM Studio with care for the KUET community.</div>
          </div>
        </div>

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
