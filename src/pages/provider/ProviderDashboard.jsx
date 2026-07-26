// ProviderDashboard.jsx
//
// PHASE 2 (SERVICES_PROVIDER_PLAN.md §5). Only reachable once
// RequireProvider confirms status === 'verified'. Layout follows the
// spec's priority order exactly: pending bookings queue first (the
// thing that needs action right now), then the open/closed toggle
// (big, one-tap), then offerings management, then revenue — mobile-first
// since "owner মূলত মোবাইল ইউজার" (§5 closing note).
//
// PHASE 3 PART 2: booking-state alerts are wired at the serviceSync.js
// level (confirmBooking/cancelBooking/expirePendingBookingsForClosedShop
// write into bookingAlerts/{uid}/items — see that file and
// NotificationPanel.jsx), so nothing changes here for that item. This
// pass instead covers the two things that DO touch this file:
// mobile touch-target/scroll-depth polish (§5's closing note — the owner
// is a busy salon owner on a phone, not someone browsing at leisure),
// and letting the owner enter a real price when finishing a booking
// (previously hardcoded to 0, so revenueTotal never actually moved).

import { useEffect, useState } from 'react';
import {
  Store, Check, X as XIcon, Clock, Wallet, Plus, Trash2,
} from 'lucide-react';
import Collapsible from '../../components/Collapsible';
import {
  subscribeProviderServices, createService, setServiceOpen,
  setServiceOfferings, addOfferingId, updateServiceDetails,
  subscribePendingBookings, subscribeConfirmedBookings,
  confirmBooking, cancelBooking, finishBooking, hasConflictingConfirmedSlot,
  countStudentNoShowsOnService,
} from '../../lib/serviceSync';

