// ProviderMyShopHub.jsx
//
// PROVIDER_NAV_RESTRUCTURE_PROMPT.md Phase 2. Small hub page reachable at
// /provider/shop — does NOT contain any editors itself, just 2 tappable
// cards routing into ProviderOfferingsPage and ProviderShopSettingsPage.
// Mirrors ProviderDashboard.jsx's subscribeProviderServices() usage so the
// hub can show a real one-line subtitle per card without any new
// Firestore reads — same `service` shape ProviderDashboard already reads
// from, run through the same withServiceDefaults() migration helper.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight, ShoppingBag, Settings as SettingsIcon, Store,
} from 'lucide-react';
import {
  subscribeProviderServices, withServiceDefaults,
} from '../../lib/serviceSync';

export default function ProviderMyShopHub({ providerProfile }) {
  const [services, setServices] = useState(null);
  const uid = providerProfile?.uid;
  const navigate = useNavigate();

  useEffect(() => {
    if (!uid) return undefined;
    return subscribeProviderServices(uid, setServices);
  }, [uid]);

  if (!uid) return null;

  const stillLoading = services === null;
  const rawService = services && services.length > 0 ? services[0] : null;
  const service = rawService ? withServiceDefaults(rawService) : null;
  const isInquiryMode = service?.interactionMode === 'inquiry';

  const offeringsCount = service ? (service.offerings || []).length : 0;
  const offeringsSubtitle = !service
    ? 'সেট করা হয়নি'
    : isInquiryMode
      ? `${offeringsCount} item${offeringsCount === 1 ? '' : 's'}`
      : `${offeringsCount} item${offeringsCount === 1 ? '' : 's'} · ৳${service.revenueTotal || 0} আয়`;

  const isDormant = service?.status === 'dormant';
  const statusSubtitle = !service
    ? 'সেট করা হয়নি'
    : isDormant
      ? 'নিষ্ক্রিয় (Dormant)'
      : 'সক্রিয়';

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
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>My Shop</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Offerings, আয় ও শপের বিবরণ</div>
        </div>
      </div>

      {stillLoading && (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          Loading…
        </div>
      )}

      {!stillLoading && !service && (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          এখনো কোনো সার্ভিস সেট আপ করা হয়নি। Dashboard থেকে সেট আপ করুন।
        </div>
      )}

      {!stillLoading && service && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <HubCard
            icon={<ShoppingBag size={20} color="var(--accent)" />}
            title="Offerings & Earnings"
            subtitle={offeringsSubtitle}
            onClick={() => navigate('/provider/shop/offerings')}
          />
          <HubCard
            icon={<SettingsIcon size={20} color="var(--accent)" />}
            title="Shop Details & Status"
            subtitle={statusSubtitle}
            onClick={() => navigate('/provider/shop/settings')}
          />
        </div>
      )}
    </div>
  );
}

function HubCard({
  icon, title, subtitle, onClick,
}) {
  return (
    <button
      onClick={onClick}
      className="card"
      style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: 16,
        textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border)',
        background: 'var(--card)', width: '100%',
      }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 12, background: 'var(--accentSoft)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{subtitle}</div>
      </div>
      <ChevronRight size={18} color="var(--muted)" />
    </button>
  );
}
