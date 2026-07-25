/**
 * NoticePrioritySelector — Phase 4 of the Notice upgrade.
 *
 * Small segmented control for choosing a notice's priority at send time:
 * 'urgent' | 'normal' | 'info'. Shared by all 3 composers so the visual
 * language (and the color each priority maps to) stays identical to
 * NoticeCard's rendering in Notice.jsx.
 *
 * 'urgent' notices are pinned to the top of the recipient's Notice feed
 * (see Notice.jsx's pinnedNotices filter) — this isn't just a color/label
 * choice, so the control spells that out rather than leaving "Urgent"
 * to be guessed at.
 *
 * Props:
 *   value     {'urgent'|'normal'|'info'}  required
 *   onChange  {(next) => void}            required
 *   disabled  {boolean}                   optional
 */
const OPTIONS = [
  { value: 'urgent', label: 'Urgent', color: 'var(--danger)', hint: 'Pinned to the top of everyone\'s feed' },
  { value: 'normal', label: 'Normal', color: 'var(--accent)', hint: 'Regular notice, shown in the normal order' },
  { value: 'info', label: 'Info', color: 'var(--muted)', hint: 'Low-priority, for FYI-only updates' },
];

export default function NoticePrioritySelector({ value, onChange, disabled = false }) {
  const active = OPTIONS.find((o) => o.value === value) || OPTIONS[1];
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 5 }}>
        Notice type — how important is this?
      </div>
      <div style={{ display: 'inline-flex', gap: 4, padding: 3, borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {OPTIONS.map((opt) => {
          const isActive = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              aria-pressed={isActive}
              title={opt.hint}
              style={{
                fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: 'none',
                cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
                color: isActive ? '#fff' : opt.color,
                background: isActive ? opt.color : 'transparent',
                transition: 'background 0.15s ease, color 0.15s ease',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 5 }}>
        {active.hint}
      </div>
    </div>
  );
}