function formatWhen(ts) {
  if (!ts) return '';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('en-BD', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function ProviderDashboard({ providerProfile }) {
  const [services, setServices] = useState(null);
  const uid = providerProfile?.uid;

  useEffect(() => {
    if (!uid) return undefined;
    return subscribeProviderServices(uid, setServices);
  }, [uid]);

  if (!uid) return null;

  const myService = services && services.length > 0 ? services[0] : null;
  const stillLoading = services === null;

  return (
    <div style={{ padding: '20px 16px', maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, background: 'var(--accentSoft)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Store size={22} color="var(--accent)" />
        </div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
            {providerProfile?.displayName || 'Provider Dashboard'}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Verified service provider</div>
        </div>
      </div>

      {stillLoading && (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          Loading…
        </div>
      )}

      {!stillLoading && !myService && (
        <ServiceSetupForm providerUid={uid} />
      )}

      {!stillLoading && myService && (
        <ServiceManager service={myService} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// First-time setup — a verified provider has no services/{serviceId}
// doc yet (Phase 1 left serviceIds: [] on purpose). This is the one-time
// form that creates it.
// ---------------------------------------------------------------------
function ServiceSetupForm({ providerUid }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priceNote, setPriceNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!name.trim()) {
      setError('সার্ভিসের নাম দিন।');
      return;
    }
    setSubmitting(true);
    try {
      await createService(providerUid, {
        type: 'salon', name, description, priceNote,
      });
    } catch (e) {
      setError('সেভ করতে সমস্যা হয়েছে — আবার চেষ্টা করুন।');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
        আপনার সার্ভিস সেট আপ করুন
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
        এটা একবারই করতে হবে। পরে সব কিছু এখান থেকে এডিট করতে পারবেন।
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label="সার্ভিসের নাম" value={name} onChange={setName} placeholder="যেমন: Rafiq's Salon" />
        <Field label="বর্ণনা (ঐচ্ছিক)" value={description} onChange={setDescription} placeholder="সংক্ষিপ্ত বিবরণ" textarea />
        <Field label="মূল্য নোট (ঐচ্ছিক)" value={priceNote} onChange={setPriceNote} placeholder="যেমন: ৳50 - ৳300" />
      </div>

      {error && <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--danger, #dc2626)' }}>{error}</div>}

      <button onClick={submit} disabled={submitting} className="btn btn-primary" style={{ marginTop: 16, width: '100%' }}>
        {submitting ? 'সেভ হচ্ছে…' : 'সার্ভিস তৈরি করুন'}
      </button>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, textarea,
}) {
  const commonStyle = {
    width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 10,
    border: '1px solid var(--border)', background: 'var(--card)',
    color: 'var(--text)', fontSize: 14, fontFamily: 'inherit',
  };
  return (
    <div>
      <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{label}</label>
      {textarea ? (
        <textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={commonStyle} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={commonStyle} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Main manager — shown once a service exists.
// ---------------------------------------------------------------------
function ServiceManager({ service }) {
  const [pending, setPending] = useState(null);
  const [confirmed, setConfirmed] = useState(null);
  const [toggling, setToggling] = useState(false);

  useEffect(() => subscribePendingBookings(service.id, setPending), [service.id]);
  useEffect(() => subscribeConfirmedBookings(service.id, setConfirmed), [service.id]);

  const toggleOpen = async () => {
    setToggling(true);
    try {
      await setServiceOpen(service.id, !service.isOpen);
    } finally {
      setToggling(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Open/Closed — biggest, most important, one tap (§5.2) */}
      <button
        onClick={toggleOpen}
        disabled={toggling}
        style={{
          padding: '18px 16px', borderRadius: 16, border: 'none', cursor: 'pointer',
          fontSize: 17, fontWeight: 800, color: '#fff',
          background: service.isOpen ? '#16a34a' : '#6b7280',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        }}
      >
        {service.isOpen ? <Check size={22} /> : <XIcon size={22} />}
        {service.isOpen ? 'দোকান এখন খোলা — ট্যাপ করে বন্ধ করুন' : 'দোকান এখন বন্ধ — ট্যাপ করে খুলুন'}
      </button>

      {/* Pending bookings queue — first screen priority (§5.1) */}
      <PendingQueue serviceId={service.id} bookings={pending} offerings={service.offerings || []} />

      {/* Confirmed bookings — finish or cancel-as-no-show */}
      <ConfirmedList serviceId={service.id} bookings={confirmed} offerings={service.offerings || []} />

      {/*
        Mobile scroll-depth pass (§5 closing note): PendingQueue and
        ConfirmedList above stay always-expanded — those are the two
        things a busy owner mid-shift needs on-screen without an extra
        tap. Offerings, revenue, and the details editor are lower-
        frequency (edited occasionally, not every booking), so they
        collapse by default, cutting the vertical stack down to just the
        open/closed toggle + two live queues on first paint.
      */}
      <Collapsible title="Offerings" subtitle={`${(service.offerings || []).length} item${(service.offerings || []).length === 1 ? '' : 's'}`}>
        <OfferingsManager service={service} />
      </Collapsible>

      <Collapsible
        title="মোট আয়"
        subtitle="Done বুকিং থেকে"
        rightCollapsed={<span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>৳{service.revenueTotal || 0}</span>}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Wallet size={22} color="var(--accent)" />
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>৳{service.revenueTotal || 0}</div>
        </div>
      </Collapsible>

      <Collapsible title="সার্ভিস বিবরণ এডিট করুন" subtitle={service.name}>
        <ServiceDetailsEditor service={service} />
      </Collapsible>
    </div>
  );
}

function PendingQueue({ serviceId, bookings, offerings }) {
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [conflictWarningFor, setConflictWarningFor] = useState(null);

  const offeringLabel = (id) => offerings.find((o) => o.id === id)?.label || 'Unknown offering';

  const doConfirm = async (bookingId, preferredTime) => {
    setBusyId(bookingId);
    setError('');
    try {
      // §11 item 2: warn, don't block — see hasConflictingConfirmedSlot's
      // own doc comment for why this stays a nudge rather than an
      // enforced rule. If the owner already dismissed the warning once
      // for this booking (conflictWarningFor === bookingId) and tapped
      // Confirm again, go ahead — re-showing the same warning forever
      // would just be annoying, not protective.
      if (preferredTime && conflictWarningFor !== bookingId) {
        const conflict = await hasConflictingConfirmedSlot(serviceId, preferredTime);
        if (conflict) {
          setConflictWarningFor(bookingId);
          setError('এই সময়ে আরেকটা বুকিং আগে থেকেই কনফার্ম আছে — আবার Confirm চাপলে এগিয়ে যাবে।');
          setBusyId(null);
          return;
        }
      }
      setConflictWarningFor(null);
      await confirmBooking(serviceId, bookingId, preferredTime || null);
    } catch (e) {
      setError(e.message || 'কনফার্ম করতে সমস্যা হয়েছে।');
    } finally {
      setBusyId(null);
    }
  };

  const doCancel = async (bookingId) => {
    setBusyId(bookingId);
    setError('');
    try {
      await cancelBooking(serviceId, bookingId, 'owner');
    } catch (e) {
      setError(e.message || 'বাতিল করতে সমস্যা হয়েছে।');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Clock size={16} /> Pending Bookings {bookings ? `(${bookings.length})` : ''}
      </div>

      {bookings === null && <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</div>}
      {bookings && bookings.length === 0 && <div style={{ fontSize: 13, color: 'var(--muted)' }}>কোনো pending বুকিং নেই।</div>}

      {error && <div style={{ fontSize: 12.5, color: 'var(--danger, #dc2626)', marginBottom: 8 }}>{error}</div>}

      {(bookings || []).map((b) => (
        <PendingBookingCard
          key={b.id}
          serviceId={serviceId}
          booking={b}
          offeringLabel={offeringLabel(b.offeringId)}
          busy={busyId === b.id}
          onConfirm={() => doConfirm(b.id, b.preferredTime)}
          onCancel={() => doCancel(b.id)}
        />
      ))}
    </div>
  );
}

function PendingBookingCard({
  serviceId, booking: b, offeringLabel, busy, onConfirm, onCancel,
}) {
  // §11 item 1: fetched lazily per card, once, not part of the live
  // bookings subscription above — this is a one-off lookup for owner
  // context, not something that needs real-time updates while the queue
  // is open (the count can only grow from a NEW no-show, which wouldn't
  // affect an already-rendered pending booking's own card anyway).
  const [noShowCount, setNoShowCount] = useState(null);
  useEffect(() => {
    let cancelled = false;
    countStudentNoShowsOnService(serviceId, b.studentUid)
      .then((n) => { if (!cancelled) setNoShowCount(n); })
      .catch(() => { if (!cancelled) setNoShowCount(0); });
    return () => { cancelled = true; };
  }, [serviceId, b.studentUid]);

  return (
    <div
      style={{
        padding: 12, borderRadius: 12, marginBottom: 8,
        background: b.preferredTime ? 'var(--accentSoft)' : 'var(--surface, var(--card))',
        border: '1px solid var(--border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{b.studentName || 'Student'}</div>
        {noShowCount >= 2 && (
          <span
            title="আগে এই শপে একাধিকবার no-show হয়েছে"
            style={{
              fontSize: 10, fontWeight: 800, letterSpacing: 0.3, textTransform: 'uppercase',
              color: '#dc2626', background: 'rgba(220,38,38,0.12)',
              borderRadius: 6, padding: '2px 8px',
            }}
          >
            {noShowCount}× no-show
          </span>
        )}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{offeringLabel}</div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>Requested: {formatWhen(b.requestedAt)}</div>
      {b.preferredTime && (
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--accent)', marginTop: 4 }}>
          Preferred: {b.preferredTime.date} at {b.preferredTime.time}
        </div>
      )}
      {b.studentPhone && (
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{b.studentPhone}</div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          onClick={onConfirm}
          disabled={busy}
          className="btn btn-primary"
          style={{ flex: 1, minHeight: 46, fontSize: 14.5, fontWeight: 700 }}
        >
          Confirm
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          className="btn btn-secondary"
          style={{ flex: 1, minHeight: 46, fontSize: 14.5, fontWeight: 700 }}
        >
          বাতিল
        </button>
      </div>
    </div>
  );
}

function ConfirmedList({ serviceId, bookings, offerings }) {
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [priceEntryFor, setPriceEntryFor] = useState(null);
  const [priceInput, setPriceInput] = useState('');

  const offeringLabel = (id) => offerings.find((o) => o.id === id)?.label || 'Unknown offering';

  // §11 revenue decision: stays a single running revenueTotal (no
  // daily/weekly/per-offering breakdown for now — see the file-level note
  // for why) but the owner can now actually enter what they charged, so
  // revenueTotal moves at all. Previously this was hardcoded to 0, which
  // meant "Finish" never added anything to revenue no matter how many
  // bookings were completed. Price entry is a tiny inline step (not a
  // separate screen) since finishing a booking is the busy, high-frequency
  // action here — a modal or route change would slow down exactly the
  // moment §5's "কম scroll, বড় টগল" note is about.
  const startFinish = (bookingId) => {
    setError('');
    setPriceInput('');
    setPriceEntryFor(bookingId);
  };

  const confirmFinish = async (bookingId) => {
    setBusyId(bookingId);
    setError('');
    try {
      const price = Number(priceInput) || 0;
      await finishBooking(serviceId, bookingId, price);
      setPriceEntryFor(null);
    } catch (e) {
      setError(e.message || 'সমস্যা হয়েছে।');
    } finally {
      setBusyId(null);
    }
  };

  const doCancel = async (bookingId) => {
    setBusyId(bookingId);
    setError('');
    try {
      await cancelBooking(serviceId, bookingId, 'owner');
    } catch (e) {
      setError(e.message || 'সমস্যা হয়েছে।');
    } finally {
      setBusyId(null);
    }
  };

  if (bookings === null || bookings.length === 0) return null;

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
        Confirmed ({bookings.length})
      </div>
      {error && <div style={{ fontSize: 12.5, color: 'var(--danger, #dc2626)', marginBottom: 8 }}>{error}</div>}
      {bookings.map((b) => (
        <div key={b.id} style={{ padding: 12, borderRadius: 12, marginBottom: 8, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{b.studentName || 'Student'}</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{offeringLabel(b.offeringId)}</div>
          {b.confirmedSlot && (
            <div style={{ fontSize: 12.5, color: 'var(--accent)', fontWeight: 700, marginTop: 4 }}>
              Slot: {b.confirmedSlot.date} at {b.confirmedSlot.time}
            </div>
          )}
          {priceEntryFor === b.id ? (
            <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
              <input
                type="number"
                inputMode="numeric"
                autoFocus
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                placeholder="৳ মূল্য"
                style={{
                  width: 90, minHeight: 46, padding: '0 12px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--card)',
                  color: 'var(--text)', fontSize: 15,
                }}
              />
              <button
                onClick={() => confirmFinish(b.id)}
                disabled={busyId === b.id}
                className="btn btn-primary"
                style={{ flex: 1, minHeight: 46, fontSize: 14.5, fontWeight: 700 }}
              >
                সম্পন্ন করুন
              </button>
              <button
                onClick={() => setPriceEntryFor(null)}
                disabled={busyId === b.id}
                className="btn btn-secondary"
                style={{ minHeight: 46, minWidth: 46, fontSize: 14.5, fontWeight: 700 }}
              >
                <XIcon size={16} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => startFinish(b.id)} disabled={busyId === b.id} className="btn btn-primary" style={{ flex: 1, minHeight: 46, fontSize: 14.5, fontWeight: 700 }}>
                Finish
              </button>
              <button onClick={() => doCancel(b.id)} disabled={busyId === b.id} className="btn btn-secondary" style={{ flex: 1, minHeight: 46, fontSize: 14.5, fontWeight: 700 }}>
                No-show / বাতিল
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function OfferingsManager({ service }) {
  const [offerings, setOfferings] = useState(service.offerings || []);
  const [newLabel, setNewLabel] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => setOfferings(service.offerings || []), [service.offerings]);

  const save = async (next) => {
    setSaving(true);
    try {
      await setServiceOfferings(service.id, next);
      setOfferings(next);
    } finally {
      setSaving(false);
    }
  };

  const addOffering = () => {
    if (!newLabel.trim()) return;
    const next = [...offerings, { id: addOfferingId(), label: newLabel.trim(), isAvailable: true }];
    setNewLabel('');
    save(next);
  };

  const toggleOffering = (id) => {
    const next = offerings.map((o) => (o.id === id ? { ...o, isAvailable: !o.isAvailable } : o));
    save(next);
  };

  const removeOffering = (id) => {
    // Removing an offering entirely (not just turning it off) is fine
    // here because Gap 5 only requires that EXISTING bookings referencing
    // an offeringId stay intact — those bookings keep their offeringId
    // string regardless of whether the offerings array still lists it;
    // ProviderDashboard's offeringLabel() falls back to "Unknown offering"
    // for exactly that case.
    save(offerings.filter((o) => o.id !== id));
  };

  return (
    <div>
      {offerings.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>এখনো কোনো offering যোগ করা হয়নি।</div>
      )}

      {offerings.map((o) => (
        <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
          <span style={{ flex: 1, fontSize: 14, color: 'var(--text)', opacity: o.isAvailable ? 1 : 0.5 }}>{o.label}</span>
          <button
            onClick={() => toggleOffering(o.id)}
            disabled={saving}
            style={{
              minHeight: 40, minWidth: 56, padding: '0 14px', borderRadius: 10, border: 'none',
              fontSize: 13, fontWeight: 800, cursor: 'pointer',
              background: o.isAvailable ? '#16a34a' : '#6b7280', color: '#fff',
            }}
          >
            {o.isAvailable ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={() => removeOffering(o.id)}
            disabled={saving}
            className="btn btn-secondary"
            style={{ minHeight: 40, minWidth: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="নতুন offering (যেমন: Haircut)"
          style={{
            flex: 1, minHeight: 44, padding: '0 12px', borderRadius: 10,
            border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 14,
          }}
        />
        <button
          onClick={addOffering}
          disabled={saving}
          className="btn btn-primary"
          style={{ minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}

function ServiceDetailsEditor({ service }) {
  const [name, setName] = useState(service.name || '');
  const [description, setDescription] = useState(service.description || '');
  const [priceNote, setPriceNote] = useState(service.priceNote || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName(service.name || '');
    setDescription(service.description || '');
    setPriceNote(service.priceNote || '');
  }, [service.id, service.name, service.description, service.priceNote]);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await updateServiceDetails(service.id, { name, description, priceNote });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Field label="নাম" value={name} onChange={setName} />
        <Field label="বর্ণনা" value={description} onChange={setDescription} textarea />
        <Field label="মূল্য নোট" value={priceNote} onChange={setPriceNote} />
      </div>
      <button onClick={save} disabled={saving} className="btn btn-primary" style={{ marginTop: 12, minHeight: 44 }}>
        {saving ? 'সেভ হচ্ছে…' : 'সেভ করুন'}
      </button>
      {saved && <span style={{ marginLeft: 10, fontSize: 12, color: '#16a34a' }}>সেভ হয়েছে ✓</span>}
    </div>
  );
}

