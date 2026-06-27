import { useState, useEffect, useRef, useCallback } from 'react';

const MIN_WIDTH = 60;   // icon-only
const MAX_WIDTH = 420;
const DEFAULT_WIDTH = 240;

const BREAKPOINTS = [
  { max: 60,  cols: 0, label: 'none' },   // icon-only (ultra compact)
  { max: 180, cols: 1, label: '1col' },   // list
  { max: 270, cols: 2, label: '2col' },   // default grid
  { max: 360, cols: 3, label: '3col' },
  { max: 420, cols: 4, label: '4col' },
];

// snap to nearest breakpoint center on release
const SNAP_CENTERS = [60, 130, 240, 315, 390];

function getColsForWidth(w) {
  for (const bp of BREAKPOINTS) {
    if (w <= bp.max) return bp.cols;
  }
  return 4;
}

function snapWidth(w) {
  let closest = SNAP_CENTERS[0];
  let minDist = Math.abs(w - SNAP_CENTERS[0]);
  for (const s of SNAP_CENTERS) {
    const d = Math.abs(w - s);
    if (d < minDist) { minDist = d; closest = s; }
  }
  return closest;
}

export function useSidebarResize() {
  const [width, setWidth] = useState(() => {
    try {
      const saved = parseInt(localStorage.getItem('kuetx_sidebar_width'), 10);
      return isNaN(saved) ? DEFAULT_WIDTH : Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, saved));
    } catch { return DEFAULT_WIDTH; }
  });

  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const animFrame = useRef(null);

  const cols = getColsForWidth(width);
  const isUltraCompact = width <= 60;

  const persist = useCallback((w) => {
    try { localStorage.setItem('kuetx_sidebar_width', String(w)); } catch {}
  }, []);

  // Step through cols via button: 0→1→2→3→4→0
  const stepCols = useCallback(() => {
    const order = [SNAP_CENTERS[0], SNAP_CENTERS[1], SNAP_CENTERS[2], SNAP_CENTERS[3], SNAP_CENTERS[4]];
    const currentIdx = order.findIndex(s => s === snapWidth(width));
    const nextIdx = currentIdx === -1 ? 2 : (currentIdx + 1) % order.length;
    const next = order[nextIdx];
    setWidth(next);
    persist(next);
  }, [width, persist]);

  // Drag handlers
  const onMouseDown = useCallback((e) => {
    e.preventDefault();
    isDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [width]);

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!isDragging.current) return;
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
      animFrame.current = requestAnimationFrame(() => {
        const delta = e.clientX - startX.current;
        const next = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth.current + delta));
        setWidth(next);
      });
    };

    const onMouseUp = (e) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      const delta = e.clientX - startX.current;
      const raw = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth.current + delta));
      const snapped = snapWidth(raw);
      setWidth(snapped);
      persist(snapped);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
    };
  }, [persist]);

  return { width, cols, isUltraCompact, onMouseDown, stepCols, isDragging };
}
