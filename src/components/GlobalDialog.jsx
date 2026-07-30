import { useEffect, useState } from 'react';

/**
 * GlobalDialog — renders confirmDialog()/alertDialog() calls from
 * src/lib/dialog.js. Mount exactly once (see App.jsx). Uses the same
 * kuetx-dialog-* CSS as the existing ConfirmDialog.jsx so every confirm/
 * alert in the app — however it's triggered — looks identical and sits in
 * the same centered, backdrop-blurred position instead of the browser's
 * own unstyleable popup chrome.
 */
export default function GlobalDialog() {
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    const onDialog = (event) => {
      const detail = event.detail;
      if (!detail?.id) return;
      setQueue((current) => [...current, detail]);
    };
    window.addEventListener('kuetx:dialog', onDialog);
    return () => window.removeEventListener('kuetx:dialog', onDialog);
  }, []);

  const current = queue[0];

  useEffect(() => {
    if (!current) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') settle(false);
      if (event.key === 'Enter') settle(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  if (!current) return null;

  const settle = (value) => {
    current.resolve(value);
    setQueue((q) => q.slice(1));
  };

  return (
    <div className="kuetx-dialog-backdrop" role="presentation" onClick={() => settle(false)}>
      <div
        className="kuetx-dialog-card"
        role="alertdialog"
        aria-modal="true"
        aria-label={current.title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="kuetx-dialog-title">{current.title}</div>
        {current.message && <div className="kuetx-dialog-body">{current.message}</div>}
        <div className="kuetx-dialog-actions">
          {current.kind === 'confirm' && (
            <button type="button" className="btn btn-ghost" onClick={() => settle(false)}>
              {current.cancelLabel}
            </button>
          )}
          <button
            type="button"
            className={`btn ${current.tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => settle(true)}
          >
            {current.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
