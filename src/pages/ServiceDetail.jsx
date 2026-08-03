// ServiceDetail.jsx
//
// PHASE 2 (SERVICES_PROVIDER_PLAN.md §6). Detail page reached from
// Services.jsx. Display order is exactly the spec's: title -> price ->
// description. Booking form uses native <input type="date"> /
// <input type="time"> for preferredTime — structured, never free text
// (Gap 10) — and preferredTime itself stays fully optional.
//
// MULTI_CATEGORY_SERVICES_PLAN.md Phase 4 additions: branches on
// service.interactionMode. 'booking' keeps the original BookingForm
// untouched below. 'inquiry' renders the new InquiryForm — multi-item
// select + quantity stepper + optional free-text question, all folded
// into one createBooking({ items, question }) call (Phase 2's single
// entry point, no new collection). Also added here: cover/offering
// image gallery, locationText/hasDelivery badges, and a non-blocking
// dormant banner (student can still view + submit an inquiry/booking
// while dormant — the plan is explicit dormant never blocks the page).
//
// PHASE 4 (SERVICES_OVERHAUL_PLAN_PROMPT.md): visual polish pass only.
// - Cover image became a small image-gallery + thumbnail strip
//   (`GalleryMedia` below), sourced from the service's own cover image
//   plus every available offering's first image — this degrades
//   gracefully to a single static image (no thumbnail strip at all)
//   when a service has one or zero images, per Phase 0's recorded
//   decision, since most KUETx services only have a cover image today.
// - A small top-right icon button (Package icon, doubles as "My
//   Orders" shortcut — the closest sane equivalent to a cart icon for
//   an appointment/inquiry-based marketplace, since these services
//   aren't a shopping-cart checkout flow) was added to the page header.
// - Colour/quantity-style variant selectors were explicitly skipped
//   per Phase 0 — KUETx services are appointment/inquiry-based, not
//   colour-variant physical products, so there's nothing for that kind
//   of selector to attach to.
// - Everything below this point that touches booking/inquiry/errand
//   STATE or MUTATIONS (BookingForm, InquiryForm, ErrandForm,
//   MyActiveBooking, MyActiveInquiry, MyActiveErrand, and every
//   createBooking/cancelBooking/createErrandRequest/etc. call) is
//   untouched — this phase is a layout/visual wrapper only, per the
//   plan's explicit "do NOT rewrite the booking state machine" scope.
// - `.kx-offering-grid` / `.kx-pick-grid`'s auto-fill + minmax(min,max)
//   grid-template-columns (the previously-fixed layout bug) was left
//   exactly as-is — verified still present, not regressed.

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Store, Circle, MapPin, Truck, Minus, Plus, ExternalLink, ImageOff, Check, Package,
  Phone, Copy,
} from 'lucide-react';
import { auth } from '../lib/firebase';
import { getProfile } from '../store/store';
import { getAccountRole } from '../lib/accountRole';
import { getFacultyProfile } from '../lib/facultySync';
import {
  subscribeService, createBooking, subscribeMyBookingsForService, cancelBooking,
  closeInquiry, withServiceDefaults,
  // Phase 4 (Delivery/Errand Runner plan §4.2-§4.5): errand-mode entry
  // points. UI-only addition — all of these were already written and
  // tested in serviceSync.js; this file just wires them up.
  createErrandRequest, subscribeMyErrandRequestsForService, subscribeAllServices,
  editErrandProposedPrice, confirmErrandRequest, rejectErrandAccept,
  cancelErrandRequest, finishErrandRequest,
} from '../lib/serviceSync';
import { getProviderPhone } from '../lib/providerSync';
import { renderFormattedNoticeBody } from '../lib/noticeFormat.jsx';

const STATUS_LABEL = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  done: 'Completed',
  cancelled: 'Cancelled',
  expired_shop_closed: 'Cancelled — shop closed',
};

const INQUIRY_STATUS_LABEL = {
  open: 'Pending — waiting for reply',
  answered: 'Answered',
  closed: 'Closed',
};

// Phase 4 (plan §4): errand request status labels — mirrors the state
// machine in serviceSync.js's createErrandRequest/acceptErrandRequest/
// confirmErrandRequest/finishErrandRequest comments exactly.
const ERRAND_STATUS_LABEL = {
  open: 'Pending — no Runner has accepted yet',
  runner_accepted: 'A Runner has accepted — please confirm',
  confirmed: 'Confirmed',
  finished: 'Completed',
  cancelled: 'Cancelled',
};

