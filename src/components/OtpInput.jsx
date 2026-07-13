// OtpInput.jsx — reusable 6-digit code entry, shared by student + faculty
// verify UIs. Auto-advances between boxes, supports paste-the-whole-code,
// backspace-to-previous-box. Controlled: value/onChange are the full
// 6-char string, same shape callers already handle for verifyOtpCode().
import { useRef } from 'react';

export default function OtpInput({ value, onChange, disabled, length = 6 }) {
  const inputsRef = useRef([]);
  const digits = value.padEnd(length, ' ').split('').slice(0, length);

  const setDigit = (index, char) => {
    const next = value.split('');
    next[index] = char;
    onChange(next.join('').slice(0, length).replace(/\s/g, ''));
  };

  const handleChange = (index) => (e) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) { setDigit(index, ''); return; }
    // Handle paste-into-single-box: distribute all pasted digits from here.
    if (raw.length > 1) {
      const chars = raw.split('').slice(0, length - index);
      const next = value.split('');
      chars.forEach((c, i) => { next[index + i] = c; });
      onChange(next.join('').slice(0, length));
      const lastFilled = Math.min(index + chars.length, length - 1);
      inputsRef.current[lastFilled]?.focus();
      return;
    }
    setDigit(index, raw);
    if (index < length - 1) inputsRef.current[index + 1]?.focus();
  };

  const handleKeyDown = (index) => (e) => {
    if (e.key === 'Backspace' && !digits[index].trim() && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (inputsRef.current[i] = el)}
          value={d.trim()}
          onChange={handleChange(i)}
          onKeyDown={handleKeyDown(i)}
          disabled={disabled}
          inputMode="numeric"
          maxLength={1}
          style={{
            width: 42, height: 50, textAlign: 'center', fontSize: 20, fontWeight: 700,
            borderRadius: 8, border: '1px solid var(--border)',
            background: 'var(--surfaceGlassStrong, var(--bg))', color: 'var(--text)',
            boxSizing: 'border-box',
          }}
        />
      ))}
    </div>
  );
}
