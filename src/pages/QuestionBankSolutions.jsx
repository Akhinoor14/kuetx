import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  BookOpen, ChevronRight, Search, ArrowLeft, Calendar,
  Layers, Filter, X, Tag, Hash, ChevronDown,
  Bookmark, BookmarkCheck, Copy, Check, Sun, Moon,
} from 'lucide-react';
import 'katex/dist/katex.min.css';
import { getProfile, getCurrentTermKey } from '../store/store';
import { QB_DEPARTMENTS, QB_DEPT_CODE_MAP } from '../data/questionbank/questionBankData';

// ─────────────────────────────────────────────────────────────────────────────
// THEME — dark / light with system preference
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  dark: {
    bg: '#0C1220', surface: '#131D2E', card: '#1A2740',
    cardHov: '#1F3050', border: '#243451', borderSub: '#1A2B44',
    accent: '#22C55E', accentDim: '#16A34A', accentGlow: 'rgba(34,197,94,0.12)',
    blue: '#60A5FA', blueDim: '#3B82F6', blueBg: 'rgba(96,165,250,0.08)',
    yellow: '#FBBF24', yellowBg: 'rgba(251,191,36,0.08)', yellowText: '#FDE68A',
    text: '#E8F0FE', textSub: '#8BA3C4', textMut: '#4A6080',
    eqBg: '#0E1A30', eqBord: '#3B82F6',
    codeBgM: '#111827', codeBgP: '#060D17',
    numBg: '#0D2E1A', numText: '#4ADE80',
    shortBg: 'rgba(34,197,94,0.07)', shortBord: '#22C55E',
    bnBg: 'rgba(251,191,36,0.07)', bnBord: '#FBBF24',
    tagBg: 'rgba(96,165,250,0.12)', tagText: '#93C5FD', tagBord: 'rgba(96,165,250,0.3)',
    divider: '#1A2B44',
    selBg: '#1A2740', selBord: '#243451',
    filterActiveBg: 'rgba(34,197,94,0.12)', filterActiveBord: '#22C55E', filterActiveText: '#4ADE80',
  },
  light: {
    bg: '#F0F4FA', surface: '#FFFFFF', card: '#FFFFFF',
    cardHov: '#F0FDF4', border: '#D1DCF0', borderSub: '#E2ECF8',
    accent: '#16A34A', accentDim: '#15803D', accentGlow: 'rgba(22,163,74,0.1)',
    blue: '#2563EB', blueDim: '#1D4ED8', blueBg: 'rgba(37,99,235,0.06)',
    yellow: '#D97706', yellowBg: 'rgba(217,119,6,0.07)', yellowText: '#92400E',
    text: '#0F1F3D', textSub: '#3D5A80', textMut: '#8BA3C4',
    eqBg: '#EEF4FF', eqBord: '#2563EB',
    codeBgM: '#1C2333', codeBgP: '#0D1117',
    numBg: '#DCFCE7', numText: '#15803D',
    shortBg: '#F0FDF4', shortBord: '#16A34A',
    bnBg: '#FFFBEB', bnBord: '#D97706',
    tagBg: 'rgba(37,99,235,0.06)', tagText: '#1D4ED8', tagBord: 'rgba(37,99,235,0.2)',
    divider: '#E2ECF8',
    selBg: '#FFFFFF', selBord: '#D1DCF0',
    filterActiveBg: 'rgba(22,163,74,0.08)', filterActiveBord: '#16A34A', filterActiveText: '#15803D',
  },
};

function useSolutionsTheme() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('kuetx-sol-theme');
    if (saved) return saved === 'dark';
    return window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)').matches : true;
  });
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const h = e => {
      if (!localStorage.getItem('kuetx-sol-theme')) setDark(e.matches);
    };
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  function toggle() {
    setDark(d => {
      const next = !d;
      localStorage.setItem('kuetx-sol-theme', next ? 'dark' : 'light');
      return next;
    });
  }
  return { t: dark ? T.dark : T.light, dark, toggle };
}

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

function useBookmarks() {
  const [bookmarks, setBookmarks] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('kuetx-sol-bookmarks') || '[]')); }
    catch { return new Set(); }
  });
  function toggleBookmark(key) {
    setBookmarks(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      localStorage.setItem('kuetx-sol-bookmarks', JSON.stringify([...next]));
      return next;
    });
  }
  return { bookmarks, toggleBookmark };
}

// ─────────────────────────────────────────────────────────────────────────────
// KATEX
// ─────────────────────────────────────────────────────────────────────────────
let _katex = null;
async function loadKatex() {
  if (_katex) return _katex;
  try { _katex = (await import('katex')).default; } catch (_) { _katex = null; }
  return _katex;
}

function MathSpan({ src, display = false }) {
  const ref = useRef(null);
  useEffect(() => {
    loadKatex().then(kt => {
      if (!kt || !ref.current) return;
      try { kt.render(src, ref.current, { displayMode: display, throwOnError: false, output: 'html' }); }
      catch (_) { if (ref.current) ref.current.textContent = src; }
    });
  }, [src, display]);
  return <span ref={ref} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// MATH HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const MATH_CHARS = /[τμρσθαβγδεζηικλνξπυφχψωΔΣΩ∫∂√∞±×÷≈≠≤≥→←↔∝∇²³¹⁰⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉]/;
const MATH_PATS = [
  /[a-zA-Z]\s*=\s*[^a-zA-Z\s,.]{2,}/,
  /d[a-zA-Z]\/d[a-zA-Z]/,
  /[∫∂√∞]/,
  /\^[\d(]/,
  /[a-zA-Z]_[a-zA-Z0-9]/,
];
function isMathLine(t) {
  t = (t || '').trim();
  if (!t || t.length > 160) return false;
  if (MATH_CHARS.test(t)) return true;
  return MATH_PATS.filter(p => p.test(t)).length >= 2;
}
function hasLatex(t) {
  const text = t || '';
  return /\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]/.test(text);
}

function splitLatex(text) {
  const tokens = [];
  const re = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\])/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) tokens.push({ type: 'text', val: text.slice(last, m.index) });
    const raw = m[1];
    const disp = raw.startsWith('$$') || raw.startsWith('\\[');
    let val;
    if (raw.startsWith('$$')) val = raw.slice(2, -2).trim();
    else if (raw.startsWith('\\[')) val = raw.slice(2, -2).trim();
    else if (raw.startsWith('\\(')) val = raw.slice(2, -2).trim();
    else val = raw.slice(1, -1).trim();
    tokens.push({ type: 'math', val, display: disp });
    last = m.index + raw.length;
  }
  if (last < text.length) tokens.push({ type: 'text', val: text.slice(last) });
  return tokens;
}

function InlineMathLine({ text, t, mathStyle }) {
  if (!text) return null;
  if (!hasLatex(text)) {
    const style = mathStyle ? { fontFamily: "'STIX Two Math','Cambria Math',serif", color: t.blue } : {};
    return <span style={style}>{text}</span>;
  }
  return (
    <>
      {splitLatex(text).map((tok, i) =>
        tok.type === 'math'
          ? <MathSpan key={i} src={tok.val} display={tok.display} />
          : <span key={i} style={mathStyle ? { color: t.blue } : {}}>{tok.val}</span>
      )}
    </>
  );
}

function renderInlineCode(text, t) {
  if (!text.includes('`')) return <InlineMathLine text={text} t={t} mathStyle={isMathLine(text)} />;
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('`') && p.endsWith('`')
          ? <code key={i} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '0.87em', background: t.eqBg, color: t.blue, padding: '1px 6px', borderRadius: 4, border: `1px solid ${t.border}` }}>{p.slice(1, -1)}</code>
          : <InlineMathLine key={i} text={p} t={t} mathStyle={isMathLine(p)} />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ANSWER PARSER — 1:1 with generate.js logic
