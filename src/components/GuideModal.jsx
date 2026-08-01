import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Circle } from 'lucide-react';
import { ICONS } from '../lib/iconRegistry';
import { GUIDE_CATEGORIES_BN, GUIDE_CATEGORIES_EN, GUIDE_SECTIONS_BN, GUIDE_SECTIONS_EN } from '../data/guideContent';

// UI chrome strings for the two languages — search placeholder, "no
// matches" text, section-count label, prev/next fallback, etc. Kept
// separate from GUIDE_SECTIONS (which holds the actual guide content)
// since this is fixed modal chrome, not per-section data.
const UI_TEXT = {
  bn: {
    guideTitle: 'KUETx গাইড',
    sectionsCount: (n) => `${n}টা সেকশন · প্রতিটা ফিচার ব্যাখ্যা করা আছে`,
    searchPlaceholder: 'গাইডে খুঁজুন…',
    noMatches: 'কিছু পাওয়া যায়নি। অন্য শব্দ দিয়ে আবার দেখুন।',
    community: 'KUETx কমিউনিটি',
    openPage: 'পেজ খুলুন',
    langToggleLabel: 'English',
  },
  en: {
    guideTitle: 'KUETx Guide',
    sectionsCount: (n) => `${n} sections · every feature, explained`,
    searchPlaceholder: 'Search the guide…',
    noMatches: 'No matches. Try another word.',
    community: 'KUETx Community',
    openPage: 'Open page',
    langToggleLabel: 'বাংলা',
  },
};

const CALLOUT_STYLE = {
  tip:     { icon: 'Lightbulb',     color: 'var(--accent)' },
  info:    { icon: 'Info',          color: 'var(--accent)' },
  success: { icon: 'CheckCircle2',  color: 'var(--success)' },
  warning: { icon: 'AlertTriangle', color: 'var(--warning)' },
  danger:  { icon: 'AlertOctagon',  color: 'var(--danger)' },
};

const BN_POLITE_REPLACEMENTS = [
  [/তোমাদের/g, 'আপনাদের'],
  [/তোমার/g, 'আপনার'],
  [/তোমাকে/g, 'আপনাকে'],
  [/তোমরা/g, 'আপনারা'],
  [/তুমি/g, 'আপনি'],
  [/দেখো/g, 'দেখুন'],
  [/খোলো/g, 'খুলুন'],
  [/যাও/g, 'যান'],
  [/করো/g, 'করুন'],
  [/নাও/g, 'নিন'],
  [/বলো/g, 'বলুন'],
  [/জানাও/g, 'জানান'],
  [/খুঁজে দেখো/g, 'খুঁজে দেখুন'],
  [/জিজ্ঞেস করো/g, 'জিজ্ঞেস করুন'],
  [/\bদাও\b/g, 'দিন'],
  [/\bপাও\b/g, 'পান'],
  [/\bপারো\b/g, 'পারেন'],
  [/\bরাখো\b/g, 'রাখুন'],
  [/\bবানাও\b/g, 'বানান'],
  [/\bপড়ো\b/g, 'পড়ুন'],
  [/\bলিখো\b/g, 'লিখুন'],
];

function toPoliteBangla(text) {
  if (typeof text !== 'string') return text;
  return BN_POLITE_REPLACEMENTS.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), text);
}

function transformBlock(block, lang) {
  if (lang !== 'bn' || !block || typeof block !== 'object') return block;
  if (block.type === 'table') {
    return {
      ...block,
      headers: (block.headers || []).map(toPoliteBangla),
      rows: (block.rows || []).map((row) => row.map(toPoliteBangla)),
    };
  }
  const next = { ...block };
  Object.keys(next).forEach((key) => {
    if (typeof next[key] === 'string') next[key] = toPoliteBangla(next[key]);
  });
  return next;
}

function transformSection(section, lang) {
  if (lang !== 'bn') return section;
  return {
    ...section,
    title: toPoliteBangla(section.title),
    desc: toPoliteBangla(section.desc),
    blocks: (section.blocks || []).map((block) => transformBlock(block, lang)),
  };
}

