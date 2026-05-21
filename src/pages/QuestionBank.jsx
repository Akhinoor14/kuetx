import { useState, useMemo, useCallback } from 'react';
import {
  BookOpen, Download, Search, Filter, ChevronDown, ChevronRight,
  FileText, AlertCircle, ExternalLink, BookMarked, Share2, Info,
  CheckCircle, Clock, Layers
} from 'lucide-react';
import { getProfile } from '../store/store';
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

// ──────────────────────────────────────────
// MAIN COMPONENT
// ──────────────────────────────────────────
export default function QuestionBank() {
  const profile = getProfile();
  const myDept = profile?.department ? (QB_DEPT_CODE_MAP[profile.department] || null) : null;

  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState(myDept || '');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [view, setView] = useState('grouped'); // grouped | list
  const [showFilters, setShowFilters] = useState(false);

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

  const handleDownload = useCallback((item) => {
    if (!item.available) {
      window.alert('This question paper is not yet available for download.\n\nWant to contribute? Tap "Contribute" to submit a paper.');
      return;
    }
    const url = `/${item.filePath}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${item.dept}_Y${item.year}T${item.term}_${item.examType}_${item.examYear}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, []);

  const handleContribute = () => {
    if (window.confirm('এটি Google Form এ redirect করবে। Continue করতে OK চাপুন।')) {
      window.open('https://forms.gle/9NahxuzSeeU6NTLw6', '_blank');
    }
  };

  const clearFilters = () => {
    setSearch(''); setSelectedDept(myDept || ''); setSelectedYear('');
    setSelectedTerm(''); setShowOnlyAvailable(false);
  };

  const activeFilterCount = [
    selectedDept && selectedDept !== myDept, !!selectedYear,
    !!selectedTerm, showOnlyAvailable, !!search,
  ].filter(Boolean).length;

  return (
    <div className="qb2-wrap">
      {/* ── HERO ── */}
      <div className="qb2-hero">
        <div className="qb2-hero-text">
          <div className="qb2-badge"><BookMarked size={12}/> Question Bank</div>
          <h1 className="qb2-title">KUET Past Papers</h1>
          <p className="qb2-sub">
            {globalStats.total} papers across {globalStats.depts} departments &nbsp;·&nbsp;
            {globalStats.available} available for download
          </p>
        </div>
        <div className="qb2-stats">
          <StatBox n={globalStats.total} l="Total Papers" color="blue"/>
          <StatBox n={globalStats.available} l="Available" color="green"/>
          <StatBox n={globalStats.depts} l="Departments" color="purple"/>
          <StatBox n={filtered.length} l="Showing" color="orange"/>
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
        <button className="qb2-contribute-btn" onClick={handleContribute}>
          Contribute <ExternalLink size={12}/>
        </button>
      </div>

      {/* ── CONTENT ── */}
      {filtered.length === 0 ? (
        <EmptyState onClear={clearFilters} />
      ) : view === 'list' ? (
        <div className="qb2-list">
          {filtered.map(item => (
            <PaperRow key={item.id} item={item} onDownload={handleDownload} />
          ))}
        </div>
      ) : (
        <div className="qb2-grouped">
          {Object.values(grouped).map(deptGroup => (
            <DeptGroup
              key={deptGroup.dept}
              deptGroup={deptGroup}
              expandedGroups={expandedGroups}
              toggleGroup={toggleGroup}
              onDownload={handleDownload}
            />
          ))}
        </div>
      )}

      {/* ── FOOTER INFO ── */}
      <div className="qb2-footer">
        <Info size={13}/>
        <span>
          Papers marked <span className="qb2-avail-dot">●</span> are available for download.
          Others are catalogued but PDFs not yet uploaded.
          Files are stored as compressed (.zst) originals.
        </span>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
// SUB-COMPONENTS
// ──────────────────────────────────────────

function StatBox({ n, l, color }) {
  const colors = {
    blue: 'rgba(37,99,235,0.1)',
    green: 'rgba(22,163,74,0.1)',
    purple: 'rgba(124,58,237,0.1)',
    orange: 'rgba(234,88,12,0.1)',
  };
  return (
    <div className="qb2-stat" style={{ background: colors[color] }}>
      <div className="qb2-stat-n">{n}</div>
      <div className="qb2-stat-l">{l}</div>
    </div>
  );
}

function DeptGroup({ deptGroup, expandedGroups, toggleGroup, onDownload }) {
  const deptKey = `dept_${deptGroup.dept}`;
  const isDeptOpen = expandedGroups[deptKey] !== false; // default open
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
                  const isOpen = expandedGroups[termKey] !== false; // default open
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
                          {papers.sort((a,b) => b.examYear - a.examYear).map(p => (
                            <PaperCard key={p.id} item={p} onDownload={onDownload}/>
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

function PaperCard({ item, onDownload }) {
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
  );
}

function PaperRow({ item, onDownload }) {
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
