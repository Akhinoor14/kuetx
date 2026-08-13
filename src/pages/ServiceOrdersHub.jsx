// ServiceOrdersHub.jsx
//
// PHASE 2 (SERVICES_OVERHAUL_PLAN_PROMPT.md). "My Orders" — the central
// hub page reached by tapping the special first-row card on Services.jsx
// (Level-1 listing). Shows every booking/inquiry/errand-request a
// signed-in student or faculty user has across EVERY shop, in one place,
// with cancel actions available inline — no need to open each shop's own
// page just to check status or cancel something.
//
// Data comes from serviceSync.js's subscribeAllMyBookings(uid, callback)
// (Phase 1) — one live cross-service query, already enriched with each
// record's shop name/category. This page's only job is to group/render
// that data and wire up the same cancel/close functions the per-shop
// page already uses (cancelBooking, cancelErrandRequest, closeInquiry) —
// no new mutation logic here, Phase 1 deliberately reused what existed.
//
// Record-kind detection: no separate "kind" field exists on the raw
// data (see Phase 1's note in the plan-prompt) — the shape itself
// disambiguates:
//   - errand request : has requesterUid + itemDescription
//   - inquiry         : has items[] + replyText (both keys present, even if null)
//   - booking         : everything else (has offeringId)
//
// Written in English throughout (this is new code — Phase 7's later
// English-copy sweep is for EXISTING Bangla strings elsewhere in the
// services module, not a reason to write this file in Bangla first).

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, Clock, HelpCircle, Bike, X } from 'lucide-react';
import { auth } from '../lib/firebase';
import {
  subscribeAllMyBookings, cancelBooking, cancelErrandRequest, closeInquiry, subscribeService,
} from '../lib/serviceSync';
import Modal from '../components/Modal';
import { MyActiveBooking, MyActiveInquiry, MyActiveErrand } from './ServiceDetail';

function recordKind(rec) {
  if (Object.prototype.hasOwnProperty.call(rec, 'requesterUid')) return 'errand';
  if (Object.prototype.hasOwnProperty.call(rec, 'items') && Object.prototype.hasOwnProperty.call(rec, 'replyText')) return 'inquiry';
  return 'booking';
}

// Simple English status labels — mirrors ServiceDetail.jsx's
// STATUS_LABEL/INQUIRY_STATUS_LABEL/ERRAND_STATUS_LABEL maps but in
// English (this page follows the owner's explicit English-only
// instruction for the services module; ServiceDetail.jsx's own Bangla
// labels get swept separately in Phase 7).
const STATUS_TEXT = {
  booking: {
    pending: 'Waiting for shop to confirm',
    confirmed: 'Confirmed',
    done: 'Completed',
    cancelled: 'Cancelled',
    expired_shop_closed: 'Cancelled — shop closed',
  },
  inquiry: {
    open: 'Waiting for a reply',
    answered: 'Replied',
    closed: 'Closed',
  },
  errand: {
    open: 'Waiting for a Runner',
    runner_accepted: 'Runner accepted — confirm to proceed',
    confirmed: 'Confirmed',
    finished: 'Completed',
    cancelled: 'Cancelled',
  },
};

const ACTIVE_STATUSES = {
  booking: ['pending', 'confirmed'],
  inquiry: ['open', 'answered'],
  errand: ['open', 'runner_accepted', 'confirmed'],
};

const DONE_STATUSES = {
  booking: ['done'],
  inquiry: [], // inquiries end at 'closed', grouped with cancelled below for simplicity
  errand: ['finished'],
};

function groupBucket(kind, status) {
  if (ACTIVE_STATUSES[kind].includes(status)) return 'active';
  if (DONE_STATUSES[kind].includes(status)) return 'done';
  return 'closed'; // cancelled / closed / expired_shop_closed
}

const KIND_ICON = { booking: Clock, inquiry: HelpCircle, errand: Bike };
const KIND_LABEL = { booking: 'Booking', inquiry: 'Inquiry', errand: 'Delivery request' };

