// FounderBatchSettings.jsx
//
// Founder/Head-of-Ops settings page for the active batch list AND each
// batch's start date, used everywhere a "Select batch" dropdown shows up
// (Faculty Add Class, My Classes grouping, etc) and everywhere a start
// date matters (Profile yearStarted auto-fill, Add Class term-plausibility
// warning). Backed by appConfigSync.js's config/batches Firestore
// singleton doc (v2 shape: { active: [...], startDates: {...} }).
//
// Deliberately NOT automatic ("just calculate from current year + 4-year
// program length") — per explicit decision, KUET's 4-year rule doesn't
// always hold (delayed sessions, extended terms, etc), so batch add/
// remove stays a manual Founder action instead of a formula that could
// silently produce a wrong list. This page is that manual control.
//
// Start date is now REQUIRED at add time (previously optional/code-only —
// see appConfigSync.js's header for why that used to silently leave new
// batches dateless). Existing batches can have their date corrected later
// via the inline "Edit date" control on each row.

import { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { getActiveBatches, getBatchStartDates, setActiveBatches, setBatchStartDate } from '../lib/appConfigSync';
import { getLandingTotalUsers, setLandingTotalUsers, getHeroCardOverrides, setHeroCardOverride } from '../lib/landingStatsSync';
import { getBatchColor } from '../lib/timeModels';
import { notify } from '../lib/notify';

// Landing page hero's "current user" stat — Admin-typed number, not an
// auto-count (see landingStatsSync.js's header for why: the signed-out
// landing page can't safely list students/faculty/providers to count
// them without exposing the collections publicly). Kept as its own small
// panel here rather than a new page, since this is a once-in-a-while
// Founder edit, same cadence as batch start dates on this same screen.
function LandingStatsPanel() {
  const [value, setValue] = useState(''); // input field, string while editing
  const [saved, setSaved] = useState(null); // last known saved number, or null = loading
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getLandingTotalUsers().then((n) => {
      setSaved(n);
      setValue(n == null ? '' : String(n));
    });
  }, []);

  const handleSave = async () => {
    if (value.trim() === '') {
      notify('Enter a number first.', 'error');
      return;
    }
    setSaving(true);
    try {
      await setLandingTotalUsers(value);
      setSaved(Number(value));
      notify('Landing page user count updated.', 'success');
    } catch (e) {
      notify(e.message || 'Could not save this number.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 14, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', marginBottom: 18 }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>LANDING PAGE — TOTAL USERS</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.5 }}>
        Shown as a hero stat on the public (signed-out) landing page. Set this by hand from your own count of
        students + faculty + providers — the landing page can't safely count these live itself, since that would mean
        opening those collections to public listing. Update it here whenever you have a fresher number.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="number"
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. 1250"
          style={{
            flex: '1 1 140px', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'var(--bg)', color: 'var(--text)', fontSize: 13.5, outline: 'none',
          }}
        />
        <button
          onClick={handleSave}
          disabled={saving || saved === undefined}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
        >
          <Icons.Check size={15} /> Save
        </button>
      </div>
      {saved != null && (
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
          Currently live on the landing page: <strong>{saved.toLocaleString('bn-BD')}</strong>
        </div>
      )}
    </div>
  );
}

// The 4 hero-strip cards on the landing page (CampusHero) — each has a
// live default (feature count / QB total / publications / user count)
// but can be overridden here per-card, both the number AND the label,
// without a code deploy. Leaving both fields blank clears the override
// and the card falls back to its live/default value.
const HERO_CARDS = [
  { id: 'features', title: 'Real feature count', defaultHint: 'FEATURE_COUNT_DISPLAY (auto)', placeholderValue: 'e.g. ৬২+', placeholderLabel: 'e.g. real feature' },
  { id: 'qb', title: 'Question bank total', defaultHint: 'Live from Question Bank Worker', placeholderValue: 'e.g. ২,০৯৫+', placeholderLabel: 'e.g. প্রশ্নব্যাংকে প্রশ্নপত্র' },
  { id: 'publications', title: 'Publications', defaultHint: '৫,৮৫৬+ (static)', placeholderValue: 'e.g. ৫,৮৫৬+', placeholderLabel: 'e.g. পাবলিকেশন' },
  { id: 'users', title: 'Total users', defaultHint: 'Same number as the panel above', placeholderValue: 'e.g. ৮৭', placeholderLabel: 'e.g. ব্যবহারকারী' },
];

