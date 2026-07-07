import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BookOpen, ChevronRight, Search, ArrowLeft, Calendar,
  Layers, Filter, X, Hash, ChevronDown,
  Bookmark, BookmarkCheck, Copy, Check, Sun, Moon,
} from 'lucide-react';
import 'katex/dist/katex.min.css';
import '../styles/questionbank.css';
import { getProfile, getCurrentTermKey } from '../store/store';
import { useTheme } from '../hooks/useTheme';
import { QB_DEPARTMENTS, QB_DEPT_CODE_MAP } from '../data/questionbank/questionBankData';
import UploadQuestionModal from '../components/UploadQuestionModal';

// ─────────────────────────────────────────────────────────────────────────────
// SOLUTION BANK — Contribution / Community constants
// ─────────────────────────────────────────────────────────────────────────────
const SOLUTION_CONTRIBUTION_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLScE5eujz_Vu5LFgkZkiGtWurliPsOiGLmUYTKftBZNSkYTPmg/viewform?embedded=true';
const SOLUTION_CONTRIBUTION_FALLBACK_URL = 'https://forms.gle/9NahxuzSeeU6NTLw6';
const SOLUTION_CONTRIBUTION_PROMPT_KEY = 'solutionBank_contribution_prompt_last_shown';
const SOLUTION_CONTRIBUTION_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours
const WA_NUMBER = '8801724812042';

// ─────────────────────────────────────────────────────────────────────────────
// THEME — Using central theme system, adapted for solutions page display
// ─────────────────────────────────────────────────────────────────────────────

// Map central theme to solutions theme structure
function mapCentralThemeToSolutions(themeId) {
  const isDark = themeId === 'dark';

  // bg/surface/card/border/text now mirror the app's real theme tokens
  // (--bg/--surface/--card/--border/--text) instead of a hardcoded
  // palette, so this page matches the rest of the app. Accent/content
  // colors (blue, yellow, code blocks, etc.) keep their own tuned values.
  if (isDark) {
    return {
      bg: '#0a0a0c', surface: '#14141a', card: '#1a1a21',
      cardHov: '#20202a', border: '#27272f', borderSub: '#1f1f27',
      accent: '#22C55E', accentDim: '#16A34A', accentGlow: 'rgba(34,197,94,0.12)',
      blue: '#60A5FA', blueDim: '#3B82F6', blueBg: 'rgba(96,165,250,0.08)',
      yellow: '#FBBF24', yellowBg: 'rgba(251,191,36,0.08)', yellowText: '#FDE68A',
      text: '#e5e5eb', textSub: '#9a9aab', textMut: '#7a7a8a',
      eqBg: '#171720', eqBord: '#3B82F6',
      codeBgM: '#111827', codeBgP: '#060D17',
      numBg: '#0D2E1A', numText: '#4ADE80',
      shortBg: 'rgba(34,197,94,0.07)', shortBord: '#22C55E',
      bnBg: 'rgba(251,191,36,0.07)', bnBord: '#FBBF24',
      tagBg: 'rgba(96,165,250,0.12)', tagText: '#93C5FD', tagBord: 'rgba(96,165,250,0.3)',
      divider: '#27272f',
      selBg: '#1a1a21', selBord: '#27272f',
      filterActiveBg: 'rgba(34,197,94,0.12)', filterActiveBord: '#22C55E', filterActiveText: '#4ADE80',
    };
  } else {
    return {
      bg: '#f5f5f2', surface: '#ffffff', card: '#ffffff',
      cardHov: '#F0FDF4', border: '#e2e0db', borderSub: '#ececE6',
      accent: '#16A34A', accentDim: '#15803D', accentGlow: 'rgba(22,163,74,0.1)',
      blue: '#2563EB', blueDim: '#1D4ED8', blueBg: 'rgba(37,99,235,0.06)',
      yellow: '#D97706', yellowBg: 'rgba(217,119,6,0.07)', yellowText: '#92400E',
      text: '#1c1c1a', textSub: '#6b6860', textMut: '#8c887f',
      eqBg: '#EEF4FF', eqBord: '#2563EB',
      codeBgM: '#1C2333', codeBgP: '#0D1117',
      numBg: '#DCFCE7', numText: '#15803D',
      shortBg: '#F0FDF4', shortBord: '#16A34A',
      bnBg: '#FFFBEB', bnBord: '#D97706',
      tagBg: 'rgba(37,99,235,0.06)', tagText: '#1D4ED8', tagBord: 'rgba(37,99,235,0.2)',
      divider: '#e2e0db',
      selBg: '#ffffff', selBord: '#e2e0db',
      filterActiveBg: 'rgba(22,163,74,0.08)', filterActiveBord: '#16A34A', filterActiveText: '#15803D',
    };
  }
}

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
  const { themeId } = useTheme();
  const isDark = themeId === 'dark';
  const t = mapCentralThemeToSolutions(themeId);
  
  return { t, dark: isDark };
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

function tokeniseInline(text) {
  const tokens = [];
  const re = /(\*\*|__)(.+?)\1|(\*|_)(.+?)\3|(`[^`]+`)|(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\])/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) tokens.push({ type: 'text', val: text.slice(last, m.index) });
    if (m[1])      tokens.push({ type: 'bold',   val: m[2] });
    else if (m[3]) tokens.push({ type: 'italic', val: m[4] });
    else if (m[5]) tokens.push({ type: 'code',   val: m[5].slice(1,-1) });
    else if (m[6]) {
      const raw = m[6];
      const disp = raw.startsWith('$$') || raw.startsWith('\\[');
      let val;
      if (raw.startsWith('$$'))      val = raw.slice(2,-2).trim();
      else if (raw.startsWith('\\['))val = raw.slice(2,-2).trim();
      else if (raw.startsWith('\\('))val = raw.slice(2,-2).trim();
      else                           val = raw.slice(1,-1).trim();
      tokens.push({ type: 'math', val, display: disp });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) tokens.push({ type: 'text', val: text.slice(last) });
  return tokens;
}

function renderInlineCode(text, t) {
  if (!/\*\*|__|[*_`]|\$|\\[\[(]/.test(text))
    return <InlineMathLine text={text} t={t} mathStyle={isMathLine(text)} />;

  const tokens = tokeniseInline(text);
  return (
    <>
      {tokens.map((tok, i) => {
        if (tok.type === 'bold')
          return <strong key={i} style={{ fontWeight: 700, color: t.text }}>{tok.val}</strong>;
        if (tok.type === 'italic')
          return <em key={i} style={{ fontStyle: 'italic', color: t.textSub }}>{tok.val}</em>;
        if (tok.type === 'code')
          return <code key={i} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '0.87em', background: t.eqBg, color: t.blue, padding: '1px 6px', borderRadius: 4, border: `1px solid ${t.border}` }}>{tok.val}</code>;
        if (tok.type === 'math')
          return <MathSpan key={i} src={tok.val} display={tok.display} />;
        return <InlineMathLine key={i} text={tok.val} t={t} mathStyle={isMathLine(tok.val)} />;
      })}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ANSWER PARSER
