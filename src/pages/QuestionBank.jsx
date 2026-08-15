// QuestionBank.jsx
//
// Browse the new canonical JSON-based Question Bank (54,001 questions,
// public/canonical-questions/) via useCanonicalQuestions.js. This is
// question-browsing ONLY -- no answers/solutions here. For answers, see
// SolutionBank.jsx (route: /solutions), which is a separate, unrelated
// dataset (public/solution-data/) and was NOT touched by this file.
//
// See PROGRESS_QB_WEBSITE_INTEGRATION.md for the full history of why
// these two are split (they used to be confusingly combined under one
// name, QuestionBankSolutions.jsx / "/solutions").
//
// Flow: department -> term -> course -> question list -> question detail
// (drilldown state kept in the URL via useSearchParams, same pattern as
// SolutionBank.jsx, so links/back-button work as expected).

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronRight, ArrowLeft, Search, X, BookOpen, Hash } from 'lucide-react';
import 'katex/dist/katex.min.css';
import '../styles/questionbank.css';
import {
  useCanonicalIndex,
  useCanonicalCourseList,
  useCanonicalQuestions,
} from '../hooks/useCanonicalQuestions';

// ─────────────────────────────────────────────────────────────────────────
// KATEX -- small local copy of the same lazy-loader SolutionBank.jsx uses.
// Not extracted into a shared module on purpose: SolutionBank.jsx's own
// copy is left completely untouched, so nothing there can regress.
// ─────────────────────────────────────────────────────────────────────────
let _katex = null;
async function loadKatex() {
  if (_katex) return _katex;
  try { _katex = (await import('katex')).default; } catch (_) { _katex = null; }
  return _katex;
}

function MathSpan({ src, display = false }) {
  const ref = useRef(null);
  useEffect(() => {
    loadKatex().then((kt) => {
      if (!kt || !ref.current) return;
      try { kt.render(src, ref.current, { displayMode: display, throwOnError: false, output: 'html' }); }
      catch (_) { if (ref.current) ref.current.textContent = src; }
    });
  }, [src, display]);
  return <span ref={ref} />;
}

// strips the $$...$$ / $...$ wrapper canonical "formula" blocks store their
// latex in, since MathSpan/katex.render wants the bare expression
function stripLatexDelimiters(raw) {
  const s = (raw || '').trim();
  if (s.startsWith('$$') && s.endsWith('$$')) return s.slice(2, -2).trim();
  if (s.startsWith('$') && s.endsWith('$')) return s.slice(1, -1).trim();
  if (s.startsWith('\\[') && s.endsWith('\\]')) return s.slice(2, -2).trim();
  return s;
}

// ─────────────────────────────────────────────────────────────────────────
// CONTENT BLOCK RENDERER
//
// Canonical question schema, content[].type is one of:
//   text    -> { value: string }
//   formula -> { value: "$$...$$", format: "latex" }
//   table   -> { value_html: "<table>...</table>" }
//   image   -> { asset: "assets/xyz.jpg", _source_path: "..." }
//
// NOTE (image assets): as of this writing, no actual asset files exist
// under public/canonical-questions/ anywhere (verified by scanning for any
// "assets" folder -- none found). This is a known, already-flagged open
// item (ধাপ F in PROGRESS_QB_WEBSITE_INTEGRATION.md, §৪) -- image blocks
// are rendered as a clearly-labeled placeholder instead of a broken <img>,
// until that's resolved.
// ─────────────────────────────────────────────────────────────────────────
function ContentBlock({ block, idx }) {
  if (!block || !block.type) return null;

  if (block.type === 'text') {
    if (!block.value) return null;
    return <p className="qb-content-text" key={idx}>{block.value}</p>;
  }

  if (block.type === 'formula') {
    if (!block.value) return null;
    return (
      <div className="qb-content-formula" key={idx}>
        <MathSpan src={stripLatexDelimiters(block.value)} display />
      </div>
    );
  }

  if (block.type === 'table') {
    if (!block.value_html) return null;
    // pipeline-sourced HTML, not user input -- safe to render directly,
    // same trust boundary as the rest of this dataset
    return (
      <div
        className="qb-content-table"
        key={idx}
        dangerouslySetInnerHTML={{ __html: block.value_html }}
      />
    );
  }

  if (block.type === 'image') {
    return (
      <div className="qb-content-image-placeholder" key={idx}>
        <span>ছবি এখনো যোগ করা যায়নি (asset pending)</span>
      </div>
    );
  }

  return null;
}