export default function ServiceDetail() {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const [service, setService] = useState(undefined); // undefined = loading, null = not found
  const [myBookings, setMyBookings] = useState(null);
  // Owner decision (Aug 2026): the shop's contact number should always be
  // visible on this page — not gated behind a confirmed booking anymore
  // (see firestore.rules' contact/phone read rule, opened to any
  // signed-in user). Fetched as soon as we know the providerUid, same as
  // MyActiveBooking/MyActiveErrand's own getProviderPhone() calls below,
  // just no longer conditional on booking status.
  const [shopPhone, setShopPhone] = useState('');

  useEffect(() => subscribeService(serviceId, (s) => setService(s ? withServiceDefaults(s) : s)), [serviceId]);

  useEffect(() => {
    if (!service?.providerUid) return;
    getProviderPhone(service.providerUid).then(setShopPhone).catch(() => {});
  }, [service?.providerUid]);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return undefined;
    // Phase 4 (plan §4.2): errand-mode services store requests in the same
    // bookings subcollection, but subscribeMyBookingsForService's query
    // shape doesn't match errand fields — use the dedicated subscriber
    // once we know the service's mode.
    if (service && service.interactionMode === 'errand') {
      return subscribeMyErrandRequestsForService(serviceId, uid, setMyBookings);
    }
    return subscribeMyBookingsForService(serviceId, uid, setMyBookings);
  }, [serviceId, service?.interactionMode]);

  if (service === undefined) {
    return <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>;
  }

  if (service === null) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>
        This service couldn't be found.
        <div style={{ marginTop: 12 }}>
          <button onClick={() => navigate('/services')} className="btn btn-sm">Back to Services</button>
        </div>
      </div>
    );
  }

  const isInquiryMode = service.interactionMode === 'inquiry';
  const isErrandMode = service.interactionMode === 'errand';
  const isDormant = service.status === 'dormant';

  const activeBooking = !isInquiryMode && !isErrandMode
    ? (myBookings || []).find((b) => b.status === 'pending' || b.status === 'confirmed')
    : null;
  const activeInquiry = isInquiryMode
    ? (myBookings || []).find((b) => b.status === 'open' || b.status === 'answered')
    : null;
  // Phase 4 (plan §4): "one active request" — open/runner_accepted/confirmed
  // all count as active, mirroring createErrandRequest's own active-check.
  const activeErrand = isErrandMode
    ? (myBookings || []).find((b) => ['open', 'runner_accepted', 'confirmed'].includes(b.status))
    : null;

  // PHASE 4 (SERVICES_OVERHAUL_PLAN_PROMPT.md): gallery images — cover
  // image first (if present), then every available offering's images
  // (a provider can attach up to 3 per offering, see
  // ProviderOfferingDetailPage.jsx's MAX_OFFERING_IMAGES — originally
  // this only pulled each offering's FIRST image, silently dropping
  // any 2nd/3rd photo a provider had uploaded; fixed to flatten all of
  // them in), de-duplicated. Purely presentational; doesn't touch any
  // offering/booking data.
  const galleryImages = [
    service.coverImageUrl,
    ...(service.offerings || [])
      .filter((o) => o.isAvailable)
      .flatMap((o) => (Array.isArray(o.images) ? o.images : [])),
  ].filter(Boolean).filter((url, idx, arr) => arr.indexOf(url) === idx);

  return (
    <div className="kx-detail-page">
      <div className="kx-detail-topbar">
        {/* PHASE 5 (SERVICES_OVERHAUL_PLAN_PROMPT.md): the "← Services"
            back-link that used to live here was removed per the owner's
            explicit request. The row now holds only the "My Orders"
            shortcut on the right; kept as a flex row (justify-content:
            flex-end) rather than collapsing to a single centered button,
            so a future left-side element can be added again without
            another layout rewrite. */}
        {/* PHASE 4: small top-right icon button — the closest sane
            equivalent to an e-commerce "cart" icon for an appointment/
            inquiry-based marketplace (no shopping cart concept exists
            here); links to the "My Orders" hub so a student can jump
            straight to their cross-shop order list from any shop page. */}
        <button onClick={() => navigate('/services/orders')} className="kx-detail-cart-btn" title="My Orders" aria-label="My Orders">
          <Package size={18} strokeWidth={1.9} />
        </button>
      </div>

      <div className="kx-detail-layout">
        {/* ── Left column: media + info ─────────────────────────────── */}
        <div className="kx-detail-info">
          <GalleryMedia images={galleryImages} name={service.name} />

          <div className="kx-detail-titlebar">
            {/* title (§6 order: title -> price -> description) */}
            <div className="kx-detail-title">{service.name}</div>
            <div className="kx-detail-status">
              <Circle size={9} fill={service.isOpen ? '#16a34a' : '#9ca3af'} color={service.isOpen ? '#16a34a' : '#9ca3af'} />
              <span style={{ color: service.isOpen ? '#16a34a' : 'var(--muted)' }}>
                {service.isOpen ? 'Open now' : 'Closed now'}
              </span>
            </div>
          </div>

          {/* Phase 4: locationText / hasDelivery badges */}
          {(service.locationText || service.hasDelivery
            || (typeof service.locationLat === 'number' && typeof service.locationLng === 'number')) && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              {service.locationText && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600,
                  color: 'var(--muted)', background: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: 999, padding: '4px 10px',
                }}
                >
                  <MapPin size={12} /> {service.locationText}
                </span>
              )}
              {/* SHOP_LOCATION_AND_UPCOMING_FEATURES_PLAN.md Phase 2: GPS
                  coordinate, if the provider has set one, gets a small
                  "View on map" link that opens Google Maps in a new tab —
                  no API key needed. Silently absent when the provider hasn't
                  added GPS yet (locationText badge alone still shows), same
                  "no negative empty-state" pattern as locationText itself. */}
              {typeof service.locationLat === 'number' && typeof service.locationLng === 'number' && (
                <a
                  href={`https://www.google.com/maps?q=${service.locationLat},${service.locationLng}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600,
                    color: 'var(--accent)', background: 'var(--accentSoft)', borderRadius: 999,
                    padding: '4px 10px', textDecoration: 'none',
                  }}
                >
                  View on map <ExternalLink size={11} />
                </a>
              )}
              {service.hasDelivery && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600,
                  color: 'var(--accent)', background: 'var(--accentSoft)', borderRadius: 999, padding: '4px 10px',
                }}
                >
                  <Truck size={12} /> Home delivery available
                </span>
              )}
            </div>
          )}

          {/* Phase 4: dormant banner — informational only, never blocks the page */}
          {isDormant && <DormantInfoBanner service={service} />}

          {/* price */}
          {service.priceNote && (
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 10 }}>{service.priceNote}</div>
          )}

          {/* description */}
          {service.description && (
            <div style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.7 }}>
              {renderFormattedNoticeBody(service.description)}
            </div>
          )}
        </div>

        {/* ── Right column: booking / inquiry / errand form ─────────── */}
        <div className="kx-detail-action">
          {myBookings === null ? null : isErrandMode ? (
            activeErrand ? (
              <MyActiveErrand serviceId={serviceId} errand={activeErrand} />
            ) : (
              <ErrandForm service={service} />
            )
          ) : isInquiryMode ? (
            activeInquiry ? (
              <MyActiveInquiry serviceId={serviceId} inquiry={activeInquiry} providerUid={service.providerUid} />
            ) : (
              <InquiryForm service={service} />
            )
          ) : activeBooking ? (
            <MyActiveBooking serviceId={serviceId} booking={activeBooking} providerUid={service.providerUid} />
          ) : (
            <BookingForm service={service} />
          )}
        </div>
      </div>

      {shopPhone && <FloatingContactButton phone={shopPhone} shopName={service.name} />}

      <style>{`
        .kx-detail-page { padding: 20px 16px 40px; width: 100%; max-width: 1180px; margin: 0 auto; box-sizing: border-box; }
        .kx-detail-topbar { display: flex; align-items: center; justify-content: flex-end; gap: 10px; margin-bottom: 16px; }
        .kx-detail-cart-btn {
          width: 38px; height: 38px; border-radius: 12px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          border: 1px solid var(--border); background: var(--card); color: var(--text);
          cursor: pointer; transition: border-color 0.15s ease, background 0.15s ease;
        }
        .kx-detail-cart-btn:hover { border-color: rgba(var(--accentRGB), 0.4); background: var(--accentSoft); color: var(--accent); }

        .kx-detail-layout { display: grid; grid-template-columns: 1fr; gap: 24px; width: 100%; align-items: start; }

        .kx-detail-info { min-width: 0; }
        .kx-detail-action { min-width: 0; }

        .kx-detail-titlebar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
        .kx-detail-title { font-size: 24px; font-weight: 800; color: var(--text); letter-spacing: -0.01em; }
        .kx-detail-status { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; }

        @media (min-width: 900px) {
          .kx-detail-layout { grid-template-columns: minmax(0, 1.4fr) minmax(320px, 1fr); gap: 32px; }
          .kx-detail-action { position: sticky; top: 20px; }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------
// PHASE 4 (SERVICES_OVERHAUL_PLAN_PROMPT.md): image gallery + thumbnail
// strip, e-commerce-detail-page style. Purely presentational — takes a
// flat array of image URLs (already deduped/filtered by the caller) and
// renders a big active image with a thumbnail row beneath it. Degrades
// to a single static image (no thumbnails) for 0 or 1 images, and to
// the same store-icon placeholder as before when there are none at all,
// so this never looks broken for the majority of today's services that
// only have a cover image.
// ---------------------------------------------------------------------

function GalleryMedia({ images, name }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const hasImages = images.length > 0;
  const activeUrl = hasImages ? images[Math.min(activeIndex, images.length - 1)] : null;

  return (
    <div className="kx-gallery">
      <div className="kx-gallery-main">
        {activeUrl ? (
          <img src={activeUrl} alt={name} />
        ) : (
          <div className="kx-gallery-placeholder">
            <Store size={48} color="var(--accent)" strokeWidth={1.4} />
          </div>
        )}
      </div>

      {images.length > 1 && (
        <div className="kx-gallery-thumbs">
          {images.map((url, i) => (
            <button
              key={url + i}
              type="button"
              onClick={() => setActiveIndex(i)}
              className={`kx-gallery-thumb${i === activeIndex ? ' is-active' : ''}`}
            >
              <img src={url} alt={`${name} ${i + 1}`} />
            </button>
          ))}
        </div>
      )}

      <style>{`
        .kx-gallery { margin-bottom: 16px; }
        .kx-gallery-main {
          width: 100%; aspect-ratio: 16 / 9; max-height: 380px; border-radius: 18px;
          border: 1px solid var(--border); overflow: hidden;
        }
        .kx-gallery-main img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .kx-gallery-placeholder {
          width: 100%; height: 100%; background: var(--accentSoft);
          display: flex; align-items: center; justify-content: center;
        }
        .kx-gallery-thumbs {
          display: flex; gap: 8px; margin-top: 8px; overflow-x: auto; padding-bottom: 2px;
        }
        .kx-gallery-thumb {
          flex-shrink: 0; width: 56px; height: 56px; border-radius: 10px; overflow: hidden;
          border: 2px solid transparent; padding: 0; cursor: pointer; background: var(--accentSoft);
          transition: border-color 0.15s ease, opacity 0.15s ease;
          opacity: 0.65;
        }
        .kx-gallery-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .kx-gallery-thumb.is-active { border-color: var(--accent); opacity: 1; }

        @media (min-width: 900px) {
          .kx-gallery-main { max-height: 420px; }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------
// FloatingContactButton — Aug 2026 owner request: the shop's phone
// number should always be visible on this page, no booking required.
// Renders as a small floating pill fixed to the bottom-right of the
// viewport. Collapsed state just shows a phone icon; tapping it expands
// to show the number plus two actions — "Call" (tel: link, works for
// WhatsApp-registered numbers too since most students just tap-to-call)
// and "Copy" (clipboard, with a brief confirmation) — since either might
// be what a given student wants and there's no way to know which in
// advance. Purely presentational; doesn't touch booking/inquiry state.
// ---------------------------------------------------------------------

function FloatingContactButton({ phone, shopName }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable/denied — Copy button silently no-ops,
      // Call still works as a fallback either way.
    }
  };

  return (
    <div className="kx-fab-wrap">
      {expanded && (
        <div className="kx-fab-panel card">
          <div className="kx-fab-label">{shopName}</div>
          <div className="kx-fab-number">{phone}</div>
          <div className="kx-fab-actions">
            <a href={`tel:${phone}`} className="btn btn-primary btn-sm kx-fab-action">
              <Phone size={13} /> Call
            </a>
            <button onClick={doCopy} className="btn btn-secondary btn-sm kx-fab-action">
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setExpanded((v) => !v)}
        className="kx-fab-btn"
        aria-label="Shop contact number"
        title="Shop contact number"
      >
        <Phone size={20} strokeWidth={2} />
      </button>

      <style>{`
        .kx-fab-wrap { position: fixed; right: 18px; bottom: 22px; z-index: 40; display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
        .kx-fab-btn {
          width: 52px; height: 52px; border-radius: 50%; border: none; cursor: pointer;
          background: var(--accent); color: #fff; display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 16px rgba(0,0,0,0.22); transition: transform 0.15s ease;
        }
        .kx-fab-btn:hover { transform: scale(1.06); }
        .kx-fab-panel {
          padding: 12px 14px; border-radius: 14px; min-width: 200px; max-width: 260px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.18);
        }
        .kx-fab-label { font-size: 11.5px; font-weight: 700; color: var(--muted); margin-bottom: 2px; overflow-wrap: break-word; }
        .kx-fab-number { font-size: 15px; font-weight: 800; color: var(--text); margin-bottom: 10px; letter-spacing: 0.02em; }
        .kx-fab-actions { display: flex; gap: 8px; }
        .kx-fab-action { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 5px; text-decoration: none; }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------
// MULTI_CATEGORY_SERVICES_PLAN.md Phase 4 additions below: dormant
// banner (student-facing, informational-only per the plan), the
// student's own active-inquiry status view, and the multi-item
// InquiryForm itself.
// ---------------------------------------------------------------------

function DormantInfoBanner({ service }) {
  return (
    <div
      className="card"
      style={{
        padding: 12, borderRadius: 12, background: 'rgba(234,88,12,0.10)',
        border: '1px solid rgba(234,88,12,0.35)', marginBottom: 14,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, color: '#c2410c' }}>
        This shop is currently inactive
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, lineHeight: 1.6 }}>
        {service.dormantReason === 'auto' && 'It was automatically marked inactive after a long period with no updates.'}
        {service.dormantReason === 'manual_temporary' && 'The owner has temporarily closed this shop.'}
        {service.dormantReason === 'manual_permanent' && 'The owner has permanently closed this shop.'}
        {!service.dormantReason && 'This shop is currently marked as low-activity.'}
      </div>
    </div>
  );
}

function MyActiveInquiry({ serviceId, inquiry }) {
  const [closing, setClosing] = useState(false);

  const doClose = async () => {
    setClosing(true);
    try {
      await closeInquiry(serviceId, inquiry.id);
    } finally {
      setClosing(false);
    }
  };

  const total = (inquiry.items || []).reduce(
    (sum, item) => (typeof item.price === 'number' ? sum + item.price * item.quantity : sum),
    0,
  );
  const hasAnyPrice = (inquiry.items || []).some((item) => typeof item.price === 'number');

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Your inquiry</div>
      <div style={{ fontSize: 13.5, color: 'var(--muted)', marginBottom: 8 }}>
        Status: <strong style={{ color: 'var(--text)' }}>{INQUIRY_STATUS_LABEL[inquiry.status] || inquiry.status}</strong>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
        {(inquiry.items || []).map((item) => (
          <div key={item.offeringId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: 'var(--text)' }}>{item.label} × {item.quantity}</span>
            {typeof item.price === 'number' && (
              <span style={{ color: 'var(--muted)' }}>৳{item.price * item.quantity}</span>
            )}
          </div>
        ))}
      </div>

      {hasAnyPrice && (
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 8 }}>
          Total (estimated): ৳{total}
        </div>
      )}

      {inquiry.question && (
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 8, fontStyle: 'italic' }}>
          &ldquo;{inquiry.question}&rdquo;
        </div>
      )}

      {inquiry.status === 'answered' && inquiry.replyText && (
        <div style={{
          fontSize: 13, color: 'var(--text)', background: 'var(--accentSoft)', borderRadius: 10,
          padding: 10, marginBottom: 8, lineHeight: 1.6,
        }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>Shop's reply</div>
          {inquiry.replyText}
        </div>
      )}

      <button onClick={doClose} disabled={closing} className="btn btn-sm btn-secondary" style={{ marginTop: 4 }}>
        {closing ? 'Closing…' : 'Close this request'}
      </button>
    </div>
  );
}

