/**
 * NoticeComposerToolbar — Phase 3 of the Notice upgrade.
 *
 * Small formatting toolbar shown above/beside a notice composer's
 * textarea: B, I, H1/H2/H3, List (bullet), Numbered list, Highlight.
 * Clicking a button inserts the matching markdown syntax at the
 * textarea's current cursor position (or wraps the current selection,
 * for the inline wrap-style buttons), then restores focus so the sender
 * can keep typing without reaching for the mouse again.
 *
 * This component does NOT own the textarea or its value — it's handed a
 * ref to the live <textarea> DOM node plus the current value/setter, so
 * it works identically whether the composer's textarea is controlled via
 * plain useState (all three current composers) or anything else later.
 *
 * Props:
 *   textareaRef  {React.RefObject<HTMLTextAreaElement>}  required
 *   value        {string}                                current textarea value
 *   onChange     {(next: string) => void}                 required
 *   disabled     {boolean}                                optional
 */
export default function NoticeComposerToolbar({ textareaRef, value, onChange, disabled = false }) {
  const insert = (before, after = '', placeholder = '') => {
    const el = textareaRef?.current;
    if (!el) return;

    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const selected = value.slice(start, end);
    const content = selected || placeholder;
    const next = value.slice(0, start) + before + content + after + value.slice(end);

    onChange(next);

    // Restore focus + selection after the value updates. Wrapped in a
    // microtask/rAF since the textarea's DOM value hasn't caught up with
    // React's controlled `value` prop yet on this same tick.
    requestAnimationFrame(() => {
      el.focus();
      const cursorStart = start + before.length;
      const cursorEnd = cursorStart + content.length;
      el.setSelectionRange(cursorStart, cursorEnd);
    });
  };

  // Block-level buttons (heading/list) need to insert at the START of the
  // current line, not wherever the cursor happens to be mid-line — finds
  // the current line's start, and skips re-inserting the same prefix if
  // that block marker is already there (acts as a toggle).
  const insertLinePrefix = (prefix) => {
    const el = textareaRef?.current;
    if (!el) return;

    const cursor = el.selectionStart ?? value.length;
    const lineStart = value.lastIndexOf('\n', cursor - 1) + 1;
    const lineEnd = (() => {
      const idx = value.indexOf('\n', cursor);
      return idx === -1 ? value.length : idx;
    })();
    const line = value.slice(lineStart, lineEnd);

    const alreadyHasPrefix = line.startsWith(prefix);
    const nextLine = alreadyHasPrefix ? line.slice(prefix.length) : prefix + line;
    const next = value.slice(0, lineStart) + nextLine + value.slice(lineEnd);

    onChange(next);

    requestAnimationFrame(() => {
      el.focus();
      const delta = alreadyHasPrefix ? -prefix.length : prefix.length;
      const pos = cursor + delta;
      el.setSelectionRange(pos, pos);
    });
  };

  const buttons = [
    { label: 'B', title: 'Bold', action: () => insert('**', '**', 'bold text'), style: { fontWeight: 700 } },
    { label: 'I', title: 'Italic', action: () => insert('*', '*', 'italic text'), style: { fontStyle: 'italic' } },
    { label: 'H1', title: 'Heading 1', action: () => insertLinePrefix('# '), style: { fontWeight: 700, fontSize: 12 } },
    { label: 'H2', title: 'Heading 2', action: () => insertLinePrefix('## '), style: { fontWeight: 700, fontSize: 11 } },
    { label: 'H3', title: 'Heading 3', action: () => insertLinePrefix('### '), style: { fontWeight: 700, fontSize: 10.5 } },
    { label: '•', title: 'Bullet list', action: () => insertLinePrefix('- ') },
    { label: '1.', title: 'Numbered list', action: () => insertLinePrefix('1. ') },
    { label: '⬛', title: 'Highlight', action: () => insert('==', '==', 'highlighted text'), style: { fontSize: 9 } },
  ];

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {buttons.map((btn) => (
        <button
          key={btn.title}
          type="button"
          title={btn.title}
          aria-label={btn.title}
          disabled={disabled}
          onClick={btn.action}
          style={{
            minWidth: 26, height: 26, padding: '0 6px', borderRadius: 6,
            border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)',
            fontSize: 12, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            ...btn.style,
          }}
        >
          {btn.label}
        </button>
      ))}
    </div>
  );
}
