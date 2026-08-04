// Services.jsx
//
// PHASE 2 (SERVICES_PROVIDER_PLAN.md §6). Student-facing entry point from
// the Campus Life "Services" nav card.
//
// MULTI_CATEGORY_SERVICES_PLAN.md Phase 6: restructured into two levels,
// per the plan's explicit routing decision (Phase 0 §2 — nested route,
// no query param):
//   Level 1: /services              -> CategoryGrid (this file's default export)
//   Level 2: /services/category/:categoryType -> CategoryShopList
//   (unchanged) /services/:serviceId -> ServiceDetail.jsx
// Both levels are exported from this one file and wired into App.jsx as
// two separate routes, mirroring the existing /services/:serviceId
// nested-route pattern already in App.jsx.
//
// PHASE 3 (SERVICES_OVERHAUL_PLAN_PROMPT.md): Level-1 listing redesign.
// Per Phase 0's recorded decision, the old "category grid + Coming soon
// placeholders, must pick a category first" landing was replaced with a
// flat, e-commerce-style feed — every shop across every category shown
// immediately, with Sort By and Filter controls at the top instead of a
// forced category-first navigation step. Category is now just one of
// the Filter options, not a mandatory landing grid.
// The Phase 2 "My Orders" hub card stays exactly where it was: fixed
// first row, outside the sort/filter pipeline, divider still beneath
// it. subscribeAllServices/SERVICE_TYPE_LABELS/CATEGORY_ICONS and the
// underlying service data model are untouched — this phase is layout
// and interaction only, per the plan's explicit scope note.
// Level 2 (CategoryShopList, /services/category/:categoryType) is left
// as-is — still reachable (e.g. deep links) but no longer the only way
// to browse a category, now that Level 1's Filter covers the same job
// inline.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Store, Circle, Scissors, Cross, UtensilsCrossed, BookOpen, ShoppingBag, Bike, Package,
  ArrowUpDown, SlidersHorizontal, Check, X,
} from 'lucide-react';
import { subscribeAllServices, SERVICE_TYPE_LABELS, SERVICE_TYPES, withServiceDefaults } from '../lib/serviceSync';
import { listAllProviderAccounts } from '../lib/providerSync';
import { onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

// Phase 6: one icon per category type, shared by the full grid (this
// file) and the compact home-page preview row (Dashboard.jsx imports
// this same map so the two stay visually consistent).
// Phase 4 (Delivery/Errand Runner plan): 'errand' added — Bike icon,
// distinct from Truck (already used elsewhere for the hasDelivery badge)
// so a Runner's own category card doesn't visually collide with a
// regular shop's "has delivery" badge.
export const CATEGORY_ICONS = {
  salon: Scissors,
  medicine: Cross,
  hotel: UtensilsCrossed,
  bookstore: BookOpen,
  onlinemart: ShoppingBag,
  errand: Bike,
};

// PHASE 3: closes the other half of the deactivation gap flagged at the
// end of Phase 2 — forceCloseProviderServices (serviceSync.js) makes a
// deactivated provider's services isOpen:false, but a closed service
// still SHOWS UP in this list as "বন্ধ" rather than disappearing
// entirely, which is wrong for a provider the Founder has explicitly
// deactivated (as opposed to one who's just temporarily closed for the
// day). This hook fetches the deactivated set once per mount — a plain
// one-shot read, not a live subscription, since deactivation is a rare
// Founder action, not something that needs to instantly propagate to
// every open student session the second it happens.
function useDeactivatedProviderUids() {
  const [deactivatedUids, setDeactivatedUids] = useState(null);

  useEffect(() => {
    let settled = false;

    // Belt-and-braces: listAllProviderAccounts() is a one-shot getDocs()
    // call. Under Firestore's persistentMultipleTabManager cache, a
    // stuck IndexedDB lock (leftover from another tab/session) can leave
    // this promise neither resolving nor rejecting, which previously
    // left this whole page stuck on "Loading…" forever with no console
    // error. A 6s hard timeout guarantees this page always finishes
    // resolving one way or another.
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      console.warn('[Services] listAllProviderAccounts timed out after 6s — proceeding with empty deactivated set');
      setDeactivatedUids(new Set());
    }, 6000);

    listAllProviderAccounts()
      .then((accounts) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        setDeactivatedUids(new Set(
          accounts.filter((a) => a.status === 'deactivated').map((a) => a.uid),
        ));
      })
      .catch((err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        console.error('[Services] listAllProviderAccounts failed:', err);
        setDeactivatedUids(new Set());
      });

    return () => {
      settled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  return deactivatedUids;
}

// Live pending-booking COUNT per service, shown as "কতজন আছে" (§6) —
// deliberately just a number, not the queue contents themselves (that
// detail belongs to the provider dashboard, not a public student list).
function usePendingCounts(serviceIds) {
  const [counts, setCounts] = useState({});

  useEffect(() => {
    if (!serviceIds || serviceIds.length === 0) return undefined;
    const unsubs = serviceIds.map((id) => onSnapshot(
      query(collection(db, 'services', id, 'bookings'), where('status', '==', 'pending')),
      (snap) => setCounts((prev) => ({ ...prev, [id]: snap.size })),
      () => {
        // A student who isn't the service's own provider/admin can't read
        // other students' booking docs (firestore.rules bookings/read is
        // per-document, scoped to studentUid==self || ownsService || admin).
        // A collection query over "all pending bookings" therefore gets
        // rejected outright for every visiting student — this isn't a bug
        // in the rule, it's this query being the wrong shape for a
        // student-facing view. Fail quietly to 0 rather than crashing the
        // whole page; the real fix is a denormalized pendingCount field on
        // the service doc itself, written by the provider/booking-status
        // transition, not a live cross-student query from here.
        setCounts((prev) => ({ ...prev, [id]: 0 }));
      },
    ));
    return () => unsubs.forEach((u) => u());
  }, [serviceIds?.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  return counts;
}

// Shared by both levels of this file — subscribes to every service,
// filters out deactivated-provider services, and normalizes each doc
// through withServiceDefaults() (Phase 1 migration note: older docs
// without interactionMode/status still resolve correctly).
function useVisibleServices() {
  const [allServices, setAllServices] = useState(null);
  const deactivatedUids = useDeactivatedProviderUids();

  useEffect(() => subscribeAllServices(setAllServices), []);

  const stillResolving = allServices === null || deactivatedUids === null;
  const services = stillResolving
    ? null
    : allServices
      .filter((s) => !deactivatedUids.has(s.providerUid))
      .map(withServiceDefaults);

  return services;
}

// ---------------------------------------------------------------------
// Level 1 — category card grid, this file's default export, mounted at
// /services.
// ---------------------------------------------------------------------

// PHASE 3: sort options for the flat feed. 'open-first' is the default
// — open-now shops surface above closed ones, ties broken by name — since
// that's the most useful ordering for someone about to place an order
// right now (mirrors "open now" being the single badge the old grid
// showed). 'newest' relies on Firestore doc insertion order already
// being newest-last in subscribeAllServices's snapshot (no createdAt
// sort field exists on the service doc today, so this is an honest
// approximation, not a guarantee — acceptable for a first cut per
// Phase 0's note that Phase 3 can be adjusted after owner feedback).
const SORT_OPTIONS = [
  { value: 'open-first', label: 'Open now first' },
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'newest', label: 'Newest' },
];

function sortServices(list, sortBy) {
  const arr = [...list];
  if (sortBy === 'name') {
    arr.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortBy === 'newest') {
    arr.reverse();
  } else {
    // open-first (default): open shops before closed, then by name.
    arr.sort((a, b) => {
      if (a.isOpen !== b.isOpen) return a.isOpen ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }
  return arr;
}

// ---------------------------------------------------------------------
// ServiceCategoryGrid — the actual category-card grid (icon + label +
// live "N open now"/"N shops"/"Coming soon" badge). Extracted as its own
// named export (SERVICES_CATEGORY_CARD_UNIFICATION.md) so it can be
// reused verbatim, pixel-for-pixel, by SubgroupHub.jsx's "Services"
// special-case for /campus-life (mobile) and /faculty/more — not just by
// this file's own default export below. Subscribes to live services
// itself (useVisibleServices) so every place that renders it always
// shows fresh data, never a static/stale snapshot passed down as props.
// `showHeader` controls whether the "Services" title+subtitle block
// renders above the grid — SubgroupHub already renders its own section
// title, so it passes showHeader={false} to avoid a duplicate heading;
// this file's own default export (below) keeps its header, just moved
// above this component rather than inside it (see Services()).
export function ServiceCategoryGrid({ showHeader = true }) {
  const navigate = useNavigate();
  const services = useVisibleServices();

  if (services === null) {
    return (
      <div>
        {showHeader && (
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 16 }}>Services</div>
        )}
        <div className="kx-category-grid">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="card kuetx-skeleton-pulse"
              style={{
                padding: 18, border: '1px solid var(--border)',
                borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 10,
              }}
            >
              <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--border)' }} />
              <div style={{ width: '70%', height: 14, borderRadius: 4, background: 'var(--border)' }} />
              <div style={{ width: '45%', height: 18, borderRadius: 999, background: 'var(--border)' }} />
            </div>
          ))}
        </div>
        <style>{`
          .kx-category-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
            width: 100%;
          }
          @media (min-width: 480px) {
            .kx-category-grid { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
          }
          @media (min-width: 900px) {
            .kx-category-grid { grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 20px; }
          }
          .kuetx-skeleton-pulse { animation: kuetxPulse 1.1s ease-in-out infinite; }
          @keyframes kuetxPulse { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
        `}</style>
      </div>
    );
  }

  const activeShops = services.filter((s) => s.status !== 'dormant');

  const categoryStats = SERVICE_TYPES.map((type) => {
    const shopsInCategory = activeShops.filter((s) => s.type === type);
    const openCount = shopsInCategory.filter((s) => s.isOpen).length;
    return { type, total: shopsInCategory.length, openCount };
  });

  return (
    <div>
      {showHeader && (
        <div className="kx-services-header">
          <div>
            <div className="kx-services-title">Services</div>
            <div className="kx-services-subtitle">Everything on campus, in one place</div>
          </div>
        </div>
      )}

      <div className="kx-services-section">
        <div className="kx-category-grid">
          {categoryStats.map(({ type, total, openCount }) => {
            const Icon = CATEGORY_ICONS[type] || Store;
            const label = CATEGORY_LABELS_EN[type] || SERVICE_TYPE_LABELS[type] || type;
            return (
              <button
                key={type}
                className="kx-category-card"
                onClick={() => navigate(`/services/category/${type}`)}
              >
                <div className="kx-category-icon"><Icon size={26} strokeWidth={1.6} /></div>
                <div className="kx-category-label">{label}</div>
                {total > 0 ? (
                  <div className="kx-category-badge is-live">
                    {openCount > 0 ? `${openCount} open now` : `${total} shop${total > 1 ? 's' : ''}`}
                  </div>
                ) : (
                  <div className="kx-category-badge">Coming soon</div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <style>{`
        .kx-services-header {
          display: flex; align-items: flex-end; justify-content: space-between;
          margin-bottom: 20px; gap: 12px; flex-wrap: wrap;
        }
        .kx-services-title { font-size: 22px; font-weight: 800; color: var(--text); letter-spacing: -0.01em; }
        .kx-services-subtitle { font-size: 13.5px; color: var(--muted); margin-top: 4px; }

        /* Whole-section wrapper: sets Services visually apart from
           whatever section sits above it on a shared hub page (e.g.
           Campus Life's plain icon-grid) — soft accent-tinted
           background + rounded border, like a "shelf" the category
           cards sit on. */
        .kx-services-section {
          background: color-mix(in srgb, var(--accent) 5%, var(--surface, var(--card)));
          border: 1px solid color-mix(in srgb, var(--accent) 12%, var(--border));
          border-radius: 22px;
          padding: 16px;
        }

        .kx-category-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          width: 100%;
        }
        @media (min-width: 480px) {
          .kx-category-grid { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
        }
        @media (min-width: 900px) {
          .kx-category-grid { grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 20px; }
        }

        .kx-category-card {
          text-align: left;
          cursor: pointer;
          border-radius: 16px;
          border: 1px solid var(--border);
          /* Distinct from the section wrapper's tinted background —
             cards stay the normal card surface so they read as
             "items sitting on the shelf", not blended into it. */
          background: var(--card);
          padding: 18px 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
        }
        .kx-category-card:hover {
          border-color: rgba(var(--accentRGB), 0.4);
          box-shadow: 0 8px 20px -6px rgba(var(--accentRGB), 0.25);
          transform: translateY(-2px);
        }
        .kx-category-icon {
          width: 52px; height: 52px; border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          background: var(--accentSoft); color: var(--accent);
        }
        .kx-category-label { font-size: 15.5px; font-weight: 800; color: var(--text); }
        .kx-category-badge {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 12px; font-weight: 700; color: var(--muted);
          background: var(--surface, rgba(107,114,128,0.08));
          border-radius: 999px; padding: 4px 10px; width: fit-content;
        }
        .kx-category-badge.is-live {
          color: #16a34a;
          background: rgba(22,163,74,0.10);
        }
      `}</style>
    </div>
  );
}

export default function Services() {
  const navigate = useNavigate();

  // Owner decision (Aug 2026): revert Level 1 back to a category card
  // grid landing — the Phase 3 flat e-commerce feed above this function
  // is being replaced here at the point of use. "My Orders" stays
  // exactly where Phase 2 put it: fixed first row, its own divider,
  // untouched. Below it: ServiceCategoryGrid (extracted above, per
  // SERVICES_CATEGORY_CARD_UNIFICATION.md) — one card per SERVICE_TYPES
  // entry, each showing an "N open now" badge (or "Coming soon" if the
  // category has zero shops at all yet).
  // sortServices/SORT_OPTIONS/useMemo pendingCounts above are no longer
  // used by this component (they were Phase 3's sort/filter toolbar,
  // which the toolbar UI below no longer renders) — left defined in the
  // file since CategoryShopList and other code may still reference them;
  // not deleted to keep this change scoped to layout only.
  return (
    <div className="page-enter page-container content-page-bg">
      <div className="kx-services-header">
        <div>
          <div className="kx-services-title">Services</div>
          <div className="kx-services-subtitle">Everything on campus, in one place</div>
        </div>
      </div>

      {/* PHASE 2 (SERVICES_OVERHAUL_PLAN_PROMPT.md): "My Orders" hub-entry
          card — fixed first row, visually distinct from ordinary category
          cards, with a divider line beneath it. This stays local to
          /services (per the unification prompt's explicit "What NOT to
          do" note) — not part of ServiceCategoryGrid, so it never shows
          up on /campus-life or /faculty/more. */}
      <button onClick={() => navigate('/services/orders')} className="kx-orders-hub-card">
        <div className="kx-orders-hub-icon"><Package size={26} strokeWidth={1.75} /></div>
        <div className="kx-orders-hub-body">
          <div className="kx-orders-hub-title">My Orders</div>
          <div className="kx-orders-hub-subtitle">See and manage everything you've booked or asked about</div>
        </div>
      </button>
      <div className="kx-orders-hub-divider" />

      <ServiceCategoryGrid showHeader={false} />

      <style>{`
        .kx-services-header {
          display: flex; align-items: flex-end; justify-content: space-between;
          margin-bottom: 20px; gap: 12px; flex-wrap: wrap;
        }
        .kx-services-title { font-size: 22px; font-weight: 800; color: var(--text); letter-spacing: -0.01em; }
        .kx-services-subtitle { font-size: 13.5px; color: var(--muted); margin-top: 4px; }

        .kx-orders-hub-card {
          position: relative;
          width: 100%;
          text-align: left;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px 18px;
          border-radius: 16px;
          border: 1px solid rgba(var(--accentRGB), 0.35);
          background: linear-gradient(135deg, rgba(var(--accentRGB), 0.14), rgba(var(--accentRGB), 0.05));
          margin-bottom: 16px;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .kx-orders-hub-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 24px -14px rgba(var(--accentRGB), 0.45);
        }
        .kx-orders-hub-icon {
          width: 48px; height: 48px; border-radius: 13px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: var(--accent); color: #fff;
        }
        .kx-orders-hub-body { min-width: 0; }
        .kx-orders-hub-title { font-size: 16px; font-weight: 800; color: var(--text); }
        .kx-orders-hub-subtitle { font-size: 12.5px; color: var(--muted); margin-top: 2px; }

        .kx-orders-hub-divider {
          height: 1px;
          background: var(--border);
          margin-bottom: 18px;
        }
      `}</style>
    </div>
  );
}

// PHASE 3: small shared bottom-sheet used for both Sort and Filter — kept
// local to this file since neither the plan nor the rest of the app has
// an existing generic option-picker component to reuse.
function OptionSheet({ title, options, selected, onSelect, onClose }) {
  return (
    <div className="kx-sheet-backdrop" onClick={onClose}>
      <div className="kx-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="kx-sheet-header">
          <div className="kx-sheet-title">{title}</div>
          <button className="kx-sheet-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="kx-sheet-options">
          {options.map((opt) => (
            <button
              key={opt.value}
              className={`kx-sheet-option${opt.value === selected ? ' is-selected' : ''}`}
              onClick={() => onSelect(opt.value)}
            >
              <span>{opt.label}</span>
              {opt.value === selected && <Check size={16} />}
            </button>
          ))}
        </div>
      </div>
      <style>{`
        .kx-sheet-backdrop {
          position: fixed; inset: 0; z-index: 200;
          background: rgba(0,0,0,0.35);
          display: flex; align-items: flex-end; justify-content: center;
        }
        @media (min-width: 700px) {
          .kx-sheet-backdrop { align-items: center; }
        }
        .kx-sheet {
          width: 100%; max-width: 420px;
          background: var(--card);
          border-radius: 20px 20px 0 0;
          padding: 18px 6px 22px;
          max-height: 70vh;
          overflow-y: auto;
        }
        @media (min-width: 700px) {
          .kx-sheet { border-radius: 20px; }
        }
        .kx-sheet-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 14px 12px;
        }
        .kx-sheet-title { font-size: 15px; font-weight: 800; color: var(--text); }
        .kx-sheet-close {
          background: var(--border); border: none; border-radius: 999px;
          width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: var(--text);
        }
        .kx-sheet-options { display: flex; flex-direction: column; gap: 2px; }
        .kx-sheet-option {
          display: flex; align-items: center; justify-content: space-between;
          text-align: left; background: none; border: none; cursor: pointer;
          padding: 12px 14px; border-radius: 12px; font-size: 14px; font-weight: 600;
          color: var(--text);
        }
        .kx-sheet-option:hover { background: var(--accentSoft); }
        .kx-sheet-option.is-selected { color: var(--accent); }
      `}</style>
    </div>
  );
}

// English labels for the student/faculty-facing category grid — kept
// separate from SERVICE_TYPE_LABELS (still Bangla, used in headers of
// the category-filtered list / detail pages) per the request to make
// this top-level grid read in English.
const CATEGORY_LABELS_EN = {
  salon: 'Salon',
  medicine: 'Pharmacy',
  hotel: 'Food',
  bookstore: 'Stationery',
  onlinemart: 'Online Mart',
  errand: 'Pick and Drop',
};

// ---------------------------------------------------------------------
// Level 2 — category-filtered shop list. Named export, mounted at
// /services/category/:categoryType in App.jsx. Same card layout as the
// old flat Services.jsx list, just filtered to one type, with dormant
// shops split into their own lower-priority "Currently inactive"
// sub-section per the plan.
// ---------------------------------------------------------------------

export function CategoryShopList() {
  const { categoryType } = useParams();
  const navigate = useNavigate();
  const services = useVisibleServices();

  const categoryServices = (services || []).filter((s) => s.type === categoryType);
  const serviceIds = categoryServices.map((s) => s.id);
  const pendingCounts = usePendingCounts(serviceIds);

  const categoryLabel = CATEGORY_LABELS_EN[categoryType] || SERVICE_TYPE_LABELS[categoryType] || categoryType;
  const Icon = CATEGORY_ICONS[categoryType] || Store;

  if (services === null) {
    return (
      <div className="page-enter page-container content-page-bg">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: 'var(--accentSoft)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Icon size={18} color="var(--accent)" />
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{categoryLabel}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="card kuetx-skeleton-pulse"
              style={{ padding: 16, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--border)', flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ width: '35%', height: 12, borderRadius: 4, background: 'var(--border)' }} />
                <div style={{ width: '60%', height: 15, borderRadius: 4, background: 'var(--border)' }} />
              </div>
            </div>
          ))}
        </div>
        <style>{`
          .kuetx-skeleton-pulse { animation: kuetxPulse 1.1s ease-in-out infinite; }
          @keyframes kuetxPulse { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
        `}</style>
      </div>
    );
  }

  const activeShops = categoryServices.filter((s) => s.status !== 'dormant');
  const dormantShops = categoryServices.filter((s) => s.status === 'dormant');

  return (
    <div className="page-enter page-container content-page-bg">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, background: 'var(--accentSoft)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon size={18} color="var(--accent)" />
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{categoryLabel}</div>
      </div>

      {categoryServices.length === 0 ? (
        <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 13.5, color: 'var(--muted)' }}>
          No shops in this category yet.
        </div>
      ) : (
        <>
          <div className="kx-shop-grid">
            {activeShops.map((s) => (
              <ShopCard key={s.id} service={s} pendingCount={pendingCounts[s.id]} onOpen={() => navigate(`/services/${s.id}`)} />
            ))}
          </div>

          {dormantShops.length > 0 && (
            <div style={{ marginTop: 28 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Currently inactive
              </div>
              <div className="kx-shop-grid" style={{ opacity: 0.6 }}>
                {dormantShops.map((s) => (
                  <ShopCard key={s.id} service={s} pendingCount={pendingCounts[s.id]} onOpen={() => navigate(`/services/${s.id}`)} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <style>{`
        .kx-shop-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          width: 100%;
        }
        @media (min-width: 480px) {
          .kx-shop-grid { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
        }
        @media (min-width: 900px) {
          .kx-shop-grid { grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 20px; }
        }
      `}</style>
    </div>
  );
}

function ShopCard({ service: s, pendingCount, onOpen }) {
  const isInquiryMode = s.interactionMode === 'inquiry';
  // Phase 4 (Delivery/Errand Runner plan): a Runner's card shows neither
  // an inquiry-style "Send inquiry" nor a booking-style queue count —
  // pendingCount tracks 'pending' booking-mode docs specifically, which
  // an errand-mode service never has (its own status vocabulary is
  // open/runner_accepted/confirmed/finished/cancelled).
  const isErrandMode = s.interactionMode === 'errand';
  return (
    <button onClick={onOpen} className="kx-shop-card">
      <div className="kx-shop-card-media">
        {s.coverImageUrl ? (
          <img src={s.coverImageUrl} alt={s.name} />
        ) : (
          <Store size={30} color="var(--accent)" strokeWidth={1.6} />
        )}
        <span className={`kx-shop-status ${s.isOpen ? 'is-open' : 'is-closed'}`}>
          <Circle size={7} fill="currentColor" color="currentColor" />
          {s.isOpen ? 'Open' : 'Closed'}
        </span>
        {s.status === 'dormant' && (
          <span className="kx-shop-dormant-tag">Inactive</span>
        )}
      </div>
      <div className="kx-shop-card-body">
        <div className="kx-shop-card-name">{s.name}</div>
        {s.locationText && <div className="kx-shop-card-location">{s.locationText}</div>}
        <div className="kx-shop-card-action">
          {isErrandMode ? 'Send errand request' : isInquiryMode ? 'Send inquiry' : `Queue: ${pendingCount ?? '…'}`}
        </div>
      </div>

      <style>{`
        .kx-shop-card {
          text-align: left; cursor: pointer; border: 1px solid var(--border);
          background: var(--card); border-radius: 18px; overflow: hidden;
          display: flex; flex-direction: column;
          transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
        }
        .kx-shop-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 24px -12px rgba(0,0,0,0.18);
          border-color: rgba(var(--accentRGB), 0.3);
        }
        .kx-shop-card-media {
          position: relative;
          width: 100%; aspect-ratio: 4 / 3;
          background: var(--accentSoft);
          display: flex; align-items: center; justify-content: center;
          overflow: hidden;
        }
        .kx-shop-card-media img { width: 100%; height: 100%; object-fit: cover; }
        .kx-shop-status {
          position: absolute; top: 10px; left: 10px;
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 11px; font-weight: 800; border-radius: 999px; padding: 4px 9px;
          background: var(--card); backdrop-filter: blur(2px);
        }
        .kx-shop-status.is-open { color: #16a34a; }
        .kx-shop-status.is-closed { color: var(--muted); }
        .kx-shop-dormant-tag {
          position: absolute; top: 10px; right: 10px;
          font-size: 10px; font-weight: 700; color: #c2410c; background: rgba(234,88,12,0.14);
          border-radius: 6px; padding: 3px 7px;
        }
        .kx-shop-card-body { padding: 12px 14px 16px; display: flex; flex-direction: column; gap: 4px; }
        .kx-shop-card-name { font-size: 15px; font-weight: 700; color: var(--text); }
        .kx-shop-card-location { font-size: 12px; color: var(--muted); }
        .kx-shop-card-action { font-size: 12.5px; color: var(--accent); font-weight: 600; margin-top: 6px; }
      `}</style>
    </button>
  );
}
