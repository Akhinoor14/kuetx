/**
 * dialog.js — global confirm()/alertUser() replacement for window.confirm/alert
 * ─────────────────────────────────────────────────────────────────────────────
 * Native window.confirm()/window.alert() are unstyleable browser chrome (the
 * "www.kuetx.com says" box) — they can't be themed with CSS at all, they
 * block the whole tab, and they look completely out of place next to the
 * rest of the app's UI.
 *
 * This module gives every call site a drop-in, promise-based replacement
 * that renders through <GlobalDialog /> (mounted once in App.jsx) using the
 * same kuetx-dialog-* CSS the existing ConfirmDialog.jsx already uses — so
 * visually it now matches ConfirmDialog exactly, just reachable from plain
 * async functions instead of needing local open/onConfirm state wired up
 * in every component.
 *
 * Usage (mirrors the native functions so most call sites are a 1-line swap):
 *   import { confirmDialog, alertDialog } from '../lib/dialog';
 *
 *   if (!(await confirmDialog('Delete this notice?'))) return;
 *   await alertDialog('Failed: ' + err.message);
 *
 * Both also accept an options object for a custom title / button labels /
 * danger styling:
 *   await confirmDialog({
 *     title: 'Delete this notice?',
 *     message: "It will be removed from your class's feed.",
 *     confirmLabel: 'Delete',
 *     tone: 'danger',
 *   });
 */

let nextId = 1;

function normalize(input, kind) {
  // Plain string form: `confirmDialog('Delete this?')` — split a leading
  // sentence off as the title, rest (if any) becomes the body, same look
  // as the native browser dialogs people are used to but themed.
  if (typeof input === 'string') {
    return { title: input, message: null, kind };
  }
  return { title: input.title, message: input.message ?? null, kind };
}

function open(input, kind) {
  return new Promise((resolve) => {
    const detail = {
      id: nextId++,
      kind, // 'confirm' | 'alert'
      confirmLabel: input.confirmLabel || (kind === 'alert' ? 'OK' : 'Confirm'),
      cancelLabel: input.cancelLabel || 'Cancel',
      tone: input.tone || 'primary', // 'primary' | 'danger'
      ...normalize(input, kind),
      resolve,
    };
    window.dispatchEvent(new CustomEvent('kuetx:dialog', { detail }));
  });
}

/** Drop-in for `window.confirm(msg)` — resolves true/false. */
export function confirmDialog(input) {
  return open(typeof input === 'string' ? { title: input } : input, 'confirm');
}

/** Drop-in for `window.alert(msg)` — resolves once dismissed. */
export function alertDialog(input) {
  return open(typeof input === 'string' ? { title: input } : input, 'alert');
}
