import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  TIMER_MODES,
  uid,
  getTimerActiveState,
  setTimerActiveState,
  clearTimerActiveState,
  formatDurationMs,
  getTimerPrefs,
} from '../store/store';

// Play a short finish sound using WebAudio (fallback safe-guard)
const playFinishSound = () => {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(880, ctx.currentTime);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
    o.connect(g); g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.55);
    setTimeout(() => { try { ctx.close(); } catch (e) {} }, 800);
  } catch (e) {
    // ignore audio errors
  }
};

const showCompletionNotification = (title = 'Timer finished', body = '') => {
  try {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      new Notification(title, { body });
      return;
    }
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(p => {
        if (p === 'granted') new Notification(title, { body });
      }).catch(() => {});
    }
  } catch (e) {}
};

const STATUS = {
  IDLE: 'idle',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
};

const nowTs = () => Date.now();

const getElapsedMs = (state, now) => {
  if (!state) return 0;
  const base = Math.max(0, Number(state.accumulatedMs) || 0);
  if (state.status !== STATUS.RUNNING) return base;
  const startedAt = Number(state.startedAt) || now;
  return Math.max(0, base + Math.max(0, now - startedAt));
};

const buildInitialState = () => {
  const raw = getTimerActiveState();
  if (!raw || typeof raw !== 'object') {
    return {
      id: uid(),
      mode: TIMER_MODES.UP,
      status: STATUS.IDLE,
      targetMs: 0,
      accumulatedMs: 0,
      startedAt: null,
      createdAt: nowTs(),
      updatedAt: nowTs(),
      category: 'Study',
      note: '',
    };
  }
  return {
    id: raw.id || uid(),
    mode: raw.mode === TIMER_MODES.DOWN ? TIMER_MODES.DOWN : TIMER_MODES.UP,
    status: raw.status || STATUS.IDLE,
    targetMs: Math.max(0, Number(raw.targetMs) || 0),
    accumulatedMs: Math.max(0, Number(raw.accumulatedMs) || 0),
    startedAt: raw.startedAt || null,
    createdAt: raw.createdAt || nowTs(),
    updatedAt: raw.updatedAt || nowTs(),
    category: raw.category || 'Study',
    note: raw.note || '',
  };
};

