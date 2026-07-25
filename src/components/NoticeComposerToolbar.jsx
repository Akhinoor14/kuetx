import { useState, useRef, useEffect, Fragment } from 'react';
import { X } from 'lucide-react';

/**
 * NoticeComposerToolbar — Phase 3 of the Notice upgrade.
 *
 * Small formatting toolbar shown above/beside a notice composer's
 * textarea: B, I, H1/H2/H3, List (bullet), Numbered list, Highlight, and
 * a Help (?) button that opens a quick-reference card for the same
 * syntax — for people who'd rather type the markdown directly than click
 * buttons, or want a reminder of what each symbol does.
 * Clicking a format button inserts the matching markdown syntax at the
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

// Kept in sync with noticeFormat.jsx's actual parsing rules (see its
// header comment) — this is a reference card, not a separate spec, so
// every row here must match what the renderer really does.
const HELP_ROWS = [
  { syntax: '**text**', example: '**hi**', result: 'hi', resultStyle: { fontWeight: 700 } },
  { syntax: '*text*', example: '*hi*', result: 'hi', resultStyle: { fontStyle: 'italic' } },
  { syntax: '==text==', example: '==hi==', result: 'hi', resultStyle: { background: 'rgba(250,204,21,0.35)', padding: '0 3px', borderRadius: 3 } },
  { syntax: '# text', example: '# Hi', result: 'Hi', resultStyle: { fontWeight: 700, fontSize: 16 } },
  { syntax: '## text', example: '## Hi', result: 'Hi', resultStyle: { fontWeight: 700, fontSize: 14 } },
  { syntax: '### text', example: '### Hi', result: 'Hi', resultStyle: { fontWeight: 700, fontSize: 12.5 } },
  { syntax: '- text', example: '- Hi', result: '• Hi' },
  { syntax: '1. text', example: '1. Hi', result: '1. Hi' },
];

function FormattingHelpCard({ onClose }) {
  const cardRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (cardRef.current && !cardRef.current.contains(e.target)) onClose();
    };
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  return (
    <div
      ref={cardRef}
      style={{
        position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 20,
        width: 'min(300px, 90vw)', padding: 12, borderRadius: 10,
        border: '1px solid var(--border)', background: 'var(--card)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--text)' }}>Formatting</div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', lineHeight: 1, padding: 2, display: 'flex' }}
        >
          <X size={14} />
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 7, columnGap: 10, alignItems: 'center' }}>
        {HELP_ROWS.map((row) => (
          <Fragment key={row.syntax}>
            <code style={{ fontSize: 11.5, color: 'var(--text)', background: 'var(--surface)', padding: '2px 6px', borderRadius: 5, whiteSpace: 'nowrap' }}>
              {row.example}
            </code>
            <span style={{ fontSize: 12, color: 'var(--text)', justifySelf: 'end', ...row.resultStyle }}>
              {row.result}
            </span>
          </Fragment>
        ))}
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 9, lineHeight: 1.5 }}>
        Blank line between points = new paragraph.
      </div>
    </div>
  );
}

export default function NoticeComposerToolbar({ textareaRef, value, onChange, disabled = false }) {
  const [helpOpen, setHelpOpen] = useState(false);
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
    <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
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
      <button
        type="button"
        title="Formatting help"
        aria-label="Formatting help"
        onClick={() => setHelpOpen((v) => !v)}
        style={{
          minWidth: 26, height: 26, padding: '0 6px', borderRadius: 6,
          border: '1px solid var(--border)',
          background: helpOpen ? 'var(--accentBg, #eef2ff)' : 'var(--surface)',
          color: helpOpen ? 'var(--accent, #4f46e5)' : 'var(--muted)',
          fontSize: 12, fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        ?
      </button>
      {helpOpen && <FormattingHelpCard onClose={() => setHelpOpen(false)} />}
    </div>
  );
}
