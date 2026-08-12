// ServiceAbout.jsx
//
// Phase 5 (SERVICE_BOOKING_REDESIGN_PLAN_PROMPT.md, Part B): a shop's
// "about" page at /services/:serviceId/about — separate from the main
// /services/:serviceId booking-flow page (Part A) per the plan's own
// stated reasoning: booking flow and shop-info are different concerns
// and shouldn't get crammed onto one page.
//
// Reuses ServiceDetail.jsx's GalleryMedia/FloatingContactButton exactly
// (exported from there for this reason) rather than re-implementing
// gallery/contact UI a second time — the plan's own note calls this out
// as the intended approach.
//
// Review system: writes go straight to Firestore (submitReview() in
// serviceSync.js) rather than through a Cloud Function, because this
// project is permanently on the Firebase Spark (free) plan — Cloud
// Functions never deploy here (see docs/ACCOUNT_DELETION_PLAN.md for
// the same constraint already documented elsewhere in this codebase).
// firestore.rules' reviews/{bookingId} create rule is the real
// enforcement point; see its comment block for the exact
// "successfully completed" definition per interactionMode.

import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Truck, ExternalLink, Circle, Star, MessageSquare,
} from 'lucide-react';
import { auth } from '../lib/firebase';
import { getProfile } from '../store/store';
import { getAccountRole } from '../lib/accountRole';
import { getFacultyProfile } from '../lib/facultySync';
import {
  subscribeService, withServiceDefaults, subscribeServiceReviews,
  submitReview, getReviewableBookingsForUser,
} from '../lib/serviceSync';
import { getProviderPhone } from '../lib/providerSync';
import { renderFormattedNoticeBody } from '../lib/noticeFormat.jsx';
import { GalleryMedia, FloatingContactButton } from './ServiceDetail';

