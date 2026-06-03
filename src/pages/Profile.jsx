import { useEffect, useRef, useState } from 'react';
import * as Icons from 'lucide-react';
import { store, getProfile, DEFAULT_PROFILE, DEPARTMENTS } from '../store/store';
import ProfileSetupModal from '../components/ProfileSetupModal';
import { Logo } from '../components/Logo';

const InfoCard = ({ icon, title, items }) => (
  <div style={{
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    transition: 'all 0.3s ease',
    cursor: 'default',
    position: 'relative',
    overflow: 'hidden',
  }}
  onMouseEnter={e => {
    e.currentTarget.style.borderColor = 'var(--accent)';
    e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.08)';
    e.currentTarget.style.transform = 'translateY(-2px)';
  }}
  onMouseLeave={e => {
    e.currentTarget.style.borderColor = 'var(--border)';
    e.currentTarget.style.boxShadow = 'none';
    e.currentTarget.style.transform = 'translateY(0)';
  }}>
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 3,
      background: 'linear-gradient(90deg, var(--accent) 0%, var(--accent2) 100%)',
      opacity: 0.6,
    }}></div>
    
    <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', margin: 0, textTransform: 'uppercase', letterSpacing: 0.8, display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 20 }}>{icon}</span> {title}
    </h3>
    
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {items.map((item, idx) => (
        <div key={idx} style={{ 
          display: 'grid',
          gridTemplateColumns: '120px 1fr',
          gap: 12,
          paddingBottom: idx !== items.length - 1 ? 12 : 0,
          borderBottom: idx !== items.length - 1 ? '1px solid var(--border)' : 'none',
          alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{item.label}</span>
          <span style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500, wordBreak: 'break-word' }}>{item.value || '—'}</span>
        </div>
      ))}
    </div>
  </div>
);

