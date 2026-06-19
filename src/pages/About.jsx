import { Wordmark } from '../components/Logo';
import * as Icons from 'lucide-react';

export default function About() {
  return (
    <div style={{ padding: '1.5rem 1rem', width: '100%', margin: '0 auto' }}>
      {/* Hero Section */}
      <div style={{
        marginBottom: '3rem',
        padding: 'clamp(1.25rem, 3vw, 2rem)',
        border: '1px solid var(--border)',
        borderRadius: '24px',
        background: 'radial-gradient(circle at top left, rgba(var(--accentRGB), 0.10), transparent 34%), linear-gradient(180deg, var(--surfaceGlassStrong), var(--surfaceGlass))',
        boxShadow: '0 18px 48px rgba(0, 0, 0, 0.10)'
      }}>
        <div className="hero-desktop" style={{
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
            border: '1px solid var(--border)',
            background: 'linear-gradient(180deg, var(--surfaceGlassStrong), var(--surfaceGlass))',
            boxShadow: '0 10px 28px rgba(0, 0, 0, 0.10)'
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
                <div style={{ padding: '0.9rem 0.95rem', borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--surfaceGlass)' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text)', marginBottom: '0.15rem' }}>100%</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.5 }}>Local-first data handling</div>
                </div>
                <div style={{ padding: '0.9rem 0.95rem', borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--surfaceGlass)' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text)', marginBottom: '0.15rem' }}>KUET</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.5 }}>Context-aware workflows</div>
                </div>
              </div>

              <div style={{ padding: '0.95rem 1rem', borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--surfaceGlass)' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '0.35rem' }}>Purpose</div>
                <div style={{ fontSize: '0.95rem', color: 'var(--text)', lineHeight: 1.7 }}>
                  To keep essential academic and student-life tools in one dependable place, without unnecessary complexity.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Hero - Separate mobile-optimized layout */}
      <div className="hero-mobile-container" style={{ display: 'none', marginBottom: '2.5rem' }}>
        <div style={{
          padding: '1.5rem 1.2rem',
          border: '1px solid var(--border)',
          borderRadius: '18px',
          background: 'linear-gradient(180deg, var(--surfaceGlassStrong), var(--surfaceGlass))',
          boxShadow: '0 8px 20px rgba(0, 0, 0, 0.08)',
          textAlign: 'center'
        }}>
          {/* Mobile Hero - Icon */}
          <div style={{ marginBottom: '1.2rem' }}>
            <img src="/icon-512.svg" alt="KUETX" style={{ width: '140px', height: '140px', margin: '0 auto', display: 'block' }} />
          </div>

          {/* Mobile Hero - App Name */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.9rem' }}>
            <div style={{ fontSize: '1rem', fontWeight: 900, letterSpacing: '0.08em', color: 'var(--text)' }}>KUETX</div>
          </div>

          {/* Mobile Hero - Tagline */}
          <p style={{ fontSize: '0.9rem', color: 'var(--muted)', lineHeight: 1.6, margin: '0 0 1.2rem 0' }}>All-in-one platform for KUET students</p>

          {/* Mobile Hero - Trust Badges */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', padding: '0.6rem 0.75rem', borderRadius: '12px', background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.10)' }}>
              <Icons.Users size={14} style={{ color: 'var(--accent)', marginTop: '0.1rem', flexShrink: 0 }} />
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>Built for KUET</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', padding: '0.6rem 0.75rem', borderRadius: '12px', background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.10)' }}>
              <Icons.ShieldCheck size={14} style={{ color: 'var(--accent)', marginTop: '0.1rem', flexShrink: 0 }} />
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>Privacy-first</div>
            </div>
          </div>

        </div>
      </div>

      {/* Overview Section */}
      <div id="developer" style={{ marginBottom: '3.5rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: 'clamp(1.35rem, 4vw, 1.75rem)', fontWeight: 800, marginBottom: '0.35rem', color: 'var(--text)', letterSpacing: '-0.03em' }}>
            What is KUETX?
          </h2>
          <p style={{ fontSize: '0.95rem', color: 'var(--muted)', margin: 0 }}>
            Core capabilities that define the platform
          </p>
        </div>
        <div className="about-capabilities-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 'clamp(0.9rem, 2vw, 1.2rem)',
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
                padding: 'clamp(1.25rem, 3vw, 1.5rem)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                background: 'linear-gradient(180deg, var(--surfaceGlassStrong), var(--surfaceGlass))',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
                transition: 'all 0.25s ease',
                cursor: 'default'
              }}>
                <div style={{ marginBottom: '0.9rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(var(--accentRGB), 0.10)', border: '1px solid rgba(var(--accentRGB), 0.12)' }}>
                  <Icon size={24} style={{ color: 'var(--accent)' }} />
                </div>
                <h3 style={{ fontWeight: 700, marginBottom: '0.45rem', fontSize: '1.05rem', color: 'var(--text)' }}>{item.title}</h3>
                <p style={{ fontSize: '0.92rem', color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>{item.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Features Section */}
      <div style={{ marginBottom: '3.5rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: 'clamp(1.35rem, 4vw, 1.75rem)', fontWeight: 800, marginBottom: '0.35rem', color: 'var(--text)', letterSpacing: '-0.03em' }}>
            Key Features
          </h2>
          <p style={{ fontSize: '0.95rem', color: 'var(--muted)', margin: 0 }}>
            Organized into four powerful modules
          </p>
        </div>
        <div className="about-features-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 'clamp(0.9rem, 2vw, 1.2rem)'
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
              padding: 'clamp(1.25rem, 3vw, 1.5rem)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              background: 'linear-gradient(180deg, var(--surfaceGlassStrong), var(--surfaceGlass))',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)'
            }}>
              <h3 style={{ fontWeight: 800, marginBottom: '1rem', color: 'var(--accent)', fontSize: '1.1rem', letterSpacing: '-0.02em' }}>
                {section.category}
              </h3>
              <ul style={{ listStyle: 'none', display: 'grid', gap: '0.65rem', margin: 0, padding: 0 }}>
                {section.items.map((item, j) => (
                  <li key={j} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.92rem', color: 'var(--muted)', fontWeight: 500 }}>
                    <Icons.CheckCircle size={16} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '0.05rem' }} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Developer Section */}
      <div style={{ marginBottom: '3.5rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: 'clamp(1.35rem, 4vw, 1.75rem)', fontWeight: 800, marginBottom: '0.35rem', color: 'var(--text)', letterSpacing: '-0.03em' }}>
            About the Developer
          </h2>
          <p style={{ fontSize: '0.95rem', color: 'var(--muted)', margin: 0 }}>
            Meet the mind and hands behind KUETX
          </p>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 'clamp(1rem, 2vw, 1.5rem)'
        }}>
          {/* Main Developer Card */}
          <div style={{
            padding: 'clamp(1.5rem, 3vw, 2rem)',
            border: '1.5px solid var(--accent)',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(22,163,74,0.08), rgba(16,185,129,0.04))',
            boxShadow: '0 6px 20px rgba(22, 163, 74, 0.08)'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'clamp(80px, 15vw, 100px) 1fr', gap: '1rem', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <img src="/pp1.jpg" alt="Md Akhinoor Islam" style={{ width: '100%', aspectRatio: '1', borderRadius: '16px', objectFit: 'cover', border: '3px solid var(--accent)' }} />
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.25rem', color: 'var(--text)' }}>
                  Md Akhinoor Islam
                </h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--accent)', fontWeight: 700, margin: 0, marginBottom: '0.5rem' }}>
                  Founder & Lead Builder
                </p>
                <div style={{ fontSize: '0.85rem', color: 'var(--muted)', fontWeight: 500, lineHeight: 1.5 }}>
                  <div>Writes prompts, not code. Ships anyway.</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '0.92rem', color: 'var(--muted)', lineHeight: 1.6 }}>
              <div><strong style={{ color: 'var(--text)' }}>Status:</strong> Undergraduate Student</div>
              <div><strong style={{ color: 'var(--text)' }}>Institution:</strong> KUET,Khulna</div>
              <div><strong style={{ color: 'var(--text)' }}>Department:</strong> Energy Science & Engineering</div>
              <div><strong style={{ color: 'var(--text)' }}>Studio:</strong> A3KM Studio</div>
            </div>
            
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <div className="dev-social-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem' }}>
                <a href="https://a3kmstudio.vercel.app/Portfolio_Clients/Mr_Akhinoor_Portfolio/index.html" target="_blank" rel="noopener noreferrer" className="dev-social-portfolio" style={{ padding: '0.75rem 1rem', borderRadius: '12px', background: 'rgba(14,165,233,.12)', border: '1px solid rgba(14,165,233,.18)', color: 'var(--text)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 700, textAlign: 'center' }}>
                  Portfolio
                </a>
                <a href="https://github.com/Akhinoor14" target="_blank" rel="noopener noreferrer" style={{ padding: '0.75rem 1rem', borderRadius: '12px', background: 'rgba(51,65,85,.12)', border: '1px solid rgba(51,65,85,.16)', color: 'var(--text)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 700, textAlign: 'center' }}>
                  GitHub
                </a>
                <a href="https://www.linkedin.com/in/mdakhinoorislam/" target="_blank" rel="noopener noreferrer" style={{ padding: '0.75rem 1rem', borderRadius: '12px', background: 'rgba(37,99,235,.12)', border: '1px solid rgba(37,99,235,.18)', color: 'var(--text)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 700, textAlign: 'center' }}>
                  LinkedIn
                </a>
                <a href="https://www.youtube.com/@noor_academy_study" target="_blank" rel="noopener noreferrer" style={{ padding: '0.75rem 1rem', borderRadius: '12px', background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.18)', color: 'var(--text)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 700, textAlign: 'center' }}>
                  YouTube
                </a>
                <a href="https://www.facebook.com/mdakhinoorislam" target="_blank" rel="noopener noreferrer" style={{ padding: '0.75rem 1rem', borderRadius: '12px', background: 'rgba(59,89,152,.12)', border: '1px solid rgba(59,89,152,.18)', color: 'var(--text)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 700, textAlign: 'center' }}>
                  Facebook
                </a>
                <a href="mailto:mdakhinoorislam.official.2005@gmail.com" title="Email"
                  style={{ padding: '0.75rem 1rem', borderRadius: '12px', background: 'rgba(var(--accentRGB), 0.12)', border: '1px solid rgba(var(--accentRGB), 0.20)', color: 'var(--danger)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 700, textAlign: 'center' }}>
                  Email
                </a>
                <a href="https://wa.me/8801724812042" target="_blank" rel="noopener noreferrer" title="WhatsApp"
                  style={{ padding: '0.75rem 1rem', borderRadius: '12px', background: 'rgba(34,197,94,.12)', border: '1px solid rgba(34,197,94,.20)', color: 'var(--text)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 700, textAlign: 'center' }}>
                  WhatsApp
                </a>
              </div>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.9rem' }}>Other Projects</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem' }}>
                  <a href="https://textriva.vercel.app" target="_blank" rel="noopener noreferrer" style={{ padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.5)', color: 'var(--text)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 700, textAlign: 'center' }}>
                    TextRiva
                  </a>
                  <a href="https://foylxnote.vercel.app/" target="_blank" rel="noopener noreferrer" style={{ padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.5)', color: 'var(--text)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 700, textAlign: 'center' }}>
                    FoylxNote
                  </a>
                  <a href="https://bloodsync-dream.vercel.app/" target="_blank" rel="noopener noreferrer" style={{ padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.5)', color: 'var(--text)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 700, textAlign: 'center' }}>
                    BloodSync
                  </a>
                  <a href="https://scriptova.vercel.app/" target="_blank" rel="noopener noreferrer" style={{ padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.5)', color: 'var(--text)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 700, textAlign: 'center' }}>
                    Scriptova
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Vision & Mission */}
          <div style={{
            padding: 'clamp(1.5rem, 3vw, 2rem)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            background: 'linear-gradient(180deg, var(--surfaceGlassStrong), var(--surfaceGlass))',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)'
          }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '1.25rem', color: 'var(--text)', letterSpacing: '-0.02em' }}>
              Vision & Mission
            </h3>
            <div style={{ display: 'grid', gap: '1.25rem' }}>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Vision
                </div>
                <p style={{ fontSize: '0.95rem', color: 'var(--muted)', lineHeight: 1.7, margin: 0 }}>
                  To empower KUET students with an all-in-one digital platform that simplifies academic and personal life management.
                </p>
              </div>
              <div style={{ height: '1px', background: 'rgba(var(--accentRGB), 0.10)' }} />
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Mission
                </div>
                <p style={{ fontSize: '0.95rem', color: 'var(--muted)', lineHeight: 1.7, margin: 0 }}>
                  Provide a free, offline-first, privacy-respecting application that enhances productivity and wellbeing for every KUET student.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tech Stack */}
      <div style={{ marginBottom: '3.5rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: 'clamp(1.35rem, 4vw, 1.75rem)', fontWeight: 800, marginBottom: '0.35rem', color: 'var(--text)', letterSpacing: '-0.03em' }}>
            Built With
          </h2>
          <p style={{ fontSize: '0.95rem', color: 'var(--muted)', margin: 0 }}>
            Modern web technologies and best practices
          </p>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 'clamp(0.9rem, 2vw, 1rem)'
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
              padding: 'clamp(0.95rem, 2.5vw, 1.1rem)',
              border: '1px solid var(--border)',
              borderRadius: '14px',
              background: 'linear-gradient(180deg, var(--surfaceGlassStrong), var(--surfaceGlass))',
              textAlign: 'center',
              fontSize: '0.92rem',
              fontWeight: 600,
              color: 'var(--text)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
              transition: 'all 0.2s ease'
            }}>
              {tech.name}
            </div>
          ))}
        </div>
      </div>

        {/* History Placeholder (to be filled later) */}
        <div style={{ marginBottom: '3.5rem', padding: 'clamp(1.25rem, 3vw, 1.5rem)', border: '1px solid var(--border)', borderRadius: '16px', background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(14,165,233,0.04))' }}>
          <h2 style={{ fontSize: 'clamp(1.2rem, 3vw, 1.5rem)', fontWeight: 800, marginBottom: '0.75rem', color: 'var(--text)', letterSpacing: '-0.02em', margin: 0 }}>Project History</h2>
          <p style={{ fontSize: '0.95rem', color: 'var(--muted)', lineHeight: 1.7, margin: 0 }}>
            Developer's personal story and reasons behind building KUETx will be added here when provided.
          </p>
        </div>

      {/* License & Credits */}
      <div style={{
        padding: 'clamp(1.5rem, 3vw, 2rem)',
        border: '1px solid var(--border)',
        borderRadius: '20px',
        background: 'radial-gradient(circle at top right, rgba(var(--accentRGB), 0.10), transparent 28%), linear-gradient(180deg, var(--surfaceGlassStrong), var(--surfaceGlass))',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.10)',
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
          background: 'rgba(var(--accentRGB), 0.08)',
          fontSize: '0.8rem',
          fontWeight: 700,
          color: 'var(--muted)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase'
        }}>
          License & Acknowledgments
        </div>

        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '1.2rem', color: 'var(--text)' }}>
          Responsible by design, built for KUET students
        </h3>

        <div style={{
          maxWidth: '760px',
          margin: '0 auto 1.5rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.75rem',
          textAlign: 'left'
        }}>
          <div style={{ padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surfaceGlassSoft)' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.25rem' }}>Privacy-first</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--muted)', lineHeight: 1.6 }}>Designed to keep student information handled with care and minimal exposure.</div>
          </div>
          <div style={{ padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surfaceGlassSoft)' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.25rem' }}>Student-focused</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--muted)', lineHeight: 1.6 }}>Built to make academic tracking simpler, faster, and more dependable.</div>
          </div>
          <div style={{ padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surfaceGlassSoft)' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.25rem' }}>Acknowledgment</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--muted)', lineHeight: 1.6 }}>Developed and maintained by A3KM Studio with care for the KUET community.</div>
          </div>
          <div style={{ padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surfaceGlassSoft)' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.25rem' }}>Open Technology</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--muted)', lineHeight: 1.6 }}>Built with React, IndexedDB, and modern web standards for reliability and performance.</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem' }}>
          <a href="https://a3kmstudio.vercel.app" target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 700, background: 'rgba(22,163,74,0.08)', padding: '0.7rem 1rem', borderRadius: '12px', border: '1px solid rgba(22,163,74,0.18)' }}>
            Built by A3KM Studio
          </a>
          <span style={{ fontSize: '0.95rem', color: 'var(--muted)' }}>© 2026 All Rights Reserved</span>
        </div>

        <div style={{ maxWidth: '760px', margin: '0 auto', padding: '1rem', borderRadius: '14px', background: 'linear-gradient(135deg, rgba(22,163,74,0.06), rgba(14,165,233,0.03))', border: '1px solid rgba(22,163,74,0.12)', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '0.93rem', color: 'var(--muted)', lineHeight: 1.6 }}>
            Consolidating academics, finances, and personal growth into one focused platform for KUET students.
          </p>
        </div>
      </div>
    </div>
  );
}
