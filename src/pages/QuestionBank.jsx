import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, Download, Search, Filter, ChevronDown, ChevronRight,
  FileText, AlertCircle, ExternalLink, BookMarked, Share2, Info,
  CheckCircle, Clock, Layers, Eye, X
} from 'lucide-react';
import { getProfile, getCurrentTermKey } from '../store/store';
import {
  QUESTION_BANK, QB_DEPARTMENTS, QB_DEPT_CODE_MAP,
  getQBStats, getQBForDept, getQBForTerm, ytLabel,
} from '../data/questionbank/questionBankData';


// ──────────────────────────────────────────
// QB OVERRIDES (set available: true here when PDFs are placed in public/)
// Format: { [id]: { available: true, addedAt: 'YYYY-MM-DD', note?: string } }
// ──────────────────────────────────────────
const QB_OVERRIDES = {
  // Example: 'ESE_Y2T1_Regular_2023': { available: true, addedAt: '2025-05-21' },
};

const CONTRIBUTION_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLScE5eujz_Vu5LFgkZkiGtWurliPsOiGLmUYTKftBZNSkYTPmg/viewform?embedded=true';
const CONTRIBUTION_FALLBACK_URL = 'https://forms.gle/9NahxuzSeeU6NTLw6';
const CONTRIBUTION_PROMPT_LAST_SHOWN_KEY = 'questionBank_contribution_prompt_last_shown';
const CONTRIBUTION_PROMPT_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours

// Merge overrides into data
const QB_DATA = QUESTION_BANK.map(q => ({
  ...q,
  ...(QB_OVERRIDES[q.id] || {}),
}));

// ──────────────────────────────────────────
// CONSTANTS
// ──────────────────────────────────────────
const ALL_DEPTS = Object.entries(QB_DEPARTMENTS).map(([code, name]) => ({ code, name }));
const DEPT_CODE_SHORT = {
  ARCH:'Arch', BME:'BME', BECM:'BECM', CSE:'CSE', EEE:'EEE',
  ECE:'ECE', ESE:'ESE', IPE:'IPE', LE:'LE', MSE:'MSE',
  ME:'ME', MTE:'MTE', TE:'TE', URP:'URP',
};

const YEAR_LABELS = ['', '1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'];
const TERM_LABELS = ['', '1st Term', '2nd Term'];

const getDefaultExpandedGroups = (deptCode, currentTermKey) => {
  if (!deptCode || !currentTermKey) return {};
  const [yearPart, termPart] = String(currentTermKey).split('T');
  const year = Number(yearPart?.replace(/^Y/, ''));
  const term = Number(termPart);
  if (!Number.isFinite(year) || !Number.isFinite(term)) return {};
  return {
    [`dept_${deptCode}`]: true,
    [`${deptCode}_Y${year}T${term}`]: true,
  };
};

