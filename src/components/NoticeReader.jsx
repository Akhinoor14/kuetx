import { Crown, Megaphone, UserCircle2, GraduationCap, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { renderFormattedNoticeBody } from '../lib/noticeFormat';

function timeAgo(ms) {
  if (!ms) return '';
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ms).toLocaleDateString();
}

// Same role→color mapping used by the timeline's left-edge bar (see
// ROLE_ACCENT in NoticeTimeline.jsx) — kept here too since the reader
// renders standalone in both the desktop pane and the mobile sheet.
export function roleAccentFor(n) {
  if (n.isFounder) return 'var(--letter-roleFounder)';
  if (n.section === 'admin') return 'var(--letter-roleAdmin)';
  if (n.roleTag === 'Teacher') return 'var(--letter-roleFaculty)';
  return 'var(--letter-roleCR)';
}

function eyebrowFor(n) {
  if (n.isFounder) return "From the founder's desk";
  if (n.section === 'admin') return 'From admin';
  if (n.roleTag === 'Teacher') return 'From your faculty';
  return 'From your CR';
}

function RoleIcon({ n, size = 13, color }) {
  if (n.isFounder) return <Crown size={size} color={color} />;
  if (n.section === 'admin') return <Megaphone size={size} color={color} />;
  if (n.roleTag === 'Teacher') return <GraduationCap size={size} color={color} />;
  return <UserCircle2 size={size} color={color} />;
}

const PRIORITY_META = {
  urgent: { color: 'var(--danger)', label: 'Urgent', Icon: AlertTriangle },
  info: { color: 'var(--letter-inkMuted)', label: 'Info', Icon: Info },
};

// The letter — used verbatim by both the desktop right pane and the
// mobile bottom sheet; only the surrounding container/transition differs.
export default function NoticeReader({ notice, isAcknowledged, onAcknowledge, refCode }) {
  if (!notice) return null;
  const n = notice;
  const accent = roleAccentFor(n);
  const priority = n.priority || 'normal';
  const priorityMeta = priority !== 'normal' ? PRIORITY_META[priority] : null;

  return (
    <div
      className="letter-serif"
      style={{
        background: 'var(--letter-paper)',
        border: '1px solid var(--letter-paperBorder)',
        borderRadius: 16,
        overflow: 'hidden',
      }}
    >
      {/* Wax-seal-style top accent strip, split gold/role-accent */}
      <div style={{ display: 'flex', height: 4 }}>
        <div style={{ flex: 1, background: 'var(--letter-gold)' }} />
        <div style={{ flex: 1, background: accent }} />
      </div>

      <div style={{ padding: '22px 24px 26px' }}>
        {/* Letterhead */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{
            width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--letter-goldBg)',
          }}>
            <RoleIcon n={n} size={13} color="var(--letter-goldIcon)" />
          </div>
          <span style={{
            fontFamily: "'Sora','Hind Siliguri',sans-serif",
            fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
            color: 'var(--letter-gold)',
          }}>
            {eyebrowFor(n)}
          </span>
          {priorityMeta && (
            <span style={{
              fontFamily: "'Sora','Hind Siliguri',sans-serif",
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 10, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase',
              color: priority === 'urgent' ? '#fff' : priorityMeta.color,
              background: priority === 'urgent' ? priorityMeta.color : 'color-mix(in srgb, ' + priorityMeta.color + ' 16%, transparent)',
              borderRadius: 999, padding: '2px 8px', marginLeft: 2,
            }}>
              <priorityMeta.Icon size={10} /> {priorityMeta.label}
            </span>
          )}
        </div>

        {/* Headline */}
        <h2 style={{
          fontSize: 21, fontWeight: 700, color: 'var(--letter-ink)', lineHeight: 1.3, margin: 0,
        }}>
          {n.title}
        </h2>

        <div style={{
          fontFamily: "'Sora','Hind Siliguri',sans-serif",
          display: 'flex', alignItems: 'center', gap: 6, marginTop: 8,
          fontSize: 11.5, color: 'var(--letter-inkFaint)',
        }}>
          <span style={{ fontWeight: 700, color: 'var(--letter-inkMuted)' }}>{n.from}</span>
          <span>·</span>
          <span>{timeAgo(n.createdAt)}</span>
          {n.courseCode && (
            <>
              <span>·</span>
              <span style={{
                fontWeight: 700, color: accent,
                background: 'color-mix(in srgb, ' + accent + ' 14%, transparent)',
                borderRadius: 999, padding: '1px 8px',
              }}>
                {n.courseCode}
              </span>
            </>
          )}
        </div>

        {/* Body */}
        <div style={{
          marginTop: 20, fontSize: 15, lineHeight: 1.75, color: 'var(--letter-inkBody)',
        }}>
          {renderFormattedNoticeBody(n.body)}
        </div>

        {/* Signature block — dashed tear-perforation divider + sign-off */}
        <div style={{
          marginTop: 28, paddingTop: 16,
          borderTop: '1px dashed var(--letter-paperDashed)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'color-mix(in srgb, ' + accent + ' 16%, transparent)',
            }}>
              <RoleIcon n={n} size={11} color={accent} />
            </div>
            <span style={{
              fontFamily: "'Sora','Hind Siliguri',sans-serif",
              fontSize: 11.5, fontWeight: 700, color: 'var(--letter-inkMuted)',
            }}>
              {n.from}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {n.section === 'class' && (
              <button
                type="button"
                onClick={onAcknowledge}
                disabled={isAcknowledged}
                style={{
                  fontFamily: "'Sora','Hind Siliguri',sans-serif",
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontSize: 11, fontWeight: 700, padding: '5px 11px', borderRadius: 999,
                  border: `1px solid ${isAcknowledged ? accent : 'var(--letter-paperBorder)'}`,
                  background: isAcknowledged ? 'color-mix(in srgb, ' + accent + ' 14%, transparent)' : 'transparent',
                  color: isAcknowledged ? accent : 'var(--letter-inkMuted)',
                  cursor: isAcknowledged ? 'default' : 'pointer',
                }}
              >
                <CheckCircle2 size={12} />
                {isAcknowledged ? 'Got it' : 'Mark as Got it'}
              </button>
            )}
            {refCode && (
              <span style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 10.5, color: 'var(--letter-inkFaint)',
              }}>
                ref {refCode}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
