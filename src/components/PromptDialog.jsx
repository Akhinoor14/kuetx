import { useEffect, useState } from 'react';

export default function PromptDialog({
  open,
  title,
  message,
  defaultValue = '',
  placeholder = '',
  confirmLabel = 'Save',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (open) setValue(defaultValue);
  }, [open, defaultValue]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onCancel?.();
      if (event.key === 'Enter') onConfirm?.(value);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel, onConfirm, value]);

  if (!open) return null;

  return (
    <div className="kuetx-dialog-backdrop" role="presentation" onClick={onCancel}>
      <div className="kuetx-dialog-card" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <div className="kuetx-dialog-title">{title}</div>
        <div className="kuetx-dialog-body">{message}</div>
        <input
          className="kuetx-dialog-input"
          value={value}
          placeholder={placeholder}
          onChange={(event) => setValue(event.target.value)}
          autoFocus
        />
        <div className="kuetx-dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>{cancelLabel}</button>
          <button type="button" className="btn btn-primary" onClick={() => onConfirm?.(value)}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}