// ─────────────────────────────────────────────────────────────────────────────
function parseAnswer(text) {
  if (!text) return [{ type: 'blank' }];
  text = text.replace(/\\n/g, '\n');
  const lines = text.split('\n');

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
    if (tableRanges.has(i)) {
      const tl = [];
      while (i < lines.length && tableRanges.has(i)) { tl.push(lines[i]); i++; }
      segs.push({ type: 'table', lines: tl }); continue;
    }
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
    const rawNorm = lines[i].trim().replace(/\$([^$\n]*;[^$\n]*)\$/g, (match, inner) =>
      /\\/.test(inner) ? match : '`' + inner.trim() + '`'
    );
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
  text = text.replace(/\\n/g, '\n');
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
    <div className="formula-panel">
      <div className="formula-panel-header">
        <span className="formula-panel-title">📐 Formula Sheet — {courseCode}</span>
        <button onClick={onClose} className="formula-panel-close">×</button>
      </div>
      <div className="formula-grid">
        {formulas.map((f, i) => (
          <div key={i} className="formula-item" style={{ background: t.card, border: `1px solid ${t.borderSub}` }}>
            <div className="formula-name" style={{ color: t.textMut }}>{f.name}</div>
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
// QUESTION CARD — redesigned
// ─────────────────────────────────────────────────────────────────────────────
function QuestionCard({ question: q, globalIdx, showYearBadge, t, bookmarks, toggleBookmark, courseKey, onOpenDetail }) {
  const typeColor = getTypeColor(q.type);
  const hasCode = q.matlab || q.python;
  const bmKey = `${courseKey}_${q._year || ''}_${q.id}`;
  const isBookmarked = bookmarks?.has(bmKey);
  const hasDetail = q.detailed_answer || hasCode;

  return (
    <div className="qcard" style={{ background: t.card, border: `1px solid ${t.border}`, borderLeft: `3px solid ${typeColor.border}` }}>
      {/* ── Header row ── */}
      <div className="qcard-head" onClick={() => hasDetail && onOpenDetail(q)} style={{ cursor: hasDetail ? 'pointer' : 'default' }}>
        <div className="qcard-num" style={{ background: t.numBg, color: t.numText, borderRight: `1px solid ${t.borderSub}` }}>
          {q.id || `Q${globalIdx + 1}`}
        </div>
        <div className="qcard-body">
          <div className="qcard-question" style={{ color: t.text }}>
            <InlineMathLine text={q.question} t={t} mathStyle={isMathLine(q.question)} />
          </div>
          <div className="qcard-tags">
            {q.type && (
              <span className="qtag" style={{ color: typeColor.text, background: typeColor.bg, borderColor: `${typeColor.border}25` }}>{q.type}</span>
            )}
            {showYearBadge && q._year && (
              <span className="qtag" style={{ color: t.blue, background: t.blueBg, borderColor: `${t.blue}25` }}>{q._year}</span>
            )}
            {hasCode && (
              <span className="qtag qtag-code" style={{ color: '#FFD700', background: 'rgba(255,215,0,0.08)', borderColor: 'rgba(255,215,0,0.2)' }}>⬡ code</span>
            )}
          </div>
        </div>
        {hasDetail && (
          <div className="qcard-arrow" style={{ color: t.textMut }}>
            <ChevronRight size={14} />
          </div>
        )}
      </div>

      {/* ── Quick answer strip ── */}
      {q.short_answer && (
        <div className="qcard-quick" style={{ background: t.shortBg, borderTop: `1px solid ${t.borderSub}` }}>
          <span className="qcard-quick-label" style={{ color: t.accent }}>ANS</span>
          <div className="qcard-quick-text" style={{ color: t.text }}>
            <AnswerBlock text={q.short_answer} t={t} />
          </div>
        </div>
      )}

      {/* ── Actions ── */}
      <div className="qcard-footer" style={{ borderTop: `1px dashed ${t.borderSub}`, background: t.shortBg }}>
        {hasDetail && (
          <button onClick={() => onOpenDetail(q)} className="qcard-btn qcard-btn-primary" style={{ color: t.blue, background: t.blueBg, borderColor: `${t.blue}30` }}>
            <BookOpen size={11} /> Full Solution
          </button>
        )}
        {toggleBookmark && (
          <button
            onClick={e => { e.stopPropagation(); toggleBookmark(bmKey); }}
            className="qcard-btn qcard-btn-bm"
            style={{ color: isBookmarked ? '#FBBF24' : t.textMut, marginLeft: 'auto' }}
          >
            {isBookmarked ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
            <span>{isBookmarked ? 'Saved' : 'Save'}</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SOLUTION OVERLAY
// ─────────────────────────────────────────────────────────────────────────────
function SolutionOverlay({ question: q, t, dark, bookmarks, toggleBookmark, courseKey, courseMeta = {}, questionList = [], onClose, onNavigate }) {
  const typeColor = getTypeColor(q.type);
  const hasCode = q.matlab || q.python;
  const year = q._year || courseMeta.exam_year || '';
  const bmKey = `${courseKey}_${q._year || ''}_${q.id}`;
  const isBookmarked = bookmarks?.has(bmKey);

  const idx = questionList.findIndex(x => String(x.id) === String(q.id) && String(x._year || '') === String(q._year || ''));
  const prevQ = idx > 0 ? questionList[idx - 1] : null;
  const nextQ = idx !== -1 && idx < questionList.length - 1 ? questionList[idx + 1] : null;

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, []);
  useEffect(() => {
    const el = document.querySelector('.qov-overlay');
    if (el) el.scrollTop = 0;
  }, [q]);
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="qov-overlay" style={{ background: t.bg, color: t.text }}>
      {/* top bar */}
      <div className="solpage-topbar" style={{ background: t.surface, borderBottom: `1px solid ${t.border}` }}>
        <div className="solpage-topbar-inner">
          <button onClick={onClose} className="solpage-back" style={{ color: t.textMut, border: `1px solid ${t.border}` }}>
            <ArrowLeft size={14} />
            <span>Back</span>
          </button>

          <div className="solpage-topbar-crumb" style={{ color: t.textMut }}>
            <BookOpen size={13} color={t.accent} />
            <span style={{ color: t.accent, fontWeight: 700, fontSize: 12 }}>Solution Bank</span>
            {courseMeta.subject_code && (<><ChevronRight size={11} /><span style={{ fontSize: 12 }}>{courseMeta.subject_code}</span></>)}
            {year && (<><ChevronRight size={11} /><span style={{ fontSize: 12 }}>{year}</span></>)}
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {toggleBookmark && (
              <button
                onClick={() => toggleBookmark(bmKey)}
                className="solpage-bm-btn"
                style={{
                  color: isBookmarked ? '#FBBF24' : t.textMut,
                  background: isBookmarked ? 'rgba(251,191,36,0.1)' : 'transparent',
                  border: `1px solid ${isBookmarked ? 'rgba(251,191,36,0.35)' : t.border}`,
                }}
              >
                {isBookmarked ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
              </button>
            )}
            {false && (
              <button onClick={() => {}} className="solpage-theme-btn" style={{ color: t.textMut, border: `1px solid ${t.border}` }}>
                {dark ? <Sun size={14} /> : <Moon size={14} />}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="solpage-wrap">
        {/* question header card */}
        <div className="solpage-qhead" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          <div className="solpage-badges">
            <span className="solpage-badge" style={{ background: typeColor.bg, color: typeColor.text, border: `1px solid ${typeColor.border}40` }}>
              {q.type || 'Question'}
            </span>
            {year && (
              <span className="solpage-badge solpage-badge-year" style={{ background: t.blueBg, color: t.blue, border: `1px solid ${t.blue}30` }}>
                {year}
              </span>
            )}
            {courseMeta.subject_code && (
              <span className="solpage-badge" style={{ background: t.numBg, color: t.numText, border: `1px solid ${t.accent}20`, fontFamily: "'JetBrains Mono',monospace" }}>
                {courseMeta.subject_code}
              </span>
            )}
            {hasCode && (
              <span className="solpage-badge" style={{ background: 'rgba(255,215,0,0.08)', color: '#FFD700', border: '1px solid rgba(255,215,0,0.2)' }}>
                ⬡ Code
              </span>
            )}
          </div>

          <div className="solpage-qnum" style={{ color: t.textMut }}>
            Question {q.id}
            {questionList.length > 0 && idx !== -1 && (
              <span style={{ color: t.textMut, fontWeight: 400 }}> / {questionList.length}</span>
            )}
          </div>

          <div className="solpage-qtext" style={{ color: t.text }}>
            <InlineMathLine text={q.question} t={t} mathStyle={isMathLine(q.question)} />
          </div>

          {(courseMeta.subject || courseMeta.term) && (
            <div className="solpage-qmeta" style={{ color: t.textMut }}>
              {[courseMeta.subject, courseMeta.term, year].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>

        {/* answer sections */}
        <div className="solpage-sections">
          {q.short_answer && (
            <div className="solpage-section" style={{ background: t.shortBg, border: `1px solid ${t.border}` }}>
              <div className="solpage-section-label" style={{ color: t.accent }}>Quick Answer</div>
              <div className="solpage-section-body"><AnswerBlock text={q.short_answer} t={t} /></div>
            </div>
          )}

          {q.detailed_answer && (
            <div className="solpage-section" style={{ background: t.card, border: `1px solid ${t.borderSub}` }}>
              <div className="solpage-section-label" style={{ color: t.text }}>Step-by-step Solution</div>
              <div className="solpage-section-body"><AnswerBlock text={q.detailed_answer} t={t} tryDerivation /></div>
            </div>
          )}

          {q.explanation_bn && (
            <div className="solpage-section" style={{ background: t.bnBg, border: `1px solid ${t.borderSub}` }}>
              <div className="solpage-section-label" style={{ color: t.yellow }}>বাংলা ব্যাখ্যা</div>
              <div className="solpage-section-body sol-bn-section"><AnswerBlock text={q.explanation_bn} t={t} /></div>
            </div>
          )}

          {hasCode && (
            <div className="solpage-section" style={{ background: t.card, border: `1px solid ${t.borderSub}` }}>
              <div className="solpage-section-label" style={{ color: t.text }}>Code</div>
              <div className="solpage-section-body"><CodeBlock matlab={q.matlab} python={q.python} t={t} /></div>
            </div>
          )}

          {!q.short_answer && !q.detailed_answer && !q.explanation_bn && !hasCode && (
            <div style={{ textAlign: 'center', padding: '48px 0', color: t.textMut }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📝</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>Solution not available yet for this question.</div>
            </div>
          )}
        </div>

        {/* prev / next navigation */}
        {(prevQ || nextQ) && (
          <div className="solpage-nav" style={{ borderTop: `1px solid ${t.border}` }}>
            {prevQ ? (
              <button onClick={() => onNavigate(prevQ)} className="solpage-nav-btn solpage-nav-prev" style={{ background: t.card, border: `1px solid ${t.border}`, color: t.text }}>
                <ArrowLeft size={14} style={{ flexShrink: 0 }} />
                <div className="solpage-nav-content">
                  <div className="solpage-nav-label" style={{ color: t.textMut }}>← Previous</div>
                  <div className="solpage-nav-qtext" style={{ color: t.text }}>
                    Q{prevQ.id}: <InlineMathLine text={(prevQ.question || '').slice(0, 60) + ((prevQ.question || '').length > 60 ? '…' : '')} t={t} mathStyle={false} />
                  </div>
                </div>
              </button>
            ) : <div />}

            {nextQ ? (
              <button onClick={() => onNavigate(nextQ)} className="solpage-nav-btn solpage-nav-next" style={{ background: t.card, border: `1px solid ${t.border}`, color: t.text }}>
                <div className="solpage-nav-content" style={{ textAlign: 'right' }}>
                  <div className="solpage-nav-label" style={{ color: t.textMut }}>Next →</div>
                  <div className="solpage-nav-qtext" style={{ color: t.text }}>
                    Q{nextQ.id}: <InlineMathLine text={(nextQ.question || '').slice(0, 60) + ((nextQ.question || '').length > 60 ? '…' : '')} t={t} mathStyle={false} />
                  </div>
                </div>
                <ChevronRight size={14} style={{ flexShrink: 0 }} />
              </button>
            ) : <div />}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AVAILABLE SOLUTIONS CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const AVAILABLE_SOLUTIONS = {
  ESE: {
    Y2T1: {
      CSE2113: { name: 'Computer Programming', courseCode: 'CSE 2113' },
      ME2115:  { name: 'Fluid Mechanics',       courseCode: 'ME 2115'  },
    },
  },
};

const PROBE_YEARS = [2018, 2019, 2020, 2021, 2022, 2023];

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
// FILTER BAR
// ─────────────────────────────────────────────────────────────────────────────
function FilterBar({ allYears, allTypes, activeYears, activeTypes, onYearToggle, onTypeToggle, onClear, t, filterBookmarked, setFilterBookmarked, bookmarks }) {
  const hasActive = activeYears.size > 0 || activeTypes.size > 0 || filterBookmarked;

  const Pill = ({ label, active, onClick }) => (
    <button onClick={onClick} className="filter-pill" style={{
      border: `1px solid ${active ? t.filterActiveBord : t.border}`,
      background: active ? t.filterActiveBg : 'transparent',
      color: active ? t.filterActiveText : t.textSub,
    }}>{label}</button>
  );

  return (
    <div className="filter-bar" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
      <Filter size={12} color={t.textMut} style={{ flexShrink: 0 }} />

      {allYears.length > 0 && (
        <div className="filter-group">
          <span className="filter-label" style={{ color: t.textMut }}>Year</span>
          {allYears.map(y => <Pill key={y} label={y} active={activeYears.has(y)} onClick={() => onYearToggle(y)} />)}
        </div>
      )}

      {allYears.length > 0 && allTypes.length > 0 && <div className="filter-divider" style={{ background: t.border }} />}

      {allTypes.length > 0 && (
        <div className="filter-group">
          <span className="filter-label" style={{ color: t.textMut }}>Type</span>
          {allTypes.map(ty => <Pill key={ty} label={ty} active={activeTypes.has(ty)} onClick={() => onTypeToggle(ty)} />)}
          <button onClick={() => setFilterBookmarked(v => !v)} className="filter-pill" style={{
            border: `1px solid ${filterBookmarked ? '#FBBF24' : t.border}`,
            background: filterBookmarked ? 'rgba(251,191,36,0.12)' : 'transparent',
            color: filterBookmarked ? '#FBBF24' : t.textMut,
          }}>
            ⭐ Saved{filterBookmarked && bookmarks.size > 0 ? ` (${bookmarks.size})` : ''}
          </button>
        </div>
      )}

      {hasActive && (
        <button onClick={onClear} className="filter-clear" style={{ color: t.textMut }}>
          <X size={11} /> Clear
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function QuestionBankSolutions() {
  const { t, dark } = useSolutionsTheme();

  // Inject CSS variables
  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--sol-bg', t.bg);
    r.style.setProperty('--sol-surface', t.surface);
    r.style.setProperty('--sol-card', t.card);
    r.style.setProperty('--sol-border', t.border);
    r.style.setProperty('--sol-bordsub', t.borderSub);
    r.style.setProperty('--sol-text', t.text);
    r.style.setProperty('--sol-textsub', t.textSub);
    r.style.setProperty('--sol-textmut', t.textMut);
    r.style.setProperty('--sol-accent', t.accent);
    r.style.setProperty('--sol-blue', t.blue);
    r.style.setProperty('--sol-yellow', t.yellow);
    r.style.setProperty('--sol-codebgm', t.codeBgM);
    r.style.setProperty('--sol-codebgp', t.codeBgP);
    r.style.setProperty('--sol-numbg', t.numBg);
    r.style.setProperty('--sol-numtext', t.numText);
    r.style.setProperty('--sol-shortbg', t.shortBg);
    r.style.setProperty('--sol-bnbg', t.bnBg);
    r.style.setProperty('--sol-eqbg', t.eqBg);
    r.style.setProperty('--sol-eqb', t.eqBord);
    r.style.setProperty('--sol-cardHov', t.cardHov);
    r.style.setProperty('--sol-accentGlow', t.accentGlow || 'transparent');
    r.style.setProperty('--sol-blueBg', t.blueBg || 'transparent');
  }, [t]);

  const [searchParams, setSearchParams] = useSearchParams();
  const { bookmarks, toggleBookmark } = useBookmarks();
  const profile = getProfile();

  const profileDeptRaw = String(profile?.dept || '').trim();
  const myDept = profileDeptRaw
    ? (QB_DEPT_CODE_MAP[profileDeptRaw] ||
       QB_DEPT_CODE_MAP[Object.keys(QB_DEPT_CODE_MAP).find(k => k.toLowerCase() === profileDeptRaw.toLowerCase()) || ''] ||
       null)
    : null;

  const [view, setView]                     = useState('home');
  const [selectedDept, setSelectedDept]     = useState(myDept || 'ESE');
  const [selectedTerm, setSelectedTerm]     = useState('Y2T1');
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedYear, setSelectedYear]     = useState(null);
  const [availableYears, setAvailableYears] = useState([]);
  const [yearMeta, setYearMeta]             = useState({});
  const [solutionData, setSolutionData]     = useState(null);
  const [allYearsData, setAllYearsData]     = useState([]);
  const [allLoading, setAllLoading]         = useState(false);
  const [visibleCount, setVisibleCount]     = useState(20);
  const [allViewTab, setAllViewTab]         = useState('questions');
  const [showFormulas, setShowFormulas]     = useState(false);
  const [showScrollTop, setShowScrollTop]   = useState(false);
  const [filterBookmarked, setFilterBookmarked] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [loading, setLoading]               = useState(false);
  const [searchRaw, setSearchRaw]           = useState('');
  const search = useDebounce(searchRaw, 220);
  const [showContribIntro, setShowContribIntro] = useState(false);
  const [showContribForm, setShowContribForm]   = useState(false);

  // Auto-show contribution prompt (same cooldown pattern as QuestionBank)
  useEffect(() => {
    const lastShown = Number(localStorage.getItem(SOLUTION_CONTRIBUTION_PROMPT_KEY) || '0');
    const now = Date.now();
    if (!lastShown || now - lastShown >= SOLUTION_CONTRIBUTION_COOLDOWN_MS) {
      localStorage.setItem(SOLUTION_CONTRIBUTION_PROMPT_KEY, String(now));
      setShowContribIntro(true);
    }
  }, []);

  const openContribFlow = useCallback(() => {
    localStorage.setItem(SOLUTION_CONTRIBUTION_PROMPT_KEY, String(Date.now()));
    setShowContribIntro(false);
    setShowContribForm(true);
  }, []);

  const closeContribIntro = useCallback(() => {
    localStorage.setItem(SOLUTION_CONTRIBUTION_PROMPT_KEY, String(Date.now()));
    setShowContribIntro(false);
  }, []);

  const closeContribForm = useCallback(() => setShowContribForm(false), []);

  // Scroll-to-top visibility
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // URL param restore
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
        if (year === 'all') setView('all');
        else if (year) { setSelectedYear(year); setView('solutions'); }
        else setView('years');
      } else if (term) setView('courses');
    }
  }, [searchParams]);

  const [filterYears, setFilterYears] = useState(new Set());
  const [filterTypes, setFilterTypes] = useState(new Set());

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
        fetch(`/solution-data/${selectedDept}/${selectedTerm}/${selectedCourse}/${year}.json`)
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (!data) return null;
            if (!cancelled) setYearMeta(prev => ({ ...prev, [String(year)]: { count: data.questions?.length || 0 } }));
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
    fetch(`/solution-data/${selectedDept}/${selectedTerm}/${selectedCourse}/${selectedYear}.json`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { setSolutionData(data); setLoading(false); setSearchRaw(''); })
      .catch(() => { setSolutionData(null); setLoading(false); });
  }, [selectedDept, selectedTerm, selectedCourse, selectedYear]);

  // Load all years
  useEffect(() => {
    if (view !== 'all' || !selectedCourse || availableYears.length === 0) return;
    setAllLoading(true); setAllYearsData([]);
    setFilterYears(new Set()); setFilterTypes(new Set());
    Promise.all(
      availableYears.map(year =>
        fetch(`/solution-data/${selectedDept}/${selectedTerm}/${selectedCourse}/${year}.json`)
          .then(r => r.ok ? r.json() : null)
          .then(data => data ? { year, questions: (data.questions || []).map(q => ({ ...q, _year: String(year) })) } : null)
          .catch(() => null)
      )
    ).then(results => {
      setAllYearsData(results.filter(Boolean).sort((a, b) => b.year - a.year));
      setAllLoading(false);
    });
  }, [view, selectedCourse, availableYears]);

  const filteredQuestions = useMemo(() => {
    if (!solutionData?.questions) return [];
    if (!search.trim()) return solutionData.questions;
    const sq = search.toLowerCase();
    return solutionData.questions.filter(q =>
      String(q.id).includes(sq) ||
      (q.question || '').toLowerCase().includes(sq) ||
      (q.short_answer || '').toLowerCase().includes(sq) ||
      (q.detailed_answer || '').toLowerCase().includes(sq) ||
      (q.explanation_bn || '').includes(search)
    );
  }, [solutionData, search]);

  const allMergedQuestions = useMemo(() => allYearsData.flatMap(d => d.questions), [allYearsData]);
  const allUniqueYears = useMemo(() => [...new Set(allMergedQuestions.map(q => q._year))].sort((a, b) => b - a), [allMergedQuestions]);
  const allUniqueTypes = useMemo(() => [...new Set(allMergedQuestions.map(q => q.type).filter(Boolean))].sort(), [allMergedQuestions]);

  const frequencyData = useMemo(() => {
    if (allMergedQuestions.length === 0) return [];
    const types = allUniqueTypes.length > 0 ? allUniqueTypes : ['theory', 'numerical', 'programming'];
    return types.map(type => {
      const byYear = {}; let total = 0;
      allUniqueYears.forEach(y => {
        const count = allMergedQuestions.filter(q => q._year === y && q.type === type).length;
        byYear[y] = count; total += count;
      });
      return { type, byYear, total };
    }).filter(row => row.total > 0).sort((a, b) => b.total - a.total);
  }, [allMergedQuestions, allUniqueTypes, allUniqueYears]);

  const filteredAllQuestions = useMemo(() => {
    let qs = allMergedQuestions;
    if (filterBookmarked) {
      qs = qs.filter(q => bookmarks.has(`${selectedDept}_${selectedTerm}_${selectedCourse}_${q._year || ''}_${q.id}`));
    }
    if (filterYears.size > 0) qs = qs.filter(q => filterYears.has(q._year));
    if (filterTypes.size > 0) qs = qs.filter(q => filterTypes.has(q.type));
    if (search.trim()) {
      const sq = search.toLowerCase();
      qs = qs.filter(q =>
        (q.question || '').toLowerCase().includes(sq) ||
        (q.short_answer || '').toLowerCase().includes(sq) ||
        (q.detailed_answer || '').toLowerCase().includes(sq) ||
        (q.explanation_bn || '').includes(search)
      );
    }
    return qs;
  }, [allMergedQuestions, filterBookmarked, bookmarks, filterYears, filterTypes, search, selectedDept, selectedTerm, selectedCourse]);

  // Nav helpers
  function goHome() {
    setView('home'); setSelectedCourse(null); setSelectedYear(null);
    setSolutionData(null); setSelectedQuestion(null); setSearchRaw(''); setSearchParams({});
  }
  function goCourses() {
    setView('courses'); setSelectedYear(null); setSolutionData(null); setSelectedQuestion(null); setSearchRaw('');
    setSearchParams({ dept: selectedDept, term: selectedTerm });
  }
  function goYears(code) {
    setSelectedCourse(code); setSelectedYear(null); setSolutionData(null); setSelectedQuestion(null);
    setView('years'); setSearchRaw('');
    setSearchParams({ dept: selectedDept, term: selectedTerm, course: code });
  }
  function goSolutions(year) {
    setSelectedYear(String(year)); setView('solutions'); setSelectedQuestion(null); setSearchRaw('');
    setSearchParams({ dept: selectedDept, term: selectedTerm, course: selectedCourse, year: String(year) });
  }
  function goAll() {
    setView('all'); setSearchRaw(''); setSelectedQuestion(null);
    setFilterYears(new Set()); setFilterTypes(new Set()); setVisibleCount(20);
    setAllViewTab('questions'); setFilterBookmarked(false);
    setSearchParams({ dept: selectedDept, term: selectedTerm, course: selectedCourse, year: 'all' });
  }
  function openQuestionDetail(question) {
    setSelectedQuestion(question);
  }
  function closeQuestionDetail() { setSelectedQuestion(null); }
  function navigateToQuestion(question) { setSelectedQuestion(question); }

  // ── Shared sub-components ──────────────────────────────────────────────────

  const TopNav = () => (
    <div className="topnav qs-no-print" style={{ background: t.surface, borderBottom: `1px solid ${t.border}` }}>
      <div className="topnav-inner wrap">
        <button onClick={goHome} className="topnav-logo" style={{ color: t.accent }}>
          <BookOpen size={16} strokeWidth={2} />
          <span>Solution Bank</span>
        </button>

        <div className="topnav-crumb" style={{ color: t.textMut }}>
          {['courses','years','solutions','all'].includes(view) && (
            <>
              <ChevronRight size={11} />
              <span
                onClick={view !== 'courses' ? goCourses : undefined}
                className={view === 'courses' ? 'crumb-active' : 'crumb-link'}
                style={{ color: view === 'courses' ? t.text : t.textMut }}
              >{selectedDept}·{selectedTerm}</span>
            </>
          )}
          {['years','solutions','all'].includes(view) && courseInfo && (
            <>
              <ChevronRight size={11} />
              <span
                onClick={view !== 'years' ? () => setView('years') : undefined}
                className={view === 'years' ? 'crumb-active' : 'crumb-link'}
                style={{ color: view === 'years' ? t.text : t.textMut }}
              >{courseInfo.courseCode}</span>
            </>
          )}
          {view === 'solutions' && selectedYear && (
            <>
              <ChevronRight size={11} />
              <span className="crumb-active" style={{ color: t.text }}>{selectedYear}</span>
            </>
          )}
          {view === 'all' && (
            <>
              <ChevronRight size={11} />
              <span className="crumb-active" style={{ color: t.text }}>All Papers</span>
            </>
          )}
        </div>

        {false && (
        <button onClick={() => {}} className="topnav-theme" style={{ color: t.textMut, border: `1px solid ${t.border}` }}>
          {dark ? <Sun size={14} /> : <Moon size={14} />}
        </button>
        )}
      </div>
    </div>
  );

  const DeptTermRow = () => (
    <div className="dt-row qs-no-print">
      <div className="dt-field">
        <label className="dt-label" style={{ color: t.accent }}>Dept</label>
        <div className="dt-select-wrap">
          <select
            value={selectedDept}
            onChange={e => { setSelectedDept(e.target.value); setSelectedTerm(Object.keys(AVAILABLE_SOLUTIONS[e.target.value] || {})[0] || 'Y2T1'); }}
            className="dt-select"
            style={{ background: t.card, color: t.text, border: `1px solid ${t.border}` }}
          >
            {depts.map(code => <option key={code} value={code}>{code} — {QB_DEPARTMENTS[code]?.split('of ')[1] || QB_DEPARTMENTS[code] || code}</option>)}
          </select>
          <ChevronDown size={12} color={t.textMut} className="dt-chevron" />
        </div>
      </div>
      <div className="dt-field">
        <label className="dt-label" style={{ color: t.accent }}>Term</label>
        <div className="dt-select-wrap">
          <select
            value={selectedTerm}
            onChange={e => setSelectedTerm(e.target.value)}
            className="dt-select"
            style={{ background: t.card, color: t.text, border: `1px solid ${t.border}` }}
          >
            {terms.map(term => <option key={term} value={term}>{term}</option>)}
          </select>
          <ChevronDown size={12} color={t.textMut} className="dt-chevron" />
        </div>
      </div>
    </div>
  );

  const page = { minHeight: '100vh', background: t.bg, color: t.text, fontFamily: "'Inter',sans-serif", paddingBottom: 60 };

  // ════════════════════════════════════════════════════════════════════════════
  // VIEW: HOME
  // ════════════════════════════════════════════════════════════════════════════
  if (view === 'home') return (
    <div style={page}>
      <div className="wrap" style={{ paddingTop: 20 }}>
        <div
          className="home-hero"
          style={{
            background: dark
              ? `linear-gradient(135deg, color-mix(in srgb, ${t.accent} 10%, ${t.surface}), ${t.surface})`
              : `linear-gradient(135deg, color-mix(in srgb, ${t.accent} 7%, ${t.surface}), ${t.surface})`,
            border: `1px solid ${t.border}`,
            borderRadius: 16,
            padding: '20px 22px',
          }}
        >
          <div className="home-hero-inner">
            <div className="home-hero-left">
              <div className="home-hero-eyebrow" style={{ color: t.accent }}>
                <BookOpen size={13} /> KUET Solution Bank
              </div>
              <h1 className="home-hero-title" style={{ color: t.text }}>
                Past Papers,<br />
                <span style={{ color: t.accent }}>Solved.</span>
              </h1>
              <p className="home-hero-sub" style={{ color: t.textSub }}>
                Step-by-step solutions for KUET exam questions — theory, numerical & code.
              </p>
            </div>
            <div className="home-hero-stats">
              <div className="home-stat" style={{ background: t.card, border: `1px solid ${t.border}` }}>
                <div className="home-stat-n" style={{ color: t.accent }}>{courses.length}</div>
                <div className="home-stat-l" style={{ color: t.textSub }}>Courses</div>
              </div>
              <div className="home-stat" style={{ background: t.card, border: `1px solid ${t.border}` }}>
                <div className="home-stat-n" style={{ color: t.blue }}>{PROBE_YEARS.length}</div>
                <div className="home-stat-l" style={{ color: t.textSub }}>Years</div>
              </div>
              <div className="home-stat" style={{ background: t.card, border: `1px solid ${t.border}` }}>
                <div className="home-stat-n" style={{ color: t.yellow }}>3</div>
                <div className="home-stat-l" style={{ color: t.textSub }}>Types</div>
              </div>
            </div>
          </div>
        </div>

        <DeptTermRow />

        <div className="section-head" style={{ marginBottom: 14 }}>
          <div className="section-title" style={{ color: t.text }}>Available Courses</div>
          <div className="section-sub" style={{ color: t.textSub }}>{selectedDept} · {selectedTerm} · {courses.length} available</div>
        </div>

        <div className="course-grid">
          {courses.map(course => (
            <div
              key={course.code}
              onClick={() => goYears(course.code)}
              className="course-card"
              style={{ background: t.card, border: `1px solid ${t.border}`, borderTop: `3px solid ${t.accent}` }}
            >
              <div className="course-card-code" style={{ color: t.accent }}>{course.courseCode}</div>
              <div className="course-card-name" style={{ color: t.text }}>{course.name}</div>
              <div className="course-card-hint" style={{ color: t.textMut }}>View past papers →</div>
            </div>
          ))}
          {courses.length === 0 && (
            <div style={{ gridColumn: '1/-1', padding: '48px 24px', textAlign: 'center' }}>
              <div style={{
                maxWidth: 480, margin: '0 auto',
                background: t.card, border: `1px solid ${t.border}`,
                borderRadius: 12, padding: '36px 28px',
              }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📚</div>
                <div style={{ fontWeight: 700, fontSize: 17, color: t.text, marginBottom: 8 }}>
                  No solutions available yet
                </div>
                <div style={{ fontSize: 14, color: t.textSub, lineHeight: 1.65, marginBottom: 24 }}>
                  We currently don't have any solutions for <strong style={{ color: t.text }}>{selectedDept} · {selectedTerm}</strong>.
                  Questions are available, but solutions take time and community effort to build.
                  <br /><br />
                  We'd love your help! With better community participation, we can grow this into
                  a complete resource for every KUET student. 🌱
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={openContribFlow}
                    style={{
                      background: t.accent, color: '#fff',
                      border: 'none', borderRadius: 8,
                      padding: '10px 20px', fontSize: 14, fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Help us grow 🤝
                  </button>
                  <a
                    href={`https://wa.me/${WA_NUMBER}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      background: '#25D366', color: '#fff',
                      borderRadius: 8, padding: '10px 20px',
                      fontSize: 14, fontWeight: 600,
                      textDecoration: 'none',
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.533 5.846L.057 23.882l6.204-1.626A11.934 11.934 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.012-1.374l-.359-.213-3.724.976.995-3.622-.234-.372A9.818 9.818 0 1112 21.818z"/>
                    </svg>
                    Contact Us
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showContribIntro && (
        <div className="qb2-modal-backdrop" role="presentation" onClick={closeContribIntro}>
          <div className="qb2-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <div className="qb2-modal-top">
              <div>
                <div className="qb2-modal-kicker">Solution Bank help</div>
                <h2 className="qb2-modal-title">Help us build a better Solution Bank</h2>
              </div>
              <button className="qb2-modal-close" type="button" onClick={closeContribIntro} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <p className="qb2-modal-text">
              We're building a community-powered solution database for KUET students.
              If you have solved past papers or partial solutions, your contribution can make
              a real difference for hundreds of students. Every bit helps. 🙏
            </p>
            <div className="qb2-modal-actions">
              <button className="qb2-secondary-btn" type="button" onClick={closeContribIntro}>Not now</button>
              <button className="qb2-primary-btn" type="button" onClick={openContribFlow}>I want to help</button>
            </div>
          </div>
        </div>
      )}

      {showContribForm && (
        <UploadQuestionModal onClose={closeContribForm} />
      )}

      <KatexStyle />
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // VIEW: COURSES
  // ════════════════════════════════════════════════════════════════════════════
  if (view === 'courses') return (
    <div style={page}>
      <TopNav />
      <div className="wrap" style={{ paddingTop: 20 }}>
        <DeptTermRow />
        <div className="section-head">
          <div className="section-title" style={{ color: t.text }}>Courses</div>
          <div className="section-sub" style={{ color: t.textSub }}>{selectedDept} · {selectedTerm} · {courses.length} available</div>
        </div>
        <div className="course-grid">
          {courses.map(course => (
            <div
              key={course.code}
              onClick={() => goYears(course.code)}
              className="course-card"
              style={{ background: t.card, border: `1px solid ${t.border}`, borderTop: `3px solid ${t.accent}` }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div className="course-card-code" style={{ color: t.accent, margin: 0 }}>{course.courseCode}</div>
                <Layers size={14} color={t.textMut} />
              </div>
              <div className="course-card-name" style={{ color: t.text }}>{course.name}</div>
              <div className="course-card-hint" style={{ color: t.textMut }}>
                <Calendar size={10} /> View past papers →
              </div>
            </div>
          ))}
          {courses.length === 0 && (
            <div style={{ gridColumn: '1/-1', padding: '48px 24px', textAlign: 'center' }}>
              <div style={{
                maxWidth: 480, margin: '0 auto',
                background: t.card, border: `1px solid ${t.border}`,
                borderRadius: 12, padding: '36px 28px',
              }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📚</div>
                <div style={{ fontWeight: 700, fontSize: 17, color: t.text, marginBottom: 8 }}>
                  No solutions available yet
                </div>
                <div style={{ fontSize: 14, color: t.textSub, lineHeight: 1.65, marginBottom: 24 }}>
                  We currently don't have any solutions for <strong style={{ color: t.text }}>{selectedDept} · {selectedTerm}</strong>.
                  Questions are available, but solutions take time and community effort to build.
                  <br /><br />
                  We'd love your help! With better community participation, we can grow this into
                  a complete resource for every KUET student. 🌱
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={openContribFlow}
                    style={{
                      background: t.accent, color: '#fff',
                      border: 'none', borderRadius: 8,
                      padding: '10px 20px', fontSize: 14, fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Help us grow 🤝
                  </button>
                  <a
                    href={`https://wa.me/${WA_NUMBER}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      background: '#25D366', color: '#fff',
                      borderRadius: 8, padding: '10px 20px',
                      fontSize: 14, fontWeight: 600,
                      textDecoration: 'none',
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.533 5.846L.057 23.882l6.204-1.626A11.934 11.934 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.012-1.374l-.359-.213-3.724.976.995-3.622-.234-.372A9.818 9.818 0 1112 21.818z"/>
                    </svg>
                    Contact Us
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showContribIntro && (
        <div className="qb2-modal-backdrop" role="presentation" onClick={closeContribIntro}>
          <div className="qb2-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <div className="qb2-modal-top">
              <div>
                <div className="qb2-modal-kicker">Solution Bank help</div>
                <h2 className="qb2-modal-title">Help us build a better Solution Bank</h2>
              </div>
              <button className="qb2-modal-close" type="button" onClick={closeContribIntro} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <p className="qb2-modal-text">
              We're building a community-powered solution database for KUET students.
              If you have solved past papers or partial solutions, your contribution can make
              a real difference for hundreds of students. Every bit helps. 🙏
            </p>
            <div className="qb2-modal-actions">
              <button className="qb2-secondary-btn" type="button" onClick={closeContribIntro}>Not now</button>
              <button className="qb2-primary-btn" type="button" onClick={openContribFlow}>I want to help</button>
            </div>
          </div>
        </div>
      )}

      {showContribForm && (
        <UploadQuestionModal onClose={closeContribForm} />
      )}

      <KatexStyle />
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // VIEW: YEARS
  // ════════════════════════════════════════════════════════════════════════════
  if (view === 'years') return (
    <div style={page}>
      <TopNav />
      <div className="wrap" style={{ paddingTop: 20 }}>
        {courseInfo && (
          <div className="course-info-bar" style={{ background: t.surface, border: `1px solid ${t.border}`, borderLeft: `4px solid ${t.accent}` }}>
            <div>
              <div className="course-info-code" style={{ color: t.accent }}>{courseInfo.courseCode}</div>
              <div className="course-info-name" style={{ color: t.text }}>{courseInfo.name}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {FORMULA_SHEETS[selectedCourse] && (
                <button
                  onClick={() => setShowFormulas(v => !v)}
                  className="icon-btn"
                  style={{ color: showFormulas ? t.accent : t.textMut, background: showFormulas ? t.accentGlow : 'transparent', border: `1px solid ${showFormulas ? t.accent + '40' : t.border}` }}
                >
                  📐
                </button>
              )}
              {availableYears.length > 0 && (
                <button onClick={goAll} className="btn-secondary" style={{ color: t.blue, background: t.blueBg, border: `1px solid ${t.blue}35` }}>
                  <Hash size={12} /> All years
                </button>
              )}
            </div>
          </div>
        )}

        {showFormulas && <FormulaPanel courseCode={selectedCourse} t={t} onClose={() => setShowFormulas(false)} />}

        <div className="section-head">
          <div className="section-title" style={{ color: t.text }}>Past Papers</div>
          <div className="section-sub" style={{ color: t.textSub }}>
            {availableYears.length === 0 ? 'Checking available years…' : `${availableYears.length} year${availableYears.length !== 1 ? 's' : ''} found`}
          </div>
        </div>

        <div className="year-grid">
          {availableYears.length > 0
            ? availableYears.map(year => (
                <div
                  key={year}
                  onClick={() => goSolutions(year)}
                  className="year-card"
                  style={{ background: t.card, border: `1px solid ${t.border}` }}
                >
                  <div className="year-card-n" style={{ color: t.accent }}>{year}</div>
                  <div className="year-card-label" style={{ color: t.textMut }}>Exam</div>
                  {yearMeta[String(year)]?.count > 0 && (
                    <div className="year-card-count" style={{ color: t.textMut }}>{yearMeta[String(year)].count} Qs</div>
                  )}
                  <div className="year-card-badge" style={{ background: t.accentGlow, color: t.accent }}>Available</div>
                </div>
              ))
            : PROBE_YEARS.slice().reverse().map(year => (
                <div key={year} className="year-card year-card-ghost" style={{ background: t.card, border: `1px solid ${t.border}` }}>
                  <div className="year-card-n" style={{ color: t.textMut }}>{year}</div>
                  <div className="year-card-label" style={{ color: t.textMut }}>Checking…</div>
                </div>
              ))
          }
        </div>
      </div>
      {showContribForm && (
        <UploadQuestionModal onClose={closeContribForm} />
      )}

      <KatexStyle />
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // VIEW: ALL YEARS
  // ════════════════════════════════════════════════════════════════════════════
  if (view === 'all') return (
    <div style={page}>
      <div className="qs-print-area">
        <TopNav />
        <div className="wrap" style={{ paddingTop: 16 }}>
          {courseInfo && (
            <div className="course-info-bar" style={{ background: t.surface, border: `1px solid ${t.border}`, borderLeft: `4px solid ${t.blue}` }}>
              <div>
                <div className="course-info-code" style={{ color: t.blue }}>{courseInfo.courseCode} · All Papers</div>
                <div className="course-info-name" style={{ color: t.text }}>{courseInfo.name}</div>
              </div>
              {FORMULA_SHEETS[selectedCourse] && (
                <button onClick={() => setShowFormulas(v => !v)} className="icon-btn" style={{ color: showFormulas ? t.accent : t.textMut, background: showFormulas ? t.accentGlow : 'transparent', border: `1px solid ${showFormulas ? t.accent + '40' : t.border}` }}>
                  📐
                </button>
              )}
            </div>
          )}

          {showFormulas && <FormulaPanel courseCode={selectedCourse} t={t} onClose={() => setShowFormulas(false)} />}

          {allLoading && (
            <div className="loading-state" style={{ color: t.textMut }}>
              <div className="loading-icon">⏳</div>
              <div>Loading all years…</div>
            </div>
          )}

          {!allLoading && allMergedQuestions.length > 0 && (
            <>
              <div className="tab-bar qs-no-print" style={{ borderBottom: `1px solid ${t.border}` }}>
                {[
                  { id: 'questions', label: `Questions (${allMergedQuestions.length})` },
                  { id: 'analysis', label: '📊 Analysis' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setAllViewTab(tab.id)}
                    className={`tab-btn ${allViewTab === tab.id ? 'tab-active' : ''}`}
                    style={{
                      color: allViewTab === tab.id ? t.accent : t.textMut,
                      borderBottom: `2px solid ${allViewTab === tab.id ? t.accent : 'transparent'}`,
                    }}
                  >{tab.label}</button>
                ))}
              </div>

              {allViewTab === 'questions' && (
                <>
                  <FilterBar
                    allYears={allUniqueYears} allTypes={allUniqueTypes}
                    activeYears={filterYears} activeTypes={filterTypes}
                    onYearToggle={y => { setFilterYears(prev => { const s = new Set(prev); s.has(y) ? s.delete(y) : s.add(y); return s; }); setVisibleCount(20); }}
                    onTypeToggle={ty => { setFilterTypes(prev => { const s = new Set(prev); s.has(ty) ? s.delete(ty) : s.add(ty); return s; }); setVisibleCount(20); }}
                    onClear={() => { setFilterYears(new Set()); setFilterTypes(new Set()); setVisibleCount(20); setFilterBookmarked(false); }}
                    t={t} filterBookmarked={filterBookmarked} setFilterBookmarked={setFilterBookmarked} bookmarks={bookmarks}
                  />

                  <div className="search-box qs-no-print">
                    <Search size={14} className="search-icon" style={{ color: t.textMut }} />
                    <input type="text" className="search-input" placeholder="Search all questions…" value={searchRaw} onChange={e => setSearchRaw(e.target.value)} />
                  </div>

                  <div className="results-count qs-no-print" style={{ color: t.textMut }}>
                    {filteredAllQuestions.length} of {allMergedQuestions.length} questions
                    {(filterYears.size > 0 || filterTypes.size > 0 || filterBookmarked) && <span style={{ color: t.accent, marginLeft: 6 }}>· filtered</span>}
                  </div>

                  {selectedQuestion ? (
                    <SolutionOverlay
                      question={selectedQuestion} t={t} dark={dark}
                      bookmarks={bookmarks} toggleBookmark={toggleBookmark}
                      courseKey={courseKey}
                      courseMeta={{ subject_code: courseInfo?.courseCode, subject: courseInfo?.name, term: selectedTerm }}
                      questionList={filteredAllQuestions}
                      onClose={closeQuestionDetail}
                      onNavigate={navigateToQuestion}
                    />
                  ) : filteredAllQuestions.length === 0 ? (
                    <div className="empty-state" style={{ color: t.textMut }}>No questions match the current filters.</div>
                  ) : (
                    <>
                      {filteredAllQuestions.slice(0, visibleCount).map((q, idx) => (
                        <QuestionCard
                          key={`${q._year}-${q.id}`} question={q} globalIdx={idx} showYearBadge
                          t={t} bookmarks={bookmarks} toggleBookmark={toggleBookmark}
                          courseKey={courseKey} onOpenDetail={openQuestionDetail}
                        />
                      ))}
                      {visibleCount < filteredAllQuestions.length && (
                        <div style={{ textAlign: 'center', padding: '16px 0' }}>
                          <button onClick={() => setVisibleCount(c => c + 20)} className="load-more-btn" style={{ background: t.blueBg, color: t.blue, border: `1px solid ${t.blue}35` }}>
                            Load 20 more ({filteredAllQuestions.length - visibleCount} remaining)
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {allViewTab === 'analysis' && frequencyData.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12.5, color: t.textSub, marginBottom: 14 }}>
                    Question type frequency across {allUniqueYears.length} exam years
                  </div>
                  <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <table className="freq-table" style={{ border: `1px solid ${t.border}` }}>
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
        </div>
      </div>

      {showScrollTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="scroll-top-btn" style={{ background: t.accent, color: '#022009' }}>
          ↑ Top
        </button>
      )}
      {showContribForm && (
        <UploadQuestionModal onClose={closeContribForm} />
      )}

      <KatexStyle />
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // VIEW: SOLUTIONS — single year
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div style={page}>
      <div className="qs-print-area">
        <TopNav />
        <div className="wrap" style={{ paddingTop: 16 }}>

          {loading && (
            <div className="loading-state" style={{ color: t.textMut }}>
              <div className="loading-icon">⏳</div>
              <div>Loading solutions…</div>
            </div>
          )}

          {!loading && solutionData && (
            <>
              <div className="meta-bar qs-no-print" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                <div className="meta-bar-main">
                  <div>
                    <div className="meta-bar-label" style={{ color: t.textMut }}>Course</div>
                    <div className="meta-bar-value" style={{ color: t.text }}>{solutionData.subject_code} — {solutionData.subject}</div>
                  </div>
                  <div className="meta-bar-div" style={{ background: t.border }} />
                  <div>
                    <div className="meta-bar-label" style={{ color: t.textMut }}>Exam</div>
                    <div className="meta-bar-value meta-bar-sub" style={{ color: t.textSub }}>{solutionData.term} · {solutionData.exam_year}</div>
                  </div>
                  <div className="meta-bar-div" style={{ background: t.border }} />
                  <div>
                    <div className="meta-bar-label" style={{ color: t.textMut }}>Questions</div>
                    <div className="meta-bar-value meta-bar-accent" style={{ color: t.accent }}>{solutionData.questions?.length || 0}</div>
                  </div>
                </div>
                <div className="meta-bar-actions">
                  {FORMULA_SHEETS[selectedCourse] && (
                    <button onClick={() => setShowFormulas(v => !v)} className="icon-btn" style={{ color: showFormulas ? t.accent : t.textMut, background: showFormulas ? t.accentGlow : 'transparent', border: `1px solid ${showFormulas ? t.accent + '40' : t.border}` }}>
                      📐
                    </button>
                  )}
                  <button onClick={() => window.print()} className="icon-btn" style={{ color: t.textMut, background: 'transparent', border: `1px solid ${t.border}` }}>
                    🖨️
                  </button>
                  <button onClick={goAll} className="btn-secondary" style={{ color: t.blue, background: t.blueBg, border: `1px solid ${t.blue}35` }}>
                    <Hash size={12} /> All years
                  </button>
                </div>
              </div>

              {showFormulas && FORMULA_SHEETS[selectedCourse] && <FormulaPanel courseCode={selectedCourse} t={t} onClose={() => setShowFormulas(false)} />}

              {selectedQuestion ? (
                <SolutionOverlay
                  question={selectedQuestion} t={t} dark={dark}
                  bookmarks={bookmarks} toggleBookmark={toggleBookmark}
                  courseKey={courseKey}
                  courseMeta={{
                    subject_code: solutionData?.subject_code,
                    subject: solutionData?.subject,
                    term: solutionData?.term,
                    exam_year: solutionData?.exam_year,
                  }}
                  questionList={filteredQuestions}
                  onClose={closeQuestionDetail}
                  onNavigate={navigateToQuestion}
                />
              ) : (
                <>
                  <div className="search-box qs-no-print">
                    <Search size={14} className="search-icon" style={{ color: t.textMut }} />
                    <input type="text" className="search-input" placeholder="Search questions…" value={searchRaw} onChange={e => setSearchRaw(e.target.value)} />
                  </div>

                  {search && (
                    <div className="results-count qs-no-print" style={{ color: t.textMut }}>
                      {filteredQuestions.length} result{filteredQuestions.length !== 1 ? 's' : ''}
                    </div>
                  )}

                  {filteredQuestions.length === 0
                    ? <div className="empty-state" style={{ color: t.textMut }}>No questions match.</div>
                    : filteredQuestions.map((q, idx) => (
                        <QuestionCard
                          key={q.id ?? idx} question={q} globalIdx={idx} showYearBadge={false}
                          t={t} bookmarks={bookmarks} toggleBookmark={toggleBookmark}
                          courseKey={courseKey} onOpenDetail={openQuestionDetail}
                        />
                      ))
                  }
                </>
              )}
            </>
          )}

          {!loading && !solutionData && (
            <div className="empty-state" style={{ color: t.textMut }}>
              <BookOpen size={36} style={{ marginBottom: 10, opacity: 0.3 }} />
              <div>Could not load solutions for {selectedYear}.</div>
            </div>
          )}
        </div>
      </div>

      {showScrollTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="scroll-top-btn" style={{ background: t.accent, color: '#022009' }}>
          ↑ Top
        </button>
      )}
      {showContribForm && (
        <UploadQuestionModal onClose={closeContribForm} />
      )}

      <KatexStyle />
    </div>
  );
}

function KatexStyle() {
  return (
    <style>{`
      .katex { font-size: 1.06em; }
      .katex-display { overflow-x: auto; padding: 4px 0; margin: 0 !important; }
      .katex-display > .katex { text-align: left; }
      @media (max-width: 480px) {
        .qcard-quick, .qcard-footer { padding-left: 12px !important; }
        .qcard-num { min-width: 34px !important; font-size: 10px !important; }
        .filter-bar { overflow-x: auto !important; flex-wrap: nowrap !important; -webkit-overflow-scrolling: touch !important; scrollbar-width: none !important; }
        .filter-bar::-webkit-scrollbar { display: none; }
      }
      @media print {
        .qs-no-print { display: none !important; }
        .qs-print-area { display: block !important; }
        .qcard { break-inside: avoid; }
      }
    `}</style>
  );
}