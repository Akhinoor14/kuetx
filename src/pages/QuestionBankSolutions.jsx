import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, ChevronDown, ChevronRight, Search, Filter, X, Eye, Download
} from 'lucide-react';
import { getProfile, getCurrentTermKey } from '../store/store';
import { QB_DEPARTMENTS, QB_DEPT_CODE_MAP } from '../data/questionbank/questionBankData';

// ── KaTeX loader (lazy, won't break if not installed) ─────────────────────
let katex = null;
async function loadKatex() {
  if (katex) return katex;
  try {
    katex = (await import("katex")).default;
  } catch (_) {
    katex = null;
  }
  return katex;
}

// ── Math detection ────────────────────────────────────────────────────────
const MATH_CHARS = /[τμρσθαβγδεζηικλνξπυφχψωΔΣΩ∫∂√∞±×÷≈≠≤≥→←↔∝∇²³¹⁰⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉]/;
const MATH_PATTERNS = [
  /[a-zA-Z]\s*=\s*[^a-zA-Z\s,.]{2,}/,
  /d[a-zA-Z]\/d[a-zA-Z]/,
  /[∫∂√∞]/,
  /\^[\d(]/,
  /[a-zA-Z]_[a-zA-Z0-9]/,
];
function isMathLine(t) {
  t = (t || "").trim();
  if (!t || t.length > 160) return false;
  if (MATH_CHARS.test(t)) return true;
  return MATH_PATTERNS.filter((p) => p.test(t)).length >= 2;
}

function hasLatex(t) {
  return /\$\$[\s\S]+?\$\$|\$[^$\n]+?\$/.test(t);
}

// ── KaTeX render component ────────────────────────────────────────────────
function MathSpan({ src, display = false }) {
  const ref = useRef(null);
  useEffect(() => {
    loadKatex().then((kt) => {
      if (!kt || !ref.current) return;
      try {
        kt.render(src, ref.current, {
          displayMode: display,
          throwOnError: false,
          output: "html",
        });
      } catch (_) {
        if (ref.current) ref.current.textContent = src;
      }
    });
  }, [src, display]);
  return <span ref={ref} style={{ fontFamily: display ? undefined : "'Cambria Math','STIX Two Math',serif" }} />;
}

// ── Split a string into text and $latex$ tokens ───────────────────────────
function splitLatex(text) {
  const tokens = [];
  const re = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) tokens.push({ type: "text", val: text.slice(last, m.index) });
    const raw = m[1];
    const display = raw.startsWith("$$");
    const inner = display ? raw.slice(2, -2).trim() : raw.slice(1, -1).trim();
    tokens.push({ type: "math", val: inner, display });
    last = m.index + raw.length;
  }
  if (last < text.length) tokens.push({ type: "text", val: text.slice(last) });
  return tokens;
}

// Render a line that may contain inline $...$ LaTeX mixed with text
function InlineMathLine({ text, mathStyle }) {
  if (!hasLatex(text)) {
    return (
      <span style={mathStyle ? { fontFamily: "'Cambria Math','STIX Two Math',serif", color: "#1A3A6B" } : {}}>
        {text}
      </span>
    );
  }
  const tokens = splitLatex(text);
  return (
    <>
      {tokens.map((tok, i) =>
        tok.type === "math" ? (
          <MathSpan key={i} src={tok.val} display={tok.display} />
        ) : (
          <span key={i}>{tok.val}</span>
        )
      )}
    </>
  );
}

// ── Equation block: handles both Unicode and LaTeX ────────────────────────
function EquationBlock({ content }) {
  if (hasLatex(content)) {
    const tokens = splitLatex(content);
    const isFullLatex = tokens.length === 1 && tokens[0].type === "math";
    return (
      <div style={{
        background: "#EEF4FF", borderLeft: "4px solid #2E5FAC",
        borderRadius: "0 8px 8px 0", padding: "12px 20px",
        margin: "10px 0", overflowX: "auto",
      }}>
        {isFullLatex ? (
          <MathSpan src={tokens[0].val} display={true} />
        ) : (
          <span style={{ fontFamily: "'Cambria Math','STIX Two Math',serif", color: "#1A3A6B", fontSize: 15 }}>
            <InlineMathLine text={content} mathStyle={true} />
          </span>
        )}
      </div>
    );
  }
  return (
    <div style={{
      background: "#EEF4FF", borderLeft: "4px solid #2E5FAC",
      borderRadius: "0 8px 8px 0", padding: "12px 20px",
      fontFamily: "'Cambria Math','STIX Two Math',serif",
      color: "#1A3A6B", fontSize: 15.5, margin: "10px 0",
      overflowX: "auto", letterSpacing: 0.3,
    }}>
      {content}
    </div>
  );
}

