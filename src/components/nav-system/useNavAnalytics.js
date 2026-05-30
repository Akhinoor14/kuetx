// ── NavSuggestionsEngine ────────────────────────────────────────────────────────
// Smart suggestions: pattern detection, context triggers, discovery, batch signals

import { useState, useEffect } from 'react';
import { store } from '../../store/store';
import * as Icons from 'lucide-react';

const DEFAULT_ANALYTICS = {
  daily_usage: {}, // { pageId: { count: N, lastAccess: date, timeOfDay: [] } }
  pattern_detection: [], // [ {sequence: [a,b,c], frequency: N} ]
  smart_suggestions: [],
  batch_signals: [],
  discovery_gaps: [],
  last_updated: null,
};

export function useNavAnalytics() {
  const [analytics, setAnalytics] = useState(() => {
    try {
      const saved = store.get('nav_analytics_v1');
      if (saved && typeof saved === 'object') {
        return { ...DEFAULT_ANALYTICS, ...saved };
      }
    } catch {}
    return DEFAULT_ANALYTICS;
  });

  useEffect(() => {
    const sync = () => {
      try {
        const saved = store.get('nav_analytics_v1');
        if (saved && typeof saved === 'object') {
          setAnalytics({ ...DEFAULT_ANALYTICS, ...saved });
        }
      } catch {}
    };
    window.addEventListener('kuetx:store-updated', sync);
    return () => window.removeEventListener('kuetx:store-updated', sync);
  }, []);

  const updateAnalytics = (updates) => {
    try {
      const newAnalytics = {
        ...analytics,
        ...updates,
        last_updated: new Date().toISOString(),
      };
      setAnalytics(newAnalytics);
      store.set('nav_analytics_v1', newAnalytics);
    } catch {}
  };

  return [analytics, updateAnalytics];
}

// Detect user navigation patterns
export function detectPatterns(usageData) {
  if (!usageData || !usageData.recent) return [];

  const recent = usageData.recent.slice(0, 20); // Last 20 navigations
  const patterns = [];

  // Detect 2-page sequences
  for (let i = 0; i < recent.length - 1; i++) {
    const sequence = [recent[i], recent[i + 1]];
    const existing = patterns.find(p => JSON.stringify(p.sequence) === JSON.stringify(sequence));
    if (existing) {
      existing.frequency++;
    } else {
      patterns.push({ sequence, frequency: 1 });
    }
  }

  // Sort by frequency
  return patterns.sort((a, b) => b.frequency - a.frequency).slice(0, 5);
}

// Generate smart suggestions
export function generateSuggestions(allItems, usageData, patterns) {
  const suggestions = [];

  // Pattern-based suggestion
  if (patterns.length > 0) {
    const topPattern = patterns[0];
    if (topPattern.frequency >= 3) {
      const [first, second] = topPattern.sequence;
      const firstItem = allItems.find(i => i.id === first);
      const secondItem = allItems.find(i => i.id === second);
      if (firstItem && secondItem) {
        suggestions.push({
          type: 'pattern',
          title: 'You often flow from', // + firstItem.label + ' to ' + secondItem.label
          items: [firstItem, secondItem],
          reason: `You do this ${topPattern.frequency}x in a row`,
          icon: 'GitBranch',
        });
      }
    }
  }

  // Discovery gap - suggest unused items with high batch usage
  const counts = usageData?.counts || {};
  const unused = allItems.filter(item => !counts[item.id] || counts[item.id] === 0);
  if (unused.length > 0 && Object.values(counts).some(c => c > 10)) {
    suggestions.push({
      type: 'discovery',
      title: 'You haven\'t visited yet:',
      items: unused.slice(0, 3),
      reason: 'Popular among your batch in similar workflow',
      icon: 'Compass',
    });
  }

  // Time-based suggestion
  const currentHour = new Date().getHours();
  if (currentHour >= 19 && currentHour <= 21) {
    // Evening time
    const academicItems = allItems.filter(i =>
      ['qbank', 'syllabus', 'notes', 'assignments'].includes(i.id)
    );
    if (academicItems.length > 0 && counts['qbank'] < 5) {
      suggestions.push({
        type: 'time-based',
        title: 'Evening study time?',
        items: academicItems.slice(0, 2),
        reason: 'Perfect time for QBank practice',
        icon: 'Moon',
      });
    }
  }

  return suggestions;
}

// Get batch signals (what others in the batch are using)
export function getBatchSignals(profile) {
  // This would connect to a server to get batch-level stats
  // For now, simulated data
  const signals = [];

  if (profile?.year === 2) {
    signals.push({
      title: `Your batch (Year ${profile.year}) is using QBank heavily this week`,
      icon: 'TrendingUp',
      action: 'Pin QBank',
      actionId: 'qbank',
    });
  }

  if (profile?.semester % 2 === 1) {
    signals.push({
      title: 'End-term exam period: Most students studying Syllabus now',
      icon: 'AlertCircle',
      action: 'Switch to Exam Prep',
      actionId: 'exam-prep',
    });
  }

  return signals;
}

// Get discovery opportunities
export function getDiscoveryOpportunities(allItems, usageData, visitedPages) {
  const suggestions = [];
  const unused = allItems.filter(item => !visitedPages.includes(item.id));

  if (unused.length > 0) {
    // Group by category
    const categories = {};
    unused.forEach(item => {
      const category = item.path.split('/')[1] || 'misc';
      if (!categories[category]) categories[category] = [];
      categories[category].push(item);
    });

    // Pick top 2 categories with unused items
    Object.entries(categories).slice(0, 2).forEach(([cat, items]) => {
      suggestions.push({
        category: cat,
        items: items.slice(0, 2),
        title: `Explore ${cat} tools`,
        reason: 'You might find these helpful',
      });
    });
  }

  return suggestions;
}

export function NavSuggestionsChip({ suggestion, onAction }) {
  if (!suggestion) return null;

  const Icon = Icons[suggestion.icon] || Icons.Lightbulb;

  return (
    <div className="nav-suggestion-chip">
      <Icon size={14} />
      <div className="nav-suggestion-content">
        <p className="nav-suggestion-title">{suggestion.title}</p>
        <p className="nav-suggestion-reason">{suggestion.reason}</p>
      </div>
      <button
        className="nav-suggestion-action"
        onClick={() => onAction && onAction(suggestion)}
        aria-label="Dismiss"
      >
        <Icons.X size={12} />
      </button>
    </div>
  );
}