export default function useTimerEngine() {
  const [state, setState] = useState(buildInitialState);
  const [tickNow, setTickNow] = useState(nowTs());

  useEffect(() => {
    if (state.status !== STATUS.RUNNING) return undefined;
    const id = setInterval(() => setTickNow(nowTs()), 250);
    return () => clearInterval(id);
  }, [state.status]);

  // Fallback finish timeout to attempt firing completion even if tab is backgrounded
  const finishTimeoutRef = useRef(null);
  const finishAtRef = useRef(null);

  const clearFinishTimeout = () => {
    try { if (finishTimeoutRef.current) { clearTimeout(finishTimeoutRef.current); finishTimeoutRef.current = null; finishAtRef.current = null; } } catch {}
  };

  useEffect(() => {
    const elapsedMs = getElapsedMs(state, tickNow);
    if (state.mode === TIMER_MODES.DOWN && state.status === STATUS.RUNNING && state.targetMs > 0 && elapsedMs >= state.targetMs) {
      const finishedAt = nowTs();
      const next = {
        ...state,
        status: STATUS.COMPLETED,
        accumulatedMs: state.targetMs,
        startedAt: null,
        endedAt: finishedAt,
        updatedAt: finishedAt,
      };
      setState(next);
      setTimerActiveState(next);
      // play finish feedback and notify user
      try {
        const prefs = (typeof getTimerPrefs === 'function') ? getTimerPrefs() : { sound: true, vibrate: true, notify: true };
        if (prefs.sound) playFinishSound();
        if (prefs.vibrate && navigator && navigator.vibrate) {
          try { navigator.vibrate([200, 80, 200]); } catch (e) {}
        }
        if (prefs.notify) showCompletionNotification('Countdown finished', formatDurationMs(next.accumulatedMs));
      } catch (e) {}
    }
    // If running and countdown active, ensure fallback timeout is scheduled
    try {
      clearFinishTimeout();
      if (state.mode === TIMER_MODES.DOWN && state.status === STATUS.RUNNING && state.targetMs > 0) {
        const remaining = Math.max(0, (Number(state.targetMs) || 0) - elapsedMs);
        finishAtRef.current = Date.now() + remaining;
        finishTimeoutRef.current = setTimeout(() => {
          try {
            // double-check and finalize
            const finishedAt = nowTs();
            const next = {
              ...state,
              status: STATUS.COMPLETED,
              accumulatedMs: state.targetMs,
              startedAt: null,
              endedAt: finishedAt,
              updatedAt: finishedAt,
            };
            setState(next);
            setTimerActiveState(next);
            const prefs = (typeof getTimerPrefs === 'function') ? getTimerPrefs() : { sound: true, vibrate: true, notify: true };
            if (prefs.sound) playFinishSound();
            if (prefs.vibrate && navigator && navigator.vibrate) {
              try { navigator.vibrate([200, 80, 200]); } catch (e) {}
            }
            if (prefs.notify) showCompletionNotification('Countdown finished', formatDurationMs(next.accumulatedMs));
          } catch (e) {}
        }, remaining + 100);
      }
    } catch (e) {}
  }, [state, tickNow]);

  useEffect(() => {
    if (state.status === STATUS.IDLE) {
      clearTimerActiveState();
      return;
    }
    setTimerActiveState(state);
  }, [state]);

  const elapsedMs = useMemo(() => getElapsedMs(state, tickNow), [state, tickNow]);
  const remainingMs = useMemo(() => {
    if (state.mode !== TIMER_MODES.DOWN) return 0;
    return Math.max(0, (Number(state.targetMs) || 0) - elapsedMs);
  }, [state.mode, state.targetMs, elapsedMs]);

  const displayMs = state.mode === TIMER_MODES.DOWN ? remainingMs : elapsedMs;

  const startUp = useCallback(({ category, note } = {}) => {
    const ts = nowTs();
    setState({
      id: uid(),
      mode: TIMER_MODES.UP,
      status: STATUS.RUNNING,
      targetMs: 0,
      accumulatedMs: 0,
      startedAt: ts,
      createdAt: ts,
      updatedAt: ts,
      endedAt: null,
      category: category || 'Study',
      note: note || '',
    });
    setTickNow(ts);
  }, []);

  const startDown = useCallback((targetMs, { category, note } = {}) => {
    const durationMs = Math.max(0, Number(targetMs) || 0);
    if (!durationMs) return false;
    const ts = nowTs();
    setState({
      id: uid(),
      mode: TIMER_MODES.DOWN,
      status: STATUS.RUNNING,
      targetMs: durationMs,
      accumulatedMs: 0,
      startedAt: ts,
      createdAt: ts,
      updatedAt: ts,
      endedAt: null,
      category: category || 'Study',
      note: note || '',
    });
    setTickNow(ts);
    // schedule fallback timeout
    try {
      if (finishTimeoutRef.current) { clearTimeout(finishTimeoutRef.current); finishTimeoutRef.current = null; }
      finishAtRef.current = ts + durationMs;
      finishTimeoutRef.current = setTimeout(() => {
        try {
          const finishedAt = nowTs();
          const next = {
            id: uid(),
            mode: TIMER_MODES.DOWN,
            status: STATUS.COMPLETED,
            targetMs: durationMs,
            accumulatedMs: durationMs,
            startedAt: null,
            createdAt: ts,
            updatedAt: finishedAt,
            endedAt: finishedAt,
            category: category || 'Study',
            note: note || '',
          };
          setState(next);
          setTimerActiveState(next);
          const prefs = (typeof getTimerPrefs === 'function') ? getTimerPrefs() : { sound: true, vibrate: true, notify: true };
          if (prefs.sound) playFinishSound();
          if (prefs.vibrate && navigator && navigator.vibrate) {
            try { navigator.vibrate([200, 80, 200]); } catch (e) {}
          }
          if (prefs.notify) showCompletionNotification('Countdown finished', formatDurationMs(next.accumulatedMs));
        } catch (e) {}
      }, durationMs + 100);
    } catch (e) {}
    return true;
  }, []);

  const pause = useCallback(() => {
    setState(prev => {
      if (prev.status !== STATUS.RUNNING) return prev;
      const ts = nowTs();
      return {
        ...prev,
        status: STATUS.PAUSED,
        accumulatedMs: getElapsedMs(prev, ts),
        startedAt: null,
        updatedAt: ts,
      };
    });
    // clear fallback timeout
    try { if (finishTimeoutRef.current) { clearTimeout(finishTimeoutRef.current); finishTimeoutRef.current = null; finishAtRef.current = null; } } catch {}
  }, []);

  const resume = useCallback(() => {
    setState(prev => {
      if (prev.status !== STATUS.PAUSED) return prev;
      const ts = nowTs();
      return {
        ...prev,
        status: STATUS.RUNNING,
        startedAt: ts,
        updatedAt: ts,
      };
    });
    setTickNow(nowTs());
    // schedule fallback again on resume
    try {
      setTimeout(() => {
        const prev = getTimerActiveState();
        if (!prev || prev.status !== STATUS.RUNNING || prev.mode !== TIMER_MODES.DOWN) return;
        const elapsed = getElapsedMs(prev, Date.now());
        const remaining = Math.max(0, (Number(prev.targetMs) || 0) - elapsed);
        if (finishTimeoutRef.current) clearTimeout(finishTimeoutRef.current);
        finishAtRef.current = Date.now() + remaining;
        finishTimeoutRef.current = setTimeout(() => {
          try {
            const finishedAt = nowTs();
            const next = {
              ...prev,
              status: STATUS.COMPLETED,
              accumulatedMs: prev.targetMs,
              startedAt: null,
              endedAt: finishedAt,
              updatedAt: finishedAt,
            };
            setState(next);
            setTimerActiveState(next);
            const prefs = (typeof getTimerPrefs === 'function') ? getTimerPrefs() : { sound: true, vibrate: true, notify: true };
            if (prefs.sound) playFinishSound();
            if (prefs.vibrate && navigator && navigator.vibrate) {
              try { navigator.vibrate([200, 80, 200]); } catch (e) {}
            }
            if (prefs.notify) showCompletionNotification('Countdown finished', formatDurationMs(next.accumulatedMs));
          } catch (e) {}
        }, remaining + 100);
      }, 20);
    } catch (e) {}
  }, []);

  const stop = useCallback((stoppedReason = 'manual') => {
    const ts = nowTs();
    const current = state;
    const finalElapsedMs = current.mode === TIMER_MODES.DOWN ? Math.min(current.targetMs || 0, elapsedMs) : elapsedMs;
    const finalized = {
      ...current,
      status: STATUS.COMPLETED,
      accumulatedMs: finalElapsedMs,
      startedAt: null,
      endedAt: ts,
      updatedAt: ts,
      stoppedReason,
    };
    setState(finalized);
    try { if (finishTimeoutRef.current) { clearTimeout(finishTimeoutRef.current); finishTimeoutRef.current = null; finishAtRef.current = null; } } catch {}
    return finalized;
  }, [state, elapsedMs]);

  const reset = useCallback(() => {
    const ts = nowTs();
    const next = {
      id: uid(),
      mode: TIMER_MODES.UP,
      status: STATUS.IDLE,
      targetMs: 0,
      accumulatedMs: 0,
      startedAt: null,
      createdAt: ts,
      updatedAt: ts,
      endedAt: null,
      category: 'Study',
      note: '',
    };
    setState(next);
    setTickNow(ts);
    try { if (finishTimeoutRef.current) { clearTimeout(finishTimeoutRef.current); finishTimeoutRef.current = null; finishAtRef.current = null; } } catch {}
  }, []);

  const setMeta = useCallback((patch) => {
    setState(prev => ({
      ...prev,
      ...patch,
      updatedAt: nowTs(),
    }));
  }, []);

  return {
    state,
    elapsedMs,
    remainingMs,
    displayMs,
    displayLabel: formatDurationMs(displayMs),
    isRunning: state.status === STATUS.RUNNING,
    isPaused: state.status === STATUS.PAUSED,
    isIdle: state.status === STATUS.IDLE,
    isCompleted: state.status === STATUS.COMPLETED,
    startUp,
    startDown,
    pause,
    resume,
    stop,
    reset,
    setMeta,
    STATUS,
  };
}