// ── Parse detailed_answer into segments ───────────────────────────────────
function parseAnswer(text) {
  if (!text) return [{ type: "text", content: "N/A" }];
  const lines = text.split("\n");
  const SEP = /^\|[\s\-|:]+\|$/;
  const tableRanges = new Set();
  let ti = 0;
  while (ti < lines.length) {
    if (lines[ti].trim().startsWith("|")) {
      const block = []; let tj = ti;
      while (tj < lines.length && lines[tj].trim().startsWith("|")) { block.push(tj); tj++; }
      if (block.length >= 2 && block.some((idx) => SEP.test(lines[idx].trim())))
        block.forEach((idx) => tableRanges.add(idx));
      ti = tj;
    } else ti++;
  }
  const segments = [];
  let i = 0;
  while (i < lines.length) {
    if (tableRanges.has(i)) {
      const tl = [];
      while (i < lines.length && tableRanges.has(i)) { tl.push(lines[i]); i++; }
      segments.push({ type: "table", lines: tl });
      continue;
    }
    const raw = lines[i].trim();
    if (raw === "") { segments.push({ type: "blank" }); i++; continue; }

    const isSH = raw.endsWith(":") && !raw.startsWith("-") && !raw.startsWith("•") && raw.length < 70;
    const isBullet = /^[-•]\s+/.test(raw);
    const wordCount = (raw.match(/\b[a-zA-Z]{4,}\b/g) || []).length;
    const looksLikeMath = isMathLine(raw) || hasLatex(raw);
    const isStandaloneEq = !isSH && !isBullet && looksLikeMath && wordCount <= 4;

    if (isSH)            segments.push({ type: "header",   content: raw });
    else if (isStandaloneEq) segments.push({ type: "equation", content: raw });
    else if (isBullet)   segments.push({ type: "bullet",   content: raw.replace(/^[-•]\s*/, ""), isMath: looksLikeMath });
    else                 segments.push({ type: "text",     content: raw, isMath: MATH_CHARS.test(raw) || hasLatex(raw) || /d[a-zA-Z]\/d[a-zA-Z]/.test(raw) });
    i++;
  }
  return segments;
}

function parseMarkdownTable(lines) {
  const dataLines = lines.filter((l) => !l.trim().match(/^\|[\s\-|:]+\|$/));
  return dataLines.map((line, ri) => ({
    isHeader: ri === 0,
    cells: line.split("|").filter((_, idx, arr) => idx > 0 && idx < arr.length - 1).map((c) => c.trim()),
  }));
}