function getShellContext(pathname) {
  if (pathname.startsWith('/provider')) return 'provider';
  if (pathname.startsWith('/faculty')) return 'faculty';
  if (pathname.startsWith('/team') || pathname.startsWith('/admin-hub') || pathname.startsWith('/admin')) return 'staff';
  return 'student';
}

function Icon({ name, ...props }) {
  const C = ICONS[name] || Circle;
  return <C {...props} />;
}

function Block({ block }) {
  switch (block.type) {
    case 'text':
      return <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.65, color: 'var(--text)' }}>{block.text}</p>;
    case 'label':
      return (
        <p style={{ margin: '0 0 10px', fontSize: 14, lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text)' }}>{block.label}</strong>{block.text ? <span style={{ color: 'var(--muted)' }}>  {block.text}</span> : null}
        </p>
      );
    case 'subhead':
      return <h4 style={{ margin: '22px 0 10px', fontSize: 12.5, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--accent)' }}>{block.text}</h4>;
    case 'bullet':
      return (
        <div style={{ display: 'flex', gap: 9, marginLeft: block.sub ? 20 : 0, marginBottom: 7, alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--accent)', fontSize: 14, lineHeight: '22px', flexShrink: 0 }}>•</span>
          <span style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text)' }}>{block.text}</span>
        </div>
      );
    case 'step':
      return (
        <div style={{ display: 'flex', gap: 11, marginBottom: 9, alignItems: 'flex-start' }}>
          <span style={{
            flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
            background: 'var(--accent)', color: 'var(--accentFg)',
            fontSize: 11.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginTop: 1,
          }}>{block.num}</span>
          <span style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text)', paddingTop: 1 }}>{block.text}</span>
        </div>
      );
    case 'callout': {
      const s = CALLOUT_STYLE[block.variant] || CALLOUT_STYLE.tip;
      return (
        <div style={{
          display: 'flex', gap: 10, padding: '10px 13px', borderRadius: 10, marginBottom: 14,
          background: 'var(--surface)', borderLeft: `2px solid ${s.color}`,
        }}>
          <Icon name={s.icon} size={15} color={s.color} style={{ flexShrink: 0, marginTop: 2 }} />
          <span style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text)' }}>{block.text}</span>
        </div>
      );
    }
    case 'table':
      return <GuideTable block={block} />;
    default:
      return null;
  }
}

