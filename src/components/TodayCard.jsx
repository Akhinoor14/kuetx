// components/TodayCard.jsx
//
// Short, fixed-height "what's next today" card for the Dashboard. Same
// component renders on both desktop and mobile — it never grows past a
// couple of lines, so it never pushes the rest of the dashboard down.
// Tapping/clicking anywhere on the card opens the full /today page.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sunrise, ChevronRight } from 'lucide-react';
import { getProfile } from '../store/store';
import { buildTodayItems, getUpcomingPair } from '../lib/todayItems';

const KIND_DOT = {
  class: '#F59E0B',
  tuition: '#DC2626',
  todo: '#3B82F6',
  assignment: '#8B5CF6',
};

function ItemLine({ item, size = 13 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: KIND_DOT[item.kind] || 'var(--muted)', flexShrink: 0 }} />
      <span style={{ fontSize: size, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {item.title}
      </span>
      {item.time && (
        <span style={{ fontSize: size - 2, color: 'var(--muted)', fontWeight: 600, flexShrink: 0 }}>
          · {item.time.split('-')[0].trim()}
        </span>
      )}
    </div>
  );
}

export default function TodayCard() {
  const [now, setNow] = useState(() => new Date());

  // Re-evaluate once a minute so "Next: ..." naturally advances through
  // the day without needing a page refresh — cheap, since buildTodayItems
  // just reads already-loaded store data.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const profile = getProfile();
  const { items } = buildTodayItems(profile, now);
  const { next, following, doneForToday, isEmpty } = getUpcomingPair(items, now);

  return (
    <Link to="/today" style={{ textDecoration: 'none' }}>
      <div
        className="card"
        style={{
          marginBottom: 14,
          padding: '14px 16px',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          minHeight: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sunrise size={14} color="var(--accent)" />
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Today
            </span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 2 }}>
            See full day <ChevronRight size={12} />
          </span>
        </div>

        {isEmpty && (
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>
            Nothing planned — tap to add
          </div>
        )}

        {!isEmpty && doneForToday && (
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)' }}>
            You're done for today 🎉
          </div>
        )}

        {!isEmpty && !doneForToday && next && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <ItemLine item={next} size={14} />
            {following && <ItemLine item={following} size={12} />}
          </div>
        )}
      </div>
    </Link>
  );
}