// ──────────────────────────────────────────
// MAIN COMPONENT
// ──────────────────────────────────────────
export default function QuestionBank() {
  const navigate = useNavigate();
  const profile = getProfile();
  const profileDeptRaw = String(profile?.dept || '').trim();
  const myDept = profileDeptRaw
    ? (QB_DEPT_CODE_MAP[profileDeptRaw]
      || QB_DEPT_CODE_MAP[Object.keys(QB_DEPT_CODE_MAP).find(key => key.toLowerCase() === profileDeptRaw.toLowerCase()) || '']
      || null)
    : null;
  const currentTermKey = getCurrentTermKey(profile);
  const defaultExpandedGroups = useMemo(
    () => getDefaultExpandedGroups(myDept, currentTermKey),
    [myDept, currentTermKey],
  );

  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState(myDept || '');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(defaultExpandedGroups);
  const [view, setView] = useState('grouped'); // grouped | list
  const [showFilters, setShowFilters] = useState(false);
  const [showIntroPrompt, setShowIntroPrompt] = useState(false);
  const [showContributionForm, setShowContributionForm] = useState(false);

  useEffect(() => {
    const lastShown = Number(localStorage.getItem(CONTRIBUTION_PROMPT_LAST_SHOWN_KEY) || '0');
    const now = Date.now();
    const shouldShow = !lastShown || (now - lastShown >= CONTRIBUTION_PROMPT_COOLDOWN_MS);

    if (shouldShow) {
      localStorage.setItem(CONTRIBUTION_PROMPT_LAST_SHOWN_KEY, String(now));
      setShowIntroPrompt(true);
    }
  }, []);

  useEffect(() => {
    if (myDept) {
      setSelectedDept(prev => (prev ? prev : myDept));
    }
  }, [myDept]);

  useEffect(() => {
    if (Object.keys(expandedGroups).length === 0 && Object.keys(defaultExpandedGroups).length > 0) {
      setExpandedGroups(defaultExpandedGroups);
    }
  }, [defaultExpandedGroups, expandedGroups]);

  // Global stats
  const globalStats = useMemo(() => ({
    total: QB_DATA.length,
    available: QB_DATA.filter(q => q.available).length,
    depts: new Set(QB_DATA.map(q => q.dept)).size,
  }), []);

  // Filtered + grouped data
  const filtered = useMemo(() => {
    const sq = search.trim().toLowerCase();
    return QB_DATA.filter(q => {
      if (selectedDept && q.dept !== selectedDept) return false;
      if (selectedYear && q.year !== Number(selectedYear)) return false;
      if (selectedTerm && q.term !== Number(selectedTerm)) return false;
      if (showOnlyAvailable && !q.available) return false;
      if (sq) {
        const haystack = `${q.dept} ${q.deptName} ${q.examYear} ${q.examType} ${ytLabel(q.year, q.term)}`.toLowerCase();
        if (!haystack.includes(sq)) return false;
      }
      return true;
    });
  }, [search, selectedDept, selectedYear, selectedTerm, showOnlyAvailable]);

  // Group by dept → year → term
  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach(q => {
      const dk = q.dept;
      const yk = q.year;
      const tk = q.term;
      if (!map[dk]) map[dk] = { dept: q.dept, deptName: q.deptName, years: {} };
      if (!map[dk].years[yk]) map[dk].years[yk] = {};
      if (!map[dk].years[yk][tk]) map[dk].years[yk][tk] = [];
      map[dk].years[yk][tk].push(q);
    });
    return map;
  }, [filtered]);

  const toggleGroup = useCallback((key) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const persistContributionPromptTimestamp = useCallback(() => {
    localStorage.setItem(CONTRIBUTION_PROMPT_LAST_SHOWN_KEY, String(Date.now()));
  }, []);

  const openContributionFlow = useCallback(() => {
    persistContributionPromptTimestamp();
    setShowIntroPrompt(false);
    setShowContributionForm(true);
  }, [persistContributionPromptTimestamp]);

  const openContributionPrompt = useCallback(() => {
    persistContributionPromptTimestamp();
    setShowIntroPrompt(true);
  }, [persistContributionPromptTimestamp]);

  const closeContributionPrompt = useCallback(() => {
    persistContributionPromptTimestamp();
    setShowIntroPrompt(false);
  }, [persistContributionPromptTimestamp]);

  const closeContributionForm = useCallback(() => {
    setShowContributionForm(false);
  }, []);

  const openPaperViewer = useCallback((item) => {
    if (!item.available) {
      openContributionPrompt();
      return;
    }
    navigate(`/question-bank/view?src=${encodeURIComponent(`/${item.filePath}`)}`);
  }, [navigate, openContributionPrompt]);

  const handleDownload = useCallback((item) => {
    if (!item.available) {
      openContributionPrompt();
      return;
    }
    const url = `/${item.filePath}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${item.dept}_Y${item.year}T${item.term}_${item.examType}_${item.examYear}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [openContributionPrompt]);

  const clearFilters = () => {
    setSearch(''); setSelectedDept(myDept || ''); setSelectedYear('');
    setSelectedTerm(''); setShowOnlyAvailable(false);
    setExpandedGroups(defaultExpandedGroups);
  };

  const activeFilterCount = [
    selectedDept && selectedDept !== myDept, !!selectedYear,
    !!selectedTerm, showOnlyAvailable, !!search,
  ].filter(Boolean).length;

  return (
    <div className="qb2-page">
      <div className="qb2-wrap">
      {/* ── HERO (minimal) ── */}
      <div className="qb-min-card">
        <div className="qb-min-head">
          <h1>KUET Past Papers</h1>
          <p className="qb-min-sub">Default view: {myDept ? `${DEPT_CODE_SHORT[myDept] || myDept} department` : 'set your profile department'}</p>
        </div>

        <div className="qb-min-stats">
          <div className="stat">
            <div className="num">{globalStats.total}</div>
            <div className="lbl">Total Papers</div>
          </div>
          <div className="stat">
            <div className="num">{globalStats.available}</div>
            <div className="lbl">Available</div>
          </div>
          <div className="stat">
            <div className="num">{globalStats.depts}</div>
            <div className="lbl">Departments</div>
          </div>
        </div>
      </div>

      {/* ── SEARCH + FILTERS ── */}
      <div className="qb2-toolbar">
        <div className="qb2-search-row">
          <div className="qb2-search-box">
            <Search size={16} className="qb2-search-icon"/>
            <input
              className="qb2-search-input"
              placeholder="Search dept, year, exam type…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="qb2-inline-dept">
            <span className="qb2-inline-dept-label">
              {myDept ? 'Default dept' : 'Dept'}
            </span>
            <select
              className="qb2-inline-dept-select"
              value={selectedDept}
              onChange={e => setSelectedDept(e.target.value)}
              aria-label="Select department filter"
            >
              <option value="">All Departments</option>
              {ALL_DEPTS.map(d => (
                <option key={d.code} value={d.code}>
                  {DEPT_CODE_SHORT[d.code]} — {d.name.replace('Department of ', '')}
                </option>
              ))}
            </select>
            {myDept && selectedDept !== myDept && (
              <button
                type="button"
                className="qb2-inline-dept-reset"
                onClick={() => setSelectedDept(myDept)}
              >
                My dept
              </button>
            )}
          </div>
          <button
            className={`qb2-filter-btn ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(v => !v)}
          >
            <Filter size={15}/>
            Filters
            {activeFilterCount > 0 && <span className="qb2-filter-badge">{activeFilterCount}</span>}
          </button>
          <div className="qb2-view-btns">
            <button className={`qb2-view-btn ${view === 'grouped' ? 'active' : ''}`} onClick={() => setView('grouped')} title="Grouped view"><Layers size={15}/></button>
            <button className={`qb2-view-btn ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')} title="List view"><FileText size={15}/></button>
          </div>
        </div>

        {showFilters && (
          <div className="qb2-filters">
            <select className="qb2-select" value={selectedDept} onChange={e => setSelectedDept(e.target.value)}>
              <option value="">All Departments</option>
              {ALL_DEPTS.map(d => (
                <option key={d.code} value={d.code}>{DEPT_CODE_SHORT[d.code]} — {d.name.replace('Department of ', '')}</option>
              ))}
            </select>
            <select className="qb2-select" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
              <option value="">All Years</option>
              {[1,2,3,4,5].map(y => <option key={y} value={y}>{y === 5 ? '5th Year' : `${['','1st','2nd','3rd','4th'][y]} Year`}</option>)}
            </select>
            <select className="qb2-select" value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)}>
              <option value="">All Terms</option>
              <option value="1">1st Term</option>
              <option value="2">2nd Term</option>
            </select>
            <label className="qb2-check-label">
              <input type="checkbox" checked={showOnlyAvailable} onChange={e => setShowOnlyAvailable(e.target.checked)}/>
              Available only
            </label>
            {activeFilterCount > 0 && (
              <button className="qb2-clear-btn" onClick={clearFilters}>Clear all</button>
            )}
          </div>
        )}
      </div>

      {/* ── CONTRIBUTE STRIP ── */}
      <div className="qb2-contribute-strip">
        <Info size={14}/>
        <span>Don't see your paper? Help others by contributing.</span>
        <button className="qb2-contribute-btn" onClick={openContributionPrompt}>
          Contribute <ExternalLink size={12}/>
        </button>
      </div>

      {/* ── CONTENT ── */}
      {filtered.length === 0 ? (
        <EmptyState onClear={clearFilters} />
      ) : view === 'list' ? (
        <div className="qb2-list">
          {filtered.map((item, index) => (
            <PaperRow key={`${item.id}-${index}`} item={item} onDownload={handleDownload} onView={openPaperViewer} />
          ))}
        </div>
      ) : (
        <div className="qb2-grouped">
          {Object.values(grouped).map(deptGroup => (
            <DeptGroup
              key={deptGroup.dept}
              deptGroup={deptGroup}
              expandedGroups={expandedGroups}
                defaultExpandedGroups={defaultExpandedGroups}
              toggleGroup={toggleGroup}
              onDownload={handleDownload}
              onView={openPaperViewer}
            />
          ))}
        </div>
      )}

      {/* ── FOOTER INFO ── */}
      <div className="qb2-footer">
        <Info size={13}/>
        <span>
          Papers marked <span className="qb2-avail-dot">●</span> are available for download.
          Use View to open any available PDF inside the site.
          The current runtime serves PDFs; compressed .zst originals stay in the offline archive.
        </span>
      </div>
      </div>

      {showIntroPrompt && (
        <div className="qb2-modal-backdrop" role="presentation" onClick={closeContributionPrompt}>
          <div className="qb2-modal" role="dialog" aria-modal="true" aria-labelledby="qb2-intro-title" onClick={e => e.stopPropagation()}>
            <div className="qb2-modal-top">
              <div>
                <div className="qb2-modal-kicker">Question Bank help</div>
                <h2 id="qb2-intro-title" className="qb2-modal-title">We are collecting question papers and solutions</h2>
              </div>
              <button className="qb2-modal-close" type="button" onClick={closeContributionPrompt} aria-label="Close help popup">
                <X size={16} />
              </button>
            </div>
            <p className="qb2-modal-text">
              If you have any question paper or solution, you can share it here.
              It helps us keep the Question Bank complete for everyone.
            </p>
            <div className="qb2-modal-actions">
              <button className="qb2-secondary-btn" type="button" onClick={closeContributionPrompt}>Not now</button>
              <button className="qb2-primary-btn" type="button" onClick={openContributionFlow}>Continue</button>
            </div>
          </div>
        </div>
      )}

      {showContributionForm && (
        <div className="qb2-modal-backdrop" role="presentation" onClick={closeContributionForm}>
          <div className="qb2-modal qb2-modal-wide" role="dialog" aria-modal="true" aria-labelledby="qb2-form-title" onClick={e => e.stopPropagation()}>
            <div className="qb2-modal-top">
              <div>
                <div className="qb2-modal-kicker">Google Form</div>
                <h2 id="qb2-form-title" className="qb2-modal-title">Share a paper without leaving the site</h2>
              </div>
              <button className="qb2-modal-close" type="button" onClick={closeContributionForm} aria-label="Close form popup">
                <X size={16} />
              </button>
            </div>
            <p className="qb2-modal-text">
              The form is embedded below. If it does not load, use the open button as a fallback.
            </p>
            <div className="qb2-form-frame-wrap">
              <iframe
                title="Question Bank contribution form"
                src={CONTRIBUTION_FORM_URL}
                className="qb2-form-frame"
                loading="lazy"
              />
            </div>
            <div className="qb2-modal-actions qb2-modal-actions-between">
              <a className="qb2-secondary-btn qb2-link-btn" href={CONTRIBUTION_FALLBACK_URL} target="_blank" rel="noreferrer">
                Open Google Form
              </a>
              <button className="qb2-primary-btn" type="button" onClick={closeContributionForm}>Done</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ──────────────────────────────────────────
// SUB-COMPONENTS
// ──────────────────────────────────────────

function StatBox({ n, l, color }) {
  const colors = {
    blue: '#2563eb',
    green: '#059669',
    purple: '#9333ea',
    orange: '#ea580c',
  };
  return (
    <div className="qb2-stat" style={{ background: colors[color] }}>
      <div className="qb2-stat-n">{n}</div>
      <div className="qb2-stat-l">{l}</div>
    </div>
  );
}

function DeptGroup({ deptGroup, expandedGroups, defaultExpandedGroups, toggleGroup, onDownload, onView }) {
  const deptKey = `dept_${deptGroup.dept}`;
  const isDeptOpen = expandedGroups[deptKey] ?? defaultExpandedGroups[deptKey] ?? false;
  const totalInDept = Object.values(deptGroup.years).flatMap(t => Object.values(t).flat()).length;
  const availInDept = Object.values(deptGroup.years).flatMap(t => Object.values(t).flat()).filter(q => q.available).length;

  return (
    <div className="qb2-dept-group">
      <button className="qb2-dept-header" onClick={() => toggleGroup(deptKey)}>
        <div className="qb2-dept-left">
          <span className="qb2-dept-code">{DEPT_CODE_SHORT[deptGroup.dept] || deptGroup.dept}</span>
          <span className="qb2-dept-name">{deptGroup.deptName.replace('Department of ', '')}</span>
        </div>
        <div className="qb2-dept-right">
          <span className="qb2-dept-count">{totalInDept} papers</span>
          {availInDept > 0 && <span className="qb2-dept-avail">{availInDept} available</span>}
          {isDeptOpen ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
        </div>
      </button>

      {isDeptOpen && (
        <div className="qb2-dept-body">
          {Object.entries(deptGroup.years).sort(([a],[b]) => a-b).map(([year, terms]) => (
            <div key={year} className="qb2-year-group">
              <div className="qb2-year-label">{YEAR_LABELS[year] || `Year ${year}`}</div>
              <div className="qb2-terms">
                {Object.entries(terms).sort(([a],[b]) => a-b).map(([term, papers]) => {
                  const termKey = `${deptGroup.dept}_Y${year}T${term}`;
                  const isOpen = expandedGroups[termKey] ?? defaultExpandedGroups[termKey] ?? false;
                  const avail = papers.filter(p => p.available).length;
                  return (
                    <div key={term} className="qb2-term-group">
                      <button className="qb2-term-header" onClick={() => toggleGroup(termKey)}>
                        <span className="qb2-term-label">{TERM_LABELS[term] || `Term ${term}`}</span>
                        <span className="qb2-term-meta">
                          {papers.length} papers
                          {avail > 0 && <span className="qb2-avail-pill">{avail} ↓</span>}
                        </span>
                        {isOpen ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                      </button>
                      {isOpen && (
                        <div className="qb2-papers-grid">
                          {papers.slice().sort((a,b) => b.examYear - a.examYear).map((p, index) => (
                            <PaperCard key={`${p.id}-${index}`} item={p} onDownload={onDownload} onView={onView}/>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PaperCard({ item, onDownload, onView }) {
  return (
    <div className={`qb2-paper-card ${item.available ? 'available' : 'unavailable'}`}>
      <div className="qb2-paper-top">
        <span className="qb2-paper-year">{item.examYear}</span>
        {item.examType !== 'Regular' && (
          <span className="qb2-paper-type">{item.examType}</span>
        )}
        {item.available
          ? <CheckCircle size={13} className="qb2-icon-avail"/>
          : <Clock size={13} className="qb2-icon-pending"/>
        }
      </div>
      <div className="qb2-paper-bot">
        <span className="qb2-paper-degree">{item.degree}</span>
        <div className="qb2-paper-actions">
          {item.available && (
            <button
              className="qb2-view-btn-mini"
              onClick={() => onView(item)}
              title={`Preview ${item.examYear} paper`}
            >
              <Eye size={13}/>
              View
            </button>
          )}
          <button
            className={`qb2-dl-btn ${item.available ? 'ready' : 'not-ready'}`}
            onClick={() => onDownload(item)}
            title={item.available ? `Download ${item.examYear} paper` : 'Not yet available'}
          >
            <Download size={13}/>
            {item.available ? 'Download' : 'Pending'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PaperRow({ item, onDownload, onView }) {
  return (
    <div className={`qb2-paper-row ${item.available ? 'available' : ''}`}>
      <div className="qb2-row-left">
        <span className="qb2-row-dept">{DEPT_CODE_SHORT[item.dept] || item.dept}</span>
        <div className="qb2-row-info">
          <span className="qb2-row-term">{ytLabel(item.year, item.term)} · {item.examYear}</span>
          {item.examType !== 'Regular' && <span className="qb2-paper-type">{item.examType}</span>}
        </div>
      </div>
      <div className="qb2-row-right">
        {item.available
          ? <CheckCircle size={14} className="qb2-icon-avail"/>
          : <Clock size={14} className="qb2-icon-pending"/>
        }
        {item.available && (
          <button className="qb2-view-btn-mini" onClick={() => onView(item)}>
            <Eye size={13}/>
            View
          </button>
        )}
        <button
          className={`qb2-dl-btn ${item.available ? 'ready' : 'not-ready'}`}
          onClick={() => onDownload(item)}
        >
          <Download size={13}/>
          {item.available ? 'PDF' : '...'}
        </button>
      </div>
    </div>
  );
}

function EmptyState({ onClear }) {
  return (
    <div className="qb2-empty">
      <AlertCircle size={32} className="qb2-empty-icon"/>
      <div className="qb2-empty-title">No papers found</div>
      <div className="qb2-empty-sub">Try adjusting filters or search terms</div>
      <button className="qb2-clear-btn2" onClick={onClear}>Clear filters</button>
    </div>
  );
}
