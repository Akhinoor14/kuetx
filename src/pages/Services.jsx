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

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Store, Circle, Scissors, Cross, UtensilsCrossed, BookOpen, ShoppingBag,
} from 'lucide-react';
import { subscribeAllServices, SERVICE_TYPE_LABELS, SERVICE_TYPES, withServiceDefaults } from '../lib/serviceSync';
import { listAllProviderAccounts } from '../lib/providerSync';
import { onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

// Phase 6: one icon per category type, shared by the full grid (this
// file) and the compact home-page preview row (Dashboard.jsx imports
// this same map so the two stay visually consistent).
export const CATEGORY_ICONS = {
  salon: Scissors,
  medicine: Cross,
  hotel: UtensilsCrossed,
  bookstore: BookOpen,
  onlinemart: ShoppingBag,
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

  useEffect(() => {
    console.log('[Services] subscribeAllServices attaching…');
    return subscribeAllServices((list) => {
      console.log('[Services] subscribeAllServices fired, count =', list.length);
      setAllServices(list);
    });
  }, []);

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

export default function Services() {
  const navigate = useNavigate();
  const services = useVisibleServices();

  if (services === null) {
    return <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>;
  }

  // NOTE: previously this returned an early "no providers yet" page and
  // hid the whole category grid when services.length === 0. That's wrong —
  // the 5 category cards (Salon/Food/Pharmacy/Stationery/Online Mart) are
  // a fixed part of this page and must always render, regardless of shop
  // count. Emptiness is shown per-category (below, via the "এখনো কোনো শপ
  // নেই" tag), never by hiding the grid itself.

  // Active-shop count per category — "active" here means not dormant,
  // matching the count the plan asks each category card to show.
  const activeCountByType = {};
  SERVICE_TYPES.forEach((t) => { activeCountByType[t] = 0; });
  services.forEach((s) => {
    if (s.status !== 'dormant' && activeCountByType[s.type] !== undefined) {
      activeCountByType[s.type] += 1;
    }
  });

  return (
    <div className="page-enter page-container content-page-bg">
      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 16 }}>Services</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {SERVICE_TYPES.map((type) => {
          const Icon = CATEGORY_ICONS[type] || Store;
          const count = activeCountByType[type];
          const isEmpty = count === 0;
          return (
            <button
              key={type}
              onClick={() => navigate(`/services/category/${type}`)}
              className="card"
              style={{
                padding: 16, textAlign: 'left', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', gap: 10,
                border: isEmpty ? '1px solid var(--border)' : '1px solid rgba(217,119,6,0.18)',
                background: isEmpty ? 'var(--card, transparent)' : 'rgba(217,119,6,0.05)',
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isEmpty ? 'var(--border)' : 'rgba(217,119,6,0.12)',
              }}>
                <Icon size={20} color={isEmpty ? 'var(--muted)' : '#d97706'} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: isEmpty ? 'var(--muted)' : 'var(--text)' }}>
                  {SERVICE_TYPE_LABELS[type]}
                </div>
                <div style={{ marginTop: 6 }}>
                  {isEmpty ? (
                    <span className="tag tag-gray">এখনো কোনো শপ নেই</span>
                  ) : (
                    <span className="tag tag-green">{count} সক্রিয় শপ</span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

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

  const categoryLabel = SERVICE_TYPE_LABELS[categoryType] || categoryType;
  const Icon = CATEGORY_ICONS[categoryType] || Store;

  if (services === null) {
    return <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>;
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
          এই ক্যাটাগরিতে এখনো কোনো শপ নেই।
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {activeShops.map((s) => (
              <ShopCard key={s.id} service={s} pendingCount={pendingCounts[s.id]} onOpen={() => navigate(`/services/${s.id}`)} />
            ))}
          </div>

          {dormantShops.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                বর্তমানে নিষ্ক্রিয়
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: 0.65 }}>
                {dormantShops.map((s) => (
                  <ShopCard key={s.id} service={s} pendingCount={pendingCounts[s.id]} onOpen={() => navigate(`/services/${s.id}`)} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ShopCard({ service: s, pendingCount, onOpen }) {
  const isInquiryMode = s.interactionMode === 'inquiry';
  return (
    <button
      onClick={onOpen}
      className="card"
      style={{
        padding: 16, textAlign: 'left', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
      }}
    >
      {s.coverImageUrl ? (
        <img
          src={s.coverImageUrl}
          alt={s.name}
          style={{ width: 44, height: 44, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }}
        />
      ) : (
        <div style={{
          width: 44, height: 44, borderRadius: 12, background: 'var(--accentSoft)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Store size={22} color="var(--accent)" />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Circle size={9} fill={s.isOpen ? '#16a34a' : '#9ca3af'} color={s.isOpen ? '#16a34a' : '#9ca3af'} />
          <span style={{ fontSize: 13, fontWeight: 800, color: s.isOpen ? '#16a34a' : 'var(--muted)' }}>
            {s.isOpen ? 'খোলা' : 'বন্ধ'}
          </span>
          {s.status === 'dormant' && (
            <span style={{
              fontSize: 10, fontWeight: 700, color: '#c2410c', background: 'rgba(234,88,12,0.12)',
              borderRadius: 6, padding: '1px 6px',
            }}
            >
              নিষ্ক্রিয়
            </span>
          )}
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>{s.name}</div>
        {s.locationText && (
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{s.locationText}</div>
        )}
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
          {isInquiryMode ? 'প্রশ্ন/অনুরোধ পাঠান' : `Queue: ${pendingCount ?? '…'}`}
        </div>
      </div>
    </button>
  );
}