export default function Profile() {
  const [profile, setProfile] = useState(getProfile() || DEFAULT_PROFILE);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const autoOpenedRef = useRef(false);

  const getDeptName = (code) => {
    const dept = DEPARTMENTS.find(d => d.code === code);
    return dept ? dept.name : code;
  };

  const hasMinimumProfile = !!(profile?.name && profile?.studentId && profile?.dept && profile?.session && profile?.currentTermKey);

  useEffect(() => {
    if (!hasMinimumProfile && !autoOpenedRef.current) {
      setIsModalOpen(true);
      autoOpenedRef.current = true;
    }
  }, [hasMinimumProfile]);

  const handleSaveProfile = (formData) => {
    const nextProfile = { ...DEFAULT_PROFILE, ...formData };
    store.set('profile', nextProfile);
    setProfile(nextProfile);
    setIsModalOpen(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const hasProfile = hasMinimumProfile;

  return (
    <div className="page-enter page-container">
      {/* Top-right action: setup button or compact simulate-CR toggle */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        {!hasProfile ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setIsModalOpen(true)}
              style={{
                padding: '10px 20px',
                background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 16px rgba(22, 163, 74, 0.25)',
                whiteSpace: 'nowrap',
                letterSpacing: '0.4px',
              }}
              onMouseEnter={e => {
                e.target.style.boxShadow = '0 8px 24px rgba(22, 163, 74, 0.4)';
                e.target.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                e.target.style.boxShadow = '0 4px 16px rgba(22, 163, 74, 0.25)';
                e.target.style.transform = 'translateY(0)';
              }}
            >
              + Setup Profile
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => {
                const next = { ...profile, isCR: !profile.isCR };
                store.set('profile', next);
                setProfile(next);
                setSaved(true);
                setTimeout(() => setSaved(false), 2200);
              }}
              title="Toggle Class Rep simulation"
              className={`profile-cr-pill ${profile.isCR ? 'active' : ''}`}
            >
              <Icons.Users size={16} />
              <span style={{ whiteSpace: 'nowrap' }}>{profile.isCR ? 'CR ON' : 'Simulate CR'}</span>
            </button>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Test CR UI</div>
          </div>
        )}
      </div>

      {saved && (
        <div style={{
          padding: '14px 18px',
          borderRadius: 10,
          background: '#dcfce7',
          color: '#166534',
          fontSize: 14,
          marginBottom: 20,
          border: '1px solid #bbf7d0',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontWeight: 600,
          animation: 'slideIn 0.3s ease',
        }}>
          <span style={{ fontSize: 18 }}>✓</span> Profile updated successfully!
        </div>
      )}

      

      {profile && profile.isCR && (
        <div style={{
          padding: '16px 20px',
          borderRadius: 12,
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
          border: '2px solid rgba(59, 130, 246, 0.4)',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          fontWeight: 600,
          color: 'var(--text)',
        }}>
          <span style={{ fontSize: 24 }}>👑</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Class Representative</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>You have access to Class Management tools. Check the sidebar for new options.</div>
          </div>
        </div>
      )}

      {!hasProfile ? (
        <div style={{
          background: 'linear-gradient(135deg, #16a34a 0%, #0ea5e9 50%, #a3e635 100%)',
          borderRadius: 20,
          padding: 'clamp(40px, 12vw, 140px) clamp(20px, 5vw, 56px)',
          textAlign: 'center',
          marginBottom: 'clamp(20px, 4vw, 40px)',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(22, 163, 74, 0.28), inset 0 1px 0 rgba(255,255,255,0.3)',
          border: '1px solid rgba(255, 255, 255, 0.25)',
          backdropFilter: 'blur(0px)',
        }}>
          {/* Premium decorative elements */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'none',
            overflow: 'hidden',
            borderRadius: 20,
          }}>
            {/* Top-right gradient orb */}
            <div style={{
              position: 'absolute',
              top: -120,
              right: -80,
              width: 320,
              height: 320,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255, 255, 255, 0.25) 0%, transparent 70%)',
              pointerEvents: 'none',
              animation: 'orbFloat 8s ease-in-out infinite',
            }}></div>
            
            {/* Bottom-left gradient orb */}
            <div style={{
              position: 'absolute',
              bottom: -140,
              left: -100,
              width: 300,
              height: 300,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255, 255, 255, 0.2) 0%, transparent 70%)',
              pointerEvents: 'none',
              animation: 'orbFloat 10s ease-in-out infinite reverse',
            }}></div>

            {/* Accent line elements */}
            <div style={{
              position: 'absolute',
              top: 20,
              left: 30,
              width: 40,
              height: 3,
              background: 'rgba(255, 255, 255, 0.3)',
              borderRadius: 2,
              animation: 'slideInRight 0.8s ease-out 0.2s both',
            }}></div>
            <div style={{
              position: 'absolute',
              bottom: 30,
              right: 40,
              width: 60,
              height: 2,
              background: 'rgba(255, 255, 255, 0.25)',
              borderRadius: 2,
              animation: 'slideInLeft 0.8s ease-out 0.4s both',
            }}></div>
          </div>

          {/* Content Container */}
          <div style={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            {/* Premium Tortoise Avatar */}
            <div style={{
              width: 'clamp(140px, 28vw, 180px)',
              height: 'clamp(140px, 28vw, 180px)',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0.12) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 16px 48px rgba(0, 0, 0, 0.24), inset 0 1px 0 rgba(255,255,255,0.8), inset 0 -1px 0 rgba(0,0,0,0.1)',
              border: '4px solid rgba(255, 255, 255, 0.5)',
              position: 'relative',
              animation: 'profileFloat 6s ease-in-out infinite',
              backdropFilter: 'blur(12px)',
              marginBottom: 'clamp(28px, 6vw, 40px)',
            }}>
              <div style={{ 
                fontSize: 'clamp(100px, 26vw, 130px)', 
                animation: 'tortoiseBreathe 3s ease-in-out infinite',
                filter: 'drop-shadow(0 6px 16px rgba(0, 0, 0, 0.2))',
              }}>
                🐢
              </div>
              
              {/* Inner glow ring */}
              <div style={{
                position: 'absolute',
                inset: -10,
                borderRadius: '50%',
                background: 'conic-gradient(from 0deg, rgba(255, 255, 255, 0.3) 0deg, rgba(255, 255, 255, 0.05) 90deg, rgba(255, 255, 255, 0.3) 180deg)',
                opacity: 0.6,
                pointerEvents: 'none',
                zIndex: -1,
                filter: 'blur(10px)',
                animation: 'rotateRing 12s linear infinite',
              }}></div>
            </div>

            {/* Premium Typography */}
            <h2 style={{ 
              fontSize: 'clamp(36px, 10vw, 56px)', 
              fontWeight: 950, 
              margin: '0 0 16px 0', 
              letterSpacing: '-0.03em',
              color: 'white',
              lineHeight: 1.15,
              textShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            }}>
              Welcome to Your Profile
            </h2>

            {/* Elegant Divider */}
            <div style={{
              width: 60,
              height: 3,
              background: 'rgba(255, 255, 255, 0.5)',
              borderRadius: 2,
              margin: '12px 0 24px 0',
              animation: 'slideInCenter 0.8s ease-out 0.3s both',
            }}></div>

            {/* Premium Subtitle */}
            <p style={{ 
              fontSize: 'clamp(15px, 3.2vw, 18px)', 
              color: 'rgba(255, 255, 255, 0.92)', 
              margin: '0 0 40px 0', 
              fontWeight: 500, 
              maxWidth: '520px',
              lineHeight: 1.7,
              letterSpacing: '0.2px',
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
            }}>
              Create your comprehensive profile to unlock personalized academic experiences and connect with your community
            </p>

            {/* Premium CTA Button */}
            <button
              onClick={() => setIsModalOpen(true)}
              style={{
                padding: 'clamp(14px, 3vw, 18px) clamp(32px, 8vw, 48px)',
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.85) 100%)',
                color: '#16a34a',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                borderRadius: 14,
                fontSize: 'clamp(15px, 2.5vw, 18px)',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                boxShadow: '0 12px 36px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255,255,255,0.8)',
                letterSpacing: '0.5px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'clamp(8px, 2vw, 12px)',
                position: 'relative',
                overflow: 'hidden',
                zIndex: 1,
              }}
              onMouseEnter={e => {
                e.target.style.boxShadow = '0 16px 48px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.8)';
                e.target.style.transform = 'translateY(-6px) scale(1.08)';
                e.target.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0.92) 100%)';
              }}
              onMouseLeave={e => {
                e.target.style.boxShadow = '0 12px 36px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255,255,255,0.8)';
                e.target.style.transform = 'translateY(0) scale(1)';
                e.target.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.85) 100%)';
              }}
            >
              <span style={{ fontSize: 'clamp(16px, 3vw, 20px)', fontWeight: 900 }}>+</span>
              <span>Start Setup</span>
              <span style={{ fontSize: 'clamp(14px, 2.5vw, 16px)', marginLeft: 'clamp(4px, 1vw, 8px)', transition: 'transform 0.3s ease', display: 'inline-block' }}>→</span>
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {/* Information Cards Grid - Responsive */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginTop: 8 }}>
            <InfoCard
              icon="👤"
              title="Personal"
              items={[
                { label: 'Full Name', value: profile.name },
                { label: 'Student ID', value: profile.studentId },
              ]}
            />

            <InfoCard
              icon="📚"
              title="Academic"
              items={[
                { label: 'Department', value: getDeptName(profile.dept) },
                { label: 'Session', value: profile.session },
                { label: 'Current Term', value: profile.currentTerm },
                { label: 'Credits Required', value: profile.totalCreditsRequired },
              ]}
            />

            <InfoCard
              icon="📅"
              title="Timeline"
              items={[
                { label: 'Year Started', value: profile.yearStarted },
                { label: 'Term Start Date', value: profile.termStartDate ? new Date(profile.termStartDate).toLocaleDateString('en-GB') : '—' },
              ]}
            />
          </div>

          {/* Additional Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
            <InfoCard
              icon="🏠"
              title="Accommodation"
              items={[
                { label: 'Hall', value: profile.hallName },
                { label: 'Room Number', value: profile.roomNo },
              ]}
            />

            <InfoCard
              icon="👨‍🏫"
              title="Advisor"
              items={[
                { label: 'Name', value: profile.advisorName },
                { label: 'Contact', value: profile.advisorContact },
              ]}
            />
          </div>

          {/* Quick Tip: Import Previous Term Results */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(168, 85, 247, 0.08) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            borderRadius: 14,
            padding: 20,
            display: 'flex',
            gap: 16,
            alignItems: 'flex-start',
            marginTop: 8,
          }}>
            <div style={{ fontSize: 24, flexShrink: 0 }}>💡</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                Previous Term Results?
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                If you have completed previous terms at KUET, you can import your results and GPA history. This helps calculate your CGPA and provides better grade predictions.
              </div>
              <a 
                href="/results"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  color: 'var(--accent)',
                  textDecoration: 'none',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  marginTop: 6,
                  transition: 'all 0.2s ease',
                  letterSpacing: '0.3px',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = 'var(--accent2)';
                  e.currentTarget.style.transform = 'translateX(4px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = 'var(--accent)';
                  e.currentTarget.style.transform = 'translateX(0)';
                }}
              >
                Go to Results & GPA
                <span style={{ fontSize: 12, fontWeight: 900 }}>→</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Edit Button - Bottom (only when profile exists) */}
      {hasProfile && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 40, paddingTop: 32, borderTop: '1.5px solid var(--border)' }}>
          <button
            onClick={() => setIsModalOpen(true)}
            style={{
              padding: '16px 40px',
              background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)',
              color: 'white',
              border: 'none',
              borderRadius: 12,
              fontSize: 'clamp(14px, 2vw, 16px)',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
              boxShadow: '0 8px 28px rgba(22, 163, 74, 0.35)',
              letterSpacing: '0.4px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 12,
              position: 'relative',
              overflow: 'hidden',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.boxShadow = '0 12px 36px rgba(22, 163, 74, 0.5)';
              e.currentTarget.style.transform = 'translateY(-4px) scale(1.06)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.boxShadow = '0 8px 28px rgba(22, 163, 74, 0.35)';
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
            }}
          >
            <span style={{ fontSize: 18 }}>✎</span>
            Edit Profile
            <span style={{ fontSize: 16, marginLeft: 4, transition: 'transform 0.3s ease' }}>→</span>
          </button>
        </div>
      )}

      <ProfileSetupModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveProfile}
        initialProfile={profile}
      />
    </div>
  );
}