function QuestionDetailCard({ question }) {
  if (!question) return null;
  return (
    <div className="course-card" style={{ cursor: 'default' }}>
      <div className="course-info-bar">
        <span className="course-info-code">{question.id}</span>
        {question.marks != null && (
          <span className="course-card-hint">{question.marks} marks</span>
        )}
      </div>
      {(question.content || []).map((block, i) => (
        <ContentBlock block={block} idx={i} key={i} />
      ))}
      {question.needs_human_review && (
        <div className="qb-review-flag">এই প্রশ্নটা এখনো manual review-এর অপেক্ষায় আছে</div>
      )}
    </div>
  );
}

export default function QuestionBank() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { index, loading: indexLoading, error: indexError } = useCanonicalIndex();

  const [selectedDept, setSelectedDept] = useState(searchParams.get('dept') || null);
  const [selectedTerm, setSelectedTerm] = useState(searchParams.get('term') || null);
  const [selectedCourse, setSelectedCourse] = useState(searchParams.get('course') || null);
  const [search, setSearch] = useState('');

  // keep URL in sync with drilldown state, same pattern as SolutionBank.jsx
  useEffect(() => {
    const params = {};
    if (selectedDept) params.dept = selectedDept;
    if (selectedTerm) params.term = selectedTerm;
    if (selectedCourse) params.course = selectedCourse;
    setSearchParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDept, selectedTerm, selectedCourse]);

  const departments = useMemo(() => {
    if (!index?.departments) return [];
    return Object.keys(index.departments).sort();
  }, [index]);

  const terms = useMemo(() => {
    if (!index?.departments || !selectedDept) return [];
    return Object.keys(index.departments[selectedDept]?.terms || {}).sort();
  }, [index, selectedDept]);

  const { courses } = useCanonicalCourseList(selectedDept, selectedTerm);

  const { questions, loading: questionsLoading, error: questionsError } =
    useCanonicalQuestions(selectedDept, selectedTerm, selectedCourse);

  const filteredQuestions = useMemo(() => {
    if (!search.trim()) return questions;
    const sq = search.toLowerCase();
    return questions.filter((q) => {
      const idMatch = String(q.id || '').toLowerCase().includes(sq);
      const textMatch = (q.content || []).some(
        (b) => b.type === 'text' && (b.value || '').toLowerCase().includes(sq)
      );
      return idMatch || textMatch;
    });
  }, [questions, search]);

  const goToDepts = useCallback(() => {
    setSelectedDept(null);
    setSelectedTerm(null);
    setSelectedCourse(null);
  }, []);

  const goToTerms = useCallback((dept) => {
    setSelectedDept(dept);
    setSelectedTerm(null);
    setSelectedCourse(null);
  }, []);

  const goToCourses = useCallback((term) => {
    setSelectedTerm(term);
    setSelectedCourse(null);
  }, []);

  const goToCourse = useCallback((courseCode) => {
    setSelectedCourse(courseCode);
    setSearch('');
  }, []);

  if (indexError) {
    return (
      <div className="content-page-bg">
        <div className="empty-state">Question Bank লোড করতে সমস্যা হয়েছে। একটু পরে আবার চেষ্টা করো।</div>
      </div>
    );
  }

  return (
    <div className="content-page-bg">
      <div className="content-page-hero">
        <div className="content-page-hero-head">
          <BookOpen className="content-page-hero-icon" size={28} />
          <div className="content-page-hero-main">
            <h1 className="content-page-hero-title">Question Bank</h1>
            <p className="content-page-hero-subtitle">
              বিভাগ, টার্ম আর কোর্স অনুযায়ী পুরনো প্রশ্ন খুঁজে দেখো
            </p>
          </div>
        </div>
        {index && (
          <div className="content-page-hero-stats">
            <div className="content-page-hero-stat">
              <span className="content-page-hero-stat-n">{index.total_question_files}</span>
              <span className="content-page-hero-stat-label">প্রশ্ন</span>
            </div>
            <div className="content-page-hero-stat">
              <span className="content-page-hero-stat-n">{departments.length}</span>
              <span className="content-page-hero-stat-label">বিভাগ</span>
            </div>
          </div>
        )}
      </div>

      {/* breadcrumb */}
      <div className="filter-bar-row qs-no-print">
        {selectedDept && (
          <button className="btn-secondary" onClick={goToDepts}>
            <ArrowLeft size={16} /> বিভাগ তালিকা
          </button>
        )}
        {selectedDept && (
          <span className="crumb-active">
            {selectedDept}
            {selectedTerm && <> <ChevronRight size={14} style={{ display: 'inline' }} /> {selectedTerm}</>}
            {selectedCourse && <> <ChevronRight size={14} style={{ display: 'inline' }} /> {selectedCourse.replace('_', ' ')}</>}
          </span>
        )}
      </div>

      {indexLoading && <div className="empty-state">লোড হচ্ছে...</div>}

      {/* level 1: department picker */}
      {!indexLoading && !selectedDept && (
        <div className="course-grid">
          {departments.map((dept) => (
            <div className="course-card" key={dept} onClick={() => goToTerms(dept)}>
              <div className="course-card-code">{dept}</div>
              <div className="course-card-hint">
                {Object.keys(index.departments[dept]?.terms || {}).length} টার্ম
              </div>
            </div>
          ))}
        </div>
      )}

      {/* level 2: term picker */}
      {selectedDept && !selectedTerm && (
        <div className="course-grid">
          {terms.map((term) => (
            <div className="course-card" key={term} onClick={() => goToCourses(term)}>
              <div className="course-card-code">{term}</div>
            </div>
          ))}
        </div>
      )}

      {/* level 3: course picker */}
      {selectedDept && selectedTerm && !selectedCourse && (
        <div className="course-grid">
          {courses.map((c) => (
            <div className="course-card" key={c.code} onClick={() => goToCourse(c.code)}>
              <div className="course-card-code">{c.displayCode}</div>
              <div className="course-card-hint">{c.questionCount} প্রশ্ন</div>
            </div>
          ))}
          {courses.length === 0 && (
            <div className="empty-state">এই টার্মে এখনো কোনো কোর্স যোগ হয়নি</div>
          )}
        </div>
      )}

      {/* level 4: question list for the selected course */}
      {selectedCourse && (
        <>
          <div className="filter-bar-row qs-no-print">
            <div className="filter-bar">
              <Search className="filter-bar-icon" size={16} />
              <input
                type="text"
                placeholder="প্রশ্ন খুঁজো..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="dt-select"
              />
              {search && (
                <button className="filter-clear" onClick={() => setSearch('')}>
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {questionsLoading && <div className="empty-state">প্রশ্ন লোড হচ্ছে...</div>}
          {questionsError && (
            <div className="empty-state">এই কোর্সের প্রশ্ন লোড করতে সমস্যা হয়েছে।</div>
          )}

          {!questionsLoading && !questionsError && (
            <div className="qb-question-list">
              {filteredQuestions.map((q, i) => (
                <QuestionDetailCard question={q} key={q.id || i} />
              ))}
              {filteredQuestions.length === 0 && (
                <div className="empty-state">
                  <Hash size={20} /> কোনো প্রশ্ন পাওয়া যায়নি
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
