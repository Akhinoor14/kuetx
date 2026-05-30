// ── useNavContext ────────────────────────────────────────────────────────────────
// Calendar-aware navigation context switching
// Detects academic phases: normal, midterm, exam-prep, exam-week, post-exam, semester-end

import { useState, useEffect, useCallback, useMemo } from 'react';
import { store } from '../../store/store';

const shallowEqual = (left, right) => {
  if (left === right) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  for (const key of leftKeys) {
    if (left[key] !== right[key]) return false;
  }
  return true;
};

const DEFAULT_NAV_CONTEXT = {
  days_to_exam: null,
  current_phase: 'normal', // normal, midterm, exam-prep, exam-week, post-exam, semester-end
  auto_context: true,
  term_start: null,
  exam_dates: [],
  last_analyzed: null,
};

export function useNavContext() {
  const [context, setContext] = useState(() => {
    try {
      const saved = store.get('nav_context_v1');
      if (saved && typeof saved === 'object') {
        return { ...DEFAULT_NAV_CONTEXT, ...saved };
      }
    } catch {}
    return DEFAULT_NAV_CONTEXT;
  });

  useEffect(() => {
    const sync = () => {
      try {
        const saved = store.get('nav_context_v1');
        if (saved && typeof saved === 'object') {
          const nextContext = { ...DEFAULT_NAV_CONTEXT, ...saved };
          setContext(prev => shallowEqual(prev, nextContext) ? prev : nextContext);
        }
      } catch {}
    };
    window.addEventListener('kuetx:store-updated', sync);
    return () => window.removeEventListener('kuetx:store-updated', sync);
  }, []);

  const updateContext = useCallback((updates) => {
    try {
      const newContext = { ...context, ...updates, last_analyzed: new Date().toISOString() };
      if (!shallowEqual(context, newContext)) {
        setContext(newContext);
        store.set('nav_context_v1', newContext);
      }
    } catch {}
  }, [context]);

  const setExamSchedule = useCallback((examDates) => {
    updateContext({
      exam_dates: examDates,
    });
  }, [updateContext]);

  const setTermStart = useCallback((startDate) => {
    updateContext({
      term_start: startDate,
    });
  }, [updateContext]);

  const actions = useMemo(() => ({ updateContext, setExamSchedule, setTermStart }), [updateContext, setExamSchedule, setTermStart]);

  return [context, actions];
}

// Detect current academic phase based on exam dates and term calendar
export function detectCurrentPhase(examDates = [], termStart = null) {
  if (!examDates || examDates.length === 0) return 'normal';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Sort exam dates
  const sortedDates = [...examDates].map(d => new Date(d)).sort((a, b) => a - b);
  const firstExam = sortedDates[0];
  const lastExam = sortedDates[sortedDates.length - 1];

  // Calculate days to first exam
  const daysToExam = Math.ceil((firstExam - today) / (1000 * 60 * 60 * 24));

  // Determine phase
  if (daysToExam < 0 && Math.abs(daysToExam) > 14) {
    // More than 14 days after exam started, likely post-exam
    return 'post-exam';
  }
  if (daysToExam < 0) {
    // During exam week
    return 'exam-week';
  }
  if (daysToExam <= 3) {
    // Last 3 days before exam
    return 'exam-week';
  }
  if (daysToExam <= 14) {
    // 2-3 weeks before exam
    return 'exam-prep';
  }
  if (daysToExam <= 21) {
    // ~3 weeks before: midterm prep
    return 'midterm';
  }

  return 'normal';
}

// Get recommended preset for current phase
export function getRecommendedPreset(phase) {
  const presetMap = {
    normal: 'daily-check',
    midterm: 'exam-prep',
    'exam-prep': 'exam-prep',
    'exam-week': 'exam-prep',
    'post-exam': 'daily-check',
    'semester-end': 'academic-full',
  };
  return presetMap[phase] || 'auto';
}

// Get context-aware suggestion
export function getContextSuggestion(phase, daysToExam) {
  const suggestions = {
    normal: 'Your nav is set to daily usage. Check assignments and attendance regularly.',
    midterm: `${daysToExam} days to first exam. Want to switch to Exam Prep mode?`,
    'exam-prep': `${daysToExam} days to exam. QBank and Syllabus are highlighted. Keep grinding! 💪`,
    'exam-week': 'Exam week! Your nav is optimized for exam prep. Good luck! 🎯',
    'post-exam': 'Exams done! Switching back to Daily Check mode.',
    'semester-end': 'Semester end approaching. Planning mode recommended.',
  };
  return suggestions[phase] || '';
}

// Auto-apply preset based on academic calendar
export function shouldAutoApplyPreset(context, currentPhase) {
  if (!context.auto_context) return null;

  const lastAnalysis = context.last_analyzed ? new Date(context.last_analyzed) : null;
  const now = new Date();

  // Only check once per day
  if (lastAnalysis && (now - lastAnalysis) < 24 * 60 * 60 * 1000) {
    return null;
  }

  // If phase changed significantly, suggest preset
  if (context.current_phase !== currentPhase) {
    return getRecommendedPreset(currentPhase);
  }

  return null;
}