function InquiryForm({ service }) {
  const profile = getProfile();
  // Faculty gap fix (Aug 2026): same missing-prefill issue as
  // BookingForm — InquiryForm only ever read the student profile store.
  const isFaculty = getAccountRole() === 'teacher';
  const [requesterName, setRequesterName] = useState(isFaculty ? '' : (profile?.name || ''));
  const [studentPhone, setStudentPhone] = useState('');
  const [quantities, setQuantities] = useState({}); // offeringId -> quantity
  const [question, setQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!isFaculty) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    getFacultyProfile(uid).then((fdoc) => {
      if (fdoc) {
        setRequesterName((prev) => prev || fdoc.name || '');
        setStudentPhone((prev) => prev || fdoc.phone || '');
      }
    }).catch(() => {});
  }, [isFaculty]);

  const availableOfferings = (service.offerings || []).filter((o) => o.isAvailable);

  const setQty = (offeringId, qty) => {
    setQuantities((prev) => {
      const next = { ...prev };
      if (qty <= 0) {
        delete next[offeringId];
      } else {
        next[offeringId] = qty;
      }
      return next;
    });
  };

  const selectedItems = availableOfferings
    .filter((o) => quantities[o.id] > 0)
    .map((o) => ({
      offeringId: o.id,
      label: o.label,
      price: typeof o.price === 'number' ? o.price : null,
      quantity: quantities[o.id],
    }));

  const total = selectedItems.reduce(
    (sum, item) => (typeof item.price === 'number' ? sum + item.price * item.quantity : sum),
    0,
  );
  const hasAnyPrice = selectedItems.some((item) => typeof item.price === 'number');

  const submit = async () => {
    setError('');
    if (!service.isOpen) {
      setError('Shop is closed right now — you can\'t send a request.');
      return;
    }
    if (selectedItems.length === 0) {
      setError('Please select at least one item.');
      return;
    }
    if (!studentPhone.trim()) {
      setError('Please enter a phone number.');
      return;
    }
    if (isFaculty && !requesterName.trim()) {
      setError('Please enter your name.');
      return;
    }

    setSubmitting(true);
    try {
      await createBooking(service.id, {
        studentUid: auth.currentUser.uid,
        studentName: isFaculty ? requesterName : (profile?.name || ''),
        studentPhone,
        items: selectedItems,
        question,
      });
      setDone(true);
    } catch (e) {
      setError(e.message || 'Something went wrong sending this.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="card" style={{ padding: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#16a34a' }}>Inquiry sent ✓</div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 6 }}>
          You'll see the shop's reply here once they respond.
        </div>
      </div>
    );
  }

  if (!service.isOpen) {
    return (
      <div className="card" style={{ padding: 16, textAlign: 'center', fontSize: 13.5, color: 'var(--muted)' }}>
        Shop is closed right now — you'll be able to send an inquiry once it's open.
      </div>
    );
  }

  if (availableOfferings.length === 0) {
    return (
      <div className="card" style={{ padding: 16, textAlign: 'center', fontSize: 13.5, color: 'var(--muted)' }}>
        No items available right now.
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Select items</div>

      <div className="kx-offering-grid" style={{ marginBottom: 14 }}>
        {availableOfferings.map((o) => {
          const qty = quantities[o.id] || 0;
          const img = Array.isArray(o.images) && o.images[0];
          return (
            <div key={o.id} className={`kx-offering-card${qty > 0 ? ' is-selected' : ''}`}>
              <div className="kx-offering-media">
                {img ? <img src={img} alt={o.label} /> : <ImageOff size={22} color="var(--muted)" />}
              </div>
              <div className="kx-offering-body">
                <div className="kx-offering-name">{o.label}</div>
                {typeof o.price === 'number' && (
                  <div className="kx-offering-price">
                    ৳{o.price} <span>/ piece</span>
                  </div>
                )}
                <div className="kx-offering-stepper">
                  <button
                    type="button"
                    onClick={() => setQty(o.id, qty - 1)}
                    disabled={qty === 0}
                    className="btn btn-sm btn-secondary"
                    style={{ width: 30, height: 30, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Minus size={14} />
                  </button>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', minWidth: 18, textAlign: 'center' }}>{qty}</span>
                  <button
                    type="button"
                    onClick={() => setQty(o.id, qty + 1)}
                    className="btn btn-sm btn-secondary"
                    style={{ width: 30, height: 30, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .kx-offering-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 150px));
          gap: 10px;
        }
        .kx-offering-card {
          border: 1px solid var(--border); border-radius: 14px; overflow: hidden;
          background: var(--card); display: flex; flex-direction: column;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .kx-offering-card.is-selected { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
        .kx-offering-media {
          width: 100%; aspect-ratio: 1 / 1; background: var(--accentSoft);
          display: flex; align-items: center; justify-content: center; overflow: hidden;
        }
        .kx-offering-media img { width: 100%; height: 100%; object-fit: cover; }
        .kx-offering-body { padding: 10px; display: flex; flex-direction: column; gap: 6px; }
        .kx-offering-name { font-size: 13px; font-weight: 700; color: var(--text); line-height: 1.3; }
        .kx-offering-price { font-size: 12px; font-weight: 700; color: var(--accent); }
        .kx-offering-price span { color: var(--muted); font-weight: 400; }
        .kx-offering-stepper { display: flex; align-items: center; gap: 8px; margin-top: 2px; }
      `}</style>

      {hasAnyPrice && selectedItems.length > 0 && (
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 12 }}>
          Total (estimated): ৳{total}
        </div>
      )}

      {isFaculty && (
        <>
          <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Name</label>
          <input
            value={requesterName}
            onChange={(e) => setRequesterName(e.target.value)}
            style={{
              width: '100%', marginTop: 6, marginBottom: 12, padding: '10px 12px', borderRadius: 10,
              border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 14,
            }}
          />
        </>
      )}

      <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Phone number</label>
      <input
        value={studentPhone}
        onChange={(e) => setStudentPhone(e.target.value)}
        placeholder="01XXXXXXXXX"
        style={{
          width: '100%', marginTop: 6, marginBottom: 12, padding: '10px 12px', borderRadius: 10,
          border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 14,
        }}
      />

      <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Question / request (optional)</label>
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="e.g. any specific color/size preference, write it here"
        rows={3}
        style={{
          width: '100%', marginTop: 6, marginBottom: 12, padding: '10px 12px', borderRadius: 10,
          border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 14,
          resize: 'vertical', fontFamily: 'inherit',
        }}
      />

      {error && <div style={{ fontSize: 12.5, color: 'var(--danger, #dc2626)', marginBottom: 10 }}>{error}</div>}

      <button onClick={submit} disabled={submitting} className="btn btn-primary" style={{ width: '100%' }}>
        {submitting ? 'Sending…' : 'Send inquiry'}
      </button>
    </div>
  );
}

function MyActiveBooking({ serviceId, booking, providerUid }) {
  const [cancelling, setCancelling] = useState(false);
  // BUGFIX (missing shop phone number on confirmed bookings):
  // firestore.rules' providers/{uid}/contact/phone read rule already
  // allows this once a student has a 'confirmed' or 'done' booking
  // (§10) — that part was correct from Phase 2. What was missing was
  // ServiceDetail.jsx ever actually calling getProviderPhone() for
  // booking-mode services; only the errand-mode MyActiveErrand did.
  // Mirrors that component's same pattern exactly.
  const [shopPhone, setShopPhone] = useState('');

  useEffect(() => {
    if (!providerUid || (booking.status !== 'confirmed' && booking.status !== 'done')) return;
    getProviderPhone(providerUid).then(setShopPhone).catch(() => {});
  }, [providerUid, booking.status]);

  const doCancel = async () => {
    setCancelling(true);
    try {
      await cancelBooking(serviceId, booking.id, 'student');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Your booking</div>
      <div style={{ fontSize: 13.5, color: 'var(--muted)' }}>
        Status: <strong style={{ color: 'var(--text)' }}>{STATUS_LABEL[booking.status] || booking.status}</strong>
      </div>
      {booking.preferredTime && (
        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
          Preferred time: {booking.preferredTime.date} at {booking.preferredTime.time}
        </div>
      )}
      {booking.confirmedSlot && (
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginTop: 4 }}>
          Confirmed time: {booking.confirmedSlot.date} at {booking.confirmedSlot.time}
        </div>
      )}
      {shopPhone && (
        <div style={{
          fontSize: 13, color: 'var(--text)', background: 'var(--accentSoft)', borderRadius: 10,
          padding: 10, marginTop: 10,
        }}
        >
          Shop's phone number: <strong>{shopPhone}</strong>
        </div>
      )}
      <button onClick={doCancel} disabled={cancelling} className="btn btn-sm btn-secondary" style={{ marginTop: 12 }}>
        {cancelling ? 'Cancelling…' : 'Cancel booking'}
      </button>
    </div>
  );
}

function BookingForm({ service }) {
  const profile = getProfile();
  // Faculty gap fix (Aug 2026): BookingForm previously only ever read the
  // student profile store (getProfile()), which is empty/null for a
  // faculty account — so a faculty booking silently submitted with
  // studentName: ''. Mirrors ErrandForm's already-working isFaculty +
  // getFacultyProfile prefill pattern exactly.
  const isFaculty = getAccountRole() === 'teacher';
  const [requesterName, setRequesterName] = useState(isFaculty ? '' : (profile?.name || ''));
  const [offeringId, setOfferingId] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [wantsPreferredTime, setWantsPreferredTime] = useState(false);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  // Faculty name/phone live in a separate doc fetched async, unlike the
  // synchronous getProfile() student store — prefill once on mount, same
  // as ErrandForm.
  useEffect(() => {
    if (!isFaculty) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    getFacultyProfile(uid).then((fdoc) => {
      if (fdoc) {
        setRequesterName((prev) => prev || fdoc.name || '');
        setStudentPhone((prev) => prev || fdoc.phone || '');
      }
    }).catch(() => {});
  }, [isFaculty]);

  const availableOfferings = (service.offerings || []).filter((o) => o.isAvailable);
  // salon/hotel are the only two 'booking'-mode types (see
  // TYPE_TO_INTERACTION_MODE in serviceSync.js) — hotel here means food
  // vendors, so its per-unit price reads "/ plate" (per piece/plate)
  // rather than salon's "/ person" (per person).
  const priceUnitLabel = service.type === 'hotel' ? 'plate' : 'person';

  const submit = async () => {
    setError('');
    if (!service.isOpen) {
      setError('Shop is closed right now — you can\'t book at the moment.');
      return;
    }
    if (!offeringId) {
      setError('Please select an offering.');
      return;
    }
    if (!studentPhone.trim()) {
      setError('Please enter a phone number.');
      return;
    }
    if (isFaculty && !requesterName.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (wantsPreferredTime && (!date || !time)) {
      setError('Please provide both a date and time, or turn off the preferred time option.');
      return;
    }

    setSubmitting(true);
    try {
      await createBooking(service.id, {
        studentUid: auth.currentUser.uid,
        studentName: isFaculty ? requesterName : (profile?.name || ''),
        studentPhone,
        offeringId,
        preferredTime: wantsPreferredTime ? { date, time } : null,
      });
      setDone(true);
    } catch (e) {
      setError(e.message || 'Something went wrong booking this.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="card" style={{ padding: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#16a34a' }}>Booking sent ✓</div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 6 }}>
          You'll see it here once the owner confirms.
        </div>
      </div>
    );
  }

  if (!service.isOpen) {
    return (
      <div className="card" style={{ padding: 16, textAlign: 'center', fontSize: 13.5, color: 'var(--muted)' }}>
        Shop is closed right now — you'll be able to book once it's open.
      </div>
    );
  }

  if (availableOfferings.length === 0) {
    return (
      <div className="card" style={{ padding: 16, textAlign: 'center', fontSize: 13.5, color: 'var(--muted)' }}>
        No offerings available right now.
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Book now</div>

      <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Choose what you'd like</label>
      <div className="kx-pick-grid" style={{ marginTop: 8, marginBottom: 12 }}>
        {availableOfferings.map((o) => {
          const isSelected = offeringId === o.id;
          const coverUrl = Array.isArray(o.images) ? o.images[0] : null;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => setOfferingId(o.id)}
              className={`kx-pick-card${isSelected ? ' is-selected' : ''}`}
            >
              <div className="kx-pick-media">
                {coverUrl
                  ? <img src={coverUrl} alt={o.label} />
                  : <ImageOff size={22} color="var(--muted)" />}
                {isSelected && (
                  <div className="kx-pick-check">
                    <Check size={12} color="#fff" strokeWidth={3} />
                  </div>
                )}
              </div>
              <div className="kx-pick-body">
                <div className="kx-pick-name">{o.label}</div>
                {typeof o.price === 'number' && (
                  <div className="kx-pick-price">
                    ৳{o.price} <span>/ {priceUnitLabel}</span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <style>{`
        .kx-pick-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(110px, 140px));
          gap: 10px;
        }
        .kx-pick-card {
          text-align: left; cursor: pointer; border-radius: 14px; overflow: hidden;
          border: 1px solid var(--border); background: var(--card);
          display: flex; flex-direction: column;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .kx-pick-card.is-selected { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
        .kx-pick-media {
          position: relative; width: 100%; aspect-ratio: 1 / 1; background: var(--accentSoft, #f3f4f6);
          display: flex; align-items: center; justify-content: center; overflow: hidden;
        }
        .kx-pick-media img { width: 100%; height: 100%; object-fit: cover; }
        .kx-pick-check {
          position: absolute; top: 6px; right: 6px; width: 20px; height: 20px; border-radius: 50%;
          background: var(--accent); display: flex; align-items: center; justify-content: center;
        }
        .kx-pick-body { padding: 8px 9px 10px; display: flex; flex-direction: column; gap: 4px; }
        .kx-pick-name { font-size: 12.5px; font-weight: 700; color: var(--text); line-height: 1.3; }
        .kx-pick-price { font-size: 11.5px; font-weight: 700; color: var(--accent); }
        .kx-pick-price span { color: var(--muted); font-weight: 400; }
      `}</style>

      {isFaculty && (
        <>
          <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Name</label>
          <input
            value={requesterName}
            onChange={(e) => setRequesterName(e.target.value)}
            style={{
              width: '100%', marginTop: 6, marginBottom: 12, padding: '10px 12px', borderRadius: 10,
              border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 14,
            }}
          />
        </>
      )}

      <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Phone number</label>
      <input
        value={studentPhone}
        onChange={(e) => setStudentPhone(e.target.value)}
        placeholder="01XXXXXXXXX"
        style={{
          width: '100%', marginTop: 6, marginBottom: 12, padding: '10px 12px', borderRadius: 10,
          border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 14,
        }}
      />

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)', marginBottom: 10 }}>
        <input type="checkbox" checked={wantsPreferredTime} onChange={(e) => setWantsPreferredTime(e.target.checked)} />
        Want to give a preferred time? (optional)
      </label>

      {wantsPreferredTime && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{
            flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)',
            background: 'var(--card)', color: 'var(--text)', fontSize: 14,
          }}
          />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{
            flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)',
            background: 'var(--card)', color: 'var(--text)', fontSize: 14,
          }}
          />
        </div>
      )}

      {error && <div style={{ fontSize: 12.5, color: 'var(--danger, #dc2626)', marginBottom: 10 }}>{error}</div>}

      <button onClick={submit} disabled={submitting} className="btn btn-primary" style={{ width: '100%' }}>
        {submitting ? 'Sending…' : 'Book now'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------
// Phase 4 (Delivery/Errand Runner plan §4.2-§4.5): request form + status
// view for errand-mode services. Mirrors the Booking/Inquiry pair above —
// ErrandForm is the "not yet requested" state, MyActiveErrand covers all
// three active statuses (open / runner_accepted / confirmed) with the
// actions valid in each, per the plan's status-flow diagram.
// ---------------------------------------------------------------------

function MyActiveErrand({ serviceId, errand }) {
  const [editing, setEditing] = useState(false);
  const [newPrice, setNewPrice] = useState(String(errand.proposedPrice || ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // plan §4.4: contact exchange — the errand doc itself never stores the
  // Runner's phone (only acceptedByRunnerUid); once 'confirmed',
  // firestore.rules' hasConfirmedBookingWithProvider gate lets this
  // requester read providers/{uid}/contact/phone via getProviderPhone.
  const [runnerPhone, setRunnerPhone] = useState('');

  useEffect(() => {
    if (errand.status !== 'confirmed' || !errand.acceptedByRunnerUid) return;
    getProviderPhone(errand.acceptedByRunnerUid).then(setRunnerPhone).catch(() => {});
  }, [errand.status, errand.acceptedByRunnerUid]);

  const doSaveEdit = async () => {
    setError('');
    const price = Number(newPrice);
    if (!(price > 0)) {
      setError('Please enter a valid price.');
      return;
    }
    setBusy(true);
    try {
      await editErrandProposedPrice(serviceId, errand.id, price);
      setEditing(false);
    } catch (e) {
      setError(e.message || 'Something went wrong updating this.');
    } finally {
      setBusy(false);
    }
  };

  // plan §4.4: "✗ Reject" on a runner_accepted request sends it back
  // to open (re-broadcast), NOT a full withdrawal — distinct from the
  // §4.2 "withdraw an open request" cancel below.
  const doRejectAccept = async () => {
    setBusy(true);
    try {
      await rejectErrandAccept(serviceId, errand.id);
    } finally {
      setBusy(false);
    }
  };

  const doConfirm = async () => {
    setBusy(true);
    try {
      await confirmErrandRequest(serviceId, errand.id);
    } catch (e) {
      setError(e.message || 'Something went wrong confirming this.');
    } finally {
      setBusy(false);
    }
  };

  const doCancel = async () => {
    setBusy(true);
    try {
      await cancelErrandRequest(serviceId, errand.id);
    } finally {
      setBusy(false);
    }
  };

  const doFinish = async () => {
    setBusy(true);
    try {
      await finishErrandRequest(serviceId, errand.id);
    } catch (e) {
      setError(e.message || 'Something went wrong marking this done.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Your errand request</div>
      <div style={{ fontSize: 13.5, color: 'var(--muted)', marginBottom: 8 }}>
        Status: <strong style={{ color: 'var(--text)' }}>{ERRAND_STATUS_LABEL[errand.status] || errand.status}</strong>
      </div>

      <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>{errand.itemDescription}</div>

      {!editing ? (
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 10 }}>
          Proposed price: ৳{errand.proposedPrice}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input
            type="number"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            style={{
              flex: 1, padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border)',
              background: 'var(--card)', color: 'var(--text)', fontSize: 14,
            }}
          />
          <button onClick={doSaveEdit} disabled={busy} className="btn btn-sm btn-primary">Save</button>
          <button onClick={() => setEditing(false)} disabled={busy} className="btn btn-sm btn-secondary">Cancel</button>
        </div>
      )}

      {/* plan §4.4: contact exchange — the errand doc has no phone
          field, so this comes from a separate getProviderPhone() read
          gated by firestore.rules' hasConfirmedBookingWithProvider once
          'confirmed' (see the useEffect above). */}
      {errand.status === 'confirmed' && runnerPhone && (
        <div style={{
          fontSize: 13, color: 'var(--text)', background: 'var(--accentSoft)', borderRadius: 10,
          padding: 10, marginBottom: 10,
        }}
        >
          Runner's phone number: <strong>{runnerPhone}</strong>
        </div>
      )}

      {error && <div style={{ fontSize: 12.5, color: 'var(--danger, #dc2626)', marginBottom: 10 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {errand.status === 'open' && !editing && (
          <>
            <button onClick={() => setEditing(true)} disabled={busy} className="btn btn-sm btn-secondary">Change price</button>
            <button onClick={doCancel} disabled={busy} className="btn btn-sm btn-secondary">Cancel request</button>
          </>
        )}
        {errand.status === 'runner_accepted' && (
          <>
            <button onClick={doConfirm} disabled={busy} className="btn btn-sm btn-primary">✓ Yes, confirm</button>
            <button onClick={doRejectAccept} disabled={busy} className="btn btn-sm btn-secondary">✗ Reject</button>
          </>
        )}
        {errand.status === 'confirmed' && (
          <button onClick={doFinish} disabled={busy} className="btn btn-sm btn-primary">Mark as completed</button>
        )}
      </div>
    </div>
  );
}

function ErrandForm({ service }) {
  const profile = getProfile();
  const isFaculty = getAccountRole() === 'teacher';
  const [requesterName, setRequesterName] = useState(isFaculty ? '' : (profile?.name || ''));
  const [requesterPhone, setRequesterPhone] = useState(isFaculty ? '' : '');
  const [itemDescription, setItemDescription] = useState('');
  const [proposedPrice, setProposedPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  // SHOP_LOCATION_AND_UPCOMING_FEATURES_PLAN.md Phase 4 targeted-picker:
  // broadcast (default) vs targeted-at-one-specific-Runner. The backend
  // (createErrandRequest) already accepted targetRunnerUid from day one —
  // only this dropdown UI was missing. Runner list is every OTHER
  // approved+open errand-type service (excluding the one whose page this
  // form lives on, since targeting the page's own Runner is redundant —
  // broadcast/plain-submit already reaches them, and a same-Runner
  // "target" would be a confusing no-op).
  const [visibility, setVisibility] = useState('broadcast');
  const [targetRunnerUid, setTargetRunnerUid] = useState('');
  const [runners, setRunners] = useState(null);

  useEffect(() => {
    const unsub = subscribeAllServices((all) => {
      const list = all.filter((s) => (
        s.type === 'errand' && s.isOpen && s.providerUid !== service.providerUid
      ));
      setRunners(list);
    });
    return unsub;
  }, [service.providerUid]);

  // Faculty name/phone live in a separate doc fetched async, unlike the
  // synchronous getProfile() student store — prefill once on mount.
  useEffect(() => {
    if (!isFaculty) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    getFacultyProfile(uid).then((fdoc) => {
      if (fdoc) {
        setRequesterName((prev) => prev || fdoc.name || '');
        setRequesterPhone((prev) => prev || fdoc.phone || '');
      }
    }).catch(() => {});
  }, [isFaculty]);

  const submit = async () => {
    setError('');
    if (!service.isOpen) {
      setError('This Runner isn\'t active right now — you can\'t send a request.');
      return;
    }
    if (!itemDescription.trim()) {
      setError('Please describe what you need.');
      return;
    }
    if (!(Number(proposedPrice) > 0)) {
      setError('Please enter a valid proposed price.');
      return;
    }
    if (!requesterPhone.trim()) {
      setError('Please enter a phone number.');
      return;
    }
    if (visibility === 'targeted' && !targetRunnerUid) {
      setError('Please choose a Runner for a targeted request.');
      return;
    }

    setSubmitting(true);
    try {
      await createErrandRequest(service.id, {
        requesterUid: auth.currentUser.uid,
        requesterName,
        requesterPhone,
        requesterRole: isFaculty ? 'faculty' : 'student',
        itemDescription,
        proposedPrice: Number(proposedPrice),
        visibility,
        targetRunnerUid: visibility === 'targeted' ? targetRunnerUid : null,
      });
      setDone(true);
    } catch (e) {
      setError(e.message || 'Something went wrong sending this.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="card" style={{ padding: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#16a34a' }}>Errand request sent ✓</div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 6 }}>
          You'll see it here once a Runner accepts.
        </div>
      </div>
    );
  }

  if (!service.isOpen) {
    return (
      <div className="card" style={{ padding: 16, textAlign: 'center', fontSize: 13.5, color: 'var(--muted)' }}>
        This Runner isn't active right now — you'll be able to send a request once they are.
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Send errand request</div>

      <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>What you need</label>
      <textarea
        value={itemDescription}
        onChange={(e) => setItemDescription(e.target.value)}
        placeholder="e.g. 1 strip of Napa Extra from the pharmacy in front of campus"
        rows={3}
        style={{
          width: '100%', marginTop: 6, marginBottom: 12, padding: '10px 12px', borderRadius: 10,
          border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 14,
          resize: 'vertical', fontFamily: 'inherit',
        }}
      />

      <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Proposed price (item cost + delivery fee)</label>
      <input
        type="number"
        value={proposedPrice}
        onChange={(e) => setProposedPrice(e.target.value)}
        placeholder="৳"
        style={{
          width: '100%', marginTop: 6, marginBottom: 12, padding: '10px 12px', borderRadius: 10,
          border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 14,
        }}
      />

      {isFaculty && (
        <>
          <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Name</label>
          <input
            value={requesterName}
            onChange={(e) => setRequesterName(e.target.value)}
            style={{
              width: '100%', marginTop: 6, marginBottom: 12, padding: '10px 12px', borderRadius: 10,
              border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 14,
            }}
          />
        </>
      )}

      <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Phone number</label>
      <input
        value={requesterPhone}
        onChange={(e) => setRequesterPhone(e.target.value)}
        placeholder="01XXXXXXXXX"
        style={{
          width: '100%', marginTop: 6, marginBottom: 12, padding: '10px 12px', borderRadius: 10,
          border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 14,
        }}
      />

      {/* Phase 4 targeted-picker: broadcast (default, everyone sees it)
          vs targeted (only one chosen Runner sees it). Hidden entirely if
          there are no other Runners to target — falling back silently to
          plain broadcast, same "no dead-end UI" pattern used elsewhere. */}
      {runners && runners.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Who to send this to</label>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button
              type="button"
              onClick={() => { setVisibility('broadcast'); setTargetRunnerUid(''); }}
              style={{
                flex: 1, padding: '9px 10px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                border: '1px solid var(--border)', cursor: 'pointer',
                background: visibility === 'broadcast' ? 'var(--accentSoft)' : 'var(--card)',
                color: visibility === 'broadcast' ? 'var(--accent)' : 'var(--text)',
              }}
            >
              All Runners (Broadcast)
            </button>
            <button
              type="button"
              onClick={() => setVisibility('targeted')}
              style={{
                flex: 1, padding: '9px 10px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                border: '1px solid var(--border)', cursor: 'pointer',
                background: visibility === 'targeted' ? 'var(--accentSoft)' : 'var(--card)',
                color: visibility === 'targeted' ? 'var(--accent)' : 'var(--text)',
              }}
            >
              Specific Runner
            </button>
          </div>

          {visibility === 'targeted' && (
            <select
              value={targetRunnerUid}
              onChange={(e) => setTargetRunnerUid(e.target.value)}
              style={{
                width: '100%', marginTop: 8, padding: '10px 12px', borderRadius: 10,
                border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)',
                fontSize: 14, fontFamily: 'inherit',
              }}
            >
              <option value="">Choose a Runner…</option>
              {runners.map((r) => (
                <option key={r.providerUid} value={r.providerUid}>
                  {r.name}{r.locationText ? ` — ${r.locationText}` : ''}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {error && <div style={{ fontSize: 12.5, color: 'var(--danger, #dc2626)', marginBottom: 10 }}>{error}</div>}

      <button onClick={submit} disabled={submitting} className="btn btn-primary" style={{ width: '100%' }}>
        {submitting ? 'Sending…' : 'Send request'}
      </button>
    </div>
  );
}