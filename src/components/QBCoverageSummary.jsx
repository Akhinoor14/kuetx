// QBCoverageSummary.jsx
//
// Read-only "how much is actually in R2 right now" view for the Founder
// upload panel — requested because Founder had no quick way to see
// coverage before picking what to upload next, only the flat dept/term/
// course drilldown on the public QuestionBank.jsx page.
//
// Pulls from the SAME live tree useQuestionBankData() already exposes
// (tree shape: { [DEPT]: { [TERM]: { [CourseCode]: [ {label,...} ] } } }),
// no separate fetch/endpoint. Three levels, click to expand:
//   Dept (paper count total)
//     Term (paper count)
//       Course (paper count) -> expand once more for exam type/year labels
//
// Depts/terms/courses with zero papers are just omitted — this is a
// coverage view of what EXISTS, not a full curriculum checklist (that's
// QB_COURSE_CODES' job, already used elsewhere for the upload dropdown).

import { useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, RefreshCw, AlertCircle } from 'lucide-react';
import { useQuestionBankData } from '../hooks/useQuestionBankData';
import { QB_DEPARTMENTS } from '../data/questionbank/questionBankData';

function countPapers(node) {
  // node can be a term-map, a course-map, or a papers array depending on depth
  if (Array.isArray(node)) return node.length;
  return Object.values(node || {}).reduce((sum, child) => sum + countPapers(child), 0);
}