export default function ServiceAbout() {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const [service, setService] = useState(undefined);
  const [shopPhone, setShopPhone] = useState('');
  const [reviews, setReviews] = useState(null);
  const [reviewable, setReviewable] = useState([]);

  useEffect(() => subscribeService(serviceId, (s) => setService(s ? withServiceDefaults(s) : s)), [serviceId]);

  useEffect(() => {
    if (!service?.providerUid) return;
    getProviderPhone(service.providerUid).then(setShopPhone).catch(() => {});
  }, [service?.providerUid]);

  useEffect(() => subscribeServiceReviews(serviceId, setReviews), [serviceId]);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setReviewable([]); return; }
    getReviewableBookingsForUser(serviceId, uid).then(setReviewable).catch(() => setReviewable([]));
  }, [serviceId, reviews]); // re-check after every new review lands, so a just-submitted one drops off the prompt list

  const galleryImages = useMemo(() => {
    if (!service) return [];
    return [
      service.coverImageUrl,
      ...(service.offerings || [])
        .filter((o) => o.isAvailable)
        .flatMap((o) => (Array.isArray(o.images) ? o.images : [])),
    ].filter(Boolean).filter((url, idx, arr) => arr.indexOf(url) === idx);
  }, [service]);

  const avgRating = useMemo(() => {
    // Phase 5 rating-denormalize follow-up (Aug 12, 2026): read
    // directly from the service doc's own avgRating/reviewCount
    // (kept in sync by submitReview()'s transaction) rather than
    // re-summing the reviews array client-side — keeps this page's
    // number identical to what Services.jsx's ShopCard badge shows,
    // and avoids a brief flash-of-different-number if the reviews
    // subscription and the service subscription resolve at slightly
    // different times.
    if (!service || !service.reviewCount) return null;
    return { value: Number(service.avgRating || 0), count: service.reviewCount };
  }, [service]);

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

  return (
    <div className="kx-about-page">
      <div className="kx-about-topbar">
        <Link to={`/services/${serviceId}`} className="kx-about-back">
          <ArrowLeft size={16} /> Back to booking
        </Link>
      </div>

      <GalleryMedia images={galleryImages} name={service.name} />

      <div className="kx-about-titlebar">
        <div className="kx-about-title">{service.name}</div>
        <div className="kx-about-status">
          <Circle size={9} fill={service.isOpen ? '#16a34a' : '#9ca3af'} color={service.isOpen ? '#16a34a' : '#9ca3af'} />
          <span style={{ color: service.isOpen ? '#16a34a' : 'var(--muted)' }}>
            {service.isOpen ? 'Open now' : 'Closed now'}
          </span>
        </div>
      </div>

      {avgRating !== null && (
        <div className="kx-about-rating">
          <Star size={15} fill="var(--accent)" color="var(--accent)" />
          <span>{avgRating.value.toFixed(1)}</span>
          <span className="kx-about-rating-count">({avgRating.count} review{avgRating.count === 1 ? '' : 's'})</span>
        </div>
      )}

      {(service.locationText || service.hasDelivery
        || (typeof service.locationLat === 'number' && typeof service.locationLng === 'number')) && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
          {service.locationText && (
            <span className="kx-about-badge">
              <MapPin size={12} /> {service.locationText}
            </span>
          )}
          {typeof service.locationLat === 'number' && typeof service.locationLng === 'number' && (
            <a
              href={`https://www.google.com/maps?q=${service.locationLat},${service.locationLng}`}
              target="_blank"
              rel="noreferrer"
              className="kx-about-badge kx-about-badge-accent"
            >
              View on map <ExternalLink size={11} />
            </a>
          )}
          {service.hasDelivery && (
            <span className="kx-about-badge kx-about-badge-accent">
              <Truck size={12} /> Home delivery available
            </span>
          )}
        </div>
      )}

      {service.description && (
        <div className="kx-about-description">
          {renderFormattedNoticeBody(service.description)}
        </div>
      )}

      <ReviewSection
        serviceId={serviceId}
        service={service}
        reviews={reviews}
        reviewable={reviewable}
        onSubmitted={() => {
          // subscribeServiceReviews' onSnapshot will re-fire on its own
          // once the write lands — nothing to do here except let the
          // reviewable-effect above re-derive from the fresh reviews
          // list (it's already keyed on `reviews` in its dep array).
        }}
      />

      {shopPhone && <FloatingContactButton phone={shopPhone} shopName={service.name} />}

      <style>{`
        .kx-about-page { padding: 20px 16px 48px; width: 100%; max-width: 760px; margin: 0 auto; box-sizing: border-box; }
        @media (min-width: 900px) {
          .kx-about-page { max-width: 960px; }
        }
        @media (min-width: 1280px) {
          .kx-about-page { max-width: 1120px; }
        }
        .kx-about-topbar { margin-bottom: 14px; }
        .kx-about-back {
          display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600;
          color: var(--muted); text-decoration: none;
        }
        .kx-about-back:hover { color: var(--accent); }
        .kx-about-titlebar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-top: 6px; }
        .kx-about-title { font-size: 22px; font-weight: 800; color: var(--text); letter-spacing: -0.01em; }
        .kx-about-status { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; }
        .kx-about-rating { display: inline-flex; align-items: center; gap: 6px; margin-top: 8px; font-size: 14px; font-weight: 700; color: var(--text); }
        .kx-about-rating-count { font-weight: 500; color: var(--muted); font-size: 12.5px; }
        .kx-about-badge {
          display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600;
          color: var(--muted); background: var(--card); border: 1px solid var(--border);
          border-radius: 999px; padding: 4px 10px; text-decoration: none;
        }
        .kx-about-badge-accent { color: var(--accent); background: var(--accentSoft); border-color: transparent; }
        .kx-about-description { font-size: 13.5px; color: var(--muted); line-height: 1.7; margin-top: 4px; }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------
// ReviewSection — review list + (conditionally) a "leave a review" form
// for each reviewable completed booking the signed-in user has that
// hasn't been reviewed yet. getReviewableBookingsForUser() already
// filters this down client-side; firestore.rules' create rule is the
// real gate (see serviceSync.js's submitReview comment block).
// ---------------------------------------------------------------------

// UI fix: a student with several completed orders on the same shop
// (common for hotel/food, where re-ordering is routine) used to see
// several identical-looking "এই অর্ডারের জন্য রিভিউ দিন" forms stacked
// with no way to tell which form is for which order. This builds a
// short, human-readable label per booking — item/offering name(s) +
// date — from whatever fields that booking type actually has:
//   - inquiry/hotel multi-item bookings -> items[].label joined
//   - salon single-select bookings -> the matching offering's label
//   - errand requests -> itemDescription (already free text)
// Falls back to just the date if none of those are present, so the
// label never renders empty.
function describeReviewableBooking(booking, service) {
  const parts = [];
  if (Array.isArray(booking.items) && booking.items.length > 0) {
    parts.push(booking.items.map((it) => it.label).filter(Boolean).join(', '));
  } else if (booking.offeringId) {
    const offering = (service?.offerings || []).find((o) => o.id === booking.offeringId);
    if (offering?.label) parts.push(offering.label);
  } else if (booking.itemDescription) {
    parts.push(booking.itemDescription);
  }
  const when = booking.requestedAt?.toDate
    ? booking.requestedAt.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : null;
  if (when) parts.push(when);
  return parts.join(' · ');
}

function ReviewSection({ serviceId, service, reviews, reviewable, onSubmitted }) {
  return (
    <div className="kx-review-section">
      <div className="kx-review-heading">
        <MessageSquare size={16} /> Reviews
      </div>

      {reviewable.map((booking) => (
        <ReviewForm
          key={booking.id}
          serviceId={serviceId}
          booking={booking}
          orderLabel={describeReviewableBooking(booking, service)}
          onSubmitted={onSubmitted}
        />
      ))}

      {reviews === null ? (
        <div style={{ padding: 16, textAlign: 'center', fontSize: 13.5, color: 'var(--muted)' }}>Loading reviews…</div>
      ) : reviews.length === 0 ? (
        <div style={{ padding: 16, textAlign: 'center', fontSize: 13.5, color: 'var(--muted)' }}>
          No reviews yet — be the first once you've completed an order here.
        </div>
      ) : (
        <div className="kx-review-list">
          {reviews.map((r) => (
            <div key={r.id} className="kx-review-item">
              <div className="kx-review-item-top">
                <div className="kx-review-stars">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} size={13} fill={n <= r.rating ? 'var(--accent)' : 'none'} color="var(--accent)" />
                  ))}
                </div>
                <div className="kx-review-name">{r.reviewerName || 'Anonymous'}</div>
              </div>
              {r.comment && <div className="kx-review-comment">{r.comment}</div>}
            </div>
          ))}
        </div>
      )}

      <style>{`
        .kx-review-section { margin-top: 24px; border-top: 1px solid var(--border); padding-top: 18px; }
        .kx-review-heading { display: flex; align-items: center; gap: 7px; font-size: 15px; font-weight: 800; color: var(--text); margin-bottom: 12px; }
        .kx-review-list { display: flex; flex-direction: column; gap: 12px; }
        .kx-review-item { border: 1px solid var(--border); border-radius: 14px; padding: 12px 14px; background: var(--card); }
        .kx-review-item-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 5px; }
        .kx-review-stars { display: flex; gap: 1px; }
        .kx-review-name { font-size: 12.5px; font-weight: 700; color: var(--muted); }
        .kx-review-comment { font-size: 13.5px; color: var(--text); line-height: 1.6; }
      `}</style>
    </div>
  );
}

function ReviewForm({ serviceId, booking, orderLabel, onSubmitted }) {
  const profile = getProfile();
  const isFaculty = getAccountRole() === 'teacher';
  const [reviewerName, setReviewerName] = useState(isFaculty ? '' : (profile?.name || ''));
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!isFaculty) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    getFacultyProfile(uid).then((fdoc) => {
      if (fdoc) setReviewerName((prev) => prev || fdoc.name || '');
    }).catch(() => {});
  }, [isFaculty]);

  if (done) {
    return (
      <div className="kx-review-form kx-review-form-done">
        ধন্যবাদ! আপনার রিভিউ যোগ হয়েছে।
      </div>
    );
  }

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      await submitReview(serviceId, booking.id, { rating, comment, reviewerName });
      setDone(true);
      onSubmitted?.();
    } catch (e) {
      // firestore.rules' create rule is the real gate — a
      // permission-denied here most likely means this exact booking
      // was already reviewed (deterministic doc-id create collision)
      // or, less likely, the booking's status changed underneath the
      // client-side reviewable check since it was computed.
      setError(e?.code === 'permission-denied'
        ? 'এই বুকিংয়ের জন্য রিভিউ দেওয়া যায়নি — হয়তো ইতিমধ্যে দেওয়া হয়ে গেছে।'
        : (e?.message || 'রিভিউ জমা দেওয়া যায়নি, আবার চেষ্টা করুন।'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="kx-review-form">
      <div className="kx-review-form-title">
        এই অর্ডারের জন্য রিভিউ দিন
        {orderLabel && <span className="kx-review-form-order"> — {orderLabel}</span>}
      </div>
      <div className="kx-review-form-stars">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setRating(n)} className="kx-review-star-btn" aria-label={`${n} star`}>
            <Star size={22} fill={n <= rating ? 'var(--accent)' : 'none'} color="var(--accent)" />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="মন্তব্য (ঐচ্ছিক)"
        rows={2}
        className="kx-review-form-textarea"
        maxLength={500}
      />
      {error && <div style={{ fontSize: 12.5, color: 'var(--danger, #dc2626)', margin: '6px 0' }}>{error}</div>}
      <button type="button" onClick={handleSubmit} disabled={submitting} className="btn btn-sm" style={{ marginTop: 6 }}>
        {submitting ? 'জমা হচ্ছে…' : 'রিভিউ জমা দিন'}
      </button>

      <style>{`
        .kx-review-form { border: 1px solid var(--border); border-radius: 14px; padding: 14px; background: var(--accentSoft); margin-bottom: 14px; }
        .kx-review-form-done { text-align: center; font-size: 13.5px; color: var(--accent); font-weight: 700; }
        .kx-review-form-title { font-size: 13.5px; font-weight: 700; color: var(--text); margin-bottom: 8px; }
        .kx-review-form-order { font-weight: 500; color: var(--muted); }
        .kx-review-form-stars { display: flex; gap: 4px; margin-bottom: 8px; }
        .kx-review-star-btn { background: none; border: none; padding: 2px; cursor: pointer; }
        .kx-review-form-textarea {
          width: 100%; box-sizing: border-box; border: 1px solid var(--border); border-radius: 10px;
          padding: 8px 10px; font-size: 13px; font-family: inherit; resize: vertical; background: var(--card); color: var(--text);
        }
      `}</style>
    </div>
  );
}
