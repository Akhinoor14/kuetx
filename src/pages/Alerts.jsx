import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getProfile } from '../store/store';
import { computeAlerts, decorateAlerts, filterUnreadAlerts, getDismissedAlertIds, setAlertDismissed } from '../lib/alertUtils';
import ClassNoticesPanel from '../components/ClassNoticesPanel';

export default function Alerts() {
  const profile = getProfile();
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const handleStoreUpdate = () => setRefreshTick(t => t + 1);
    window.addEventListener('kuetx:store-updated', handleStoreUpdate);
    return () => window.removeEventListener('kuetx:store-updated', handleStoreUpdate);
  }, []);

  const dismissedIds = useMemo(() => getDismissedAlertIds(), [refreshTick]);
  const groupedAlerts = useMemo(() => decorateAlerts(computeAlerts(profile), dismissedIds), [profile, refreshTick, dismissedIds]);
  const unreadCritical = filterUnreadAlerts(groupedAlerts.critical, dismissedIds);
  const unreadWarnings = filterUnreadAlerts(groupedAlerts.warnings, dismissedIds);
  const unreadPositives = filterUnreadAlerts(groupedAlerts.positives, dismissedIds);
  const unreadAssignments = filterUnreadAlerts(groupedAlerts.assignmentAlerts, dismissedIds);
  const readCritical = groupedAlerts.critical.length - unreadCritical.length;
  const readWarnings = groupedAlerts.warnings.length - unreadWarnings.length;
  const readPositives = groupedAlerts.positives.length - unreadPositives.length;
  const readAssignments = groupedAlerts.assignmentAlerts.length - unreadAssignments.length;
  const totalCount = unreadCritical.length + unreadWarnings.length + unreadPositives.length + unreadAssignments.length;
  const assignmentCounts = {
    overdue: unreadAssignments.filter(a => a.priority === 'overdue').length,
    today: unreadAssignments.filter(a => a.priority === 'today').length,
    soon: unreadAssignments.filter(a => a.priority === 'soon').length,
  };

  const dismissAlert = (id) => setAlertDismissed(id, true);
  const restoreAlert = (id) => setAlertDismissed(id, false);

  const tone = (color) => {
    if (color === 'var(--danger)') {
      return {
        bg: 'var(--dangerBg)',
        border: 'color-mix(in srgb, var(--danger) 28%, var(--border))',
        iconBg: 'rgba(248, 113, 113, 0.14)',
      };
    }
    if (color === 'var(--warning)') {
      return {
        bg: 'var(--warningBg)',
        border: 'color-mix(in srgb, var(--warning) 28%, var(--border))',
        iconBg: 'rgba(251, 191, 36, 0.14)',
      };
    }
    return {
      bg: 'var(--successBg)',
      border: 'color-mix(in srgb, var(--success) 28%, var(--border))',
      iconBg: 'rgba(74, 222, 128, 0.14)',
    };
  };

  const Section = ({ title, items, color, emoji, emptyLabel = 'None — all clear ✓' }) => (
    <div style={{
      marginBottom: 16,
      padding: 16,
      borderRadius: 18,
      border: '1px solid var(--border)',
      background: 'linear-gradient(180deg, var(--surfaceGlassStrong), var(--surfaceGlass))',
      boxShadow: '0 10px 28px rgba(0,0,0,0.10)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: 12,
            display: 'grid',
            placeItems: 'center',
            background: tone(color).iconBg,
            border: `1px solid ${tone(color).border}`,
          }}>{emoji}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{title}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{items.length} item{items.length === 1 ? '' : 's'}</div>
          </div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 800, color, padding: '6px 10px', borderRadius: 999, background: tone(color).iconBg, border: `1px solid ${tone(color).border}` }}>
          {items.length || '0'}
        </div>
      </div>
      {items.length === 0
        ? <div style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 2px' }}>{emptyLabel}</div>
        : items.map((a, i) => (
          <div key={a.id || i} style={{
            display: 'flex', alignItems: 'stretch', gap: 10, padding: '11px 14px', borderRadius: 14, marginBottom: 8,
            background: tone(color).bg,
            border: `1px solid ${tone(color).border}`,
            fontSize: 12, boxShadow: '0 6px 18px rgba(0,0,0,0.06)',
          }}>
            <Link to={a.link || '#'} onClick={() => dismissAlert(a.id)} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10, textDecoration: 'none', color: 'var(--text)', flex: 1,
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 4, boxShadow: `0 0 0 4px ${tone(color).iconBg}` }} />
              <span style={{ flex: 1, lineHeight: 1.55 }}>{a.msg}</span>
              <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0, paddingTop: 1 }}>→</span>
            </Link>
            <button
              type="button"
              onClick={() => restoreAlert(a.id)}
              style={{
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--muted)',
                borderRadius: 10,
                padding: '6px 10px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                alignSelf: 'center',
              }}
            >
              Restore
            </button>
          </div>
        ))
      }
    </div>
  );

  const AssignmentChip = ({ label, count, color }) => (
    <div style={{
      padding: '7px 10px',
      borderRadius: 999,
      border: `1px solid ${color}`,
      background: 'var(--surface)',
      color,
      fontSize: 11,
      fontWeight: 800,
      letterSpacing: '0.02em',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      whiteSpace: 'nowrap',
    }}>
      <span>{label}</span>
      <span style={{ minWidth: 18, textAlign: 'center', padding: '1px 6px', borderRadius: 999, background: color, color: 'white' }}>{count}</span>
    </div>
  );

  const AssignmentGroup = ({ title, items, color, badge }) => (
    <div style={{
      marginTop: 10,
      padding: 14,
      borderRadius: 16,
      border: `1px solid color-mix(in srgb, ${color} 28%, var(--border))`,
      background: 'linear-gradient(180deg, var(--surfaceGlassStrong), var(--surfaceGlass))',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 9, display: 'grid', placeItems: 'center', background: color, color: 'white', fontWeight: 900, fontSize: 12 }}>{badge}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{title}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{items.length} item{items.length === 1 ? '' : 's'}</div>
          </div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 800, color, padding: '6px 10px', borderRadius: 999, background: 'color-mix(in srgb, ' + color + ' 12%, transparent)', border: `1px solid color-mix(in srgb, ${color} 28%, var(--border))` }}>
          {items.length}
        </div>
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>None — all clear ✓</div>
      ) : items.map((item, index) => (
        <div key={item.id || `${item.link}-${index}`} style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: 10,
          padding: '10px 12px',
          borderRadius: 12,
          marginBottom: 8,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
          fontSize: 12,
          lineHeight: 1.45,
        }}>
          <Link to={item.link || '#'} onClick={() => dismissAlert(item.id)} style={{ flex: 1, textDecoration: 'none', color: 'inherit' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                <span style={{ padding: '3px 8px', borderRadius: 999, background: color, color: 'white', fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}>{item.priority}</span>
                <span style={{ padding: '3px 8px', borderRadius: 999, background: 'rgba(0,0,0,0.04)', color: 'var(--muted)', fontSize: 10, fontWeight: 700 }}>Due {item.dueLabel}</span>
              </div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{item.teacherLabel}</div>
              <div style={{ color: 'var(--muted)' }}>{item.msg}</div>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => restoreAlert(item.id)}
            style={{
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--muted)',
              borderRadius: 10,
              padding: '6px 10px',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              alignSelf: 'center',
            }}
          >
            Restore
          </button>
        </div>
      ))}
    </div>
  );

  return (
    <div className="page-enter page-container">
      <div className="hero-banner" style={{ marginBottom: 18, padding: 18, border: '1px solid rgba(var(--accentRGB), 0.14)', background: 'radial-gradient(circle at top left, rgba(var(--accentRGB), 0.12), transparent 34%), linear-gradient(180deg, var(--surfaceGlassStrong), var(--surfaceGlass))' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'var(--muted)', marginBottom: 6 }}>Notifications</div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 4 }}>Alerts & Suggestions</h1>
            <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>
              {totalCount} unread signals · {unreadCritical.length} critical · {unreadWarnings.length} warnings · {unreadPositives.length} good news · {unreadAssignments.length} assignments
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, minWidth: 'min(100%, 360px)' }}>
            <div style={{ padding: '10px 12px', borderRadius: 14, border: '1px solid color-mix(in srgb, var(--danger) 28%, var(--border))', background: 'var(--dangerBg)' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>Critical</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--danger)' }}>{unreadCritical.length}</div>
            </div>
            <div style={{ padding: '10px 12px', borderRadius: 14, border: '1px solid color-mix(in srgb, var(--warning) 28%, var(--border))', background: 'var(--warningBg)' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>Warnings</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--warning)' }}>{unreadWarnings.length}</div>
            </div>
            <div style={{ padding: '10px 12px', borderRadius: 14, border: '1px solid color-mix(in srgb, var(--success) 28%, var(--border))', background: 'var(--successBg)' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>Good</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--success)' }}>{unreadPositives.length}</div>
            </div>
          </div>
        </div>
      </div>
      <ClassNoticesPanel />
      <div style={{ marginBottom: 16, padding: 16, borderRadius: 18, border: '1px solid var(--border)', background: 'linear-gradient(180deg, var(--surfaceGlassStrong), var(--surfaceGlass))', boxShadow: '0 10px 28px rgba(0,0,0,0.10)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>📌 Assignment Alerts</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Grouped by urgency: overdue, today, and next 3 days</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <AssignmentChip label="Overdue" count={assignmentCounts.overdue} color="var(--danger)" />
            <AssignmentChip label="Today" count={assignmentCounts.today} color="var(--warning)" />
            <AssignmentChip label="Next 3 Days" count={assignmentCounts.soon} color="var(--success)" />
          </div>
        </div>

        <AssignmentGroup
          title="Overdue"
          items={unreadAssignments.filter(a => a.priority === 'overdue')}
          color="var(--danger)"
          badge="!"
        />
        <AssignmentGroup
          title="Due Today"
          items={unreadAssignments.filter(a => a.priority === 'today')}
          color="var(--warning)"
          badge="1"
        />
        <AssignmentGroup
          title="Next 3 Days"
          items={unreadAssignments.filter(a => a.priority === 'soon')}
          color="var(--success)"
          badge="3"
        />
      </div>
      <Section title="Critical Alerts" items={unreadCritical} color="var(--danger)" emoji="🔴" emptyLabel={readCritical ? `${readCritical} critical alert${readCritical > 1 ? 's' : ''} already read` : 'None — all clear ✓'} />
      <Section title="Warnings" items={unreadWarnings} color="var(--warning)" emoji="🟡" emptyLabel={readWarnings ? `${readWarnings} warning${readWarnings > 1 ? 's' : ''} already read` : 'None — all clear ✓'} />
      <Section title="Good News" items={unreadPositives} color="var(--success)" emoji="🟢" emptyLabel={readPositives ? `${readPositives} positive update${readPositives > 1 ? 's' : ''} already read` : 'None — all clear ✓'} />

      {(readCritical + readWarnings + readPositives + readAssignments) > 0 && (
        <div style={{ marginBottom: 16, padding: 16, borderRadius: 18, border: '1px solid var(--border)', background: 'linear-gradient(180deg, var(--surfaceGlassStrong), var(--surfaceGlass))', boxShadow: '0 10px 28px rgba(0,0,0,0.10)' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>Read notifications</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            এগুলো badge count-এ আর আসবে না. Restore দিলে আবার unread হিসেবে ফিরবে.
          </div>
        </div>
      )}
    </div>
  );
}
