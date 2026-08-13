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
//
// SERVICE_BOOKING_REDESIGN_PLAN_PROMPT.md Phases 1-4 (Aug 2026): the
// booking/inquiry state machine described as "untouched" in the Phase 4
// note above was, by THIS later plan's design, explicitly touched — see
// the plan doc for full context, this is just a pointer for a future
// session reading this file cold:
// - Phase 1: `.kx-pick-card`/`.kx-offering-card` visual redesign (bigger
//   image-dominant cards) + shared OFFERING_SORT_OPTIONS/sortOfferings/
//   OfferingSortDropdown (offerings >=5 only).
// - Phase 2: BookingForm's card-click now opens a Modal (Modal.jsx) with
//   the booking-details fields instead of an inline scroll-down form.
//   Salon only.
// - Phase 3: hotel split out of BookingForm entirely into its own
//   `HotelOrderForm` — multi-item quantity-stepper cart + "Review
//   order" bar + modal, submitting `items[]` to createBooking() while
//   staying in interactionMode 'booking' (NOT swapped to 'inquiry') —
//   see serviceSync.js's createBooking() and firestore.rules'
//   _allBookingItemsValid for the matching backend/rules changes this
//   required. Provider-side rendering fix is in ProviderDashboard.jsx
//   (bookingSummaryText helper).
// - Phase 4: cross-type consistency pass (this comment block + a read
//   through every type's empty/closed/loading state) — no functional
//   changes, see plan doc's Phase 4 section for what was checked.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Store, Circle, MapPin, Truck, Minus, Plus, ExternalLink, ImageOff, ImagePlus, Check, Package,
  Phone, Copy, ArrowUpDown, X, Info,
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
  editErrandProposedPrice, editErrandRequestDetails, confirmErrandRequest, rejectErrandAccept,
  cancelErrandRequest, finishErrandRequest,
} from '../lib/serviceSync';
import { getProviderPhone } from '../lib/providerSync';
import { uploadServiceImage } from '../lib/serviceImageUpload';
import { renderFormattedNoticeBody } from '../lib/noticeFormat.jsx';
import Modal from '../components/Modal';


const STATUS_LABEL = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  done: 'Completed',
  cancelled: 'Cancelled',
  expired_shop_closed: 'Cancelled — shop closed',
};

