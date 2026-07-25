/**
 * NoticePrioritySelector — Phase 4 of the Notice upgrade.
 *
 * Small segmented control for choosing a notice's priority at send time:
 * 'urgent' | 'normal' | 'info'. Shared by all 3 composers so the visual
 * language (and the color each priority maps to) stays identical to
 * NoticeCard's rendering in Notice.jsx.
 *
 * Props:
 *   value     {'urgent'|'normal'|'info'}  required
 *   onChange  {(next) => void}            required
 *   disabled  {boolean}                   optional
 */
const OPTIONS = [
  { value: 'urgent', label: 'Urgent', color: 'var(--danger)' },
  { value: 'normal', label: 'Normal', color: 'var(--accent)' },
  { value: 'info', label: 'Info', color: 'var(--muted)' },
];

export default function NoticePrioritySelector({ value, onChange, disabled = false }) {
  return (
    <div style={{ display: 'inline-flex', gap: 4, padding: 3, borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--border)' }}>
      {OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            style={{
              fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: 'none',
              cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
              color: active ? '#fff' : opt.color,
              background: active ? opt.color : 'transparent',
              transition: 'background 0.15s ease, color 0.15s ease',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
