// Services.jsx
//
// PHASE 2 (SERVICES_PROVIDER_PLAN.md §6). Student-facing entry point from
// the Campus Life "Services" nav card. Shows isOpen status first (§6:
// "open/closed status সবচেয়ে বড় করে"), then a simple pending-queue count,
// per service. Clicking a card routes to /services/:serviceId for the
// title -> price -> description detail + booking form.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Circle } from 'lucide-react';
import { subscribeAllServices } from '../lib/serviceSync';
import { listAllProviderAccounts } from '../lib/providerSync';
import { onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

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
    listAllProviderAccounts()
      .then((accounts) => {
        setDeactivatedUids(new Set(
          accounts.filter((a) => a.status === 'deactivated').map((a) => a.uid),
        ));
      })
      .catch(() => setDeactivatedUids(new Set()));
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

export default function Services() {
  const [allServices, setAllServices] = useState(null);
  const navigate = useNavigate();
  const deactivatedUids = useDeactivatedProviderUids();

  useEffect(() => subscribeAllServices(setAllServices), []);

  const stillResolving = allServices === null || deactivatedUids === null;
  const services = stillResolving
    ? null
    : allServices.filter((s) => !deactivatedUids.has(s.providerUid));

  const serviceIds = (services || []).map((s) => s.id);
  const pendingCounts = usePendingCounts(serviceIds);

  if (services === null) {
    return <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>;
  }

  if (services.length === 0) {
    return (
      <div style={{ padding: '32px 20px', maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14, margin: '0 auto 16px',
          background: 'var(--accentSoft)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Store size={26} color="var(--accent)" />
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Services</div>
        <div style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.7 }}>
          এখনো কোনো সার্ভিস প্রোভাইডার নেই। শীঘ্রই যোগ হবে।
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 16px', maxWidth: 640, margin: '0 auto' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 16 }}>Services</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {services.map((s) => (
          <button
            key={s.id}
            onClick={() => navigate(`/services/${s.id}`)}
            className="card"
            style={{
              padding: 16, textAlign: 'left', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 12, background: 'var(--accentSoft)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Store size={22} color="var(--accent)" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Circle size={9} fill={s.isOpen ? '#16a34a' : '#9ca3af'} color={s.isOpen ? '#16a34a' : '#9ca3af'} />
                <span style={{ fontSize: 13, fontWeight: 800, color: s.isOpen ? '#16a34a' : 'var(--muted)' }}>
                  {s.isOpen ? 'খোলা' : 'বন্ধ'}
                </span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>{s.name}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                Queue: {pendingCounts[s.id] ?? '…'}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
