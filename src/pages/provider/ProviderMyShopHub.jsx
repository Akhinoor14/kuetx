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
import { useProviderLang } from '../../hooks/useProviderLang';

export default function ProviderMyShopHub({ providerProfile }) {
  const { t } = useProviderLang();
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
  const offeringsCount = service ? (service.offerings || []).length : 0;
  const offeringsSubtitle = !service
    ? t('shopHub.notSetUp')
    : t('shopHub.itemsSuffix')(offeringsCount);

  const isDormant = service?.status === 'dormant';
  const statusSubtitle = !service
    ? t('shopHub.notSetUp')
    : isDormant
      ? t('shopHub.dormant')
      : t('shopHub.active');

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
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>{t('shopHub.title')}</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{t('shopHub.subtitle')}</div>
        </div>
      </div>

      {stillLoading && (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          {t('shopHub.loading')}
        </div>
      )}

      {!stillLoading && !service && (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          {t('shopHub.noServiceYet')}
        </div>
      )}

      {!stillLoading && service && (
        <div className="kx-hub-grid">
          <HubCard
            icon={<ShoppingBag size={22} />}
            title={t('shopHub.offeringsTitle')}
            subtitle={offeringsSubtitle}
            onClick={() => navigate('/provider/shop/offerings')}
          />
          <HubCard
            icon={<SettingsIcon size={22} />}
            title={t('shopHub.settingsTitle')}
            subtitle={statusSubtitle}
            accent={isDormant ? 'warn' : 'ok'}
            onClick={() => navigate('/provider/shop/settings')}
          />
        </div>
      )}

      <style>{`
        .kx-hub-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        @media (min-width: 480px) {
          .kx-hub-grid { gap: 14px; }
        }
      `}</style>
    </div>
  );
}

function HubCard({
  icon, title, subtitle, onClick, accent,
}) {
  return (
    <button onClick={onClick} className="kx-hub-card">
      <div className="kx-hub-card-top">
        <div className="kx-hub-card-icon">{icon}</div>
        <ChevronRight size={16} className="kx-hub-card-chevron" />
      </div>
      <div className="kx-hub-card-title">{title}</div>
      <div className={`kx-hub-card-subtitle${accent === 'warn' ? ' is-warn' : accent === 'ok' ? ' is-ok' : ''}`}>
        {subtitle}
      </div>

      <style>{`
        .kx-hub-card {
          text-align: left; cursor: pointer; width: 100%; box-sizing: border-box;
          border: 1px solid var(--border); border-radius: 16px; background: var(--card);
          padding: 14px; display: flex; flex-direction: column; gap: 8px;
          transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
        }
        .kx-hub-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 22px -12px rgba(0,0,0,0.18);
          border-color: rgba(var(--accentRGB), 0.3);
        }
        .kx-hub-card-top { display: flex; align-items: flex-start; justify-content: space-between; }
        .kx-hub-card-icon {
          width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: var(--accentSoft); color: var(--accent);
        }
        .kx-hub-card-chevron { color: var(--muted); margin-top: 4px; }
        .kx-hub-card-title { font-size: 13.5px; font-weight: 700; color: var(--text); margin-top: 2px; }
        .kx-hub-card-subtitle { font-size: 11.5px; color: var(--muted); line-height: 1.4; }
        .kx-hub-card-subtitle.is-ok { color: var(--accentDark, var(--accent)); font-weight: 600; }
        .kx-hub-card-subtitle.is-warn { color: #c2410c; font-weight: 600; }
      `}</style>
    </button>
  );
}
