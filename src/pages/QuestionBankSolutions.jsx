import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, ChevronRight, Search, ArrowLeft, Calendar,
  Layers, Filter, X, Tag, Hash, ChevronDown,
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

function useSystemTheme() {
  const [dark, setDark] = useState(() =>
    window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)').matches : true
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const h = e => setDark(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return dark ? T.dark : T.light;
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
    <div style={{ background: t.eqBg, borderLeft: `4px solid ${t.eqBord}`, borderRadius: '0 8px 8px 0', padding: '10px 18px', margin: '7px 0', overflowX: 'auto' }}>
      {isFullLatex
        ? <MathSpan src={tokens[0].val} display />
        : hasLatex(content)
          ? <span style={{ fontFamily: "'STIX Two Math','Cambria Math',serif", fontSize: 15 }}><InlineMathLine text={content} t={t} mathStyle /></span>
          : <span style={{ fontFamily: "'STIX Two Math','Cambria Math',serif", color: t.blue, fontSize: 15 }}>{content}</span>
      }
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ANSWER BLOCK
// ─────────────────────────────────────────────────────────────────────────────
function AnswerBlock({ text, t }) {
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
  const tabs = [matlab && 'matlab', python && 'python'].filter(Boolean);
  const code = tab === 'matlab' ? (matlab || '% Not applicable') : (python || '# Not applicable');
  return (
    <div style={{ borderRadius: 8, overflow: 'hidden', border: `1px solid ${t.border}`, marginTop: 6 }}>
      <div style={{ display: 'flex' }}>
        {tabs.map(id => (
          <button key={id} onClick={() => setTab(id)} style={{
            flex: 1, padding: '7px 0', border: 'none', cursor: 'pointer',
            fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700, letterSpacing: '0.07em',
            background: tab === id ? (id === 'matlab' ? '#111827' : '#060D17') : '#0A1422',
            color: tab === id ? (id === 'matlab' ? '#FFD700' : '#86EFAC') : t.textMut,
            borderBottom: `2px solid ${tab === id ? (id === 'matlab' ? '#FFD700' : '#86EFAC') : 'transparent'}`,
            transition: 'all .12s',
          }}>
            {id === 'matlab' ? 'MATLAB' : 'Python'}
          </button>
        ))}
      </div>
      <pre style={{
        margin: 0, padding: '12px 16px',
        background: tab === 'matlab' ? t.codeBgM : t.codeBgP,
        color: tab === 'matlab' ? '#D4D4D4' : '#C9D1D9',
        fontSize: 12.5, fontFamily: "'JetBrains Mono',monospace",
        overflowX: 'auto', lineHeight: 1.7, maxHeight: 400,
      }}>{code}</pre>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QUESTION CARD
// ─────────────────────────────────────────────────────────────────────────────
function QuestionCard({ question: q, globalIdx, showYearBadge, t }) {
  return (
    <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
      {/* Header strip */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${t.borderSub}` }}>
        <div style={{ background: t.numBg, color: t.numText, fontWeight: 800, fontSize: 12.5, fontFamily: "'JetBrains Mono',monospace", minWidth: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, letterSpacing: '0.02em' }}>
          Q{globalIdx + 1}
        </div>
        <div style={{ padding: '11px 14px', flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5, color: t.text, lineHeight: 1.55 }}>
            <InlineMathLine text={q.question} t={t} mathStyle={isMathLine(q.question)} />
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {q.type && (
              <span style={{ fontSize: 10, fontWeight: 600, color: t.accent, background: t.accentGlow, border: `1px solid ${t.accent}35`, borderRadius: 4, padding: '1px 7px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {q.type}
              </span>
            )}
            {showYearBadge && q._year && (
              <span style={{ fontSize: 10, fontWeight: 600, color: t.blue, background: t.blueBg, border: `1px solid ${t.blue}35`, borderRadius: 4, padding: '1px 7px', letterSpacing: '0.05em' }}>
                {q._year}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 11 }}>
        {q.short_answer && (
          <div style={{ background: t.shortBg, borderLeft: `3px solid ${t.shortBord}`, borderRadius: '0 8px 8px 0', padding: '9px 13px' }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: t.accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>⚡ Quick Answer</div>
            <AnswerBlock text={q.short_answer} t={t} />
          </div>
        )}
        {q.detailed_answer && (
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: t.blue, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>📝 Full Solution</div>
            <div style={{ background: t.surface, border: `1px solid ${t.borderSub}`, borderRadius: 8, padding: '11px 13px' }}>
              <AnswerBlock text={q.detailed_answer} t={t} />
            </div>
          </div>
        )}
        {q.explanation_bn && (
          <div style={{ background: t.bnBg, borderLeft: `3px solid ${t.bnBord}`, borderRadius: '0 8px 8px 0', padding: '9px 13px' }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: t.yellow, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>💡 বাংলায় ব্যাখ্যা</div>
            <div style={{ fontFamily: "'Nirmala UI','Hind Siliguri',sans-serif", color: t.yellowText, fontSize: 13, lineHeight: 1.9 }}>
              <AnswerBlock text={q.explanation_bn} t={t} />
            </div>
          </div>
        )}
        {(q.matlab || q.python) && (
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: t.accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>⌨️ Code</div>
            <CodeBlock matlab={q.matlab} python={q.python} t={t} />
          </div>
        )}
      </div>
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

// ─────────────────────────────────────────────────────────────────────────────
// FILTER BAR — type + year (used in 'all' view)
// ─────────────────────────────────────────────────────────────────────────────
function FilterBar({ allYears, allTypes, activeYears, activeTypes, onYearToggle, onTypeToggle, onClear, t }) {
  const hasActive = activeYears.size > 0 || activeTypes.size > 0;
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
  const t = useSystemTheme();
  const navigate = useNavigate();
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
  const [solutionData, setSolutionData]   = useState(null);

  // 'all' view state — all years merged
  const [allYearsData, setAllYearsData]   = useState([]); // [{year, questions}]
  const [allLoading, setAllLoading]       = useState(false);

  // Shared
  const [loading, setLoading]             = useState(false);
  const [search, setSearch]               = useState('');

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

  // Probe available years
  useEffect(() => {
    if (!selectedCourse || !selectedDept || !selectedTerm) { setAvailableYears([]); return; }
    let cancelled = false;
    Promise.all(
      PROBE_YEARS.map(year =>
        fetch(`/solutions/${selectedDept}/${selectedTerm}/${selectedCourse}/${year}.json`, { method: 'HEAD' })
          .then(r => r.ok ? year : null).catch(() => null)
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
      .then(data => { setSolutionData(data); setLoading(false); setSearch(''); })
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
      (q.short_answer || '').toLowerCase().includes(sq)
    );
  }, [solutionData, search]);

  // ── Questions for 'all' view (merged + filtered)
  const allMergedQuestions = useMemo(() => {
    const all = allYearsData.flatMap(d => d.questions);
    return all;
  }, [allYearsData]);

  const allUniqueYears = useMemo(() => [...new Set(allMergedQuestions.map(q => q._year))].sort((a, b) => b - a), [allMergedQuestions]);
  const allUniqueTypes = useMemo(() => [...new Set(allMergedQuestions.map(q => q.type).filter(Boolean))].sort(), [allMergedQuestions]);

  const filteredAllQuestions = useMemo(() => {
    let qs = allMergedQuestions;
    if (filterYears.size > 0) qs = qs.filter(q => filterYears.has(q._year));
    if (filterTypes.size > 0) qs = qs.filter(q => filterTypes.has(q.type));
    if (search.trim()) {
      const sq = search.toLowerCase();
      qs = qs.filter(q =>
        (q.question || '').toLowerCase().includes(sq) ||
        (q.short_answer || '').toLowerCase().includes(sq)
      );
    }
    return qs;
  }, [allMergedQuestions, filterYears, filterTypes, search]);

  // ── Nav helpers
  function goHome()    { setView('home'); setSelectedCourse(null); setSelectedYear(null); setSolutionData(null); setSearch(''); }
  function goCourses() { setView('courses'); setSelectedYear(null); setSolutionData(null); setSearch(''); }
  function goYears(code) { setSelectedCourse(code); setSelectedYear(null); setSolutionData(null); setView('years'); setSearch(''); }
  function goSolutions(year) { setSelectedYear(String(year)); setView('solutions'); setSearch(''); }
  function goAll() { setView('all'); setSearch(''); setFilterYears(new Set()); setFilterTypes(new Set()); }

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
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: t.text }}>Solution Bank</h1>
          <p style={{ margin: 0, fontSize: 12, color: t.textSub, marginTop: 1 }}>Past paper solutions with step-by-step answers</p>
        </div>
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
      <div style={s.wrap}>
        <PageHeader />
        <Breadcrumb />
        <span onClick={() => setView('years')} style={s.back}><ArrowLeft size={13} /> Back to Years</span>

        {courseInfo && (
          <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderLeft: `4px solid ${t.blue}`, borderRadius: '0 10px 10px 0', padding: '10px 14px', marginBottom: 18 }}>
            <div style={{ fontSize: 10, color: t.blue, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>{courseInfo.courseCode} · All Papers</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: t.text }}>{courseInfo.name}</div>
            <div style={{ fontSize: 11.5, color: t.textMut, marginTop: 1 }}>{selectedDept} · {selectedTerm} · {availableYears.join(', ')}</div>
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
            {/* Filter bar */}
            <FilterBar
              allYears={allUniqueYears}
              allTypes={allUniqueTypes}
              activeYears={filterYears}
              activeTypes={filterTypes}
              onYearToggle={y => setFilterYears(prev => { const s = new Set(prev); s.has(y) ? s.delete(y) : s.add(y); return s; })}
              onTypeToggle={ty => setFilterTypes(prev => { const s = new Set(prev); s.has(ty) ? s.delete(ty) : s.add(ty); return s; })}
              onClear={() => { setFilterYears(new Set()); setFilterTypes(new Set()); }}
              t={t}
            />

            {/* Search */}
            <div style={s.searchBox}>
              <Search size={14} style={{ position: 'absolute', top: 11, left: 12, color: t.textMut, pointerEvents: 'none' }} />
              <input type="text" placeholder="Search all questions…" value={search} onChange={e => setSearch(e.target.value)} style={s.searchIn} />
            </div>

            <div style={{ fontSize: 12, color: t.textMut, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{filteredAllQuestions.length} of {allMergedQuestions.length} question{allMergedQuestions.length !== 1 ? 's' : ''}</span>
              {(filterYears.size > 0 || filterTypes.size > 0) && <span style={{ color: t.accent }}>Filtered</span>}
            </div>

            {filteredAllQuestions.length === 0
              ? <div style={{ textAlign: 'center', padding: 40, color: t.textMut }}>No questions match the current filters.</div>
              : filteredAllQuestions.map((q, idx) => (
                  <QuestionCard key={`${q._year}-${q.id}`} question={q} globalIdx={idx} showYearBadge t={t} />
                ))
            }
          </>
        )}
      </div>
      <KatexStyle />
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // VIEW: SOLUTIONS — single year
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div style={s.page}>
      <div style={s.wrap}>
        <PageHeader />
        <Breadcrumb />
        <span onClick={() => setView('years')} style={s.back}><ArrowLeft size={13} /> {selectedYear} Papers</span>

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
              <div style={{ marginLeft: 'auto' }}>
                <button onClick={goAll} style={{ background: t.blueBg, color: t.blue, border: `1px solid ${t.blue}35`, borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Hash size={12} /> All years
                </button>
              </div>
            </div>

            <div style={s.searchBox}>
              <Search size={14} style={{ position: 'absolute', top: 11, left: 12, color: t.textMut, pointerEvents: 'none' }} />
              <input type="text" placeholder="Search questions…" value={search} onChange={e => setSearch(e.target.value)} style={s.searchIn} />
            </div>

            {search && <div style={{ fontSize: 11.5, color: t.textMut, marginBottom: 12 }}>{filteredQuestions.length} result{filteredQuestions.length !== 1 ? 's' : ''}</div>}

            {filteredQuestions.length === 0
              ? <div style={{ textAlign: 'center', padding: 40, color: t.textMut }}>No questions match.</div>
              : filteredQuestions.map((q, idx) => <QuestionCard key={q.id ?? idx} question={q} globalIdx={idx} showYearBadge={false} t={t} />)
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
    `}</style>
  );
}
