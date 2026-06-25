import { useState } from 'react';
import { setAppMode, markModeChosen } from '../lib/modeFilter';
import * as Icons from 'lucide-react';

export default function ModeSelectModal({ onDone }) {
  const [selected, setSelected] = useState(null);
  const [choosing, setChoosing] = useState(false);

  const confirm = () => {
    if (!selected) return;
    setChoosing(true);
    setAppMode(selected);
    markModeChosen();
    setTimeout(() => { onDone?.(); }, 200);
  };

  const modes = [
    {
      id: 'full',
      icon: 'LayoutDashboard',
      title: 'Full KUETx',
      subtitle: 'সব feature',
      desc: 'Academics, Finance, Activities, Wellbeing — everything included.',
      color: '#0f9b77',
      bg: 'rgba(15,155,119,0.10)',
      tags: ['All pages', 'Finance', 'Activities', 'Wellbeing'],
    },
    {
      id: 'jr',
      icon: 'GraduationCap',
      title: 'JR KUETx',
      subtitle: 'Academic focus',
      desc: 'Campus, class, and study pages only. Clean and distraction-free.',
      color: '#3b82f6',
      bg: 'rgba(59,130,246,0.10)',
      tags: ['Courses', 'Attendance', 'Question Bank', 'Results'],
    },
  ];

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 5000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }} />
      <div style={{ position: 'fixed', inset: 0, zIndex: 5001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{
          width: '100%', maxWidth: 460,
          background: 'var(--card)', borderRadius: 20,
          border: '1px solid var(--border)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.28)',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 65%, #1e40af) 100%)',
            padding: '26px 24px 22px',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.65)', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 6 }}>
              Welcome to KUETx
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', fontFamily: 'Sora, sans-serif', marginBottom: 4 }}>
              Choose your mode
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)' }}>
              You can change this anytime in Settings.
            </div>
          </div>

          {/* Mode cards */}
          <div style={{ padding: '18px 18px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {modes.map(m => {
              const Icon = Icons[m.icon] || Icons.Circle;
              const isSelected = selected === m.id;
              return (
                <button key={m.id} onClick={() => setSelected(m.id)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 14,
                    padding: '14px 16px',
                    borderRadius: 14,
                    border: `2px solid ${isSelected ? m.color : 'var(--border)'}`,
                    background: isSelected ? m.bg : 'var(--surface)',
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'border-color 0.15s, background 0.15s',
                    width: '100%',
                  }}
                >
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: m.bg, border: `1px solid ${m.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={18} color={m.color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', fontFamily: 'Sora, sans-serif' }}>{m.title}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: m.color, background: m.bg, border: `1px solid ${m.color}30`, borderRadius: 6, padding: '1px 7px' }}>{m.subtitle}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 8 }}>{m.desc}</div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {m.tags.map(t => (
                        <span key={t} style={{ fontSize: 10, color: isSelected ? m.color : 'var(--muted)', background: isSelected ? m.bg : 'var(--inputBg)', borderRadius: 5, padding: '2px 7px', fontWeight: 600 }}>{t}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${isSelected ? m.color : 'var(--border)'}`, background: isSelected ? m.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                    {isSelected && <Icons.Check size={11} color="#fff" strokeWidth={3} />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div style={{ padding: '16px 18px 20px' }}>
            <button
              onClick={confirm}
              disabled={!selected || choosing}
              style={{
                width: '100%', padding: '12px',
                borderRadius: 12, border: 'none',
                background: selected ? 'var(--accent)' : 'var(--inputBg)',
                color: selected ? 'var(--accentFg, #fff)' : 'var(--muted)',
                fontSize: 14, fontWeight: 700, cursor: selected ? 'pointer' : 'not-allowed',
                fontFamily: 'Sora, sans-serif',
                transition: 'background 0.15s',
              }}
            >
              {choosing ? 'Setting up…' : selected ? `Continue with ${selected === 'full' ? 'Full KUETx' : 'JR KUETx'} →` : 'Select a mode'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}