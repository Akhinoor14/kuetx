// ── Bottom Nav Customization Panel for Settings ──────────────────────────────
// Compact control for the three middle bottom-nav slots and quick reset

import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { useNavLayout } from './nav-system/useNavLayout';

export function BottomNavCustomizationPanel() {
  const {
    layout,
    resetToDefaults,
    summary,
  } = useNavLayout();

  const [showInstructions, setShowInstructions] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const handleResetDefaults = () => {
    resetToDefaults();
    setConfirmReset(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Bottom Navigation Layout</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            {summary.pinnedGroups} pinned group{summary.pinnedGroups !== 1 ? 's' : ''} • {summary.totalGroups} total group{summary.totalGroups !== 1 ? 's' : ''}
          </div>
        </div>
        <button
          onClick={() => setShowInstructions(!showInstructions)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--muted)',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Icons.HelpCircle size={14} />
          {showInstructions ? 'Hide' : 'Show'} Guide
        </button>
      </div>

      {/* Short Instructions */}
      {showInstructions && (
        <div style={{
          padding: 12,
          borderRadius: 8,
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          fontSize: 12,
          color: 'var(--text)',
          lineHeight: 1.6,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icons.Lightbulb size={14} />
            Quick Guide
          </div>
          <div style={{ marginBottom: 8 }}>
            - Use the All Pages drawer to pin or unpin items.
          </div>
          <div style={{ marginBottom: 8 }}>
            - Create custom groups in the drawer; keep the 3 middle slots simple.
          </div>
          <div style={{ marginTop: 6 }}>
            <Link to="/settings/navigation/guide" style={{ color: 'var(--accent)', fontWeight: 700 }}>Read full guide</Link>
          </div>
        </div>
      )}

      {/* Current Layout Preview */}
      <div style={{ padding: 12, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: 'var(--muted)' }}>MIDDLE SLOTS (3)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {layout.pinnedTabs.map((tab, idx) => {
            const group = layout.customGroups.find(g => g.id === tab.id);
            const label = group?.label || tab.id;
            const icon = group?.icon;
            return (
              <div
                key={`${tab.type}-${tab.id}`}
                style={{
                  padding: '8px 10px',
                  borderRadius: 6,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {tab.type === 'group' && icon && <Icons.Folder size={14} />}
                {tab.type === 'page' && <Icons.FileText size={14} />}
                <span>{label}</span>
                {tab.type === 'group' && <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--muted)' }}>Group</span>}
              </div>
            );
          })}
          {layout.pinnedTabs.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>
              No tabs pinned yet. Customize in the app drawer.
            </div>
          )}
        </div>
      </div>

      {/* Groups Summary */}
      <div style={{ padding: 12, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: 'var(--muted)' }}>CUSTOM GROUPS ({layout.customGroups.length})</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {layout.customGroups.map(group => (
            <div
              key={group.id}
              style={{
                padding: '8px 10px',
                borderRadius: 6,
                background: group.isDefault ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'var(--surface)',
                border: `1px solid ${group.isDefault ? 'color-mix(in srgb, var(--accent) 20%, var(--border))' : 'var(--border)'}`,
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icons.Folder size={14} />
                <div>
                  <div>{group.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                    {group.items?.length || 0} page{group.items?.length !== 1 ? 's' : ''}
                    {group.isDefault && ' • Default'}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {layout.customGroups.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>
              No custom groups yet.
            </div>
          )}
        </div>
      </div>

      {/* Reset Button */}
      <div style={{ display: 'flex', gap: 8 }}>
        {!confirmReset ? (
          <button
            onClick={() => setConfirmReset(true)}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Icons.RotateCcw size={14} />
            Reset to Recommended
          </button>
        ) : (
          <>
            <button
              onClick={handleResetDefaults}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--danger)',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Confirm Reset
            </button>
            <button
              onClick={() => setConfirmReset(false)}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </>
        )}
      </div>

      {/* Helper Info */}
      <div style={{
        padding: 10,
        borderRadius: 6,
        background: 'color-mix(in srgb, var(--info) 10%, transparent)',
        border: '1px solid color-mix(in srgb, var(--info) 30%, transparent)',
        fontSize: 11,
        color: 'var(--info)',
        lineHeight: 1.5,
      }}>
        <div style={{ fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Icons.Info size={12} />
          Tip
        </div>
        Use the <strong>All Pages</strong> drawer for quick edits. This panel stays short and only shows the basics.
      </div>
    </div>
  );
}
