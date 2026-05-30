// ── NavPresets ──────────────────────────────────────────────────────────────────
// Preset workflows: Exam Prep, Daily Check, Finance, Academic Full, Auto, Custom

import { useState, useEffect, useCallback, useMemo } from 'react';
import * as Icons from 'lucide-react';
import { store } from '../../store/store';

const PRESETS = {
  'exam-prep': {
    label: 'Exam Prep',
    description: 'QBank, Notes, Syllabus, Results, Schedule',
    icon: 'BookMarked',
    pages: ['qbank', 'notes', 'syllabus', 'results', 'schedule'],
    context: 'exam-week',
  },
  'daily-check': {
    label: 'Daily Check',
    description: 'Attendance, Schedule, Assignments, Marks',
    icon: 'Calendar',
    pages: ['attendance', 'schedule', 'assignments', 'marks'],
    context: 'normal',
  },
  'finance': {
    label: 'Finance',
    description: 'Money, Tuition, Food & Health',
    icon: 'Wallet',
    pages: ['money', 'tuition', 'food'],
    context: 'normal',
  },
  'academic-full': {
    label: 'Academic Full',
    description: 'Courses, Attendance, Schedule, Assignments, Marks',
    icon: 'BookOpen',
    pages: ['courses', 'attendance', 'schedule', 'assignments', 'marks'],
    context: 'normal',
  },
  'auto': {
    label: 'Auto (Adaptive)',
    description: 'Let system decide based on usage',
    icon: 'Zap',
    pages: [],
    context: 'auto',
  },
};

export function useNavPresets() {
  const [currentPreset, setCurrentPreset] = useState(() => {
    try {
      const saved = store.get('current_preset_v1');
      return saved || 'auto';
    } catch {
      return 'auto';
    }
  });

  const [customPresets, setCustomPresets] = useState(() => {
    try {
      const saved = store.get('nav_custom_presets_v1');
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const sync = () => {
      try {
        const saved = store.get('current_preset_v1');
        if (saved) setCurrentPreset(saved);
      } catch {}
    };
    window.addEventListener('kuetx:store-updated', sync);
    return () => window.removeEventListener('kuetx:store-updated', sync);
  }, []);

  const resolvePreset = useCallback((presetId) => {
    return PRESETS[presetId] || customPresets.find(preset => preset.id === presetId) || null;
  }, [customPresets]);

  const applyPreset = useCallback((presetId) => {
    try {
      const preset = resolvePreset(presetId);
      if (!preset) return;

      // Save current preset
      store.set('current_preset_v1', presetId);
      setCurrentPreset(presetId);

      // Update pinned tabs if preset has pages
      if (preset.pages.length > 0) {
        const tabs = preset.pages.map(id => ({ type: 'page', id }));
        store.set('bottomnav_tabs_v2', tabs);
      }

      // Save to context for context-aware switching
      store.set('nav_context_v1', {
        ...(store.get('nav_context_v1') || {}),
        current_context: preset.context || 'custom',
        preset_applied: presetId,
        applied_at: new Date().toISOString(),
      });

      // Dispatch event to notify listeners
      window.dispatchEvent(new CustomEvent('kuetx:preset-applied', { detail: { preset: presetId } }));
    } catch (err) {
      console.error('Error applying preset:', err);
    }
  }, [resolvePreset]);

  const createCustomPreset = useCallback((name, pages) => {
    try {
      const newPreset = {
        id: `custom-${Date.now()}`,
        label: name,
        pages,
        createdAt: new Date().toISOString(),
      };
      const updated = [...customPresets, newPreset];
      setCustomPresets(updated);
      store.set('nav_custom_presets_v1', updated);
      return newPreset;
    } catch (err) {
      console.error('Error creating custom preset:', err);
      return null;
    }
  }, [customPresets]);

  const deleteCustomPreset = useCallback((presetId) => {
    try {
      const updated = customPresets.filter(p => p.id !== presetId);
      setCustomPresets(updated);
      store.set('nav_custom_presets_v1', updated);
    } catch (err) {
      console.error('Error deleting preset:', err);
    }
  }, [customPresets]);

  const result = useMemo(() => ({
    currentPreset,
    presets: PRESETS,
    customPresets,
    applyPreset,
    createCustomPreset,
    deleteCustomPreset,
  }), [currentPreset, customPresets, applyPreset, createCustomPreset, deleteCustomPreset]);

  return result;
}

export function NavPresetsPanel() {
  const { currentPreset, presets, customPresets, applyPreset } = useNavPresets();
  const [expanded, setExpanded] = useState(false);
  const currentPresetLabel = presets[currentPreset]?.label || customPresets.find(preset => preset.id === currentPreset)?.label || 'Auto';

  return (
    <div className="nav-presets-panel">
      <div className="nav-presets-header" onClick={() => setExpanded(!expanded)}>
        <Icons.Zap size={16} />
        <span>Navigation Workflows</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>{currentPresetLabel}</span>
        <Icons.ChevronDown size={14} style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
      </div>

      {expanded && (
        <div className="nav-presets-grid">
          {Object.entries(presets).map(([id, preset]) => {
            const Icon = Icons[preset.icon] || Icons.Zap;
            const isActive = currentPreset === id;
            return (
              <button
                key={id}
                className={`nav-preset-chip${isActive ? ' active' : ''}`}
                onClick={() => applyPreset(id)}
                title={preset.description}
              >
                <Icon size={16} />
                <span>{preset.label}</span>
              </button>
            );
          })}

          {customPresets.map(preset => (
            <button
              key={preset.id}
              className={`nav-preset-chip custom${currentPreset === preset.id ? ' active' : ''}`}
              onClick={() => applyPreset(preset.id)}
            >
              <Icons.Palette size={16} />
              <span>{preset.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