function HeroCardsPanel() {
  const [overrides, setOverrides] = useState(null); // null = loading
  const [drafts, setDrafts] = useState({}); // { [cardId]: { value, label } }
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    getHeroCardOverrides().then((o) => {
      setOverrides(o);
      const d = {};
      HERO_CARDS.forEach(({ id }) => {
        d[id] = { value: o[id]?.value || '', label: o[id]?.label || '' };
      });
      setDrafts(d);
    });
  }, []);

  const handleSave = async (cardId) => {
    const draft = drafts[cardId];
    setSavingId(cardId);
    try {
      const hasValue = draft.value.trim() !== '' || draft.label.trim() !== '';
      await setHeroCardOverride(cardId, hasValue ? draft : null);
      setOverrides((prev) => {
        const next = { ...prev };
        if (hasValue) next[cardId] = { value: draft.value.trim(), label: draft.label.trim() };
        else delete next[cardId];
        return next;
      });
      notify(hasValue ? 'Card updated.' : 'Card override cleared — back to live default.', 'success');
    } catch (e) {
      notify(e.message || 'Could not save this card.', 'error');
    } finally {
      setSavingId(null);
    }
  };

  if (overrides === null) {
    return (
      <div style={{ padding: 14, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', marginBottom: 18, fontSize: 12.5, color: 'var(--muted)' }}>
        Loading hero stat cards…
      </div>
    );
  }

  return (
    <div style={{ padding: 14, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', marginBottom: 18 }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>LANDING PAGE — HERO STAT CARDS</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.5 }}>
        The 4 glassy cards under the landing page headline. Each one has a live/default value already — fill in a
        value and/or label below only to override it by hand. Leave both blank and save to go back to the live
        default.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {HERO_CARDS.map(({ id, title, defaultHint, placeholderValue, placeholderLabel }) => (
          <div key={id} style={{ padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, flexWrap: 'wrap', gap: 4 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
              <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>Default: {defaultHint}</div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <input
                type="text"
                value={drafts[id]?.value || ''}
                onChange={(e) => setDrafts((d) => ({ ...d, [id]: { ...d[id], value: e.target.value } }))}
                placeholder={placeholderValue}
                style={{
                  flex: '1 1 120px', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)',
                  background: 'var(--card)', color: 'var(--text)', fontSize: 12.5, outline: 'none',
                }}
              />
              <input
                type="text"
                value={drafts[id]?.label || ''}
                onChange={(e) => setDrafts((d) => ({ ...d, [id]: { ...d[id], label: e.target.value } }))}
                placeholder={placeholderLabel}
                style={{
                  flex: '1 1 160px', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)',
                  background: 'var(--card)', color: 'var(--text)', fontSize: 12.5, outline: 'none',
                }}
              />
              <button
                onClick={() => handleSave(id)}
                disabled={savingId === id}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', fontSize: 12.5 }}
              >
                <Icons.Check size={13} /> Save
              </button>
            </div>
            {overrides[id] && (
              <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 5 }}>
                Currently overridden: <strong>{overrides[id].value}</strong> — {overrides[id].label}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function BatchesContent() {
  const [batches, setBatches] = useState(null); // null = loading
  const [startDates, setStartDates] = useState({});
  const [newBatch, setNewBatch] = useState('');
  const [newBatchDate, setNewBatchDate] = useState('');
  const [saving, setSaving] = useState(false);
  // Arms the Remove button for one batch at a time — see the tap-to-confirm
  // comment on the button itself for why this exists (mobile touch-target
  // safety net next to the reorder buttons).
  const [confirmingRemove, setConfirmingRemove] = useState(null);
  // Which batch row currently has its date input open for editing.
  const [editingDateFor, setEditingDateFor] = useState(null);
  const [editingDateValue, setEditingDateValue] = useState('');
  const [savingDate, setSavingDate] = useState(false);

  useEffect(() => {
    getActiveBatches().then(setBatches);
    getBatchStartDates().then(setStartDates);
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

  const handleAdd = async () => {
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
    if (!newBatchDate) {
      notify('Set the batch\'s university start date before adding it.', 'error');
      return;
    }
    setSaving(true);
    try {
      const cleaned = await setActiveBatches([...batches, key], { [key]: newBatchDate });
      setBatches(cleaned);
      setStartDates((prev) => ({ ...prev, [key]: newBatchDate }));
      notify('Batch added.', 'success');
      setNewBatch('');
      setNewBatchDate('');
    } catch (e) {
      notify(e.message || 'Could not add this batch.', 'error');
    } finally {
      setSaving(false);
    }
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

  const openDateEdit = (b) => {
    setEditingDateFor(b);
    setEditingDateValue(startDates[b] || '');
  };

  const saveDateEdit = async (b) => {
    if (!editingDateValue) {
      notify('Pick a date first.', 'error');
      return;
    }
    setSavingDate(true);
    try {
      await setBatchStartDate(b, editingDateValue);
      setStartDates((prev) => ({ ...prev, [b]: editingDateValue }));
      notify('Start date updated.', 'success');
      setEditingDateFor(null);
    } catch (e) {
      notify(e.message || 'Could not save this date.', 'error');
    } finally {
      setSavingDate(false);
    }
  };

  return (
    <div style={{ padding: '20px 24px 40px', width: '100%', boxSizing: 'border-box', maxWidth: 720, margin: '0 auto' }}>
      <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 0, marginBottom: 20, lineHeight: 1.5 }}>
        Used to auto-fill a student's Profile and to power the batch/term plausibility check in Faculty Add Class.
        Order matters — each batch's color is assigned by its position in this list.
      </p>

      {batches === null ? (
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</div>
      ) : (
        <>
          <LandingStatsPanel />
          <HeroCardsPanel />

          <div style={{ padding: 14, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', marginBottom: 18 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>ADD A NEW BATCH</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                value={newBatch}
                onChange={(e) => setNewBatch(e.target.value)}
                placeholder="e.g. 2k26"
                style={{
                  flex: '1 1 140px', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)',
                  background: 'var(--bg)', color: 'var(--text)', fontSize: 13.5, outline: 'none',
                }}
              />
              <input
                type="date"
                value={newBatchDate}
                onChange={(e) => setNewBatchDate(e.target.value)}
                style={{
                  flex: '1 1 160px', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)',
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
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
              Start date is required — it's what makes this batch show up correctly on student profiles and the term-plausibility check.
            </div>
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            {batches.map((b, idx) => {
              const color = getBatchColor(b, batches);
              const startDate = startDates[b];
              const isEditingDate = editingDateFor === b;
              return (
                <div
                  key={b}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12,
                    background: color.bg, border: `1px solid ${color.border}`, flexWrap: 'wrap',
                  }}
                >
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%', background: color.text, flexShrink: 0,
                  }} />
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: color.text }}>{b.toUpperCase()}</div>
                    {!isEditingDate && (
                      startDate ? (
                        <button
                          onClick={() => openDateEdit(b)}
                          style={{
                            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                            fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4,
                          }}
                        >
                          Starts {startDate} <Icons.Pencil size={10} />
                        </button>
                      ) : (
                        <button
                          onClick={() => openDateEdit(b)}
                          style={{
                            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                            fontSize: 11, color: '#d97706', display: 'flex', alignItems: 'center', gap: 4,
                          }}
                        >
                          <Icons.AlertTriangle size={11} /> No start date set — tap to add one
                        </button>
                      )
                    )}
                    {isEditingDate && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <input
                          type="date"
                          value={editingDateValue}
                          onChange={(e) => setEditingDateValue(e.target.value)}
                          style={{
                            padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)',
                            background: 'var(--bg)', color: 'var(--text)', fontSize: 12.5,
                          }}
                        />
                        <button
                          onClick={() => saveDateEdit(b)}
                          disabled={savingDate}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)' }}
                          title="Save date"
                        >
                          <Icons.Check size={16} />
                        </button>
                        <button
                          onClick={() => setEditingDateFor(null)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}
                          title="Cancel"
                        >
                          <Icons.X size={16} />
                        </button>
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
  );
}

// Standalone page wrapper for the direct /admin/batches route (kept working
// for any existing bookmarks/links). The embedded copy used inside
// AdminDashboard's Founder shell (see AdminDashboard.jsx's 'batches' view)
// renders the same BatchesContent without this outer hero/page-bg, since
// TeamDashboard/CategoryShell already provide that chrome — this avoids a
// doubled-up header and keeps the Founder role-tab chips visible there.
export default function FounderBatchSettings() {
  return (
    <div className="hub-page-bg" style={{ minHeight: '100vh' }}>
      <div style={{ padding: '20px 24px 40px', width: '100%', boxSizing: 'border-box', maxWidth: 720, margin: '0 auto' }}>
        <div className="content-page-hero">
          <div className="content-page-hero-main">
            <div className="content-page-hero-head">
              <div className="content-page-hero-icon">
                <Icons.Users size={24} color="var(--accent)" />
              </div>
              <h1 className="content-page-hero-title">Manage Batches</h1>
            </div>
            <p className="content-page-hero-subtitle">
              Controls batches shown in every "Select batch" dropdown app-wide and each batch's university start date
            </p>
          </div>
        </div>
        <BatchesContent />
      </div>
    </div>
  );
}
