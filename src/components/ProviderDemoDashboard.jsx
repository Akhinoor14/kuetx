// ProviderDemoDashboard.jsx — Phase E of DEMO_MODE_FULL_PLAN_PROMPT.md.
//
// Follows the exact precedent set by StudentDemoDashboard.jsx (Phase C)
// and FacultyDemoDashboard.jsx (Phase D): ProviderDashboard.jsx (1141
// lines) and ServiceDetail.jsx (2262 lines) were both read in full this
// phase — see demoWorld.js's Phase E section comment — and are deeply
// Firestore-coupled: live subscriptions (subscribeProviderServices,
// subscribeConfirmedBookings, subscribeOpenErrandRequestsForRunner, ...)
// plus real writes (confirmBooking, cancelBooking, finishBooking,
// acceptErrandRequest, createBooking, createErrandRequest — real
// money/order flow, not just notices this time). NOT props-driven
// convertible. This is a hand-built, purely presentational dashboard
// instead, same as the other two roles.
//
// StatCard is reused as-is (same pure shared component). No other real
// component from ProviderDashboard.jsx/ServiceDetail.jsx is reused —
// unlike MeetingCard in the faculty pass, nothing in those two files was
// confirmed pure/extractable this session, so everything below the stat
// tiles is a simple static list, matching the established precedent.
import { Store, Package, ClipboardList, Wallet, Check, Clock } from 'lucide-react';
import StatCard from './shared/StatCard';
import { DEMO_WORLD_PROVIDER } from '../data/demoWorld';

export default function ProviderDemoDashboard() {
  const { profile, offerings, bookings, revenueTotal } = DEMO_WORLD_PROVIDER;

  const pendingCount = bookings.filter((b) => b.status === 'pending').length;

  return (
    <div style={{ minHeight: '100%', background: 'var(--bg)' }}>
      {/* Purpose-built demo nav strip — mirrors Student/FacultyDemoDashboard's
          own strip exactly (same reasoning: real Sidebar/BottomNav read
          auth.currentUser / real local store, unsafe to reuse here for a
          signed-out visitor). */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.7rem 1rem', borderBottom: '1px dashed var(--border)',
        background: 'rgba(var(--accentRGB), 0.04)',
      }}>
        <Store size={16} style={{ color: 'var(--accent)' }} />
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)' }}>
          {profile.displayName}
        </span>
        <span style={{
          marginLeft: 'auto', fontSize: '0.68rem', fontWeight: 700,
          color: 'var(--muted)', padding: '0.2rem 0.5rem', borderRadius: '999px',
          border: '1px solid var(--border)',
        }}>
          Preview — read only
        </span>
      </div>

      <div style={{ padding: '1rem' }}>
        {/* Stat tiles — real StatCard component, demo props */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: '0.6rem', marginBottom: '1rem',
        }}>
          <StatCard
            label="Pending"
            value={pendingCount}
            sub="বুকিং"
            color="#d97706"
            icon={Clock}
          />
          <StatCard
            label="Offerings"
            value={offerings.length}
            sub="সার্ভিস"
            color="#2563eb"
            icon={Package}
          />
          <StatCard
            label="Revenue"
            value={`৳${revenueTotal}`}
            sub="সর্বমোট"
            color="#16a34a"
            icon={Wallet}
          />
        </div>

        {/* Bookings queue — simple static list, same precedent as
            Student/FacultyDemoDashboard's own preview cards (not
            extracted from a real component this pass — ProviderDashboard's
            PendingBookingCard is real-write-coupled, see file header). */}
        <div className="card" style={{ padding: '12px 14px', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
            <ClipboardList size={14} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>
              Bookings
            </span>
          </div>
          {bookings.map((b) => (
            <div key={b.id} style={{ padding: '0.4rem 0', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)' }}>
                  {b.offeringLabel} · {b.studentName}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                  {new Date(b.requestedAt).toLocaleString('en-BD', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <span style={{
                fontSize: '0.68rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '999px',
                color: b.status === 'confirmed' ? '#16a34a' : '#d97706',
                background: b.status === 'confirmed' ? 'rgba(22,163,74,0.1)' : 'rgba(217,119,6,0.1)',
                display: 'flex', alignItems: 'center', gap: '0.2rem',
              }}>
                {b.status === 'confirmed' && <Check size={10} />}
                {b.status === 'confirmed' ? 'Confirmed' : 'Pending'}
              </span>
            </div>
          ))}
        </div>

        {/* Offerings list — same static-list precedent */}
        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
            <Package size={14} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>
              My Offerings
            </span>
          </div>
          {offerings.map((o) => (
            <div key={o.id} style={{ padding: '0.4rem 0', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)' }}>{o.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{o.priceNote}</div>
              </div>
              <span style={{
                fontSize: '0.68rem', fontWeight: 700,
                color: o.available ? '#16a34a' : 'var(--muted)',
              }}>
                {o.available ? 'এখন করানো যাচ্ছে' : 'এখন বন্ধ'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
