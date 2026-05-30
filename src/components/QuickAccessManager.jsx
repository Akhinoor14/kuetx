import { useMemo } from 'react';
import * as Icons from 'lucide-react';
import { X } from 'lucide-react';
import { getProfile } from '../store/store';
import { getAllNavItems, useBottomNavFavourites } from './BottomNav';

export default function QuickAccessManager({ open, onClose }) {
  const profile = getProfile();
  const allItems = useMemo(() => getAllNavItems(profile).filter(i => i && i.id && i.path), [profile]);
  const [favourites, toggleFavourite] = useBottomNavFavourites();

  if (!open) return null;

  return (
    <>
      <div className="quickaccess-manager-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="quickaccess-manager" role="dialog" aria-modal="true" aria-label="Quick access manager">
        <div className="qam-header">
          <div className="qam-title">Customize Quick Access</div>
          <button className="qam-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="qam-sub">Pin your top pages to show on Dashboard</div>

        <div className="qam-list">
          {allItems.map(item => {
            const Icon = Icons[item.icon] || Icons.Circle;
            const pinned = favourites.includes(item.id);
            return (
              <div key={item.id} className="qam-item">
                <div className="qam-item-left">
                  <div className="qam-item-icon"><Icon size={16} /></div>
                  <div className="qam-item-label">{item.label}</div>
                </div>
                <button
                  className={`qam-toggle${pinned ? ' pinned' : ''}`}
                  onClick={() => toggleFavourite(item.id)}
                  aria-pressed={pinned}
                  title={pinned ? 'Unpin' : 'Pin'}
                >
                  {pinned ? 'Pinned' : 'Pin'}
                </button>
              </div>
            );
          })}
        </div>

        <div className="qam-actions">
          <button className="btn ghost" onClick={onClose}>Done</button>
        </div>
      </div>
    </>
  );
}