// ─────────────────────────────────────────────────────────────────────────────
function parseAnswer(text) {
  if (!text) return [{ type: 'blank' }];
  const lines = text.split('\n');

  // Table detection
  const SEP = /^\|[\s\-|:]+\|$/;
  const tableRanges = new Set();
  let ti = 0;
  while (ti < lines.length) {
    if (lines[ti].trim().startsWith('|')) {
      const block = []; let tj = ti;
      while (tj < lines.length && lines[tj].trim().startsWith('|')) { block.push(tj); tj++; }
      if (block.length >= 2 && block.some(idx => SEP.test(lines[idx].trim())))
        block.forEach(idx => tableRanges.add(idx));
      ti = tj;
    } else ti++;
  }

  const segs = [];
  let i = 0;
  while (i < lines.length) {
    // Table
    if (tableRanges.has(i)) {
      const tl = [];
      while (i < lines.length && tableRanges.has(i)) { tl.push(lines[i]); i++; }
      segs.push({ type: 'table', lines: tl }); continue;
    }
    // Fenced code
    const fenceMatch = lines[i].trim().match(/^(`{3,})/);
    if (fenceMatch) {
      const fence = fenceMatch[1];
      const lang = lines[i].trim().slice(fence.length).trim() || '';
      i++;
      const codeLines = [];
      while (i < lines.length && !lines[i].trim().startsWith(fence)) { codeLines.push(lines[i]); i++; }
      if (i < lines.length) i++;
      segs.push({ type: 'fencedcode', lines: codeLines, lang }); continue;
    }
    // Normalize: $[arr;arr]$ → `arr;arr`
    const rawNorm = lines[i].trim().replace(/\$([^$\n]*;[^$\n]*)\$/g, (match, inner) =>
      /\\/.test(inner) ? match : '`' + inner.trim() + '`'
    );
    // Normalize: single $ around \begin → $$
    const raw = rawNorm.replace(
      /^\$(\s*\\begin\{[a-z*]+\}[\s\S]*?\\end\{[a-z*]+\}\s*)\$$/,
      '$$$$$1$$$$'
    );

    if (raw === '') { segs.push({ type: 'blank' }); i++; continue; }

    const isSH     = raw.endsWith(':') && !raw.startsWith('-') && !raw.startsWith('•') && raw.length < 70;
    const isBullet = /^[-•]\s+/.test(raw);
    const isNumd   = /^\d+\.\s+/.test(raw);
    const isAscii  = /^[│├└┌┐┘┴┬┼─═╔╗╚╝╠╣╦╩╬]/.test(raw) ||
                     (lines[i].startsWith('    ') && !/^    [-•*\d]/.test(lines[i]) && raw.length > 0);
    const noMath   = raw.replace(/\$\$[\s\S]+?\$\$|\$[^$\n]+?\$/g, '').trim();
    const longWds  = (noMath.match(/\b[a-zA-Z]{4,}\b/g) || []).length;
    const hasLabel = /\([ivxlcdmIVXLCDM]{1,4}\)|\([a-zA-Z]\)/.test(noMath);
    const outside  = longWds + (hasLabel ? 2 : 0);
    const isEq     = !isSH && !isBullet && !isNumd && !isAscii && (
      /^\$\$.+\$\$\s*$/.test(raw) || raw.trim().startsWith('$$') || (hasLatex(raw) && outside < 2)
    );

    if (isSH)         segs.push({ type: 'header',    content: raw });
    else if (isEq)    segs.push({ type: 'equation',  content: raw });
    else if (isBullet)segs.push({ type: 'bullet',    content: raw.replace(/^[-•]\s*/, '') });
    else if (isNumd)  segs.push({ type: 'numbered',  num: raw.match(/^(\d+)\./)?.[1] || '', text: raw.match(/^\d+\.\s+(.*)/)?.[1] || '' });
    else if (isAscii) segs.push({ type: 'ascii',     content: raw });
    else              segs.push({ type: 'prose',     content: raw });
    i++;
  }
  return segs;
}

function parseMarkdownTable(lines) {
  return lines
    .filter(l => !l.trim().match(/^\|[\s\-|:]+\|$/))
    .map((line, ri) => ({
      isHeader: ri === 0,
      cells: line.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1).map(c => c.trim()),
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
// EQUATION BLOCK
// ─────────────────────────────────────────────────────────────────────────────
function EquationBlock({ content, t }) {
  const tokens = splitLatex(content);
  const isFullLatex = tokens.length === 1 && tokens[0].type === 'math';
  return (
    <div style={{
      background: t.eqBg,
      border: `1px solid ${t.eqBord}30`,
      borderLeft: `4px solid ${t.eqBord}`,
      borderRadius: '0 10px 10px 0',
      padding: '12px 20px',
      margin: '8px 0',
      overflowX: 'auto',
      WebkitOverflowScrolling: 'touch',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: `0 0 0 1px ${t.eqBord}15, inset 0 1px 0 ${t.eqBord}08`,
    }}>
      {isFullLatex
        ? <MathSpan src={tokens[0].val} display />
        : hasLatex(content)
          ? <span style={{ fontFamily: "'STIX Two Math','Cambria Math',serif", fontSize: '1.1em' }}>
              <InlineMathLine text={content} t={t} mathStyle />
            </span>
          : <span style={{ fontFamily: "'STIX Two Math','Cambria Math',serif", color: t.blue, fontSize: '1.1em' }}>
              {content}
            </span>
      }
    </div>
  );
}

function parseDerivationSegments(text) {
  if (!text) return null;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const hasGiven  = lines.some(l => /^given[:\s]/i.test(l));
  const hasStep   = lines.some(l => /^step\s*\d+/i.test(l));
  const hasResult = lines.some(l => /^(result|ans|∴|therefore)[:\s]/i.test(l));
  if (!((hasGiven || hasResult) && hasStep)) return null;

  const segments = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (/^given[:\s]/i.test(line)) {
      const items = [line.replace(/^given[:\s]*/i, '').trim()].filter(Boolean);
      i++;
      while (i < lines.length && !/^(find|step\s*\d+|result|ans|∴)/i.test(lines[i])) {
        if (lines[i]) items.push(lines[i]);
        i++;
      }
      segments.push({ type: 'given', items }); continue;
    }

    if (/^find[:\s]/i.test(line)) {
      segments.push({ type: 'find', text: line.replace(/^find[:\s]*/i, '') });
      i++; continue;
    }

    if (/^step\s*\d+/i.test(line)) {
      const num = parseInt(line.match(/\d+/)[0]);
      const label = line.replace(/^step\s*\d+[:\s—-]*/i, '').trim();
      const content = [];
      i++;
      while (i < lines.length && !/^step\s*\d+/i.test(lines[i]) && !/^(result|ans|∴)/i.test(lines[i])) {
        content.push(lines[i]);
        i++;
      }
      segments.push({ type: 'step', num, label, content }); continue;
    }

    if (/^(result|ans|∴|therefore)[:\s]/i.test(line)) {
      segments.push({ type: 'result', text: line.replace(/^(result|ans|∴|therefore)[:\s]*/i, '') });
      i++; continue;
    }

    segments.push({ type: 'prose', text: line });
    i++;
  }
  return segments.length > 2 ? segments : null;
}

function DerivationBlock({ segments, t }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {segments.map((seg, i) => {
        if (seg.type === 'given') return (
          <div key={i} style={{ background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: '#93C5FD', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>● Given</div>
            {seg.items.map((item, j) => (
              <div key={j} style={{ fontSize: 13, color: t.text, lineHeight: 1.8, fontFamily: item.includes('=') ? "'JetBrains Mono',monospace" : 'inherit' }}>
                <InlineMathLine text={item} t={t} mathStyle={isMathLine(item)} />
              </div>
            ))}
          </div>
        );

        if (seg.type === 'find') return (
          <div key={i} style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: '#FCD34D', letterSpacing: '0.1em', textTransform: 'uppercase', flexShrink: 0 }}>Find:</span>
            <span style={{ fontSize: 13, color: t.text }}><InlineMathLine text={seg.text} t={t} mathStyle={isMathLine(seg.text)} /></span>
          </div>
        );

        if (seg.type === 'step') return (
          <div key={i} style={{ paddingLeft: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ background: t.accent, color: '#000', borderRadius: 4, fontSize: 9.5, fontWeight: 800, padding: '2px 8px', fontFamily: "'JetBrains Mono',monospace", flexShrink: 0 }}>STEP {seg.num}</span>
              {seg.label && <span style={{ fontSize: 12.5, fontWeight: 600, color: t.textSub }}>{seg.label}</span>}
            </div>
            <div style={{ paddingLeft: 14, borderLeft: `2px solid ${t.border}` }}>
              {seg.content.map((line, j) => (
                hasLatex(line) || (line.startsWith('$$') && line.endsWith('$$'))
                  ? <EquationBlock key={j} content={line} t={t} />
                  : <div key={j} style={{ fontSize: 13, color: t.text, lineHeight: 1.75 }}>
                      <InlineMathLine text={line} t={t} mathStyle={isMathLine(line)} />
                    </div>
              ))}
            </div>
          </div>
        );

        if (seg.type === 'result') return (
          <div key={i} style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: '#4ADE80', fontSize: 16, flexShrink: 0 }}>✓</span>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#4ADE80' }}>
              <InlineMathLine text={seg.text} t={t} mathStyle={isMathLine(seg.text)} />
            </div>
          </div>
        );

        return (
          <div key={i} style={{ fontSize: 13.5, color: t.text, lineHeight: 1.85 }}>
            {renderInlineCode(seg.text, t)}
          </div>
        );
      })}
    </div>
  );
}

function FormulaPanel({ courseCode, t, onClose }) {
  const formulas = FORMULA_SHEETS[courseCode];
  if (!formulas) return null;
  return (
    <div style={{
      background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12,
      padding: '14px', marginBottom: 16,
      boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: t.accent, letterSpacing: '0.08em', textTransform: 'uppercase' }}>📐 Formula Sheet — {courseCode}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMut, fontSize: 16, padding: '0 4px' }}>×</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
        {formulas.map((f, i) => (
          <div key={i} style={{ background: t.card, border: `1px solid ${t.borderSub}`, borderRadius: 8, padding: '8px 12px' }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: t.textMut, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>{f.name}</div>
            <MathSpan src={f.tex} display={false} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ANSWER BLOCK
// ─────────────────────────────────────────────────────────────────────────────
function AnswerBlock({ text, t, tryDerivation = false }) {
  if (tryDerivation) {
    const derivSegs = parseDerivationSegments(text);
    if (derivSegs) return <DerivationBlock segments={derivSegs} t={t} />;
  }
  const segs = parseAnswer(text);
  return (
    <div style={{ fontSize: 13.5, lineHeight: 1.85, color: t.text }}>
      {segs.map((seg, idx) => {
        if (seg.type === 'blank') return <div key={idx} style={{ height: 6 }} />;

        if (seg.type === 'header')
          return <div key={idx} style={{ fontWeight: 700, color: t.accent, fontSize: 11.5, marginTop: 14, marginBottom: 3, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{seg.content}</div>;

        if (seg.type === 'equation')
          return <EquationBlock key={idx} content={seg.content} t={t} />;

        if (seg.type === 'bullet')
          return (
            <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 4, paddingLeft: 2 }}>
              <span style={{ color: t.accent, fontWeight: 800, flexShrink: 0, marginTop: 3, fontSize: 9 }}>◆</span>
              <span>{renderInlineCode(seg.content, t)}</span>
            </div>
          );

        if (seg.type === 'numbered')
          return (
            <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 4, paddingLeft: 2 }}>
              <span style={{ color: t.accent, fontWeight: 700, flexShrink: 0, minWidth: 20, fontSize: 13 }}>{seg.num}.</span>
              <span>{renderInlineCode(seg.text || '', t)}</span>
            </div>
          );

        if (seg.type === 'ascii')
          return <pre key={idx} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: t.textSub, margin: '2px 0', lineHeight: 1.5 }}>{seg.content}</pre>;

        if (seg.type === 'fencedcode') {
          const isDark = seg.lang === 'python';
          return (
            <div key={idx} style={{ margin: '8px 0 4px', borderRadius: 7, overflow: 'hidden', border: `1px solid ${t.border}` }}>
              {seg.lang && <div style={{ fontSize: 9.5, color: t.accent, fontFamily: "'JetBrains Mono',monospace", padding: '5px 12px 4px', background: isDark ? '#060D17' : '#0A1422', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>{seg.lang}</div>}
              <div style={{ background: isDark ? t.codeBgP : t.codeBgM, padding: '10px 14px' }}>
                {seg.lines.map((cl, li) => (
                  <div key={li} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, color: isDark ? '#C9D1D9' : '#D4D4D4', lineHeight: 1.7 }}>{cl || '\u00A0'}</div>
                ))}
              </div>
            </div>
          );
        }

        if (seg.type === 'table') {
          const rows = parseMarkdownTable(seg.lines);
          return (
            <div key={idx} style={{ overflowX: 'auto', margin: '10px 0' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12.5 }}>
                <tbody>
                  {rows.map((row, ri) => (
                    <tr key={ri} style={{ background: row.isHeader ? t.numBg : ri % 2 === 0 ? t.surface : t.card }}>
                      {row.cells.map((cell, ci) => (
                        <td key={ci} style={{ border: `1px solid ${t.border}`, padding: '6px 10px', fontWeight: row.isHeader ? 700 : 400, color: row.isHeader ? t.numText : t.text }}>
                          <InlineMathLine text={cell} t={t} mathStyle={false} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        // prose
        return <div key={idx} style={{ marginBottom: 2 }}>{renderInlineCode(seg.content, t)}</div>;
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CODE BLOCK (MATLAB / Python tabs)
// ─────────────────────────────────────────────────────────────────────────────
function CodeBlock({ matlab, python, t }) {
  const [tab, setTab] = useState(matlab ? 'matlab' : 'python');
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const tabs = [matlab && 'matlab', python && 'python'].filter(Boolean);
  const code = tab === 'matlab' ? (matlab || '% Not applicable') : (python || '# Not applicable');
  const lines = code.split('\n');
  const PREVIEW = 20;
  const shouldCollapse = lines.length > PREVIEW;
  const visibleCode = expanded ? code : lines.slice(0, PREVIEW).join('\n');

  function handleCopy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div style={{ borderRadius: 8, overflow: 'hidden', border: `1px solid ${t.border}`, marginTop: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', background: '#0A1422' }}>
        {tabs.map(id => (
          <button key={id} onClick={() => setTab(id)} style={{
            padding: '7px 16px', border: 'none', cursor: 'pointer',
            fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700, letterSpacing: '0.07em',
            background: 'none',
            color: tab === id ? (id === 'matlab' ? '#FFD700' : '#86EFAC') : '#4A6080',
            borderBottom: `2px solid ${tab === id ? (id === 'matlab' ? '#FFD700' : '#86EFAC') : 'transparent'}`,
            transition: 'all .12s',
          }}>
            {id === 'matlab' ? '⬡ MATLAB' : '🐍 Python'}
          </button>
        ))}
        <button onClick={handleCopy} style={{
          marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 600,
          color: copied ? '#4ADE80' : '#4A6080', padding: '7px 12px',
          display: 'flex', alignItems: 'center', gap: 4, transition: 'color .15s',
        }}>
          {copied ? <><Check size={12} /> copied</> : <><Copy size={12} /> copy</>}
        </button>
      </div>
      <pre style={{
        margin: 0, padding: '12px 16px',
        background: tab === 'matlab' ? t.codeBgM : t.codeBgP,
        color: tab === 'matlab' ? '#D4D4D4' : '#C9D1D9',
        fontSize: 12.5, fontFamily: "'JetBrains Mono',monospace",
        overflowX: 'auto', lineHeight: 1.7,
        WebkitOverflowScrolling: 'touch',
      }}>{visibleCode}</pre>
      {shouldCollapse && (
        <button onClick={() => setExpanded(e => !e)} style={{
          width: '100%', padding: '7px', background: '#0A1422', border: 'none',
          borderTop: '1px dashed #1A2B44', color: '#4A6080', fontSize: 11,
          cursor: 'pointer', fontFamily: "'JetBrains Mono',monospace",
        }}>
          {expanded ? '▲ show less' : `▼ show ${lines.length - PREVIEW} more lines`}
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QUESTION CARD
// ─────────────────────────────────────────────────────────────────────────────
function QuestionCard({ question: q, globalIdx, showYearBadge, t, bookmarks, toggleBookmark, courseKey }) {
  const [open, setOpen] = useState(false);
  const typeColor = getTypeColor(q.type);
  const hasCode = q.matlab || q.python;
  const bmKey = `${courseKey}_${q._year || ''}_${q.id}`;
  const isBookmarked = bookmarks?.has(bmKey);

  return (
    <div style={{
      background: t.card,
      border: `1px solid ${open ? typeColor.border + '55' : t.border}`,
      borderLeft: `4px solid ${typeColor.border}`,
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 12,
      transition: 'border-color .15s, box-shadow .15s',
      boxShadow: open ? '0 4px 20px rgba(0,0,0,0.12)' : 'none',
    }}>
      {/* ── LAYER 1: Header — always visible, click to expand ── */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'grid', gridTemplateColumns: '50px 1fr 32px', cursor: 'pointer', userSelect: 'none' }}
      >
        {/* Q-number */}
        <div style={{
          background: t.numBg, color: t.numText,
          fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRight: `1px solid ${t.borderSub}`, flexShrink: 0,
        }}>
          {q.id || `Q${globalIdx + 1}`}
        </div>

        {/* Question text + badges */}
        <div style={{ padding: '12px 12px 10px' }}>
          <div style={{ fontWeight: 600, fontSize: 13.5, color: t.text, lineHeight: 1.55 }}>
            <InlineMathLine text={q.question} t={t} mathStyle={isMathLine(q.question)} />
          </div>
          <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {q.type && (
              <span style={{
                fontSize: 9.5, fontWeight: 700, color: typeColor.text,
                background: typeColor.bg, border: `1px solid ${typeColor.border}30`,
                borderRadius: 4, padding: '2px 7px', letterSpacing: '0.06em', textTransform: 'uppercase',
              }}>{q.type}</span>
            )}
            {showYearBadge && q._year && (
              <span style={{
                fontSize: 9.5, fontWeight: 600, color: t.blue,
                background: t.blueBg, border: `1px solid ${t.blue}30`,
                borderRadius: 4, padding: '2px 7px',
              }}>{q._year}</span>
            )}
          </div>
        </div>

        {/* Chevron */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          paddingTop: 14, color: t.textMut,
          transition: 'transform .22s',
          transform: open ? 'rotate(180deg)' : 'none',
        }}>
          <ChevronDown size={14} />
        </div>
      </div>

      {/* ── LAYER 2: Quick Answer — always visible ── */}
      {q.short_answer && (
        <div style={{
          borderTop: `1px solid ${t.borderSub}`,
          background: t.shortBg, padding: '9px 13px 9px 64px',
        }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: t.accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>
            ● Quick Answer
          </div>
          <AnswerBlock text={q.short_answer} t={t} />
        </div>
      )}

      {/* Action bar — bookmark button */}
      <div style={{
        borderTop: `1px dashed ${t.borderSub}`,
        background: t.shortBg, padding: '6px 13px 6px 64px',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        {(q.detailed_answer || hasCode) && (
          <button onClick={() => setOpen(o => !o)} style={{
            fontSize: 11, fontWeight: 600, color: t.blue, background: t.blueBg,
            border: `1px solid ${t.blue}30`, borderRadius: 6, padding: '3px 10px',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
          }}>
            {open ? '▲ Close' : '📖 Full Solution'}
          </button>
        )}
        {toggleBookmark && (
          <button
            onClick={e => { e.stopPropagation(); toggleBookmark(bmKey); }}
            style={{
              marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
              color: isBookmarked ? '#FBBF24' : t.textMut, padding: '3px 6px',
              display: 'flex', alignItems: 'center', gap: 4, fontSize: 11,
              fontWeight: 600, transition: 'color .15s',
            }}
          >
            {isBookmarked ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
            {isBookmarked ? 'Saved' : 'Save'}
          </button>
        )}
      </div>

      {/* ── LAYER 3: Expanded body ── */}
      {open && (
        <div>
          {q.detailed_answer && (
            <div style={{ borderTop: `1px solid ${t.borderSub}`, padding: '12px 14px', background: t.surface }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: t.blue, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>● Full Solution</div>
              <AnswerBlock text={q.detailed_answer} t={t} />
            </div>
          )}
          {q.explanation_bn && (
            <div style={{ borderTop: `1px solid ${t.borderSub}`, background: t.bnBg, padding: '10px 14px' }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: t.yellow, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>● বাংলায় ব্যাখ্যা</div>
              <div style={{ fontFamily: "'Nirmala UI','Hind Siliguri',sans-serif", color: t.yellowText, fontSize: 13, lineHeight: 1.9 }}>
                <AnswerBlock text={q.explanation_bn} t={t} />
              </div>
            </div>
          )}
          {hasCode && (
            <div style={{ borderTop: `1px solid ${t.borderSub}`, padding: '10px 14px' }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: t.accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>● Code</div>
              <CodeBlock matlab={q.matlab} python={q.python} t={t} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AVAILABLE SOLUTIONS CONFIG
// Structure: { DEPT: { TERM: { COURSECODE: { name, courseCode } } } }
// Add new courses here as JSON files are added to /public/solutions/
// ─────────────────────────────────────────────────────────────────────────────
const AVAILABLE_SOLUTIONS = {
  ESE: {
    Y2T1: {
      CSE2113: { name: 'Computer Programming', courseCode: 'CSE 2113' },
      ME2115:  { name: 'Fluid Mechanics',       courseCode: 'ME 2115'  },
    },
  },
};

const PROBE_YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024];

const FORMULA_SHEETS = {
  ME2115: [
    { name: 'Continuity',             tex: 'A_1 V_1 = A_2 V_2' },
    { name: 'Bernoulli',              tex: '\\frac{p}{\\rho g} + \\frac{V^2}{2g} + z = C' },
    { name: 'Reynolds Number',        tex: 'Re = \\frac{\\rho V D}{\\mu}' },
    { name: "Newton's Viscosity",     tex: '\\tau = \\mu \\dfrac{du}{dy}' },
    { name: 'Kinematic Viscosity',    tex: '\\nu = \\dfrac{\\mu}{\\rho}' },
    { name: 'Darcy-Weisbach',         tex: 'h_f = f\\dfrac{L}{D}\\dfrac{V^2}{2g}' },
    { name: 'Hydrostatic Pressure',   tex: 'p = \\rho g h' },
    { name: 'Discharge',              tex: 'Q = A \\cdot V' },
  ],
};

const TYPE_COLORS = {
  theory:      { border: '#60A5FA', bg: 'rgba(96,165,250,0.08)',  text: '#93C5FD' },
  numerical:   { border: '#22C55E', bg: 'rgba(34,197,94,0.08)',   text: '#4ADE80' },
  programming: { border: '#F59E0B', bg: 'rgba(245,158,11,0.08)',  text: '#FCD34D' },
  default:     { border: '#4A6080', bg: 'rgba(74,96,128,0.06)',   text: '#8BA3C4' },
};
function getTypeColor(type) {
  return TYPE_COLORS[(type || '').toLowerCase()] || TYPE_COLORS.default;
}

// ─────────────────────────────────────────────────────────────────────────────
// FILTER BAR — type + year (used in 'all' view)
// ─────────────────────────────────────────────────────────────────────────────
function FilterBar({ allYears, allTypes, activeYears, activeTypes, onYearToggle, onTypeToggle, onClear, t, filterBookmarked, setFilterBookmarked, bookmarks }) {
  const hasActive = activeYears.size > 0 || activeTypes.size > 0 || filterBookmarked;
  const [openYear, setOpenYear] = useState(false);
  const [openType, setOpenType] = useState(false);

  const Pill = ({ label, active, onClick }) => (
    <button onClick={onClick} style={{
      fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, cursor: 'pointer',
      border: `1px solid ${active ? t.filterActiveBord : t.border}`,
      background: active ? t.filterActiveBg : 'transparent',
      color: active ? t.filterActiveText : t.textSub,
      transition: 'all .12s',
    }}>{label}</button>
  );

  return (
    <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
      <Filter size={13} color={t.textMut} />

      {/* Year pills */}
      {allYears.length > 0 && (
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: t.textMut, letterSpacing: '0.07em', textTransform: 'uppercase', marginRight: 2 }}>Year</span>
          {allYears.map(y => (
            <Pill key={y} label={y} active={activeYears.has(y)} onClick={() => onYearToggle(y)} />
          ))}
        </div>
      )}

      {allYears.length > 0 && allTypes.length > 0 && <div style={{ width: 1, height: 20, background: t.border }} />}

      {/* Type pills */}
      {allTypes.length > 0 && (
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: t.textMut, letterSpacing: '0.07em', textTransform: 'uppercase', marginRight: 2 }}>Type</span>
          {allTypes.map(ty => (
            <Pill key={ty} label={ty} active={activeTypes.has(ty)} onClick={() => onTypeToggle(ty)} />
          ))}
          <button onClick={() => { setFilterBookmarked(v => !v); }} style={{
            fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, cursor: 'pointer',
            border: `1px solid ${filterBookmarked ? '#FBBF24' : t.border}`,
            background: filterBookmarked ? 'rgba(251,191,36,0.12)' : 'transparent',
            color: filterBookmarked ? '#FBBF24' : t.textMut,
            transition: 'all .12s', display: 'flex', alignItems: 'center', gap: 4,
          }}>
            ⭐ Saved{filterBookmarked && bookmarks.size > 0 ? ` (${bookmarks.size})` : ''}
          </button>
        </div>
      )}

      {hasActive && (
        <button onClick={onClear} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: t.textMut, background: 'transparent', border: 'none', cursor: 'pointer', padding: '3px 6px' }}>
          <X size={12} /> Clear
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function QuestionBankSolutions() {
  const { t, dark, toggle: toggleTheme } = useSolutionsTheme();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { bookmarks, toggleBookmark } = useBookmarks();
  const profile = getProfile();

  const profileDeptRaw = String(profile?.dept || '').trim();
  const myDept = profileDeptRaw
    ? (QB_DEPT_CODE_MAP[profileDeptRaw] ||
       QB_DEPT_CODE_MAP[Object.keys(QB_DEPT_CODE_MAP).find(k => k.toLowerCase() === profileDeptRaw.toLowerCase()) || ''] ||
       null)
    : null;

  // ── Navigation
  // views: 'home' | 'courses' | 'years' | 'solutions' | 'all'
  const [view, setView]                   = useState('home');
  const [selectedDept, setSelectedDept]   = useState(myDept || 'ESE');
  const [selectedTerm, setSelectedTerm]   = useState('Y2T1');
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedYear, setSelectedYear]   = useState(null);
  const [availableYears, setAvailableYears] = useState([]);
  const [yearMeta, setYearMeta] = useState({});
  const [solutionData, setSolutionData]   = useState(null);

  // 'all' view state — all years merged
  const [allYearsData, setAllYearsData]   = useState([]); // [{year, questions}]
  const [allLoading, setAllLoading]       = useState(false);
  const [visibleCount, setVisibleCount]   = useState(20);
  const [allViewTab, setAllViewTab]       = useState('questions');

  // Shared
  const [showFormulas, setShowFormulas] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [filterBookmarked, setFilterBookmarked] = useState(false);

  // Shared
  const [loading, setLoading]             = useState(false);
  const [searchRaw, setSearchRaw]         = useState('');
  const search = useDebounce(searchRaw, 220);

  useEffect(() => {
    const dept   = searchParams.get('dept');
    const term   = searchParams.get('term');
    const course = searchParams.get('course');
    const year   = searchParams.get('year');
    if (dept && AVAILABLE_SOLUTIONS[dept]) {
      setSelectedDept(dept);
      if (term) setSelectedTerm(term);
      if (course && AVAILABLE_SOLUTIONS[dept]?.[term]?.[course]) {
        setSelectedCourse(course);
        if (year === 'all') {
          setView('all');
        } else if (year) {
          setSelectedYear(year);
          setView('solutions');
        } else {
          setView('years');
        }
      } else if (term) {
        setView('courses');
      }
    }
  }, []);

  // Filters (for 'all' view)
  const [filterYears, setFilterYears]     = useState(new Set());
  const [filterTypes, setFilterTypes]     = useState(new Set());

  // ── Derived
  const depts   = useMemo(() => Object.keys(AVAILABLE_SOLUTIONS), []);
  const terms   = useMemo(() => Object.keys(AVAILABLE_SOLUTIONS[selectedDept] || {}), [selectedDept]);
  const courses = useMemo(() => {
    const map = AVAILABLE_SOLUTIONS[selectedDept]?.[selectedTerm] || {};
    return Object.entries(map).map(([code, data]) => ({ code, ...data }));
  }, [selectedDept, selectedTerm]);
  const courseInfo = selectedCourse ? AVAILABLE_SOLUTIONS[selectedDept]?.[selectedTerm]?.[selectedCourse] : null;
  const courseKey = `${selectedDept}_${selectedTerm}_${selectedCourse}`;

  // Probe available years
  useEffect(() => {
    if (!selectedCourse || !selectedDept || !selectedTerm) { setAvailableYears([]); setYearMeta({}); return; }
    let cancelled = false;
    setYearMeta({});
    Promise.all(
      PROBE_YEARS.map(year =>
        fetch(`/solutions/${selectedDept}/${selectedTerm}/${selectedCourse}/${year}.json`)
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (!data) return null;
            if (!cancelled) {
              setYearMeta(prev => ({ ...prev, [String(year)]: { count: data.questions?.length || 0 } }));
            }
            return year;
          })
          .catch(() => null)
      )
    ).then(results => { if (!cancelled) setAvailableYears(results.filter(Boolean).sort((a, b) => b - a)); });
    return () => { cancelled = true; };
  }, [selectedDept, selectedTerm, selectedCourse]);

  // Load single year
  useEffect(() => {
    if (!selectedCourse || !selectedYear) { setSolutionData(null); return; }
    setLoading(true);
    fetch(`/solutions/${selectedDept}/${selectedTerm}/${selectedCourse}/${selectedYear}.json`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { setSolutionData(data); setLoading(false); setSearchRaw(''); })
      .catch(() => { setSolutionData(null); setLoading(false); });
  }, [selectedDept, selectedTerm, selectedCourse, selectedYear]);

  // Load all years (for 'all' view)
  useEffect(() => {
    if (view !== 'all' || !selectedCourse || availableYears.length === 0) return;
    setAllLoading(true);
    setAllYearsData([]);
    setFilterYears(new Set()); setFilterTypes(new Set());
    Promise.all(
      availableYears.map(year =>
        fetch(`/solutions/${selectedDept}/${selectedTerm}/${selectedCourse}/${year}.json`)
          .then(r => r.ok ? r.json() : null)
          .then(data => data ? { year, questions: (data.questions || []).map(q => ({ ...q, _year: String(year) })) } : null)
          .catch(() => null)
      )
    ).then(results => {
      setAllYearsData(results.filter(Boolean).sort((a, b) => b.year - a.year));
      setAllLoading(false);
    });
  }, [view, selectedCourse, availableYears]);

  // ── Questions for 'solutions' (single year)
  const filteredQuestions = useMemo(() => {
    if (!solutionData?.questions) return [];
    if (!search.trim()) return solutionData.questions;
    const sq = search.toLowerCase();
    return solutionData.questions.filter(q =>
      String(q.id).includes(sq) ||
      (q.question || '').toLowerCase().includes(sq) ||
      (q.short_answer || '').toLowerCase().includes(sq) ||
      (q.detailed_answer || '').toLowerCase().includes(sq) ||
      (q.explanation_bn || '').includes(search)  // bangla: don't lowercase
    );
  }, [solutionData, search]);

  // ── Questions for 'all' view (merged + filtered)
  const allMergedQuestions = useMemo(() => {
    const all = allYearsData.flatMap(d => d.questions);
    return all;
  }, [allYearsData]);

  const allUniqueYears = useMemo(() => [...new Set(allMergedQuestions.map(q => q._year))].sort((a, b) => b - a), [allMergedQuestions]);
  const allUniqueTypes = useMemo(() => [...new Set(allMergedQuestions.map(q => q.type).filter(Boolean))].sort(), [allMergedQuestions]);

  const frequencyData = useMemo(() => {
    if (allMergedQuestions.length === 0) return [];
    const types = allUniqueTypes.length > 0 ? allUniqueTypes : ['theory', 'numerical', 'programming'];
    const years = allUniqueYears;
    return types.map(type => {
      const byYear = {};
      let total = 0;
      years.forEach(y => {
        const count = allMergedQuestions.filter(q => q._year === y && q.type === type).length;
        byYear[y] = count;
        total += count;
      });
      return { type, byYear, total };
    }).filter(row => row.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [allMergedQuestions, allUniqueTypes, allUniqueYears]);

  const filteredAllQuestions = useMemo(() => {
    let qs = allMergedQuestions;
    if (filterBookmarked) {
      qs = qs.filter(q => {
        const key = `${selectedDept}_${selectedTerm}_${selectedCourse}_${q._year || ''}_${q.id}`;
        return bookmarks.has(key);
      });
    }
    if (filterYears.size > 0) qs = qs.filter(q => filterYears.has(q._year));
    if (filterTypes.size > 0) qs = qs.filter(q => filterTypes.has(q.type));
    if (search.trim()) {
      const sq = search.toLowerCase();
      qs = qs.filter(q =>
        (q.question || '').toLowerCase().includes(sq) ||
        (q.short_answer || '').toLowerCase().includes(sq) ||
        (q.detailed_answer || '').toLowerCase().includes(sq) ||
        (q.explanation_bn || '').includes(search)  // bangla: don't lowercase
      );
    }
    return qs;
  }, [allMergedQuestions, filterBookmarked, bookmarks, filterYears, filterTypes, search, selectedDept, selectedTerm, selectedCourse]);

  // ── Nav helpers
  function goHome() {
    setView('home'); setSelectedCourse(null); setSelectedYear(null);
    setSolutionData(null); setSearchRaw(''); setSearchParams({});
  }
  function goCourses() {
    setView('courses'); setSelectedYear(null); setSolutionData(null); setSearchRaw('');
    setSearchParams({ dept: selectedDept, term: selectedTerm });
  }
  function goYears(code) {
    setSelectedCourse(code); setSelectedYear(null); setSolutionData(null);
    setView('years'); setSearchRaw('');
    setSearchParams({ dept: selectedDept, term: selectedTerm, course: code });
  }
  function goSolutions(year) {
    setSelectedYear(String(year)); setView('solutions'); setSearchRaw('');
    setSearchParams({ dept: selectedDept, term: selectedTerm, course: selectedCourse, year: String(year) });
  }
  function goAll() {
    setView('all'); setSearchRaw(''); setFilterYears(new Set()); setFilterTypes(new Set()); setVisibleCount(20); setAllViewTab('questions'); setFilterBookmarked(false);
    setSearchParams({ dept: selectedDept, term: selectedTerm, course: selectedCourse, year: 'all' });
  }

  // ── Shared UI elements
  const s = {
    page:  { minHeight: '100vh', background: t.bg, color: t.text, fontFamily: "'Inter',sans-serif", paddingBottom: 60 },
    wrap:  { maxWidth: 860, margin: '0 auto', padding: '0 16px' },
    back:  { display: 'inline-flex', alignItems: 'center', gap: 5, color: t.accent, fontWeight: 600, fontSize: 12.5, cursor: 'pointer', marginBottom: 16, padding: '5px 11px', border: `1px solid ${t.accent}35`, borderRadius: 6, background: t.accentGlow, userSelect: 'none' },
    secTitle: { fontSize: 20, fontWeight: 800, color: t.text, marginBottom: 3 },
    secSub:   { fontSize: 13, color: t.textSub, marginBottom: 20 },
    select: { background: t.selBg, color: t.text, border: `1px solid ${t.selBord}`, borderRadius: 7, padding: '8px 11px', fontSize: 13, outline: 'none', cursor: 'pointer', minWidth: 120, fontFamily: "'Inter',sans-serif" },
    courseGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 12 },
    yearGrid:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 10 },
    searchBox:  { position: 'relative', marginBottom: 14 },
    searchIn:   { width: '100%', padding: '9px 13px 9px 36px', background: t.card, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: "'Inter',sans-serif" },
  };

  const PageHeader = () => (
    <div style={{ padding: '24px 0 18px', borderBottom: `1px solid ${t.border}`, marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <div style={{ background: t.accentGlow, border: `1px solid ${t.accent}40`, borderRadius: 10, padding: '9px', display: 'flex' }}>
          <BookOpen size={20} color={t.accent} />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: t.text }}>Solution Bank</h1>
          <p style={{ margin: 0, fontSize: 12, color: t.textSub, marginTop: 1 }}>Past paper solutions with step-by-step answers</p>
        </div>
        <button
          onClick={toggleTheme}
          style={{
            background: t.surface, border: `1px solid ${t.border}`, borderRadius: 8,
            padding: '7px 10px', cursor: 'pointer', color: t.textSub,
            display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600,
            transition: 'all .15s',
          }}
          title="Toggle theme"
        >
          {dark ? <Sun size={14} /> : <Moon size={14} />}
          {dark ? 'Light' : 'Dark'}
        </button>
      </div>
    </div>
  );

  const Breadcrumb = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 0 12px', fontSize: 11.5, color: t.textMut, flexWrap: 'wrap' }}>
      <span onClick={goHome} style={{ color: t.accent, cursor: 'pointer', fontWeight: 500 }}>Solutions</span>
      {['courses','years','solutions','all'].includes(view) && <>
        <ChevronRight size={11} color={t.textMut} />
        <span onClick={view !== 'courses' ? goCourses : undefined} style={{ color: view === 'courses' ? t.text : t.textMut, cursor: view !== 'courses' ? 'pointer' : 'default', fontWeight: view === 'courses' ? 600 : 400 }}>{selectedDept}·{selectedTerm}</span>
      </>}
      {['years','solutions','all'].includes(view) && courseInfo && <>
        <ChevronRight size={11} color={t.textMut} />
        <span onClick={view === 'solutions' || view === 'all' ? () => setView('years') : undefined} style={{ color: view === 'years' ? t.text : t.textMut, cursor: view !== 'years' ? 'pointer' : 'default', fontWeight: view === 'years' ? 600 : 400 }}>{courseInfo.courseCode}</span>
      </>}
      {view === 'solutions' && selectedYear && <>
        <ChevronRight size={11} color={t.textMut} />
        <span style={{ color: t.text, fontWeight: 600 }}>{selectedYear}</span>
      </>}
      {view === 'all' && <>
        <ChevronRight size={11} color={t.textMut} />
        <span style={{ color: t.text, fontWeight: 600 }}>All Papers</span>
      </>}
    </div>
  );

  const DeptTermBar = () => (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20, padding: '12px 14px', background: t.surface, borderRadius: 10, border: `1px solid ${t.border}` }}>
      <div style={{ flex: 1, minWidth: 150 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: t.textMut, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>Department</div>
        <select value={selectedDept} onChange={e => { setSelectedDept(e.target.value); setSelectedTerm(Object.keys(AVAILABLE_SOLUTIONS[e.target.value] || {})[0] || 'Y2T1'); }} style={s.select}>
          {depts.map(code => <option key={code} value={code}>{code} — {QB_DEPARTMENTS[code]?.split('of ')[1] || QB_DEPARTMENTS[code] || code}</option>)}
        </select>
      </div>
      <div style={{ flex: 1, minWidth: 110 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: t.textMut, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>Term</div>
        <select value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)} style={s.select}>
          {terms.map(term => <option key={term} value={term}>{term}</option>)}
        </select>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // VIEW: HOME
  // ════════════════════════════════════════════════════════════════════════════
  if (view === 'home') return (
    <div style={s.page}>
      <div style={s.wrap}>
        <PageHeader />
        <div style={s.secTitle}>Browse Solutions</div>
        <div style={{ fontSize: 13, color: t.textSub, marginBottom: 18 }}>Select department and term to see available courses</div>
        <DeptTermBar />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.textMut, letterSpacing: '0.07em', textTransform: 'uppercase' }}>Available now · {courses.length} course{courses.length !== 1 ? 's' : ''}</div>
          <button onClick={goCourses} style={{ background: t.accent, color: '#fff', border: 'none', borderRadius: 7, padding: '7px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Browse all →</button>
        </div>
        <div style={s.courseGrid}>
          {courses.map(course => (
            <div key={course.code} onClick={() => { setSelectedCourse(course.code); setView('years'); }}
              style={{ background: t.card, border: `1px solid ${t.border}`, borderLeft: `3px solid ${t.accent}`, borderRadius: 10, padding: '16px 18px', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = t.cardHov}
              onMouseLeave={e => e.currentTarget.style.background = t.card}
            >
              <div style={{ fontSize: 10, color: t.accent, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 5 }}>{course.courseCode}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text, lineHeight: 1.4 }}>{course.name}</div>
              <div style={{ marginTop: 8, fontSize: 11, color: t.textMut }}>View past papers →</div>
            </div>
          ))}
        </div>
      </div>
      <KatexStyle />
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // VIEW: COURSES
  // ════════════════════════════════════════════════════════════════════════════
  if (view === 'courses') return (
    <div style={s.page}>
      <div style={s.wrap}>
        <PageHeader />
        <Breadcrumb />
        <span onClick={goHome} style={s.back}><ArrowLeft size={13} /> Back</span>
        <DeptTermBar />
        <div style={s.secTitle}>Courses</div>
        <div style={s.secSub}>{selectedDept} · {selectedTerm} · {courses.length} available</div>
        <div style={s.courseGrid}>
          {courses.map(course => (
            <div key={course.code} onClick={() => goYears(course.code)}
              style={{ background: t.card, border: `1px solid ${t.border}`, borderLeft: `4px solid ${t.accent}`, borderRadius: 10, padding: '16px 18px', cursor: 'pointer', transition: 'background .12s' }}
              onMouseEnter={e => e.currentTarget.style.background = t.cardHov}
              onMouseLeave={e => e.currentTarget.style.background = t.card}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: t.accent, background: t.accentGlow, border: `1px solid ${t.accent}30`, borderRadius: 5, padding: '3px 8px', letterSpacing: '0.06em' }}>{course.courseCode}</span>
                <Layers size={15} color={t.textMut} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text, lineHeight: 1.4, marginBottom: 8 }}>{course.name}</div>
              <div style={{ fontSize: 11, color: t.textMut, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Calendar size={11} /> View past papers →
              </div>
            </div>
          ))}
          {courses.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: t.textMut }}>No courses yet for {selectedDept} · {selectedTerm}</div>}
        </div>
      </div>
      <KatexStyle />
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // VIEW: YEARS
  // ════════════════════════════════════════════════════════════════════════════
  if (view === 'years') return (
    <div style={s.page}>
      <div style={s.wrap}>
        <PageHeader />
        <Breadcrumb />
        <span onClick={goCourses} style={s.back}><ArrowLeft size={13} /> All Courses</span>

        {courseInfo && (
          <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderLeft: `4px solid ${t.accent}`, borderRadius: '0 10px 10px 0', padding: '12px 16px', marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: t.accent, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>{courseInfo.courseCode}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>{courseInfo.name}</div>
            <div style={{ fontSize: 11.5, color: t.textMut, marginTop: 2 }}>{selectedDept} · {selectedTerm}</div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <div style={s.secTitle}>Past Papers</div>
            <div style={{ fontSize: 12.5, color: t.textSub }}>{availableYears.length === 0 ? 'Checking available years…' : `${availableYears.length} year${availableYears.length !== 1 ? 's' : ''} available`}</div>
          </div>
          {availableYears.length > 0 && (
            <button onClick={goAll} style={{ background: t.blueBg, color: t.blue, border: `1px solid ${t.blueDim}40`, borderRadius: 7, padding: '7px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Hash size={13} /> All years combined
            </button>
          )}
        </div>

        <div style={s.yearGrid}>
          {availableYears.length > 0
            ? availableYears.map(year => (
                <div key={year} onClick={() => goSolutions(year)}
                  style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: '18px 12px', cursor: 'pointer', textAlign: 'center', transition: 'border-color .12s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = t.accent; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.transform = 'none'; }}
                >
                  <div style={{ fontSize: 24, fontWeight: 800, color: t.accent, fontFamily: "'JetBrains Mono',monospace" }}>{year}</div>
                  <div style={{ fontSize: 10.5, color: t.textMut, marginTop: 4 }}>Exam</div>
                  <div style={{ marginTop: 8, fontSize: 9.5, background: t.accentGlow, color: t.accent, borderRadius: 4, padding: '2px 7px', display: 'inline-block', fontWeight: 700, letterSpacing: '0.07em' }}>AVAILABLE</div>
                  {yearMeta[String(year)]?.count > 0 && (
                    <div style={{ fontSize: 10, color: t.textMut, marginTop: 4 }}>
                      {yearMeta[String(year)].count} questions
                    </div>
                  )}
                </div>
              ))
            : PROBE_YEARS.slice().reverse().map(year => (
                <div key={year} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: '18px 12px', textAlign: 'center', opacity: 0.3 }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: t.textMut, fontFamily: "'JetBrains Mono',monospace" }}>{year}</div>
                  <div style={{ fontSize: 10, color: t.textMut, marginTop: 4 }}>Checking…</div>
                </div>
              ))
          }
        </div>
      </div>
      <KatexStyle />
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // VIEW: ALL YEARS — merged questions with filter panel
  // ════════════════════════════════════════════════════════════════════════════
  if (view === 'all') return (
    <div style={s.page}>
      <div className="qs-print-area">
        <div style={s.wrap}>
          <div className="qs-no-print"><PageHeader /></div>
          <div className="qs-no-print"><Breadcrumb /></div>
          <span className="qs-no-print" onClick={() => setView('years')} style={s.back}><ArrowLeft size={13} /> Back to Years</span>

        {courseInfo && (
          <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderLeft: `4px solid ${t.blue}`, borderRadius: '0 10px 10px 0', padding: '10px 14px', marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: t.blue, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>{courseInfo.courseCode} · All Papers</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: t.text }}>{courseInfo.name}</div>
              </div>
              {FORMULA_SHEETS[selectedCourse] && (
                <button onClick={() => setShowFormulas(v => !v)} style={{
                  background: showFormulas ? t.accentGlow : t.surface,
                  color: showFormulas ? t.accent : t.textMut,
                  border: `1px solid ${showFormulas ? t.accent + '40' : t.border}`,
                  borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  📐 Formulas
                </button>
              )}
            </div>
            <div style={{ fontSize: 11.5, color: t.textMut }}>{selectedDept} · {selectedTerm} · {availableYears.join(', ')}</div>
            {showFormulas && <FormulaPanel courseCode={selectedCourse} t={t} onClose={() => setShowFormulas(false)} />}
          </div>
        )}

        {allLoading && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: t.textMut }}>
            <div style={{ fontSize: 26, marginBottom: 8 }}>⏳</div>
            <div style={{ fontSize: 13 }}>Loading all years…</div>
          </div>
        )}

        {!allLoading && allMergedQuestions.length > 0 && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: `1px solid ${t.border}`, paddingBottom: 0 }}>
              {[
                { id: 'questions', label: `Questions (${allMergedQuestions.length})` },
                { id: 'analysis', label: '📊 Analysis' },
              ].map(tab => (
                <button key={tab.id} onClick={() => setAllViewTab(tab.id)} style={{
                  padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
                  fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
                  color: allViewTab === tab.id ? t.accent : t.textMut,
                  borderBottom: `2px solid ${allViewTab === tab.id ? t.accent : 'transparent'}`,
                  marginBottom: -1, transition: 'color .15s',
                }}>{tab.label}</button>
              ))}
            </div>

            {allViewTab === 'questions' && (
              <>
                <FilterBar
                  allYears={allUniqueYears}
                  allTypes={allUniqueTypes}
                  activeYears={filterYears}
                  activeTypes={filterTypes}
                  onYearToggle={y => { setFilterYears(prev => { const s = new Set(prev); s.has(y) ? s.delete(y) : s.add(y); return s; }); setVisibleCount(20); }}
                  onTypeToggle={ty => { setFilterTypes(prev => { const s = new Set(prev); s.has(ty) ? s.delete(ty) : s.add(ty); return s; }); setVisibleCount(20); }}
                  onClear={() => { setFilterYears(new Set()); setFilterTypes(new Set()); setVisibleCount(20); setFilterBookmarked(false); }}
                  t={t}
                  filterBookmarked={filterBookmarked}
                  setFilterBookmarked={setFilterBookmarked}
                  bookmarks={bookmarks}
                />

                <div className="qs-no-print" style={s.searchBox}>
                  <Search size={14} style={{ position: 'absolute', top: 11, left: 12, color: t.textMut, pointerEvents: 'none' }} />
                  <input type="text" placeholder="Search all questions…" value={searchRaw} onChange={e => setSearchRaw(e.target.value)} style={s.searchIn} />
                </div>

                <div style={{ fontSize: 12, color: t.textMut, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{filteredAllQuestions.length} of {allMergedQuestions.length} question{allMergedQuestions.length !== 1 ? 's' : ''}</span>
                  {(filterYears.size > 0 || filterTypes.size > 0 || filterBookmarked) && <span style={{ color: t.accent }}>Filtered</span>}
                </div>

                {filteredAllQuestions.length === 0
                  ? <div style={{ textAlign: 'center', padding: 40, color: t.textMut }}>No questions match the current filters.</div>
                  : <>
                      {filteredAllQuestions.slice(0, visibleCount).map((q, idx) => (
                        <QuestionCard
                          key={`${q._year}-${q.id}`}
                          question={q}
                          globalIdx={idx}
                          showYearBadge
                          t={t}
                          bookmarks={bookmarks}
                          toggleBookmark={toggleBookmark}
                          courseKey={courseKey}
                        />
                      ))}
                      {visibleCount < filteredAllQuestions.length && (
                        <div style={{ textAlign: 'center', padding: '16px 0' }}>
                          <button
                            onClick={() => setVisibleCount(c => c + 20)}
                            style={{
                              background: t.blueBg, color: t.blue, border: `1px solid ${t.blue}35`,
                              borderRadius: 8, padding: '9px 24px', fontWeight: 700, fontSize: 13,
                              cursor: 'pointer', fontFamily: 'inherit',
                            }}
                          >
                            Load 20 more ({filteredAllQuestions.length - visibleCount} remaining)
                          </button>
                        </div>
                      )}
                    </>
                }
              </>
            )}

            {allViewTab === 'analysis' && frequencyData.length > 0 && (
              <div>
                <div style={{ fontSize: 13, color: t.textSub, marginBottom: 14 }}>
                  Question type frequency across {allUniqueYears.length} exam years
                </div>
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', fontSize: 12.5, borderRadius: 8, overflow: 'hidden', border: `1px solid ${t.border}` }}>
                    <thead>
                      <tr style={{ background: t.numBg }}>
                        <td style={{ padding: '9px 14px', fontWeight: 700, color: t.numText, borderBottom: `2px solid ${t.border}` }}>Type</td>
                        {allUniqueYears.map(y => (
                          <td key={y} style={{ padding: '9px 10px', fontWeight: 700, color: t.numText, textAlign: 'center', borderBottom: `2px solid ${t.border}` }}>{y}</td>
                        ))}
                        <td style={{ padding: '9px 10px', fontWeight: 700, color: t.accent, textAlign: 'center', borderBottom: `2px solid ${t.border}` }}>Total</td>
                      </tr>
                    </thead>
                    <tbody>
                      {frequencyData.map((row, ri) => (
                        <tr key={row.type} style={{ background: ri % 2 === 0 ? t.surface : t.card }}>
                          <td style={{ padding: '8px 14px', fontWeight: 600, color: t.text, textTransform: 'capitalize', borderRight: `1px solid ${t.borderSub}` }}>{row.type}</td>
                          {allUniqueYears.map(y => (
                            <td key={y} style={{ padding: '8px 10px', textAlign: 'center', color: row.byYear[y] > 0 ? t.text : t.textMut, borderRight: `1px solid ${t.borderSub}` }}>
                              {row.byYear[y] > 0 ? row.byYear[y] : '—'}
                            </td>
                          ))}
                          <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: t.accent }}>{row.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {showScrollTop && (
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            style={{
              position: 'fixed', bottom: 80, right: 20, zIndex: 100,
              background: t.accent, color: '#fff', border: 'none', borderRadius: 24,
              padding: '9px 16px', fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(0,0,0,0.25)', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            ↑ Top
          </button>
        )}
      </div>
      </div>
      <KatexStyle />
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // VIEW: SOLUTIONS — single year
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div style={s.page}>
      <div className="qs-print-area">
        <div style={s.wrap}>
          <div className="qs-no-print"><PageHeader /></div>
          <div className="qs-no-print"><Breadcrumb /></div>
          <span className="qs-no-print" onClick={() => setView('years')} style={s.back}><ArrowLeft size={13} /> {selectedYear} Papers</span>

        {loading && (
          <div style={{ textAlign: 'center', padding: '50px 0', color: t.textMut }}>
            <div style={{ fontSize: 26, marginBottom: 8 }}>⏳</div>
            <div>Loading solutions…</div>
          </div>
        )}

        {!loading && solutionData && (
          <>
            {/* Meta */}
            <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 10, color: t.textMut, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Course</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{solutionData.subject_code} — {solutionData.subject}</div>
              </div>
              <div style={{ width: 1, height: 30, background: t.border }} />
              <div>
                <div style={{ fontSize: 10, color: t.textMut, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Exam</div>
                <div style={{ fontSize: 13, color: t.textSub }}>{solutionData.term} · {solutionData.exam_year}</div>
              </div>
              <div style={{ width: 1, height: 30, background: t.border }} />
              <div>
                <div style={{ fontSize: 10, color: t.textMut, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Questions</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.accent }}>{solutionData.questions?.length || 0}</div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                {FORMULA_SHEETS[selectedCourse] && (
                  <button onClick={() => setShowFormulas(v => !v)} className="qs-no-print" style={{
                    background: showFormulas ? t.accentGlow : t.surface,
                    color: showFormulas ? t.accent : t.textMut,
                    border: `1px solid ${showFormulas ? t.accent + '40' : t.border}`,
                    borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    📐 Formulas
                  </button>
                )}
                <button onClick={() => window.print()} className="qs-no-print" style={{
                  background: t.surface,
                  color: t.textMut,
                  border: `1px solid ${t.border}`,
                  borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  🖨️ Print
                </button>
                <button onClick={goAll} className="qs-no-print" style={{ background: t.blueBg, color: t.blue, border: `1px solid ${t.blue}35`, borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Hash size={12} /> All years
                </button>
              </div>
            </div>

            {showFormulas && FORMULA_SHEETS[selectedCourse] && <FormulaPanel courseCode={selectedCourse} t={t} onClose={() => setShowFormulas(false)} />}

            <div className="qs-no-print" style={s.searchBox}>
              <Search size={14} style={{ position: 'absolute', top: 11, left: 12, color: t.textMut, pointerEvents: 'none' }} />
              <input type="text" placeholder="Search questions…" value={searchRaw} onChange={e => setSearchRaw(e.target.value)} style={s.searchIn} />
            </div>

            {search && <div style={{ fontSize: 11.5, color: t.textMut, marginBottom: 12 }}>{filteredQuestions.length} result{filteredQuestions.length !== 1 ? 's' : ''}</div>}

            {filteredQuestions.length === 0
              ? <div style={{ textAlign: 'center', padding: 40, color: t.textMut }}>No questions match.</div>
              : filteredQuestions.map((q, idx) => (
                  <QuestionCard
                    key={q.id ?? idx}
                    question={q}
                    globalIdx={idx}
                    showYearBadge={false}
                    t={t}
                    bookmarks={bookmarks}
                    toggleBookmark={toggleBookmark}
                    courseKey={courseKey}
                  />
                ))
            }
          </>
        )}

        {!loading && !solutionData && (
          <div style={{ textAlign: 'center', padding: 50, color: t.textMut }}>
            <BookOpen size={38} style={{ marginBottom: 12, opacity: 0.35 }} />
            <div>Could not load solutions for {selectedYear}.</div>
          </div>
        )}
      </div>
      </div>
      <KatexStyle />
    </div>
  );
}

function KatexStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap');
      .katex { font-size: 1.06em; }
      .katex-display { overflow-x: auto; padding: 4px 0; margin: 0 !important; }
      .katex-display > .katex { text-align: left; }
      @media (max-width: 480px) {
        /* Remove left indent on small screens */
        .qs-quick, .qs-actions, .qs-section { padding-left: 14px !important; }
        /* Smaller Q-number badge */
        .qs-qnum { min-width: 36px !important; font-size: 10px !important; }
        /* Filter pills — horizontal scroll */
        .qs-filter-bar { overflow-x: auto !important; flex-wrap: nowrap !important; -webkit-overflow-scrolling: touch !important; scrollbar-width: none !important; }
      }
      @media print {
        .qs-no-print { display: none !important; }
        .qs-print-area { display: block !important; }
        .q-card-body { max-height: none !important; }
      }
    `}</style>
  );
}