export default function ServiceOrdersHub() {
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid || null;
  const [records, setRecords] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  // Person requested: tapping a request card should open a modal (with
  // progress/status + edit/cancel/delete actions) right here on the Hub,
  // instead of navigating away to the shop's own page — this holds
  // which record (if any) is currently open in that modal.
  const [openRecord, setOpenRecord] = useState(null);

  useEffect(() => {
    if (!uid) {
      setRecords([]);
      return;
    }
    return subscribeAllMyBookings(uid, setRecords);
  }, [uid]);

  const grouped = useMemo(() => {
    const buckets = { active: [], done: [], closed: [] };
    (records || []).forEach((rec) => {
      const kind = recordKind(rec);
      const bucket = groupBucket(kind, rec.status);
      buckets[bucket].push({ ...rec, kind });
    });
    return buckets;
  }, [records]);

  // Keep the open modal's record in sync with live updates (e.g. a
  // Runner accepting while the modal is open should flip the status
  // shown inside it, not just in the card behind it) — re-derive from
  // the latest `records` on every change rather than freezing the
  // snapshot that was open when the modal was first triggered.
  useEffect(() => {
    if (!openRecord) return;
    const all = [...grouped.active, ...grouped.done, ...grouped.closed];
    const fresh = all.find((r) => r.id === openRecord.id && r.serviceId === openRecord.serviceId);
    if (fresh && fresh !== openRecord) setOpenRecord(fresh);
    if (!fresh) setOpenRecord(null); // e.g. deleted/cancelled and dropped from the list
  }, [grouped]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCancel = async (rec) => {
    setError('');
    setBusyId(rec.id);
    try {
      if (rec.kind === 'errand') {
        await cancelErrandRequest(rec.serviceId, rec.id);
      } else if (rec.kind === 'inquiry') {
        await closeInquiry(rec.serviceId, rec.id);
      } else {
        await cancelBooking(rec.serviceId, rec.id, 'student');
      }
    } catch (err) {
      setError(err?.message || 'Could not cancel this — please try again.');
    } finally {
      setBusyId(null);
    }
  };

  if (records === null) {
    return (
      <div className="page-enter page-container content-page-bg">
        <HubHeader navigate={navigate} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="card kuetx-orderhub-skeleton" style={{ padding: 16, height: 72 }} />
          ))}
        </div>
        <style>{`
          .kuetx-orderhub-skeleton { animation: kuetxOrderHubPulse 1.1s ease-in-out infinite; }
          @keyframes kuetxOrderHubPulse { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
        `}</style>
      </div>
    );
  }

  const isEmpty = grouped.active.length === 0 && grouped.done.length === 0 && grouped.closed.length === 0;

  return (
    <div className="page-enter page-container content-page-bg">
      <HubHeader navigate={navigate} />

      {error && (
        <div className="kx-hub-error">{error}</div>
      )}

      {isEmpty ? (
        <div className="card kx-hub-empty">
          <Package size={36} strokeWidth={1.5} />
          <div style={{ fontWeight: 700, marginTop: 10 }}>No orders yet</div>
          <div style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 4 }}>
            Anything you book, ask about, or request delivery for will show up here.
          </div>
        </div>
      ) : (
        <>
          <HubSection title="Active" records={grouped.active} onCancel={handleCancel} busyId={busyId} onOpen={setOpenRecord} />
          <HubSection title="Completed" records={grouped.done} onCancel={null} busyId={busyId} onOpen={setOpenRecord} />
          <HubSection title="Cancelled / Closed" records={grouped.closed} onCancel={null} busyId={busyId} onOpen={setOpenRecord} />
        </>
      )}

      {openRecord && (
        <Modal
          onClose={() => setOpenRecord(null)}
          contentStyle={{ width: 'min(440px, 100%)', maxHeight: '85vh', overflowY: 'auto' }}
        >
          <RecordDetailModal
            rec={openRecord}
            onClose={() => setOpenRecord(null)}
            onNavigateToShop={() => { setOpenRecord(null); navigate(`/services/${openRecord.serviceId}`); }}
          />
        </Modal>
      )}

      <style>{`
        .kx-hub-error {
          padding: 12px 14px; border-radius: 12px; margin-bottom: 14px;
          background: rgba(220,38,38,0.10); border: 1px solid rgba(220,38,38,0.30);
          color: var(--text); font-size: 13.5px;
        }
        .kx-hub-empty {
          padding: 40px 20px; text-align: center; color: var(--muted);
          display: flex; flex-direction: column; align-items: center;
        }
      `}</style>
    </div>
  );
}

