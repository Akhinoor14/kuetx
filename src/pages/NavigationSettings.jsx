import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Layers3 } from 'lucide-react';
import { NavPresetsPanel } from '../components/nav-system/useNavPresets.jsx';
import { BottomNavCustomizationPanel } from '../components/BottomNavCustomizationPanel';
import { useNavConfig } from '../components/nav-system/useNavConfig';
import { useNavContext, detectCurrentPhase } from '../components/nav-system/useNavContext';
import { useNavLayout } from '../components/nav-system/useNavLayout';

const NAV_TOGGLES = [
  { key: 'adaptive_learning', label: 'Adaptive learning', desc: 'Auto-pick your most used pages' },
  { key: 'context_aware', label: 'Calendar switching', desc: 'Swap presets by academic phase' },
  { key: 'gesture_enabled', label: 'Gesture controls', desc: 'Swipe to pin or hide tabs' },
  { key: 'show_suggestions', label: 'Smart suggestions', desc: 'Show hints and quick actions' },
  { key: 'cr_board_enabled', label: 'Show CR Board', desc: 'Show CR-only pages when needed' },
];

export default function NavigationSettings() {
  const navigate = useNavigate();
  const [navConfig, setNavConfig] = useNavConfig();
  const [navContext, navContextActions] = useNavContext();
  const { summary } = useNavLayout();
  const currentPhase = detectCurrentPhase(navContext.exam_dates, navContext.term_start);

  const updateExamDate = (date) => {
    navContextActions.setExamSchedule(date ? [date] : []);
  };

  const updateTermStart = (date) => {
    navContextActions.setTermStart(date || null);
  };

  return (
    <div className="page-enter page-container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 700, marginBottom: 2 }}>Navigation Settings</h1>
          <p style={{ fontSize: 11, color: 'var(--muted)' }}>Compact controls for presets, tabs and calendar-aware behavior.</p>
        </div>
        <button className="btn btn-ghost" onClick={() => navigate('/settings')} style={{ padding: '6px 8px' }}>
          <ArrowLeft size={14} />
        </button>
      </div>

      {/* Quick summary strip */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Pinned</div>
          <div style={{ fontWeight: 700 }}>{summary.pinnedPages}</div>
        </div>
        <div style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Groups</div>
          <div style={{ fontWeight: 700 }}>{summary.totalGroups}</div>
        </div>
        <div style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Phase</div>
          <div style={{ fontWeight: 700, textTransform: 'capitalize' }}>{currentPhase}</div>
        </div>
      </div>

      {/* Compact toggles */}
      <div className="card" style={{ marginBottom: 12, padding: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Behavior toggles</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {NAV_TOGGLES.map(item => (
            <label key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 10px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)', fontSize: 12 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{item.label}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{item.desc}</div>
              </div>
              <input type="checkbox" checked={!!navConfig[item.key]} onChange={() => setNavConfig({ [item.key]: !navConfig[item.key] })} />
            </label>
          ))}

          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 10px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)', fontSize: 12 }}>
            <div>
              <div style={{ fontWeight: 600 }}>Auto-apply presets</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Apply calendar-based presets automatically</div>
            </div>
            <input type="checkbox" checked={!!navContext.auto_context} onChange={() => navContextActions.updateContext({ auto_context: !navContext.auto_context })} />
          </label>
        </div>
      </div>

      {/* Calendar — compact inline */}
      <div className="card" style={{ marginBottom: 12, padding: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}><CalendarDays size={14} /> Academic dates</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Used for context-aware presets</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="date" value={navContext.term_start || ''} onChange={(e) => updateTermStart(e.target.value)} style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border)' }} />
          <input type="date" value={navContext.exam_dates?.[0] || ''} onChange={(e) => updateExamDate(e.target.value)} style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border)' }} />
        </div>
      </div>

      {/* Presets + Customization (kept available but compact) */}
      <div style={{ display: 'grid', gap: 12 }}>
        <div className="card" style={{ padding: 8 }}>
          <NavPresetsPanel compact />
        </div>

        <div className="card" style={{ padding: 8 }}>
          <BottomNavCustomizationPanel />
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>
        <Layers3 size={14} style={{ verticalAlign: 'middle', marginRight: 8 }} /> Keep this page for quick controls. Advanced details live in the separate guide.
      </div>
    </div>
  );
}
