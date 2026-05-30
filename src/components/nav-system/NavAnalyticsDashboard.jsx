// ── NavAnalyticsDashboard ────────────────────────────────────────────────────────
// Usage analytics, pattern insights, and advanced rules configuration

import { useState } from 'react';
import * as Icons from 'lucide-react';
import { store } from '../../store/store';

export function NavAnalyticsDashboard() {
  const [analytics] = useState(() => {
    try {
      return store.get('nav_analytics_v1') || {};
    } catch {
      return {};
    }
  });

  const [usageData] = useState(() => {
    try {
      return store.get('nav_usage_v1') || { counts: {}, recent: [] };
    } catch {
      return { counts: {}, recent: [] };
    }
  });

  const counts = usageData.counts || {};
  const mostUsed = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const totalVisits = Object.values(counts).reduce((sum, n) => sum + n, 0);

  return (
    <div className="nav-analytics-dashboard">
      <div className="analytics-header">
        <Icons.BarChart3 size={18} />
        <h3>Navigation Analytics</h3>
      </div>

      {/* Usage Summary */}
      <div className="analytics-section">
        <h4>Usage Summary</h4>
        <div className="analytics-stats">
          <div className="stat-card">
            <span className="stat-label">Total Visits</span>
            <span className="stat-value">{totalVisits}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Unique Pages</span>
            <span className="stat-value">{Object.keys(counts).length}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">This Week</span>
            <span className="stat-value">{usageData.recent?.length || 0}</span>
          </div>
        </div>
      </div>

      {/* Most Used Pages */}
      <div className="analytics-section">
        <h4>Most Used Pages</h4>
        <div className="analytics-list">
          {mostUsed.length > 0 ? (
            mostUsed.map(([pageId, count], idx) => (
              <div key={pageId} className="analytics-item">
                <span className="analytics-rank">#{idx + 1}</span>
                <span className="analytics-page">{pageId}</span>
                <span className="analytics-count">{count}x</span>
                <div className="analytics-bar" style={{ width: `${(count / mostUsed[0][1]) * 100}%` }} />
              </div>
            ))
          ) : (
            <p className="analytics-empty">No usage data yet. Start using the app!</p>
          )}
        </div>
      </div>

      {/* Patterns */}
      <div className="analytics-section">
        <h4>Navigation Patterns</h4>
        <p className="analytics-hint">System detects your regular navigation flows</p>
        <p className="analytics-empty">Patterns will appear after more usage data</p>
      </div>

      {/* Advanced Rules */}
      <div className="analytics-section">
        <h4>Advanced Rules</h4>
        <AdvancedRulesEditor />
      </div>
    </div>
  );
}

// ── Advanced Rules Editor ────────────────────────────────────────────────────────
export function AdvancedRulesEditor() {
  const [rules, setRules] = useState(() => {
    try {
      const saved = store.get('nav_custom_rules_v1');
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });

  const [editingRule, setEditingRule] = useState(null);
  const [showNewRule, setShowNewRule] = useState(false);

  const addRule = (rule) => {
    const newRules = [...rules, { ...rule, id: Date.now() }];
    setRules(newRules);
    store.set('nav_custom_rules_v1', newRules);
    setShowNewRule(false);
  };

  const deleteRule = (ruleId) => {
    const newRules = rules.filter(r => r.id !== ruleId);
    setRules(newRules);
    store.set('nav_custom_rules_v1', newRules);
  };

  return (
    <div className="advanced-rules-editor">
      <p className="rules-hint">⚙️ Create custom rules for automatic nav adjustments</p>

      <div className="rules-list">
        {rules.length > 0 ? (
          rules.map(rule => (
            <div key={rule.id} className="rule-item">
              <div className="rule-trigger">
                <Icons.Zap size={14} />
                <span>{rule.trigger}</span>
              </div>
              <div className="rule-arrow">
                <Icons.ArrowRight size={12} />
              </div>
              <div className="rule-action">
                <Icons.CheckCircle size={14} />
                <span>{rule.action}</span>
              </div>
              <button
                className="rule-delete"
                onClick={() => deleteRule(rule.id)}
                title="Delete rule"
              >
                <Icons.Trash2 size={12} />
              </button>
            </div>
          ))
        ) : (
          <p className="rules-empty">No custom rules yet</p>
        )}
      </div>

      {!showNewRule ? (
        <button className="btn-add-rule" onClick={() => setShowNewRule(true)}>
          <Icons.Plus size={14} />
          Add Custom Rule
        </button>
      ) : (
        <RuleForm onSave={addRule} onCancel={() => setShowNewRule(false)} />
      )}
    </div>
  );
}

// ── Rule Form ────────────────────────────────────────────────────────────────────
function RuleForm({ onSave, onCancel }) {
  const [rule, setRule] = useState({
    trigger: 'on-weekday',
    action: 'apply-preset',
    value: 'daily-check',
  });

  const triggers = [
    { value: 'on-weekday', label: 'On weekday (Mon-Fri)' },
    { value: 'on-weekend', label: 'On weekend (Sat-Sun)' },
    { value: 'evening', label: 'Between 6PM-10PM' },
    { value: 'morning', label: 'Between 6AM-12PM' },
    { value: 'time', label: 'At specific time' },
  ];

  const actions = [
    { value: 'apply-preset', label: 'Apply preset' },
    { value: 'show-suggestion', label: 'Show suggestion' },
    { value: 'pin-page', label: 'Pin page to nav' },
  ];

  return (
    <div className="rule-form">
      <div className="form-group">
        <label>When</label>
        <select value={rule.trigger} onChange={(e) => setRule({ ...rule, trigger: e.target.value })}>
          {triggers.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Then</label>
        <select value={rule.action} onChange={(e) => setRule({ ...rule, action: e.target.value })}>
          {actions.map(a => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </select>
      </div>

      <div className="form-actions">
        <button className="btn-primary" onClick={() => onSave(rule)}>
          <Icons.Check size={14} />
          Save Rule
        </button>
        <button className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
