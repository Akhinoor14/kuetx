// components/shared/TodayFullList.jsx
//
// Dashboard's "Today" (left) column — read-only, full list of
// everything happening today, no actions. Reuses buildTodayItems()
// from lib/todayItems.js unchanged (already the correct full-day data
// source — see HANDOFF_dashboard_today_actions.md item 4), just renders
// the FULL items array instead of TodayCard's next+following pair.
//
// Capped to ~6 rows with "See more" expand-in-place once content
// exceeds that, matching FacultyDashboard.jsx's Alerts & Notices card
// pattern exactly (never an internal scrollbar — decision #2).
import { useEffect, useState } from 'react';
import { Sunrise, PartyPopper, ChevronUp, ChevronDown } from 'lucide-react';
import { getProfile, getBDNow } from '../../store/store';
import { buildTodayItems } from '../../lib/todayItems';

const KIND_DOT = {
  class: '#F59E0B',
  tuition: '#DC2626',
  todo: '#3B82F6',
  assignment: '#8B5CF6',
};

const CAP = 6;

function ItemRow({ item }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 9, background: 'rgba(0,0,0,0.02)' }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: KIND_DOT[item.kind] || 'var(--muted)', flexShrink: 0 }} />
      <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
        {item.title}
      </span>
      {item.sub && (
        <span style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 90, whiteSpace: 'nowrap' }}>
          {item.sub}
        </span>
      )}
      {item.time && (
        <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700, flexShrink: 0, fontFamily: 'JetBrains Mono, monospace' }}>
          {item.time.split('-')[0].trim()}
        </span>
      )}
    </div>
  );
}

export default function TodayFullList() {
  const [now, setNow] = useState(() => getBDNow());
  const [expanded, setExpanded] = useState(false);

  // Same 1-minute re-evaluation as TodayCard used to do, so the list
  // naturally advances through the day without a page refresh.
  useEffect(() => {
    const t = setInterval(() => setNow(getBDNow()), 60000);
    return () => clearInterval(t);
  }, []);

  const profile = getProfile();
  const { items: allItems, isHoliday } = buildTodayItems(profile, now);

  // Once a timed item's slot has started/passed, drop it from this list —
  // same "upcoming only" rule getUpcomingPair() uses for the compact
  // widget, just kept as a full list here instead of next+following.
  // Untimed items (minutes === null, e.g. assignments due today) always
  // stay, since they have no "past" state.
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const items = allItems.filter((it) => it.minutes === null || it.minutes >= nowMinutes);

  const visibleItems = expanded ? items : items.slice(0, CAP);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
      {isHoliday && items.length === 0 && (
        <div style={{ fontSize: 12.5, color: 'var(--muted)', textAlign: 'center', padding: '18px 0', display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <PartyPopper size={20} color="var(--muted)" style={{ opacity: 0.5 }} />
          No classes today — holiday
        </div>
      )}
      {!isHoliday && items.length === 0 && (
        <div style={{ fontSize: 12.5, color: 'var(--muted)', textAlign: 'center', padding: '18px 0', display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Sunrise size={20} color="var(--muted)" style={{ opacity: 0.5 }} />
          {allItems.length === 0 ? 'Nothing planned for today' : "You're done for today"}
        </div>
      )}
      {visibleItems.map((item) => <ItemRow key={item.id} item={item} />)}
      {items.length > CAP && (
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{ marginTop: 2, padding: '6px 0', border: 'none', background: 'transparent', color: 'var(--accent)', fontWeight: 700, fontSize: 11.5, cursor: 'pointer', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}
        >
          {expanded ? <>Show less <ChevronUp size={13} /></> : <>See more ({items.length - CAP}) <ChevronDown size={13} /></>}
        </button>
      )}
    </div>
  );
}
