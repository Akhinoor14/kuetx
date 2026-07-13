// FounderBatchSettings.jsx
//
// Founder/Head-of-Ops settings page for the active batch list used
// everywhere a "Select batch" dropdown shows up (Faculty Add Class, My
// Classes grouping, etc). Backed by appConfigSync.js's config/batches
// Firestore singleton doc.
//
// Deliberately NOT automatic ("just calculate from current year + 4-year
// program length") — per explicit decision, KUET's 4-year rule doesn't
// always hold (delayed sessions, extended terms, etc), so batch add/
// remove stays a manual Founder action instead of a formula that could
// silently produce a wrong list. This page is that manual control.
//
// Start dates (BATCH_START_DATES in store.js) stay as-is — a batch's
// start date is fixed once set, so there's no ongoing reason to move
// that part into Firestore. Only the ACTIVE LIST (which batches
// currently show up) is Founder-editable here. Adding a batch key here
// that has no matching BATCH_START_DATES entry still works everywhere
// EXCEPT the batch/term plausibility warning in Add Class (which quietly
// no-ops for unknown batches — see getBatchTermPlausibility in
// FacultyClasses.jsx), so this page warns if you add one without a
// matching start date.

import { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { BATCH_START_DATES } from '../store/store';
import { getActiveBatches, setActiveBatches } from '../lib/appConfigSync';
import { getBatchColor } from '../lib/timeModels';
import { notify } from '../lib/notify';

export default function FounderBatchSettings() {
  const [batches, setBatches] = useState(null); // null = loading
  const [newBatch, setNewBatch] = useState('');
  const [saving, setSaving] = useState(false);
  // Arms the Remove button for one batch at a time — see the tap-to-confirm
  // comment on the button itself for why this exists (mobile touch-target
  // safety net next to the reorder buttons).
  const [confirmingRemove, setConfirmingRemove] = useState(null);

  useEffect(() => {
    getActiveBatches().then(setBatches);
  }, []);

  const save = async (next) => {
    setSaving(true);
    try {
      const cleaned = await setActiveBatches(next);
      setBatches(cleaned);
      notify('Batch list updated.', 'success');
    } catch (e) {
      notify(e.message || 'Could not save the batch list.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = () => {
    const key = newBatch.trim().toLowerCase();
    if (!key) return;
    if (!/^2k\d{2}$/.test(key)) {
      notify('Batch key should look like "2k26".', 'error');
      return;
    }
    if (batches.includes(key)) {
      notify('That batch is already in the list.', 'error');
      return;
    }
    save([...batches, key]);
    setNewBatch('');
  };

  const handleRemove = (key) => {
    save(batches.filter((b) => b !== key));
  };

  const moveBatch = (idx, dir) => {
    const next = [...batches];
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= next.length) return;
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    save(next);
  };

  return (
    <div className="hub-page-bg" style={{ minHeight: '100vh' }}>
      <div style={{ padding: '20px 24px 40px', width: '97%', maxWidth: 720, margin: '0 auto' }}>
        <div className="hub-page-hero" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="hub-page-hero-icon">
            <Icons.Users size={20} color="var(--accent)" />
          </div>
          <h1 className="hub-page-hero-title">Manage Batches</h1>
        </div>

        <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8, marginBottom: 20, lineHeight: 1.5 }}>
          Controls which batches show up in every "Select batch" dropdown app-wide
          (faculty Add Class, My Classes grouping, etc). Order matters — each
          batch's color is assigned by its position in this list.
        </p>

        {batches === null ? (
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
              <input
                value={newBatch}
                onChange={(e) => setNewBatch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
                placeholder="e.g. 2k26"
                style={{
                  flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)',
                  background: 'var(--bg)', color: 'var(--text)', fontSize: 13.5, outline: 'none',
                }}
              />
              <button
                onClick={handleAdd}
                disabled={saving}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
              >
                <Icons.Plus size={15} /> Add Batch
              </button>
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              {batches.map((b, idx) => {
                const color = getBatchColor(b, batches);
                const hasStartDate = !!BATCH_START_DATES[b];
                return (
                  <div
                    key={b}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12,
                      background: color.bg, border: `1px solid ${color.border}`,
                    }}
                  >
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%', background: color.text, flexShrink: 0,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 14, color: color.text }}>{b.toUpperCase()}</div>
                      {hasStartDate ? (
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>Starts {BATCH_START_DATES[b]}</div>
                      ) : (
                        <div style={{ fontSize: 11, color: '#d97706', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Icons.AlertTriangle size={11} /> No start date set in code — term-plausibility check will be skipped for this batch.
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => moveBatch(idx, -1)}
                      disabled={idx === 0 || saving}
                      title="Move up"
                      style={{
                        background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer',
                        opacity: idx === 0 ? 0.3 : 1, color: 'var(--text)',
                        width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}
                    >
                      <Icons.ChevronUp size={18} />
                    </button>
                    <button
                      onClick={() => moveBatch(idx, 1)}
                      disabled={idx === batches.length - 1 || saving}
                      title="Move down"
                      style={{
                        background: 'none', border: 'none', cursor: idx === batches.length - 1 ? 'default' : 'pointer',
                        opacity: idx === batches.length - 1 ? 0.3 : 1, color: 'var(--text)',
                        width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}
                    >
                      <Icons.ChevronDown size={18} />
                    </button>
                    <button
                      onClick={() => {
                        // Destructive action sitting right next to two harmless
                        // reorder buttons at a similar tap-target size — on a
                        // touch screen a slightly mis-aimed tap can land on the
                        // wrong one. Rather than shrinking the row further to
                        // fit a full confirm dialog, first tap just arms the
                        // button (turns solid + relabels "Confirm"); the actual
                        // removal only fires on a second, deliberate tap. Arms
                        // for 3s then quietly resets so a stray tap elsewhere
                        // doesn't leave it primed.
                        if (confirmingRemove === b) {
                          setConfirmingRemove(null);
                          handleRemove(b);
                        } else {
                          setConfirmingRemove(b);
                          setTimeout(() => {
                            setConfirmingRemove((cur) => (cur === b ? null : cur));
                          }, 3000);
                        }
                      }}
                      disabled={saving}
                      title={confirmingRemove === b ? 'Tap again to confirm removal' : 'Remove batch'}
                      style={{
                        background: confirmingRemove === b ? 'rgba(239,68,68,0.12)' : 'none',
                        border: confirmingRemove === b ? '1px solid #ef4444' : 'none',
                        borderRadius: 8, cursor: 'pointer', color: '#ef4444',
                        width: confirmingRemove === b ? 'auto' : 44, height: 44,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                        padding: confirmingRemove === b ? '0 10px' : 0, flexShrink: 0,
                      }}
                    >
                      <Icons.Trash2 size={18} />
                      {confirmingRemove === b && <span style={{ fontSize: 12, fontWeight: 700 }}>Confirm</span>}
                    </button>
                  </div>
                );
              })}
              {batches.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: 24 }}>
                  No batches configured — add one above.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