// Phase 3 (SERVICE_BOOKING_REDESIGN_PLAN_PROMPT.md): a booking doc now
// has two possible "what was ordered" shapes — a single offeringId
// (salon) or a multi-item items[] array (hotel/food, new this phase).
// This renders either shape as one readable line/list, shared by both
// the student-facing MyActiveBooking (below) and reused conceptually by
// the provider dashboard's own equivalent helper (kept separate there
// since that file already has its own offeringLabel() local closure —
// same idea, not literally imported, to avoid a cross-file coupling for
// a two-line render helper).
function bookingOfferingSummary(booking, offerings) {
  if (Array.isArray(booking.items) && booking.items.length > 0) {
    return booking.items.map((item) => `${item.label} × ${item.quantity}`).join(', ');
  }
  if (booking.offeringId) {
    const match = (offerings || []).find((o) => o.id === booking.offeringId);
    return match?.label || 'Offering no longer listed';
  }
  return '';
}

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
        {/* Phase 5 (SERVICE_BOOKING_REDESIGN_PLAN_PROMPT.md, Part B):
            link to the new /about sub-page — kept as a separate,
            deliberately understated link (not a tab-bar) per the
            plan's framing of booking-flow vs shop-info as separate
            concerns, not two equal-weight views of the same page. */}
        <Link to={`/services/${serviceId}/about`} className="kx-detail-about-link">
          <Info size={14} /> About this shop
        </Link>
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
            <MyActiveBooking serviceId={serviceId} booking={activeBooking} providerUid={service.providerUid} offerings={service.offerings} />
          ) : service.type === 'hotel' ? (
            <HotelOrderForm service={service} />
          ) : (
            <BookingForm service={service} />
          )}
        </div>
      </div>

      {shopPhone && <FloatingContactButton phone={shopPhone} shopName={service.name} />}

      <style>{`
        .kx-detail-page { padding: 20px 16px 40px; width: 100%; max-width: 1180px; margin: 0 auto; box-sizing: border-box; }
        .kx-detail-topbar { display: flex; align-items: center; justify-content: flex-end; gap: 14px; margin-bottom: 16px; }
        .kx-detail-about-link {
          display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; font-weight: 600;
          color: var(--muted); text-decoration: none;
        }
        .kx-detail-about-link:hover { color: var(--accent); }
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

// Phase 5 (SERVICE_BOOKING_REDESIGN_PLAN_PROMPT.md): exported so
// ServiceAbout.jsx can reuse the exact same gallery/contact-button
// components instead of duplicating their markup+styles — the plan's
// own note ("GalleryMedia reuse করা যায়") is honored literally here,
// not just in spirit.
export function GalleryMedia({ images, name }) {
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

export function FloatingContactButton({ phone, shopName }) {
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

export function MyActiveInquiry({ serviceId, inquiry }) {
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

// ---------------------------------------------------------------------
// SERVICE_BOOKING_REDESIGN_PLAN_PROMPT.md Phase 1: offering-level sort,
// adapted from Services.jsx's own SORT_OPTIONS/sortServices idiom (same
// value/label shape, same "don't invent a new UI pattern" instruction)
// — but for individual offerings within one shop, not shops themselves.
// Price-based options replace that file's "open now"/"newest" (neither
// applies at offering granularity); Name A-Z carries over unchanged.
// Only rendered when there are >4 offerings (see OFFERING_SORT_MIN_COUNT
// below) so a shop with a handful of items doesn't get a dropdown with
// nothing meaningful to do.
const OFFERING_SORT_OPTIONS = [
  { value: 'default', label: 'Default order' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
  { value: 'name', label: 'Name A-Z' },
];
const OFFERING_SORT_MIN_COUNT = 5;

function sortOfferings(list, sortBy) {
  if (sortBy === 'default' || !sortBy) return list;
  const arr = [...list];
  if (sortBy === 'name') {
    arr.sort((a, b) => a.label.localeCompare(b.label));
  } else if (sortBy === 'price-low' || sortBy === 'price-high') {
    // Offerings with no numeric price sink to the end regardless of
    // direction — there's nothing sane to compare them against, and
    // silently treating a missing price as 0 would wrongly shove
    // priceless items to the very front of "low to high".
    arr.sort((a, b) => {
      const ap = typeof a.price === 'number' ? a.price : null;
      const bp = typeof b.price === 'number' ? b.price : null;
      if (ap === null && bp === null) return 0;
      if (ap === null) return 1;
      if (bp === null) return -1;
      return sortBy === 'price-low' ? ap - bp : bp - ap;
    });
  }
  return arr;
}

function OfferingSortDropdown({ sortBy, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
      <ArrowUpDown size={13} color="var(--muted)" style={{ flexShrink: 0 }} />
      <select
        value={sortBy}
        onChange={(e) => onChange(e.target.value)}
        style={{
          fontSize: 12.5, fontWeight: 600, color: 'var(--text)',
          border: '1px solid var(--border)', borderRadius: 8,
          background: 'var(--card)', padding: '6px 10px',
          cursor: 'pointer',
        }}
      >
        {OFFERING_SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
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
  // Phase 1: sort dropdown only shown once there's enough offerings to
  // make sorting meaningful (OFFERING_SORT_MIN_COUNT) — otherwise it's
  // just clutter above a handful of cards.
  const [sortBy, setSortBy] = useState('default');
  const displayOfferings = useMemo(
    () => sortOfferings(availableOfferings, sortBy),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [availableOfferings, sortBy],
  );

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Select items</div>
        {availableOfferings.length >= OFFERING_SORT_MIN_COUNT && (
          <OfferingSortDropdown sortBy={sortBy} onChange={setSortBy} />
        )}
      </div>

      <div className="kx-offering-grid" style={{ marginBottom: 14 }}>
        {displayOfferings.map((o) => {
          const qty = quantities[o.id] || 0;
          const img = Array.isArray(o.images) && o.images[0];
          return (
            <div key={o.id} className={`kx-offering-card${qty > 0 ? ' is-selected' : ''}`}>
              <div className="kx-offering-media">
                {img ? <img src={img} alt={o.label} /> : <ImageOff size={26} color="var(--muted)" />}
                {qty > 0 && <div className="kx-offering-qtybadge">{qty}</div>}
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
        /* SERVICE_BOOKING_REDESIGN_PLAN_PROMPT.md Phase 1: bigger,
           image-dominant product-card look. 2-column-friendly minmax on
           mobile (kept close to the previous 120-150px range, just
           slightly larger so the image reads as the dominant element),
           more columns naturally fit on wider screens via auto-fill —
           unchanged mechanism, just a roomier card. */
        .kx-offering-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(136px, 1fr));
          gap: 12px;
        }
        .kx-offering-card {
          border: 1px solid var(--border); border-radius: 16px; overflow: hidden;
          background: var(--card); display: flex; flex-direction: column;
          transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
        }
        .kx-offering-card:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(0,0,0,0.08); }
        .kx-offering-card.is-selected { border-color: var(--accent); box-shadow: 0 0 0 1.5px var(--accent); }
        .kx-offering-media {
          position: relative; width: 100%; aspect-ratio: 1 / 1; background: var(--accentSoft);
          display: flex; align-items: center; justify-content: center; overflow: hidden;
        }
        .kx-offering-media img { width: 100%; height: 100%; object-fit: cover; }
        .kx-offering-qtybadge {
          position: absolute; top: 8px; right: 8px; min-width: 22px; height: 22px; padding: 0 5px;
          border-radius: 999px; background: var(--accent); color: #fff;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 800; box-shadow: 0 1px 4px rgba(0,0,0,0.25);
        }
        .kx-offering-body { padding: 11px 12px 12px; display: flex; flex-direction: column; gap: 6px; }
        .kx-offering-name { font-size: 13.5px; font-weight: 700; color: var(--text); line-height: 1.3; }
        .kx-offering-price { font-size: 12.5px; font-weight: 700; color: var(--accent); }
        .kx-offering-price span { color: var(--muted); font-weight: 400; }
        .kx-offering-stepper { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
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

export function MyActiveBooking({ serviceId, booking, providerUid, offerings }) {
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
      {/* Phase 3/4: previously this card never showed WHAT was booked
          at all (not even for salon's single offeringId). Multi-item
          (hotel) bookings get the same itemized list + total pattern
          MyActiveInquiry already uses (Phase 4 consistency pass) —
          single-offering (salon) bookings get one plain summary line,
          since there's nothing to itemize for a single pick. */}
      {Array.isArray(booking.items) && booking.items.length > 0 ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, marginBottom: 4 }}>
            {booking.items.map((item) => (
              <div key={item.offeringId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--text)' }}>{item.label} × {item.quantity}</span>
                {typeof item.price === 'number' && (
                  <span style={{ color: 'var(--muted)' }}>৳{item.price * item.quantity}</span>
                )}
              </div>
            ))}
          </div>
          {booking.items.some((item) => typeof item.price === 'number') && (
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>
              Total (estimated): ৳{booking.items.reduce(
                (sum, item) => (typeof item.price === 'number' ? sum + item.price * item.quantity : sum),
                0,
              )}
            </div>
          )}
        </>
      ) : bookingOfferingSummary(booking, offerings) && (
        <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, marginTop: 4 }}>
          {bookingOfferingSummary(booking, offerings)}
        </div>
      )}
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
  // Phase 2 (SERVICE_BOOKING_REDESIGN_PLAN_PROMPT.md): modalOfferingId
  // drives whether the details Modal is open — null means closed. Kept
  // separate from offeringId (the actual submitted selection) so
  // "Change" inside the modal can clear the picked offering back to
  // the grid without also closing the modal — modalOfferingId only
  // becomes null on an explicit close (X button, overlay click, or
  // after a successful submit).

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
  // Phase 3: BookingForm is now salon-only (hotel moved to
  // HotelOrderForm above) — priceUnitLabel simplified from its old
  // hotel/salon branch to just 'person' accordingly.
  const priceUnitLabel = 'person';
  // Phase 1: same sort dropdown idiom as InquiryForm, only shown past
  // OFFERING_SORT_MIN_COUNT offerings.
  const [sortBy, setSortBy] = useState('default');
  const displayOfferings = useMemo(
    () => sortOfferings(availableOfferings, sortBy),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [availableOfferings, sortBy],
  );

  const [modalOfferingId, setModalOfferingId] = useState(null);
  const selectedOffering = availableOfferings.find((o) => o.id === offeringId) || null;

  const openModalFor = (id) => {
    setError('');
    setOfferingId(id);
    setModalOfferingId(id);
  };
  const closeModal = () => setModalOfferingId(null);
  // "Change" inside the modal: go back to the card grid without fully
  // closing the modal chrome — clears the current pick so the summary
  // strip disappears and the person picks again, same modal session.
  const goBackToPicker = () => {
    setOfferingId('');
    setModalOfferingId(null);
  };

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Book now</div>
        {availableOfferings.length >= OFFERING_SORT_MIN_COUNT && (
          <OfferingSortDropdown sortBy={sortBy} onChange={setSortBy} />
        )}
      </div>

      <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Choose what you'd like</label>
      <div className="kx-pick-grid" style={{ marginTop: 8, marginBottom: 4 }}>
        {displayOfferings.map((o) => {
          const coverUrl = Array.isArray(o.images) ? o.images[0] : null;
          return (
            <div key={o.id} className="kx-pick-card">
              <button
                type="button"
                onClick={() => openModalFor(o.id)}
                className="kx-pick-media-btn"
              >
                <div className="kx-pick-media">
                  {coverUrl
                    ? <img src={coverUrl} alt={o.label} />
                    : <ImageOff size={26} color="var(--muted)" />}
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
              {/* Phase 2: click (image/body or this CTA — either tap
                  target works) now opens the booking-details modal
                  directly instead of just marking the card "selected"
                  inline. */}
              <button
                type="button"
                onClick={() => openModalFor(o.id)}
                className="kx-pick-cta"
              >
                {'Book'}
              </button>
            </div>
          );
        })}
      </div>

      <style>{`
        /* SERVICE_BOOKING_REDESIGN_PLAN_PROMPT.md Phase 1: bigger,
           image-dominant product-card look + explicit CTA button below
           each card (kx-pick-cta), not just a select-highlight border.
           Phase 2: is-selected state removed from the grid cards
           themselves — selection now only exists inside the modal,
           since the grid no longer holds an inline "currently chosen"
           offering the way the old single-select-then-scroll-down flow
           did. */
        .kx-pick-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(128px, 1fr));
          gap: 12px;
        }
        .kx-pick-card {
          border-radius: 16px; overflow: hidden;
          border: 1px solid var(--border); background: var(--card);
          display: flex; flex-direction: column;
          transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
        }
        .kx-pick-card:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(0,0,0,0.08); }
        .kx-pick-media-btn {
          text-align: left; cursor: pointer; background: none; border: none; padding: 0;
          display: flex; flex-direction: column; font: inherit; color: inherit;
        }
        .kx-pick-media {
          position: relative; width: 100%; aspect-ratio: 1 / 1; background: var(--accentSoft, #f3f4f6);
          display: flex; align-items: center; justify-content: center; overflow: hidden;
        }
        .kx-pick-media img { width: 100%; height: 100%; object-fit: cover; }
        .kx-pick-body { padding: 9px 10px 6px; display: flex; flex-direction: column; gap: 4px; }
        .kx-pick-name { font-size: 13px; font-weight: 700; color: var(--text); line-height: 1.3; }
        .kx-pick-price { font-size: 12px; font-weight: 700; color: var(--accent); }
        .kx-pick-price span { color: var(--muted); font-weight: 400; }
        .kx-pick-cta {
          margin: 6px 10px 10px; padding: 7px 0; border-radius: 9px; border: none;
          background: var(--accentSoft, #f3f4f6); color: var(--accent);
          font-size: 12.5px; font-weight: 700; cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .kx-pick-cta:hover { background: var(--accent); color: #fff; }

        /* Phase 2: modal-internal styles */
        .kx-modal-card {
          width: 100%; max-width: 440px; border-radius: 20px; background: var(--card);
          max-height: calc(100vh - 24px); overflow: auto; padding: 18px;
        }
        .kx-modal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
        .kx-modal-title { font-size: 15px; font-weight: 800; color: var(--text); }
        .kx-modal-close {
          width: 30px; height: 30px; border-radius: 999px; border: none; background: var(--accentSoft, #f3f4f6);
          display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text);
        }
        .kx-modal-summary {
          display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 14px;
          background: var(--accentSoft, #f3f4f6); margin-bottom: 16px;
        }
        .kx-modal-summary-media {
          width: 48px; height: 48px; border-radius: 10px; overflow: hidden; flex-shrink: 0;
          background: var(--card); display: flex; align-items: center; justify-content: center;
        }
        .kx-modal-summary-media img { width: 100%; height: 100%; object-fit: cover; }
        .kx-modal-summary-body { flex: 1; min-width: 0; }
        .kx-modal-summary-name { font-size: 13.5px; font-weight: 700; color: var(--text); line-height: 1.3; }
        .kx-modal-summary-price { font-size: 12.5px; font-weight: 700; color: var(--accent); margin-top: 2px; }
        .kx-modal-change-btn {
          flex-shrink: 0; font-size: 12px; font-weight: 700; color: var(--accent); background: none;
          border: none; cursor: pointer; text-decoration: underline; padding: 4px;
        }
      `}</style>

      {error && !modalOfferingId && <div style={{ fontSize: 12.5, color: 'var(--danger, #dc2626)', marginBottom: 10 }}>{error}</div>}

      {modalOfferingId && (
        <Modal
          onClose={closeModal}
          overlayStyle={{ padding: 12 }}
          contentStyle={{ width: '100%', maxWidth: 440, background: 'transparent' }}
        >
          <div className="kx-modal-card">
            <div className="kx-modal-head">
              <div className="kx-modal-title">Booking details</div>
              <button type="button" onClick={closeModal} className="kx-modal-close" aria-label="Close">
                <X size={16} />
              </button>
            </div>

            {selectedOffering && (
              <div className="kx-modal-summary">
                <div className="kx-modal-summary-media">
                  {Array.isArray(selectedOffering.images) && selectedOffering.images[0]
                    ? <img src={selectedOffering.images[0]} alt={selectedOffering.label} />
                    : <ImageOff size={18} color="var(--muted)" />}
                </div>
                <div className="kx-modal-summary-body">
                  <div className="kx-modal-summary-name">{selectedOffering.label}</div>
                  {typeof selectedOffering.price === 'number' && (
                    <div className="kx-modal-summary-price">৳{selectedOffering.price} / {priceUnitLabel}</div>
                  )}
                </div>
                <button type="button" onClick={goBackToPicker} className="kx-modal-change-btn">
                  Change
                </button>
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
        </Modal>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Phase 3 (SERVICE_BOOKING_REDESIGN_PLAN_PROMPT.md): hotel/food-specific
// multi-item order form. Only ever rendered for service.type === 'hotel'
// (see the render branch above) — salon keeps using BookingForm
// untouched. Deliberately built as its own component rather than a
// type-conditional branch inside BookingForm: the two forms' selection
// models are fundamentally different shapes (single offeringId + radio
// grid vs items{} map + quantity steppers), and keeping them separate
// components mirrors how InquiryForm/BookingForm were already split by
// selection-model rather than folded into one mega-component with
// internal branching everywhere.
//
// Interaction mode stays 'booking' (createBooking() is called with an
// `items` array instead of `offeringId` — see serviceSync.js's Phase 3
// comment) so status flow is still pending/confirmed/done with owner
// accept/reject, NOT inquiry-mode's open/answered/closed — an incoming
// food order is something the shop accepts or declines, not a question
// to "answer".
// ---------------------------------------------------------------------

function HotelOrderForm({ service }) {
  const profile = getProfile();
  const isFaculty = getAccountRole() === 'teacher';
  const [requesterName, setRequesterName] = useState(isFaculty ? '' : (profile?.name || ''));
  const [studentPhone, setStudentPhone] = useState('');
  const [quantities, setQuantities] = useState({}); // offeringId -> quantity
  const [wantsPreferredTime, setWantsPreferredTime] = useState(false);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

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
  const [sortBy, setSortBy] = useState('default');
  const displayOfferings = useMemo(
    () => sortOfferings(availableOfferings, sortBy),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [availableOfferings, sortBy],
  );

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
  const totalQty = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const total = selectedItems.reduce(
    (sum, item) => (typeof item.price === 'number' ? sum + item.price * item.quantity : sum),
    0,
  );
  const hasAnyPrice = selectedItems.some((item) => typeof item.price === 'number');

  const submit = async () => {
    setError('');
    if (!service.isOpen) {
      setError('Shop is closed right now — you can\'t order at the moment.');
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
        items: selectedItems,
        preferredTime: wantsPreferredTime ? { date, time } : null,
      });
      setDone(true);
    } catch (e) {
      setError(e.message || 'Something went wrong ordering this.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="card" style={{ padding: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#16a34a' }}>Order sent ✓</div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 6 }}>
          You'll see it here once the shop confirms.
        </div>
      </div>
    );
  }

  if (!service.isOpen) {
    return (
      <div className="card" style={{ padding: 16, textAlign: 'center', fontSize: 13.5, color: 'var(--muted)' }}>
        Shop is closed right now — you'll be able to order once it's open.
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Select items</div>
        {availableOfferings.length >= OFFERING_SORT_MIN_COUNT && (
          <OfferingSortDropdown sortBy={sortBy} onChange={setSortBy} />
        )}
      </div>

      {/* Reuses .kx-offering-grid/-card exactly (same class names,
          styles already defined in InquiryForm's <style> block above,
          which is always mounted alongside this for medicine/bookstore/
          onlinemart services — but hotel never coexists with those on
          the same page, so this form defines its own copy of the same
          rules to stay self-contained/robust if InquiryForm's block
          ever isn't mounted). */}
      <div className="kx-offering-grid" style={{ marginBottom: 14 }}>
        {displayOfferings.map((o) => {
          const qty = quantities[o.id] || 0;
          const img = Array.isArray(o.images) && o.images[0];
          return (
            <div key={o.id} className={`kx-offering-card${qty > 0 ? ' is-selected' : ''}`}>
              <div className="kx-offering-media">
                {img ? <img src={img} alt={o.label} /> : <ImageOff size={26} color="var(--muted)" />}
                {qty > 0 && <div className="kx-offering-qtybadge">{qty}</div>}
              </div>
              <div className="kx-offering-body">
                <div className="kx-offering-name">{o.label}</div>
                {typeof o.price === 'number' && (
                  <div className="kx-offering-price">
                    ৳{o.price} <span>/ plate</span>
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
          grid-template-columns: repeat(auto-fill, minmax(136px, 1fr));
          gap: 12px;
        }
        .kx-offering-card {
          border: 1px solid var(--border); border-radius: 16px; overflow: hidden;
          background: var(--card); display: flex; flex-direction: column;
          transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
        }
        .kx-offering-card:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(0,0,0,0.08); }
        .kx-offering-card.is-selected { border-color: var(--accent); box-shadow: 0 0 0 1.5px var(--accent); }
        .kx-offering-media {
          position: relative; width: 100%; aspect-ratio: 1 / 1; background: var(--accentSoft);
          display: flex; align-items: center; justify-content: center; overflow: hidden;
        }
        .kx-offering-media img { width: 100%; height: 100%; object-fit: cover; }
        .kx-offering-qtybadge {
          position: absolute; top: 8px; right: 8px; min-width: 22px; height: 22px; padding: 0 5px;
          border-radius: 999px; background: var(--accent); color: #fff;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 800; box-shadow: 0 1px 4px rgba(0,0,0,0.25);
        }
        .kx-offering-body { padding: 11px 12px 12px; display: flex; flex-direction: column; gap: 6px; }
        .kx-offering-name { font-size: 13.5px; font-weight: 700; color: var(--text); line-height: 1.3; }
        .kx-offering-price { font-size: 12.5px; font-weight: 700; color: var(--accent); }
        .kx-offering-price span { color: var(--muted); font-weight: 400; }
        .kx-offering-stepper { display: flex; align-items: center; gap: 8px; margin-top: 4px; }

        .kx-hotel-review-bar {
          position: sticky; bottom: 8px; display: flex; align-items: center; justify-content: space-between;
          gap: 10px; padding: 10px 14px; border-radius: 14px; background: var(--accent); color: #fff;
          box-shadow: 0 4px 16px rgba(0,0,0,0.18); cursor: pointer; border: none; width: 100%; margin-top: 4px;
        }
        .kx-hotel-review-bar-label { font-size: 13px; font-weight: 700; }
        .kx-hotel-review-bar-total { font-size: 13px; font-weight: 800; }

        .kx-modal-card {
          width: 100%; max-width: 440px; border-radius: 20px; background: var(--card);
          max-height: calc(100vh - 24px); overflow: auto; padding: 18px;
        }
        .kx-modal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
        .kx-modal-title { font-size: 15px; font-weight: 800; color: var(--text); }
        .kx-modal-close {
          width: 30px; height: 30px; border-radius: 999px; border: none; background: var(--accentSoft, #f3f4f6);
          display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text);
        }
        .kx-modal-items-list { margin-bottom: 14px; display: flex; flex-direction: column; gap: 8px; }
        .kx-modal-item-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: var(--text); }
        .kx-modal-item-row span:last-child { color: var(--muted); font-weight: 600; }
        .kx-modal-change-btn {
          font-size: 12px; font-weight: 700; color: var(--accent); background: none;
          border: none; cursor: pointer; text-decoration: underline; padding: 4px 0; align-self: flex-start;
        }
        .kx-modal-total-row {
          display: flex; justify-content: space-between; font-size: 13.5px; font-weight: 800;
          color: var(--accent); border-top: 1px solid var(--border); padding-top: 10px; margin-bottom: 14px;
        }
      `}</style>

      {/* Phase 3: "Review Order" bar replaces a single-select CTA — only
          appears once at least one item has a quantity > 0, mirrors a
          cart-summary bar rather than a per-card button since multiple
          items can be selected at once here. */}
      {totalQty > 0 && (
        <button type="button" onClick={() => setModalOpen(true)} className="kx-hotel-review-bar">
          <span className="kx-hotel-review-bar-label">Review order ({totalQty} item{totalQty > 1 ? 's' : ''})</span>
          {hasAnyPrice && <span className="kx-hotel-review-bar-total">৳{total}</span>}
        </button>
      )}

      {error && !modalOpen && <div style={{ fontSize: 12.5, color: 'var(--danger, #dc2626)', marginTop: 10 }}>{error}</div>}

      {modalOpen && (
        <Modal
          onClose={() => setModalOpen(false)}
          overlayStyle={{ padding: 12 }}
          contentStyle={{ width: '100%', maxWidth: 440, background: 'transparent' }}
        >
          <div className="kx-modal-card">
            <div className="kx-modal-head">
              <div className="kx-modal-title">Your order</div>
              <button type="button" onClick={() => setModalOpen(false)} className="kx-modal-close" aria-label="Close">
                <X size={16} />
              </button>
            </div>

            <div className="kx-modal-items-list">
              {selectedItems.map((item) => (
                <div key={item.offeringId} className="kx-modal-item-row">
                  <span>{item.label} × {item.quantity}</span>
                  {typeof item.price === 'number' && <span>৳{item.price * item.quantity}</span>}
                </div>
              ))}
            </div>
            {/* "Change" here just closes the modal back to the grid —
                unlike BookingForm's single-select Change (which also
                clears the pick), quantities stay exactly as they were
                since there's no single "current pick" to reset, just an
                editable cart the person can keep adjusting on the grid. */}
            <button type="button" onClick={() => setModalOpen(false)} className="kx-modal-change-btn">
              Change items
            </button>

            {hasAnyPrice && (
              <div className="kx-modal-total-row">
                <span>Total (estimated)</span>
                <span>৳{total}</span>
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
              {submitting ? 'Sending…' : 'Order now'}
            </button>
          </div>
        </Modal>
      )}
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

export function MyActiveErrand({ serviceId, errand }) {
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

      {errand.itemImageUrl && (
        <img
          src={errand.itemImageUrl}
          alt=""
          style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 10 }}
        />
      )}

      {!editing ? (
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 10 }}>
          {errand.proposedPrice > 0 ? `Proposed price: ৳${errand.proposedPrice}` : 'Free request (no charge)'}
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
  // Person requested: a way to attach a photo when sending an errand
  // request (e.g. a picture of the exact product wanted, or a screenshot
  // of a shopping list) — reuses uploadServiceImage(), the same
  // Cloudflare-Worker-backed pipeline provider shop setup already uses
  // for item photos (see ProviderOfferingsPage.jsx), so no new upload
  // infra. Upload happens on submit (not on file-pick) since an
  // unsubmitted request shouldn't leave an orphaned image in storage if
  // the person changes their mind and navigates away.
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const imageInputRef = useRef(null);
  const onPickImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(file); });
  };
  const clearImage = () => {
    setImagePreview((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    setImageFile(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  // SHOP_LOCATION_AND_UPCOMING_FEATURES_PLAN.md Phase 4 targeted-picker:
  // broadcast (default) vs targeted-at-one-specific-Runner. The backend
  // (createErrandRequest) already accepted targetRunnerUid from day one —
  // only this dropdown UI was missing. Runner list is every OTHER
  // approved+open errand-type service (excluding the one whose page this
  // form lives on, since targeting the page's own Runner is redundant —
  // broadcast/plain-submit already reaches them, and a same-Runner
  // "target" would be a confusing no-op).
  // BUGFIX (person reported): "Proposed price" was mandatory (> 0) with
  // no way to mark a request as free — so people who genuinely meant
  // "no charge, just do it as a favor" had no honest way to submit that
  // and were left typing 0 or 1 into a field labeled as a price, which
  // reads as a data-quality bug from the Runner's side (an incoming
  // request that says "৳0" looks like an error, not an intentional
  // free ask). This checkbox makes "free" an explicit, first-class
  // choice instead of a workaround.
  const [isFree, setIsFree] = useState(false);
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
    if (!isFree && !(Number(proposedPrice) > 0)) {
      setError('Please enter a valid proposed price, or mark this as a free request.');
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
      let itemImageUrl = null;
      if (imageFile) {
        // service.id is a real, already-created shop doc here (this
        // form only renders once the Runner's service exists), so the
        // same uploadServiceImage(serviceId, file) call used for
        // provider offering photos works as-is — the errand request's
        // own doc ID doesn't exist yet at this point (it's about to be
        // created by createErrandRequest below), so the image is keyed
        // under the SHOP's id, same folder every other image for this
        // shop already lives under.
        itemImageUrl = await uploadServiceImage(service.id, imageFile);
      }
      await createErrandRequest(service.id, {
        requesterUid: auth.currentUser.uid,
        requesterName,
        requesterPhone,
        requesterRole: isFaculty ? 'faculty' : 'student',
        itemDescription,
        itemImageUrl,
        proposedPrice: isFree ? 0 : Number(proposedPrice),
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

  // Phase 6 (SERVICE_BOOKING_REDESIGN_PLAN_PROMPT.md): provider-side
  // "who can send me a request" filter. withServiceDefaults() already
  // guarantees service.errandAcceptFrom is a definite string. Blocked
  // here at the UI level (form never even renders) rather than only
  // failing on submit — firestore.rules' create rule and
  // createErrandRequest()'s own check are still the real enforcement,
  // this is just so a filtered-out user doesn't fill out the whole
  // form before finding out.
  if (service.errandAcceptFrom && service.errandAcceptFrom !== 'all'
      && service.errandAcceptFrom !== (isFaculty ? 'faculty' : 'student')) {
    return (
      <div className="card" style={{ padding: 16, textAlign: 'center', fontSize: 13.5, color: 'var(--muted)' }}>
        {service.errandAcceptFrom === 'faculty'
          ? 'এই Runner শুধু Faculty-দের থেকে রিকোয়েস্ট নিচ্ছেন।'
          : 'এই Runner শুধু Student-দের থেকে রিকোয়েস্ট নিচ্ছেন।'}
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

      <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>ছবি (ঐচ্ছিক)</label>
      <div style={{ marginTop: 6, marginBottom: 12 }}>
        {imagePreview ? (
          <div style={{ position: 'relative', width: 96, height: 96 }}>
            <img src={imagePreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }} />
            <button
              type="button"
              onClick={clearImage}
              aria-label="Remove image"
              style={{
                position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: '50%',
                background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 13, lineHeight: 1,
              }}
            >×</button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="btn btn-sm btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <ImagePlus size={15} /> ছবি যোগ করুন
          </button>
        )}
        <input ref={imageInputRef} type="file" accept="image/*" onChange={onPickImage} style={{ display: 'none' }} />
      </div>

      <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Proposed price (item cost + delivery fee)</label>
      <input
        type="number"
        value={proposedPrice}
        onChange={(e) => setProposedPrice(e.target.value)}
        placeholder="৳"
        disabled={isFree}
        style={{
          width: '100%', marginTop: 6, marginBottom: 8, padding: '10px 12px', borderRadius: 10,
          border: '1px solid var(--border)', background: isFree ? 'var(--border)' : 'var(--card)',
          color: 'var(--text)', fontSize: 14, opacity: isFree ? 0.6 : 1,
        }}
      />
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)', marginBottom: 12, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={isFree}
          onChange={(e) => { setIsFree(e.target.checked); if (e.target.checked) setProposedPrice(''); }}
        />
        এটা ফ্রি রিকোয়েস্ট (কোনো পেমেন্ট ছাড়া)
      </label>

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