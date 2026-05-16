import { useState } from 'react';
import { store, getProfile, DEFAULT_PROFILE, DEPARTMENTS } from '../store/store';
import ProfileSetupModal from '../components/ProfileSetupModal';
import { Logo } from '../components/Logo';

const InfoCard = ({ icon, title, items }) => (
  <div style={{
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  }}>
    <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', margin: 0, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 18 }}>{icon}</span> {title}
    </h3>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((item, idx) => (
        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>{item.label}</span>
          <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, textAlign: 'right' }}>{item.value || '—'}</span>
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
    store.set('profile', formData);
    setProfile(formData);
    setIsModalOpen(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const hasProfile = profile && profile.name && profile.studentId;

  return (
    <div className="page-enter page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 'clamp(20px, 5vw, 28px)', fontWeight: 700, margin: '0 0 4px 0' }}>Profile</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>Manage your student information</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          style={{
            padding: '10px 18px',
            background: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'opacity 0.2s',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => e.target.style.opacity = '0.9'}
          onMouseLeave={e => e.target.style.opacity = '1'}
        >
          {hasProfile ? '✎ Edit Profile' : '+ Setup Profile'}
        </button>
      </div>

      {saved && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 8,
          background: '#dcfce7',
          color: '#166534',
          fontSize: 13,
          marginBottom: 16,
          border: '1px solid #bbf7d0',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span>✓</span> Profile updated successfully!
        </div>
      )}

      {!hasProfile ? (
        <div style={{
          background: 'var(--surface)',
          border: '2px dashed var(--border)',
          borderRadius: 12,
          padding: 40,
          textAlign: 'center',
          marginBottom: 24,
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>👤</div>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px 0' }}>No Profile Set Up Yet</h2>
          <p style={{ fontSize: 14, color: 'var(--muted)', margin: '0 0 16px 0' }}>Create your profile to get started with KUETx</p>
          <button
            onClick={() => setIsModalOpen(true)}
            style={{
              padding: '10px 20px',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + Create Profile
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Profile Header Card */}
          <div style={{
            background: 'linear-gradient(135deg, var(--accent) 0%, rgba(22, 163, 74, 0.8) 100%)',
            borderRadius: 12,
            padding: 'clamp(16px, 5vw, 24px)',
            color: 'white',
            boxShadow: '0 4px 20px rgba(22, 163, 74, 0.25)',
            display: 'flex',
            gap: 'clamp(12px, 4vw, 20px)',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}>
            {/* Profile Picture */}
            <div style={{
              width: 'clamp(80px, 20vw, 100px)',
              height: 'clamp(80px, 20vw, 100px)',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.15)',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              backdropFilter: 'blur(10px)',
            }}>
              <Logo size={60} />
            </div>

            {/* Profile Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'clamp(28px, 6vw, 38px)', fontWeight: 800, marginBottom: 8, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{profile.name}</div>
              <div style={{ fontSize: 'clamp(13px, 3vw, 15px)', opacity: 0.9, fontWeight: 500 }}>ID: {profile.studentId}</div>
            </div>

            {profile.isCR && (
              <div style={{
                background: 'rgba(255, 255, 255, 0.2)',
                padding: '8px 14px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                whiteSpace: 'nowrap',
              }}>
                🎓 Class Representative
              </div>
            )}
          </div>

          {/* Information Cards Grid - Responsive */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
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
                { label: 'Batch', value: profile.batch },
                { label: 'Current Term', value: profile.currentTerm },
                { label: 'Credits Required', value: profile.totalCreditsRequired },
              ]}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            <InfoCard
              icon="📅"
              title="Timeline"
              items={[
                { label: 'Year Started', value: profile.yearStarted },
                { label: 'Term Start Date', value: profile.termStartDate ? new Date(profile.termStartDate).toLocaleDateString('en-GB') : '—' },
              ]}
            />

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

      <ProfileSetupModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveProfile}
        initialProfile={profile}
      />
    </div>
  );
}