export default function QBCoverageSummary() {
  const { tree, count, loading, error, refetch } = useQuestionBankData();
  const [openDept, setOpenDept] = useState(null);
  const [openTerm, setOpenTerm] = useState(null); // `${dept}::${term}`
  const [openCourse, setOpenCourse] = useState(null); // `${dept}::${term}::${course}`
  // 'single' = normal click-expand-one-branch-at-a-time (original behavior).
  // 'all' = every dept/term/course row expanded simultaneously, for
  // scanning the whole coverage tree in one scroll without clicking
  // through each level — this is what "as nested as possible, all counts"
  // needs when there are many depts already uploaded.
  const [expandMode, setExpandMode] = useState('single');

  // Only depts that actually have >=1 paper in the live tree, sorted by
  // count desc (busiest depts first) then alphabetically.
  const deptRows = useMemo(() => {
    return Object.keys(tree)
      .map((dept) => ({ dept, total: countPapers(tree[dept]) }))
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total || a.dept.localeCompare(b.dept));
  }, [tree]);

  function toggleDept(dept) {
    if (expandMode === 'all') return; // rows are all open already in this mode
    setOpenDept((cur) => (cur === dept ? null : dept));
    setOpenTerm(null);
    setOpenCourse(null);
  }
  function toggleTerm(dept, term) {
    if (expandMode === 'all') return;
    const key = `${dept}::${term}`;
    setOpenTerm((cur) => (cur === key ? null : key));
    setOpenCourse(null);
  }
  function toggleCourse(dept, term, course) {
    if (expandMode === 'all') return;
    const key = `${dept}::${term}::${course}`;
    setOpenCourse((cur) => (cur === key ? null : key));
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>
          Coverage — {count} paper{count === 1 ? '' : 's'} live in R2
        </h3>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={() => setExpandMode((m) => (m === 'all' ? 'single' : 'all'))}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', color: 'var(--text)' }}
          >
            {expandMode === 'all' ? 'Collapse all' : 'Expand all'}
          </button>
          <button
            type="button"
            onClick={refetch}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', color: 'var(--text)' }}
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {loading && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Loading coverage…</div>}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--danger)' }}>
          <AlertCircle size={14} /> Couldn't load: {error}
        </div>
      )}

      {!loading && !error && deptRows.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>No papers uploaded yet.</div>
      )}

      {!loading && !error && deptRows.length > 0 && (
        <>
          {/* All-depts-at-a-glance grid — every dept's total visible without
              clicking anything, so you don't have to expand one by one just
              to compare which depts have how much. */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
            gap: 6, marginBottom: 10,
          }}>
            {deptRows.map(({ dept, total }) => (
              <div
                key={dept}
                style={{
                  border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px',
                  background: 'var(--surface)',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>{dept}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent, #2563eb)' }}>{total}</div>
              </div>
            ))}
          </div>

          <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            {deptRows.map(({ dept, total }) => (
              <div key={dept} style={{ borderBottom: '1px solid var(--border)' }}>
                <Row
                  label={`${dept} — ${QB_DEPARTMENTS[dept] || dept}`}
                  count={total}
                  depth={0}
                  open={expandMode === 'all' || openDept === dept}
                  onClick={() => toggleDept(dept)}
                />
                {(expandMode === 'all' || openDept === dept) && (
                  <TermRows dept={dept} tree={tree} openTerm={openTerm} openCourse={openCourse}
                    onToggleTerm={toggleTerm} onToggleCourse={toggleCourse} expandMode={expandMode} />
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TermRows({ dept, tree, openTerm, openCourse, onToggleTerm, onToggleCourse, expandMode }) {
  const terms = useMemo(() => {
    return Object.keys(tree[dept] || {})
      .map((term) => ({ term, total: countPapers(tree[dept][term]) }))
      .filter((r) => r.total > 0)
      .sort((a, b) => a.term.localeCompare(b.term));
  }, [tree, dept]);

  return (
    <>
      {terms.map(({ term, total }) => {
        const termKey = `${dept}::${term}`;
        const isOpen = expandMode === 'all' || openTerm === termKey;
        return (
          <div key={term}>
            <Row
              label={term}
              count={total}
              depth={1}
              open={isOpen}
              onClick={() => onToggleTerm(dept, term)}
            />
            {isOpen && (
              <CourseRows dept={dept} term={term} tree={tree} openCourse={openCourse} onToggleCourse={onToggleCourse} expandMode={expandMode} />
            )}
          </div>
        );
      })}
    </>
  );
}

function CourseRows({ dept, term, tree, openCourse, onToggleCourse, expandMode }) {
  const courses = useMemo(() => {
    const courseMap = tree[dept]?.[term] || {};
    return Object.keys(courseMap)
      .map((course) => ({ course, papers: courseMap[course] || [] }))
      .sort((a, b) => a.course.localeCompare(b.course));
  }, [tree, dept, term]);

  return (
    <>
      {courses.map(({ course, papers }) => {
        const courseKey = `${dept}::${term}::${course}`;
        const isOpen = expandMode === 'all' || openCourse === courseKey;
        return (
          <div key={course}>
            <Row
              label={course}
              count={papers.length}
              depth={2}
              open={isOpen}
              onClick={() => onToggleCourse(dept, term, course)}
            />
            {isOpen && (
              <div style={{ padding: '4px 12px 8px 68px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {papers.map((p) => (
                  <span
                    key={p.key}
                    style={{
                      fontSize: 11, padding: '3px 8px', borderRadius: 999,
                      background: 'var(--inputBg)', border: '1px solid var(--border)',
                    }}
                  >
                    {p.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

function Row({ label, count, depth, open, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `7px 12px 7px ${12 + depth * 18}px`,
        background: depth === 0 ? 'var(--surface)' : 'transparent',
        border: 'none', borderTop: depth > 0 ? '1px solid var(--border)' : 'none',
        cursor: 'pointer', textAlign: 'left', fontSize: depth === 0 ? 13 : 12.5,
        fontWeight: depth === 0 ? 700 : 500, color: 'var(--text)',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        {label}
      </span>
      <span style={{
        fontSize: 11, fontWeight: 700, color: 'var(--muted)',
        background: 'var(--inputBg)', borderRadius: 999, padding: '1px 8px',
      }}>
        {count}
      </span>
    </button>
  );
}