// ── AnswerBlock ───────────────────────────────────────────────────────────
function AnswerBlock({ text }) {
  const segments = parseAnswer(text);
  return (
    <div style={{ fontSize: 14, lineHeight: 1.8, color: "#1a1a1a" }}>
      {segments.map((seg, idx) => {
        if (seg.type === "blank") return <div key={idx} style={{ height: 8 }} />;

        if (seg.type === "header")
          return <div key={idx} style={{ fontWeight: 700, color: "#2D6A4F", fontSize: 13.5, marginTop: 16, marginBottom: 4 }}>{seg.content}</div>;

        if (seg.type === "equation")
          return <EquationBlock key={idx} content={seg.content} />;

        if (seg.type === "bullet")
          return (
            <div key={idx} style={{ display: "flex", gap: 8, marginBottom: 5, paddingLeft: 6 }}>
              <span style={{ color: "#2D6A4F", fontWeight: 800, flexShrink: 0, marginTop: 1 }}>•</span>
              <span>
                <InlineMathLine text={seg.content} mathStyle={seg.isMath} />
              </span>
            </div>
          );

        if (seg.type === "table") {
          const rows = parseMarkdownTable(seg.lines);
          return (
            <div key={idx} style={{ overflowX: "auto", margin: "12px 0" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
                <tbody>
                  {rows.map((row, ri) => (
                    <tr key={ri} style={{ background: row.isHeader ? "#2D6A4F" : ri % 2 === 0 ? "#F0FBF4" : "#fff" }}>
                      {row.cells.map((cell, ci) => (
                        <td key={ci} style={{ border: "1px solid #B7E4C7", padding: "7px 11px", fontWeight: row.isHeader ? 700 : 400, color: row.isHeader ? "#fff" : "#1a1a1a" }}>
                          <InlineMathLine text={cell} mathStyle={false} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        return (
          <div key={idx} style={{ marginBottom: 3 }}>
            <InlineMathLine text={seg.content} mathStyle={seg.isMath} />
          </div>
        );
      })}
    </div>
  );
}

// ── Code block with tabs ──────────────────────────────────────────────────
function CodeBlock({ matlab, python }) {
  const [tab, setTab] = useState(matlab ? "matlab" : "python");
  const code = tab === "matlab" ? (matlab || "% Not applicable") : (python || "# Not applicable");
  return (
    <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid #2a3a50", marginTop: 10 }}>
      <div style={{ display: "flex", background: "#1C2333" }}>
        {[matlab && "matlab", python && "python"].filter(Boolean).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: "9px 0", border: "none", cursor: "pointer",
            fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700,
            background: tab === t ? (t === "matlab" ? "#2B3A52" : "#0A1628") : "transparent",
            color: tab === t ? (t === "matlab" ? "#FFD700" : "#85E89D") : "#555",
            borderBottom: tab === t ? `2px solid ${t === "matlab" ? "#FFD700" : "#85E89D"}` : "2px solid transparent",
            transition: "all .15s",
          }}>
            {t === "matlab" ? "MATLAB" : "Python"}
          </button>
        ))}
      </div>
      <pre style={{
        margin: 0, padding: "16px 20px",
        background: tab === "matlab" ? "#1C2333" : "#0D1117",
        color: tab === "matlab" ? "#D4D4D4" : "#C9D1D9",
        fontSize: 13, fontFamily: "'JetBrains Mono',monospace",
        overflowX: "auto", lineHeight: 1.65, maxHeight: 420,
      }}>
        {code}
      </pre>
    </div>
  );
}

function getCurriculumForDeptTerm(dept, term) {
  try {
    const module = require(`../data/curriculum/departments/${dept}/terms/${term}.js`);
    return module[term] || [];
  } catch (e) {
    return [];
  }
}

export default function QuestionBankSolutions() {
  const navigate = useNavigate();
  const profile = getProfile();
  const currentTermKey = getCurrentTermKey(profile);

  const profileDeptRaw = String(profile?.dept || '').trim();
  const myDept = profileDeptRaw
    ? (QB_DEPT_CODE_MAP[profileDeptRaw]
      || QB_DEPT_CODE_MAP[Object.keys(QB_DEPT_CODE_MAP).find(key => key.toLowerCase() === profileDeptRaw.toLowerCase()) || '']
      || null)
    : null;

  // Available solution courses (from ESE Y2T1 for now)
  const AVAILABLE_SOLUTIONS = {
    ESE: {
      Y2T1: {
        CSE2113: { name: 'Computer Programming', courseCode: 'CSE 2113' },
        ME2115: { name: 'Fluid Mechanics', courseCode: 'ME 2115' },
      },
    },
  };

  const [selectedDept, setSelectedDept] = useState(myDept || 'ESE');
  const [selectedTerm, setSelectedTerm] = useState('Y2T1');
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [solutionData, setSolutionData] = useState(null);
  const [search, setSearch] = useState('');
  const [expandedSections, setExpandedSections] = useState({});

  // Get available terms for selected dept
  const availableTerms = useMemo(() => {
    if (!selectedDept || !AVAILABLE_SOLUTIONS[selectedDept]) return [];
    return Object.keys(AVAILABLE_SOLUTIONS[selectedDept]);
  }, [selectedDept]);

  // Get available courses for selected dept/term
  const availableCourses = useMemo(() => {
    if (!selectedDept || !selectedTerm || !AVAILABLE_SOLUTIONS[selectedDept]?.[selectedTerm]) {
      return [];
    }
    return Object.entries(AVAILABLE_SOLUTIONS[selectedDept][selectedTerm]).map(([code, data]) => ({
      code,
      ...data,
    }));
  }, [selectedDept, selectedTerm]);

  // Load solution JSON when course/year selected
  useEffect(() => {
    if (!selectedCourse || !selectedYear) {
      setSolutionData(null);
      return;
    }

    const fetchSolution = async () => {
      try {
        const path = `/solutions/${selectedDept}/${selectedTerm}/${selectedCourse}/${selectedYear}.json`;
        const response = await fetch(path);
        if (response.ok) {
          const data = await response.json();
          setSolutionData(data);
          setExpandedSections({});
        }
      } catch (e) {
        console.error('Error loading solution:', e);
        setSolutionData(null);
      }
    };

    fetchSolution();
  }, [selectedDept, selectedTerm, selectedCourse, selectedYear]);

  // Filter questions by search
  const filteredQuestions = useMemo(() => {
    if (!solutionData?.questions) return [];
    if (!search.trim()) return solutionData.questions;

    const sq = search.toLowerCase();
    return solutionData.questions.filter(q =>
      q.id.toLowerCase().includes(sq)
      || q.question.toLowerCase().includes(sq)
      || (q.short_answer || '').toLowerCase().includes(sq)
    );
  }, [solutionData, search]);

  const toggleSection = useCallback((id) => {
    setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const deptName = selectedDept && QB_DEPARTMENTS[selectedDept] ? QB_DEPARTMENTS[selectedDept] : selectedDept;

  return (
    <div className="qb2-page" style={{ padding: '20px' }}>
      <div className="qb2-wrap">
        {/* Header */}
        <div className="qb-min-card">
          <div className="qb-min-head">
            <h1>Solution Bank</h1>
            <p className="qb-min-sub">Browse solutions for past papers</p>
          </div>
        </div>

        {/* Selectors */}
        <div className="qb2-toolbar" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
          {/* Department Selector */}
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Department</label>
            <select
              value={selectedDept}
              onChange={(e) => {
                setSelectedDept(e.target.value);
                setSelectedTerm('Y2T1');
                setSelectedCourse(null);
                setSelectedYear(null);
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--border-color, #333)',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-secondary, #1a1b1f)',
                color: 'inherit',
              }}
            >
              {Object.entries(QB_DEPARTMENTS).map(([code, name]) => (
                <option key={code} value={code}>{code} - {name.split('of ')[1] || name}</option>
              ))}
            </select>
          </div>

          {/* Term Selector */}
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Term</label>
            <select
              value={selectedTerm}
              onChange={(e) => {
                setSelectedTerm(e.target.value);
                setSelectedCourse(null);
                setSelectedYear(null);
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--border-color, #333)',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-secondary, #1a1b1f)',
                color: 'inherit',
              }}
            >
              {availableTerms.map(term => (
                <option key={term} value={term}>{term}</option>
              ))}
            </select>
          </div>

          {/* Course Selector */}
          <div style={{ flex: 1, minWidth: '250px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Course</label>
            <select
              value={selectedCourse || ''}
              onChange={(e) => {
                setSelectedCourse(e.target.value);
                setSelectedYear(null);
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--border-color, #333)',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-secondary, #1a1b1f)',
                color: 'inherit',
              }}
            >
              <option value="">-- Select Course --</option>
              {availableCourses.map(course => (
                <option key={course.code} value={course.code}>
                  {course.courseCode} - {course.name}
                </option>
              ))}
            </select>
          </div>

          {/* Year Selector */}
          {selectedCourse && (
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Year</label>
              <select
                value={selectedYear || ''}
                onChange={(e) => setSelectedYear(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid var(--border-color, #333)',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-secondary, #1a1b1f)',
                  color: 'inherit',
                }}
              >
                <option value="">-- Select Exam Year --</option>
                {[2018, 2019, 2020, 2021, 2022, 2023].map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Solution Display */}
        {solutionData ? (
          <div>
            {/* Metadata */}
            <div style={{
              padding: '16px',
              backgroundColor: 'var(--bg-secondary, #1a1b1f)',
              borderRadius: '8px',
              marginBottom: '16px',
              borderLeft: '4px solid var(--accent, #6366f1)',
            }}>
              <p style={{ margin: '4px 0', fontSize: '14px' }}>
                <strong>{solutionData.subject_code}</strong> - {solutionData.subject}
              </p>
              <p style={{ margin: '4px 0', fontSize: '13px', opacity: 0.7 }}>
                {solutionData.term} | {solutionData.exam_year} Exam
              </p>
            </div>

            {/* Search */}
            <div style={{ marginBottom: '16px', position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', top: '10px', left: '12px', opacity: 0.5 }} />
              <input
                type="text"
                placeholder="Search questions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  paddingLeft: '40px',
                  padding: '10px 12px',
                  border: '1px solid var(--border-color, #333)',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-secondary, #1a1b1f)',
                  color: 'inherit',
                }}
              />
            </div>

            {/* Questions */}
            <div>
              {filteredQuestions.length === 0 ? (
                <p style={{ textAlign: 'center', opacity: 0.6, padding: '20px' }}>No questions found</p>
              ) : (
                filteredQuestions.map(question => (
                  <div key={question.id} style={{
                    marginBottom: '12px',
                    backgroundColor: 'var(--bg-secondary, #1a1b1f)',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    border: '1px solid var(--border-color, #333)',
                  }}>
                    <div
                      onClick={() => toggleSection(question.id)}
                      style={{
                        padding: '12px 16px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                      }}
                    >
                      {expandedSections[question.id] ? (
                        <ChevronDown size={18} />
                      ) : (
                        <ChevronRight size={18} />
                      )}
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: '600', marginBottom: '4px', fontSize: '14px' }}>
                          {question.id}: {question.question.substring(0, 80)}...
                        </p>
                        <p style={{ fontSize: '12px', opacity: 0.7 }}>Type: {question.type}</p>
                      </div>
                    </div>

                    {expandedSections[question.id] && (
                      <div style={{ padding: '16px', borderTop: '1px solid var(--border-color, #333)', backgroundColor: 'rgba(0,0,0,0.2)' }}>
                        {/* Question */}
                        <div style={{ marginBottom: '16px' }}>
                          <strong style={{ fontSize: '13px', color: '#52B788', textTransform: 'uppercase', letterSpacing: 0.8 }}>📋 Question</strong>
                          <div style={{ marginTop: '8px', fontSize: '14px', lineHeight: 1.6 }}>
                            <InlineMathLine text={question.question} mathStyle={isMathLine(question.question)} />
                          </div>
                        </div>

                        {/* Quick Answer */}
                        {question.short_answer && (
                          <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: 'rgba(82,183,136,0.1)', borderRadius: '6px', borderLeft: '3px solid #52B788' }}>
                            <strong style={{ fontSize: '12px', color: '#52B788', textTransform: 'uppercase', letterSpacing: 0.8 }}>⚡ Quick Answer</strong>
                            <div style={{ marginTop: '8px', fontSize: '14px', color: '#e8f5ee' }}>
                              <InlineMathLine text={question.short_answer} mathStyle={isMathLine(question.short_answer)} />
                            </div>
                          </div>
                        )}

                        {/* Full Solution */}
                        {question.detailed_answer && (
                          <div style={{ marginBottom: '16px' }}>
                            <strong style={{ fontSize: '13px', color: '#2D6A4F', textTransform: 'uppercase', letterSpacing: 0.8 }}>📝 Full Solution</strong>
                            <div style={{ marginTop: '8px', backgroundColor: '#f9fdf9', padding: '14px', borderRadius: '6px', borderLeft: '4px solid #2D6A4F' }}>
                              <AnswerBlock text={question.detailed_answer} />
                            </div>
                          </div>
                        )}

                        {/* Bangla Explanation */}
                        {question.explanation_bn && (
                          <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: 'rgba(255, 205, 86, 0.1)', borderRadius: '6px', borderLeft: '3px solid #FFCD56' }}>
                            <strong style={{ fontSize: '12px', color: '#FFCD56', textTransform: 'uppercase', letterSpacing: 0.8 }}>💡 বাংলায় ব্যাখ্যা</strong>
                            <div style={{ marginTop: '8px', fontSize: '13px', fontFamily: "'Nirmala UI','Hind Siliguri',sans-serif", lineHeight: 1.8, color: '#e8f5ee' }}>
                              {question.explanation_bn}
                            </div>
                          </div>
                        )}

                        {/* Code Solutions */}
                        {(question.matlab || question.python) && (
                          <div style={{ marginBottom: '16px' }}>
                            <strong style={{ fontSize: '12px', color: '#52B788', textTransform: 'uppercase', letterSpacing: 0.8 }}>⌨️ Code Solutions</strong>
                            <CodeBlock matlab={question.matlab} python={question.python} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 20px', opacity: 0.6 }}>
            <BookOpen size={48} style={{ margin: '0 auto 16px' }} />
            <p>Select a course and exam year to view solutions</p>
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');
        .katex { font-size: 1.1em; }
        .katex-display { overflow-x: auto; padding: 4px 0; }
      `}</style>
    </div>
  );
}
