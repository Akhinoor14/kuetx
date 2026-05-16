import { useState } from 'react';
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

  const getDeptName = (code) => {
    const dept = DEPARTMENTS.find(d => d.code === code);
    return dept ? dept.name : code;
  };

  const handleSaveProfile = (formData) => {
    const nextProfile = { ...DEFAULT_PROFILE, ...formData };
    store.set('profile', nextProfile);
    setProfile(nextProfile);
    setIsModalOpen(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const hasProfile = profile && profile.name && profile.studentId;

  return (
    <div className="page-enter page-container">
      {/* Setup Button - Top (only when no profile) */}
      {!hasProfile && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
          <button
            onClick={() => setIsModalOpen(true)}
            style={{
              padding: '12px 24px',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)',
              whiteSpace: 'nowrap',
              letterSpacing: '0.3px',
            }}
            onMouseEnter={e => {
              e.target.style.background = 'var(--accent2)';
              e.target.style.boxShadow = '0 6px 20px rgba(22, 163, 74, 0.35)';
              e.target.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={e => {
              e.target.style.background = 'var(--accent)';
              e.target.style.boxShadow = '0 4px 12px rgba(22, 163, 74, 0.25)';
              e.target.style.transform = 'translateY(0)';
            }}
          >
            + Setup Profile
          </button>
        </div>
      )}

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

      {!hasProfile ? (
        <div style={{
          background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent2) 50%, rgba(163, 230, 53, 0.7) 100%)',
          borderRadius: 16,
          padding: 'clamp(60px, 15vw, 100px) clamp(20px, 5vw, 40px)',
          textAlign: 'center',
          marginBottom: 32,
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 16px 48px rgba(22, 163, 74, 0.3)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
        }}>
          {/* Animated gradient orbs background */}
          <div style={{
            position: 'absolute',
            top: -100,
            left: -100,
            width: 280,
            height: 280,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255, 255, 255, 0.15) 0%, transparent 70%)',
            pointerEvents: 'none',
            animation: 'orbFloat 8s ease-in-out infinite',
          }}></div>
          <div style={{
            position: 'absolute',
            bottom: -120,
            right: -80,
            width: 260,
            height: 260,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255, 255, 255, 0.12) 0%, transparent 70%)',
            pointerEvents: 'none',
            animation: 'orbFloat 10s ease-in-out infinite reverse',
          }}></div>
          
          {/* Tortoise Icon - Centered, Large, Animated */}
          <div style={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <div style={{
              width: 160,
              height: 160,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0.1) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255,255,255,0.6)',
              border: '3px solid rgba(255, 255, 255, 0.4)',
              position: 'relative',
              animation: 'profileFloat 6s ease-in-out infinite',
              backdropFilter: 'blur(10px)',
            }}>
              <div style={{ 
                fontSize: 90, 
                animation: 'tortoiseBreathe 3s ease-in-out infinite',
                filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.15))',
              }}>
                🐢
              </div>
              {/* Subtle inner glow */}
              <div style={{
                position: 'absolute',
                inset: -8,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.05) 100%)',
                opacity: 0.5,
                pointerEvents: 'none',
                zIndex: -1,
                filter: 'blur(12px)',
              }}></div>
            </div>
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
