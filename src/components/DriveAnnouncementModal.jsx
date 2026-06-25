import React, { useEffect, useState } from 'react';
import { store } from '../store/store';
import { BookOpen, ArrowRight, X, Sparkles } from 'lucide-react';

const UPDATES = [
  {
    id: 1,
    icon: '🔥',
    tag: 'New',
    tagColor: '#16a34a',
    title: 'Firebase Sync',
    body: 'Real-time cloud sync across all your devices. Sign in once — data follows you everywhere.',
  },
  {
    id: 2,
    icon: '🔄',
    tag: 'New',
    tagColor: '#16a34a',
    title: 'Auto Update',
    body: 'App updates automatically in the background. You get a toast when a new version is ready.',
  },
  {
    id: 3,
    icon: '🎓',
    tag: 'Rebuilt',
    tagColor: '#2563eb',
    title: 'Attendance',
    body: 'KUET marking slab logic, hero cards, daily log with merged teacher cards.',
  },
  {
    id: 4,
    icon: '📊',
    tag: 'Fixed',
    tagColor: '#d97706',
    title: 'Results & GPA',
    body: 'Grade Points now shows real achieved vs max (credit-weighted). CGPA card fixed.',
  },
  {
    id: 5,
    icon: '🧭',
    tag: 'New',
    tagColor: '#16a34a',
    title: 'JR Mode',
    body: 'Academic-only view — hides Finance, Activities & Wellbeing for a cleaner experience.',
  },
  {
    id: 6,
    icon: '🌙',
    tag: 'Fixed',
    tagColor: '#7c3aed',
    title: 'Dark Mode',
    body: 'Overrides across Attendance, Question Bank, Time Tracker, Self Eval, CT Planner.',
  },
];

const MODAL_KEY = 'announcementV2LastShown';
const COUNT_KEY = 'announcementV2ShowCount';

export default function AnnouncementModal({ open: openProp, onClose: onCloseProp } = {}) {
  const [open, setOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    if (openProp !== undefined) { setOpen(openProp); return; }
    try {
      const lastShown = store.get(MODAL_KEY);
      const showCount = store.get(COUNT_KEY) || 0;
      const now = Date.now();
      const interval = showCount >= 3 ? 604800000 : 259200000;
      if (!lastShown || now - new Date(lastShown).getTime() >= interval) setOpen(true);
    } catch {}
  }, [openProp]);

  const dismiss = () => {
    try {
      const showCount = store.get(COUNT_KEY) || 0;
      store.set(COUNT_KEY, showCount + 1);
      store.set(MODAL_KEY, new Date().toISOString());
    } catch {}
    setOpen(false);
    onCloseProp?.();
  };

  if (!open) return null;

  // Guide PDF inline panel
  if (guideOpen) {
    return (
      <>
        <div style={{ position: 'fixed', inset: 0, zIndex: 4999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }} onClick={() => setGuideOpen(false)} />
        <div style={{ position: 'fixed', inset: 0, zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, pointerEvents: 'none' }}>
          <div onClick={e => e.stopPropagation()} style={{
            pointerEvents: 'auto', width: '100%', maxWidth: 500,
            maxHeight: 'calc(100dvh - 40px)', background: 'var(--card)',
            border: '1px solid var(--border)', borderRadius: 18,
            boxShadow: '0 32px 80px rgba(0,0,0,0.28)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>📖 KUETx Guide</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>How to use every feature</div>
              </div>
              <button onClick={() => setGuideOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 6, borderRadius: 8, display: 'flex', alignItems: 'center' }}>
                <X size={17} />
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
              <iframe src="/KUETx_Guide .pdf" title="KUETx Guide" style={{ width: '100%', height: '100%', minHeight: 400, border: 'none' }} />
            </div>
            <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', flexShrink: 0, background: 'var(--bg)' }}>
              <button onClick={() => setGuideOpen(false)} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: 13 }}>
                Back to Updates
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 3999, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(5px)' }} onClick={dismiss} />
      <div style={{ position: 'fixed', inset: 0, zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, pointerEvents: 'none' }}>
        <div onClick={e => e.stopPropagation()} style={{
          pointerEvents: 'auto', width: '100%', maxWidth: 500,
          maxHeight: 'calc(100dvh - 40px)',
          display: 'flex', flexDirection: 'column',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 18,
          boxShadow: '0 32px 80px rgba(0,0,0,0.26)',
          overflow: 'hidden',
        }}>

          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 60%, #1e40af) 100%)',
            padding: '20px 20px 18px', flexShrink: 0,
            position: 'relative',
          }}>
            <button onClick={dismiss} style={{
              position: 'absolute', top: 14, right: 14,
              background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer',
              color: '#fff', borderRadius: 8, width: 28, height: 28,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <X size={14} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Sparkles size={15} color="rgba(255,255,255,0.8)" />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.75)', letterSpacing: '1.1px', textTransform: 'uppercase' }}>
                What's New
              </span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', fontFamily: 'Sora, sans-serif', marginBottom: 3 }}>
              KUETx Updates
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
              {UPDATES.length} updates in this release
            </div>
          </div>

          {/* Guide CTA — prominent banner */}
          <div
            onClick={() => setGuideOpen(true)}
            style={{
              margin: '14px 14px 0',
              padding: '13px 16px',
              borderRadius: 12,
              background: 'color-mix(in srgb, var(--accent) 8%, var(--surface))',
              border: '1.5px solid color-mix(in srgb, var(--accent) 30%, var(--border))',
              display: 'flex', alignItems: 'center', gap: 12,
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--accent) 14%, var(--surface))'}
            onMouseLeave={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--accent) 8%, var(--surface))'}
          >
            <div style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: 'color-mix(in srgb, var(--accent) 15%, var(--card))',
              border: '1px solid color-mix(in srgb, var(--accent) 25%, var(--border))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <BookOpen size={17} color="var(--accent)" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
                KUETx Guide — PDF
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                প্রতিটা feature কীভাবে use করবে step-by-step
              </div>
            </div>
            <ArrowRight size={15} color="var(--accent)" style={{ flexShrink: 0 }} />
          </div>

          {/* Update list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {UPDATES.map(u => (
                <div key={u.id} style={{
                  display: 'flex', gap: 11, padding: '10px 12px',
                  borderRadius: 10, border: '1px solid var(--border)',
                  background: 'var(--surface)', alignItems: 'flex-start',
                }}>
                  <div style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{u.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{u.title}</span>
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                        background: u.tagColor + '18', color: u.tagColor,
                        letterSpacing: '0.06em', textTransform: 'uppercase',
                      }}>{u.tag}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>{u.body}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Facebook community */}
            <div style={{ marginTop: 10, padding: '11px 13px', borderRadius: 10, border: '1px solid rgba(24,119,242,0.2)', background: 'rgba(24,119,242,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>📘</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 1 }}>KUETx Community</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>Updates, tips, announcements</div>
              </div>
              <a href="https://www.facebook.com/kuetx" target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '6px 12px', borderRadius: 7, textDecoration: 'none',
                  background: 'rgba(24,119,242,0.12)', border: '1px solid rgba(24,119,242,0.25)',
                  color: '#1877F2', fontSize: 12, fontWeight: 700, flexShrink: 0,
                }}>
                Follow
              </a>
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: '11px 14px 14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            <button className="btn btn-primary" onClick={dismiss} style={{ width: '100%', justifyContent: 'center', fontSize: 13 }}>
              Got it — let's go 🚀
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