function GuideTable({ block }) {
  const { headers, rows } = block;
  return (
    <>
      {/* Desktop / wide: real table */}
      <div className="guide-table-wide" style={{ marginBottom: 16, overflow: 'hidden', borderRadius: 12, border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i} style={{
                  textAlign: i === 1 && headers.length === 3 ? 'center' : 'left',
                  padding: '9px 12px', background: 'var(--surface)', color: 'var(--muted)',
                  fontWeight: 700, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.03em',
                  borderBottom: '2px solid var(--border)',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} style={{ background: ri % 2 === 1 ? 'var(--inputBg)' : 'transparent' }}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{
                    padding: '9px 12px', borderTop: '1px solid var(--border)',
                    color: ci === 0 ? 'var(--accent)' : 'var(--text)',
                    fontWeight: ci === 0 ? 700 : 400,
                    textAlign: ci === 1 && headers.length === 3 ? 'center' : 'left',
                    verticalAlign: 'top',
                  }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Mobile / narrow: stacked cards */}
      <div className="guide-table-narrow" style={{ display: 'none', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {rows.map((row, ri) => (
          <div key={ri} style={{ borderRadius: 11, border: '1px solid var(--border)', padding: '10px 12px', background: 'var(--inputBg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent)' }}>{row[0]}</span>
              {row.length === 3 && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{row[1]}</span>}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4, lineHeight: 1.55 }}>{row[row.length - 1]}</div>
          </div>
        ))}
      </div>
    </>
  );
}

export default function GuideModal({ open, onClose, isViewerCR = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState('');
  // Bangla-first by default, per Akhinoor — English is one tap away via
  // the toggle button next to search, not a separate route/setting.
  const [lang, setLang] = useState('bn');
  const shell = getShellContext(location.pathname);
  const GUIDE_SECTIONS_BASE = lang === 'bn' ? GUIDE_SECTIONS_BN : GUIDE_SECTIONS_EN;
  const GUIDE_CATEGORIES = lang === 'bn' ? GUIDE_CATEGORIES_BN : GUIDE_CATEGORIES_EN;
  const T = UI_TEXT[lang];
  const activeShellSections = useMemo(() => {
    const visibleCategories = {
      student: [0, 1, 2, 3],
      faculty: [5],
      provider: [6],
      staff: [7],
    }[shell] || [0, 1, 2, 3];
    const withCR = shell === 'student' && isViewerCR ? [...visibleCategories, 4] : visibleCategories;
    return GUIDE_SECTIONS_BASE
      .filter((section) => withCR.includes(GUIDE_CATEGORIES.indexOf(section.category)))
      .map((section) => transformSection(section, lang));
  }, [GUIDE_SECTIONS_BASE, GUIDE_CATEGORIES, isViewerCR, lang, shell]);
  const [activeId, setActiveId] = useState(activeShellSections[0]?.id || GUIDE_SECTIONS_BASE[0]?.id);
  const [mobileShowContent, setMobileShowContent] = useState(false);
  const contentRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => { if (open) { setQuery(''); setMobileShowContent(false); } }, [open]);
  useEffect(() => {
    if (!activeShellSections.length) return;
    if (!activeShellSections.some((section) => section.id === activeId)) {
      setActiveId(activeShellSections[0].id);
    }
  }, [activeShellSections, activeId]);
  useEffect(() => { if (contentRef.current) contentRef.current.scrollTop = 0; }, [activeId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeShellSections;
    return activeShellSections.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.desc.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q)
    );
  }, [query, activeShellSections]);

  const grouped = useMemo(() => {
    const m = new Map(GUIDE_CATEGORIES.map(c => [c, []]));
    filtered.forEach(s => { if (m.has(s.category)) m.get(s.category).push(s); });
    return [...m.entries()].filter(([, items]) => items.length);
  }, [filtered]);

  const active = filtered.find(s => s.id === activeId) || filtered[0] || activeShellSections[0];
  const flatIdx = filtered.findIndex(s => s.id === active?.id);
  const prevSection = filtered[flatIdx - 1];
  const nextSection = filtered[flatIdx + 1];

  const selectSection = (id) => { setActiveId(id); setMobileShowContent(true); };

  if (!open) return null;

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 10020, background: 'rgba(8,12,22,0.72)', backdropFilter: 'blur(6px)' }} onClick={onClose} />
      <div style={{ position: 'fixed', inset: 0, zIndex: 10021, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
        <div className="guide-modal-shell" onClick={e => e.stopPropagation()} style={{
          width: '100%', maxWidth: 980, height: 'min(86vh, 760px)',
          background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16,
          boxShadow: '0 24px 60px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          position: 'relative',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px',
            borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'var(--surface)',
          }}>
            {/* mobile back button */}
            <button
              className="guide-back-btn"
              onClick={() => setMobileShowContent(false)}
              aria-label="Back to list"
              style={{ display: 'none', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text)', padding: 4 }}
            >
              <Icon name="ChevronLeft" size={20} />
            </button>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="BookOpen" size={16} color="var(--accentFg)" />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 14.5, color: 'var(--text)' }}>{T.guideTitle}</div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{T.sectionsCount(activeShellSections.length)}</div>
            </div>
            {/* Language toggle — Bangla is default; tapping this swaps
                every section's title/desc/blocks + category names to
                English, and back. No separate settings entry: this
                button is the only toggle, per Akhinoor's request. */}
            <button
              onClick={() => setLang(l => l === 'bn' ? 'en' : 'bn')}
              style={{
                flexShrink: 0, padding: '6px 11px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'transparent',
                color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {T.langToggleLabel}
            </button>
            <button onClick={onClose} aria-label="Close" style={{
              background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)',
              padding: 6, borderRadius: 8, display: 'flex',
            }}><Icon name="X" size={18} /></button>
          </div>

          <div className="guide-body" style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            {/* Sidebar */}
            <div className="guide-sidebar" style={{
              width: 250, flexShrink: 0, borderRight: '1px solid var(--border)',
              display: 'flex', flexDirection: 'column', background: 'var(--surface)',
            }}>
              <div style={{ padding: 12, flexShrink: 0 }}>
                <div style={{ position: 'relative' }}>
                  <Icon name="Search" size={14} color="var(--muted)" style={{ position: 'absolute', left: 10, top: 9 }} />
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder={T.searchPlaceholder}
                    style={{
                      width: '100%', padding: '7px 10px 7px 30px', borderRadius: 9,
                      border: '1px solid var(--border)', background: 'var(--inputBg)',
                      color: 'var(--text)', fontSize: 13, boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 12px' }}>
                {grouped.length === 0 && (
                  <div style={{ padding: '20px 8px', textAlign: 'center', fontSize: 12.5, color: 'var(--muted)' }}>{T.noMatches}</div>
                )}
                {grouped.map(([cat, items]) => (
                  <div key={cat} style={{ marginBottom: 6 }}>
                    <div style={{ padding: '10px 8px 4px', fontSize: 10.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>{cat}</div>
                    {items.map(s => {
                      const isActive = s.id === activeId;
                      return (
                        <button key={s.id} onClick={() => selectSection(s.id)} style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                          padding: '8px 9px', borderRadius: 9, border: 'none', cursor: 'pointer',
                          textAlign: 'left', marginBottom: 1,
                          background: isActive ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'transparent',
                          borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                        }}>
                          <Icon name={s.icon} size={15} color={isActive ? 'var(--accent)' : 'var(--muted)'} style={{ flexShrink: 0 }} />
                          <span style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
                <a href="https://www.facebook.com/kuetx" target="_blank" rel="noopener noreferrer" style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '7px 10px', borderRadius: 8, textDecoration: 'none', fontSize: 12, fontWeight: 700,
                  background: 'rgba(24,119,242,0.12)', color: '#1877F2',
                }}>
                  <Icon name="Facebook" size={13} /> {T.community}
                </a>
              </div>
            </div>

            {/* Content */}
            <div className="guide-content" ref={contentRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 26px 28px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: 'color-mix(in srgb, var(--accent) 15%, var(--card))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name={active.icon} size={17} color="var(--accent)" />
                  </div>
                  <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: 'var(--text)' }}>{active.title}</h3>
                </div>
                {active.route && (
                  <button
                    onClick={() => { onClose?.(); navigate(active.route); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
                      padding: '6px 11px', borderRadius: 8, border: '1px solid var(--border)',
                      background: 'transparent', color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    }}>
                    {T.openPage} <Icon name="ArrowUpRight" size={13} />
                  </button>
                )}
              </div>
              <div style={{ height: 1, background: 'var(--border)', margin: '14px 0 18px' }} />
              {active.blocks.map((b, i) => <Block key={i} block={b} />)}

              {/* Prev / Next */}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                {prevSection ? (
                  <button onClick={() => selectSection(prevSection.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 12.5, padding: 6 }}>
                    <Icon name="ChevronLeft" size={14} /> {prevSection.title}
                  </button>
                ) : <span />}
                {nextSection ? (
                  <button onClick={() => selectSection(nextSection.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 12.5, fontWeight: 700, padding: 6 }}>
                    {nextSection.title} <Icon name="ChevronRight" size={14} />
                  </button>
                ) : <span />}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 740px) {
          .guide-modal-shell { height: 100% !important; max-width: 100% !important; border-radius: 0 !important; }
          .guide-sidebar { width: 100% !important; display: ${mobileShowContent ? 'none' : 'flex'} !important; }
          .guide-content { display: ${mobileShowContent ? 'block' : 'none'} !important; }
          .guide-back-btn { display: flex !important; }
          .guide-content { padding: 16px 16px 22px !important; }
          .guide-sidebar > div:first-child { padding: 10px !important; }
        }
        @media (max-width: 600px) {
          .guide-table-wide { display: none !important; }
          .guide-table-narrow { display: flex !important; }
        }
      `}</style>
    </>
  );
}