function HubHeader({ navigate }) {
  return (
    <div className="kx-hub-header">
      <button onClick={() => navigate('/services')} className="kx-hub-back" aria-label="Back to Services">
        <ArrowLeft size={18} />
      </button>
      <div>
        <div className="kx-hub-title">My Orders</div>
        <div className="kx-hub-subtitle">Everything you've booked or asked about, across every shop</div>
      </div>
      <style>{`
        .kx-hub-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
        .kx-hub-back {
          width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: var(--card); border: 1px solid var(--border); color: var(--text); cursor: pointer;
        }
        .kx-hub-title { font-size: 20px; font-weight: 800; color: var(--text); letter-spacing: -0.01em; }
        .kx-hub-subtitle { font-size: 13px; color: var(--muted); margin-top: 2px; }
      `}</style>
    </div>
  );
}

function HubSection({ title, records, onCancel, busyId, onOpen }) {
  if (records.length === 0) return null;
  return (
    <div style={{ marginBottom: 22 }}>
      <div className="kx-hub-section-title">{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {records.map((rec) => (
          <HubRecordCard key={`${rec.serviceId}-${rec.id}`} rec={rec} onCancel={onCancel} busy={busyId === rec.id} onOpen={onOpen} />
        ))}
      </div>
      <style>{`
        .kx-hub-section-title {
          font-size: 12.5px; font-weight: 800; letter-spacing: 0.03em; text-transform: uppercase;
          color: var(--muted); margin-bottom: 10px;
        }
      `}</style>
    </div>
  );
}

function HubRecordCard({ rec, onCancel, busy, onOpen }) {
  const Icon = KIND_ICON[rec.kind] || Package;
  const statusText = STATUS_TEXT[rec.kind]?.[rec.status] || rec.status;
  const title = rec.kind === 'errand' ? rec.itemDescription : (rec.serviceName || 'Shop');
  // Progress fraction for the thin bar at the card's bottom edge — a
  // quick-glance "how far along is this" without opening the modal.
  // Terminal states (done/cancelled/closed) always read as 100% (the
  // request is no longer "in progress", it's finished one way or
  // another); active states step through each kind's own status order.
  const progress = recordProgress(rec.kind, rec.status);

  return (
    <div className="card kx-hub-card" onClick={() => onOpen(rec)}>
      {rec.kind === 'errand' && rec.itemImageUrl ? (
        <img src={rec.itemImageUrl} alt="" className="kx-hub-card-thumb" />
      ) : (
        <div className="kx-hub-card-icon"><Icon size={20} strokeWidth={1.75} /></div>
      )}
      <div className="kx-hub-card-body">
        <div className="kx-hub-card-top">
          <span className="kx-hub-card-kind">{KIND_LABEL[rec.kind]}</span>
          <span className="kx-hub-card-shop">{rec.serviceName || 'Shop'}</span>
        </div>
        <div className="kx-hub-card-title">{title}</div>
        <div className="kx-hub-card-status">{statusText}</div>
        <div className="kx-hub-card-progress-track">
          <div className="kx-hub-card-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
      {onCancel && (
        <button
          onClick={(e) => { e.stopPropagation(); onCancel(rec); }}
          disabled={busy}
          className="btn btn-sm btn-secondary kx-hub-card-cancel"
        >
          {busy ? 'Cancelling…' : 'Cancel'}
        </button>
      )}
      <style>{`
        .kx-hub-card {
          display: flex; align-items: flex-start; gap: 12px; padding: 14px;
          cursor: pointer; transition: border-color 0.15s ease;
        }
        .kx-hub-card:hover { border-color: rgba(var(--accentRGB), 0.35); }
        .kx-hub-card-icon {
          width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: var(--accentSoft); color: var(--accent);
        }
        .kx-hub-card-thumb {
          width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0; object-fit: cover;
          border: 1px solid var(--border);
        }
        .kx-hub-card-body { flex: 1; min-width: 0; }
        .kx-hub-card-top { display: flex; align-items: center; gap: 8px; margin-bottom: 2px; }
        .kx-hub-card-kind {
          font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em;
          color: var(--accent); background: var(--accentSoft); padding: 2px 8px; border-radius: 999px;
        }
        .kx-hub-card-shop { font-size: 12px; color: var(--muted); }
        .kx-hub-card-title { font-size: 14.5px; font-weight: 700; color: var(--text); margin-top: 2px; }
        .kx-hub-card-status { font-size: 12.5px; color: var(--muted); margin-top: 3px; }
        .kx-hub-card-cancel { flex-shrink: 0; align-self: center; }
        .kx-hub-card-progress-track {
          height: 4px; border-radius: 999px; background: var(--border); margin-top: 8px; overflow: hidden;
        }
        .kx-hub-card-progress-fill {
          height: 100%; background: var(--accent); border-radius: 999px; transition: width 0.2s ease;
        }
      `}</style>
    </div>
  );
}

// Coarse "how far along" percentage per kind+status, purely for the
// card's glanceable progress bar — not used for any logic decision.
function recordProgress(kind, status) {
  const STEPS = {
    booking: { pending: 33, confirmed: 66, done: 100, cancelled: 100, expired_shop_closed: 100 },
    inquiry: { open: 33, answered: 100, closed: 100 },
    errand: { open: 20, runner_accepted: 55, confirmed: 80, finished: 100, cancelled: 100 },
  };
  return STEPS[kind]?.[status] ?? 0;
}

// ---------------------------------------------------------------------
// Modal shown when a card is tapped — full detail + every action
// available for that record's kind, reusing the exact same
// MyActiveBooking/MyActiveInquiry/MyActiveErrand components the per-shop
// page (ServiceDetail.jsx) already renders inline, so there's exactly
// ONE place that owns each kind's status labels, edit form, and
// accept/confirm/cancel/finish buttons — this modal is just a new
// container around the same logic, not a second copy of it. Terminal
// records (done/cancelled/closed) show a simplified read-only summary
// instead, since those components assume an "active" record (e.g. they
// render a Cancel button that would be meaningless on something already
// finished).
// ---------------------------------------------------------------------
function RecordDetailModal({ rec, onClose, onNavigateToShop }) {
  const [service, setService] = useState(undefined); // undefined = loading, null = not found
  useEffect(() => {
    setService(undefined);
    const unsub = subscribeService(rec.serviceId, setService);
    return unsub;
  }, [rec.serviceId]);

  const isTerminal = groupBucket(rec.kind, rec.status) !== 'active';

  return (
    <div className="card kx-modal-card">
      <div className="kx-modal-header">
        <div>
          <div className="kx-modal-kind">{KIND_LABEL[rec.kind]}</div>
          <div className="kx-modal-shop">{rec.serviceName || 'Shop'}</div>
        </div>
        <button onClick={onClose} className="kx-modal-close" aria-label="Close">
          <X size={18} />
        </button>
      </div>

      {rec.kind === 'errand' && rec.itemImageUrl && (
        <img src={rec.itemImageUrl} alt="" className="kx-modal-image" />
      )}

      {isTerminal ? (
        <TerminalRecordSummary rec={rec} />
      ) : service === undefined ? (
        <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13.5 }}>Loading…</div>
      ) : rec.kind === 'errand' ? (
        <MyActiveErrand serviceId={rec.serviceId} errand={rec} />
      ) : rec.kind === 'inquiry' ? (
        <MyActiveInquiry serviceId={rec.serviceId} inquiry={rec} />
      ) : (
        <MyActiveBooking
          serviceId={rec.serviceId}
          booking={rec}
          providerUid={service?.providerUid}
          offerings={service?.offerings}
        />
      )}

      <button onClick={onNavigateToShop} className="btn btn-sm btn-secondary" style={{ width: '100%', marginTop: 12 }}>
        Open shop page
      </button>

      <style>{`
        .kx-modal-card { padding: 16px; }
        .kx-modal-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px; }
        .kx-modal-kind {
          font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em;
          color: var(--accent); background: var(--accentSoft); padding: 2px 8px; border-radius: 999px; display: inline-block;
        }
        .kx-modal-shop { font-size: 16px; font-weight: 800; color: var(--text); margin-top: 6px; }
        .kx-modal-close {
          width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: var(--card); border: 1px solid var(--border); color: var(--text); cursor: pointer;
        }
        .kx-modal-image {
          width: 100%; max-height: 220px; object-fit: cover; border-radius: 12px;
          border: 1px solid var(--border); margin-bottom: 12px;
        }
      `}</style>
    </div>
  );
}

function TerminalRecordSummary({ rec }) {
  const statusText = STATUS_TEXT[rec.kind]?.[rec.status] || rec.status;
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 13.5, color: 'var(--muted)', marginBottom: 8 }}>
        Status: <strong style={{ color: 'var(--text)' }}>{statusText}</strong>
      </div>
      {rec.kind === 'errand' && (
        <>
          <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 6 }}>{rec.itemDescription}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
            {rec.proposedPrice > 0 ? `৳${rec.proposedPrice}` : 'Free request'}
          </div>
        </>
      )}
      {rec.kind === 'inquiry' && rec.replyText && (
        <div style={{ fontSize: 13, color: 'var(--text)' }}>{rec.replyText}</div>
      )}
    </div>
  );
}
