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
          background: 'linear-gradient(135deg, rgba(22, 163, 74, 0.05) 0%, rgba(59, 130, 246, 0.05) 100%)',
          border: '2px solid var(--border)',
          borderRadius: 16,
          padding: 'clamp(32px, 8vw, 48px)',
          textAlign: 'center',
          marginBottom: 24,
        }}>
          <div style={{ fontSize: 56, marginBottom: 16, animation: 'float 3s ease-in-out infinite' }}>👤</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 8px 0', letterSpacing: '-0.01em' }}>No Profile Set Up Yet</h2>
          <p style={{ fontSize: 15, color: 'var(--muted)', margin: '0 0 24px 0', fontWeight: 500, maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>Create your profile to unlock all features in KUETx</p>
          <button
            onClick={() => setIsModalOpen(true)}
            style={{
              padding: '12px 28px',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)',
            }}
            onMouseEnter={e => {
              e.target.style.background = 'var(--accent2)';
              e.target.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={e => {
              e.target.style.background = 'var(--accent)';
              e.target.style.transform = 'translateY(0)';
            }}
          >
            + Create Profile
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {/* Profile Header Card */}
          <div style={{
            background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)',
            borderRadius: 16,
            padding: 'clamp(20px, 5vw, 32px)',
            color: 'white',
            boxShadow: '0 8px 32px rgba(22, 163, 74, 0.3)',
            display: 'flex',
            gap: 'clamp(16px, 5vw, 28px)',
            alignItems: 'center',
            flexWrap: 'wrap',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Decorative Elements */}
            <div style={{
              position: 'absolute',
              top: -40,
              right: -40,
              width: 200,
              height: 200,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.1)',
              pointerEvents: 'none',
            }}></div>
            
            {/* Profile Picture */}
            <div style={{
              width: 'clamp(90px, 22vw, 110px)',
              height: 'clamp(90px, 22vw, 110px)',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.15)',
              border: '3px solid rgba(255, 255, 255, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              backdropFilter: 'blur(10px)',
              position: 'relative',
              zIndex: 1,
            }}>
              <Logo size={70} />
            </div>

            {/* Profile Info */}
            <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: 'clamp(28px, 7vw, 42px)', fontWeight: 900, marginBottom: 8, letterSpacing: '-0.03em', lineHeight: 1, textShadow: '0 2px 8px rgba(0, 0, 0, 0.1)' }}>{profile.name}</div>
              <div style={{ fontSize: 'clamp(13px, 3vw, 16px)', opacity: 0.95, fontWeight: 600, letterSpacing: '0.5px' }}>ID: {profile.studentId}</div>
            </div>

            {profile.isCR && (
              <div style={{
                background: 'rgba(255, 255, 255, 0.2)',
                padding: '10px 16px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                backdropFilter: 'blur(10px)',
                border: '1.5px solid rgba(255, 255, 255, 0.4)',
                whiteSpace: 'nowrap',
                position: 'relative',
                zIndex: 1,
                letterSpacing: '0.3px',
              }}>
                🎓 Class Representative
              </div>
            )}
          </div>

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
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 32, paddingTop: 28, borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => setIsModalOpen(true)}
            style={{
              padding: '14px 36px',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 6px 20px rgba(22, 163, 74, 0.3)',
              letterSpacing: '0.3px',
            }}
            onMouseEnter={e => {
              e.target.style.background = 'var(--accent2)';
              e.target.style.boxShadow = '0 8px 28px rgba(22, 163, 74, 0.4)';
              e.target.style.transform = 'translateY(-3px)';
            }}
            onMouseLeave={e => {
              e.target.style.background = 'var(--accent)';
              e.target.style.boxShadow = '0 6px 20px rgba(22, 163, 74, 0.3)';
              e.target.style.transform = 'translateY(0)';
            }}
          >
            ✎ Edit Profile
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
