import React, { useEffect, useState } from 'react';
import { store } from '../store/store';
import { BookOpen, ArrowRight, X, Sparkles, Flame, RefreshCw, GraduationCap } from 'lucide-react';

// Fresh-launch welcome highlights — kept short on purpose. Not a
// changelog: these are the handful of things a brand-new user should
// know KUETx does, not a running list of "New/Fixed/Rebuilt" updates.
const HIGHLIGHTS = [
  {
    id: 1,
    icon: GraduationCap,
    title: 'Attendance & Results',
    body: 'KUET marking-slab attendance tracking plus a real GPA/CGPA calculator, built around KUET\'s own grading rules.',
  },
  {
    id: 2,
    icon: Flame,
    title: 'Question Bank',
    body: 'Browse and upload previous-semester questions by course, department, and batch.',
  },
  {
    id: 3,
    icon: RefreshCw,
    title: 'Synced Everywhere',
    body: 'Sign in once — your data follows you across every device automatically.',
  },
];

const MODAL_KEY = 'announcementV2LastShown';
const COUNT_KEY = 'announcementV2ShowCount';

export default function AnnouncementModal({ open: openProp, onClose: onCloseProp } = {}) {
  const [open, setOpen] = useState(false);

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
                Welcome
              </span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', fontFamily: 'Sora, sans-serif', marginBottom: 3 }}>
              Welcome to KUETx
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
              Everything you need for KUET academic life, in one place
            </div>
          </div>

          {/* Guide CTA — prominent banner */}
          <div
            onClick={() => window.dispatchEvent(new CustomEvent('kuetx:openGuide'))}
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
                KUETx Guide
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                How to use every feature step by step
              </div>
            </div>
            <ArrowRight size={15} color="var(--accent)" style={{ flexShrink: 0 }} />
          </div>

          {/* Highlights — kept short: 3-4 things a new user should know,
              not a changelog. */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {HIGHLIGHTS.map(u => {
                const Icon = u.icon;
                return (
                <div key={u.id} style={{
                  display: 'flex', gap: 11, padding: '10px 12px',
                  borderRadius: 10, border: '1px solid var(--border)',
                  background: 'var(--surface)', alignItems: 'flex-start',
                }}>
                  <div style={{ width: 18, flexShrink: 0, marginTop: 1, display: 'flex', justifyContent: 'center' }}><Icon size={16} color="var(--accent)" /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{u.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>{u.body}</div>
                  </div>
                </div>
                );
              })}
            </div>

            {/* Facebook community — single-line mention, theme-matched
                (not the standalone blue-branded card the old changelog
                modal used), so it doesn't compete with the highlights. */}
            <div style={{
              marginTop: 10, padding: '9px 12px', borderRadius: 10,
              border: '1px solid var(--border)', background: 'var(--surface)',
              display: 'flex', alignItems: 'center', gap: 9,
            }}>
              <BookOpen size={15} color="var(--accent)" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: 11, color: 'var(--muted)' }}>
                Join the <span style={{ color: 'var(--text)', fontWeight: 600 }}>KUETx Community</span> on Facebook for updates and tips
              </div>
              <a href="https://www.facebook.com/kuetx" target="_blank" rel="noopener noreferrer"
                style={{
                  fontSize: 11, fontWeight: 700, color: 'var(--accent)',
                  textDecoration: 'none', flexShrink: 0,
                }}>
                Follow
              </a>
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: '11px 14px 14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            <button className="btn btn-primary" onClick={dismiss} style={{ width: '100%', justifyContent: 'center', fontSize: 13 }}>
              Got it — let's go
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
