// SolutionViewer.jsx — KUETx Solution Bank
// Supports both Unicode math (τ, μ, ∫) and LaTeX ($\frac{d u}{d y}$)
// Uses KaTeX for proper rendering — add to your project:
//   npm install katex
//   import 'katex/dist/katex.min.css'  ← in your _app.jsx or layout
//
// File structure needed:
//   /public/solutions/index.json        → ["FLUID_2023","FLUID_2022",...]
//   /public/solutions/FLUID_2023.json   → your solution JSON

import { useState, useEffect, useRef } from "react";

// ── KaTeX loader (lazy, won't break if not installed) ─────────────────────
let katex = null;
async function loadKatex() {
  if (katex) return katex;
  try {
    katex = (await import("katex")).default;
  } catch (_) {
    katex = null; // graceful fallback if katex not installed
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

// Does this string contain $...$ or $$...$$ LaTeX?
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
  // Split on $$...$$ (display) and $...$ (inline)
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
  // If it has $...$ → strip and render as KaTeX display
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
  // Unicode math — render styled
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

        // plain / inline-math text
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

// ── Single question card ──────────────────────────────────────────────────
function QuestionCard({ q, forceOpen }) {
  const [open, setOpen] = useState(false);
  const isOpen = forceOpen || open;

  return (
    <div style={{
      border: `1px solid ${isOpen ? "#52B788" : "#2D6A4F"}`,
      borderRadius: 14, overflow: "hidden", marginBottom: 12,
      background: "#fff",
      boxShadow: isOpen ? "0 6px 24px rgba(45,106,79,.18)" : "0 1px 4px rgba(0,0,0,.06)",
      transition: "box-shadow .2s, border-color .2s",
    }}>
      {/* Header row */}
      <div onClick={() => setOpen((o) => !o)} style={{ display: "flex", cursor: "pointer", background: isOpen ? "#f4fbf6" : "#fff", transition: "background .2s" }}>
        <div style={{ background: "#1B4332", color: "#fff", fontWeight: 800, fontSize: 13, minWidth: 54, display: "flex", alignItems: "center", justifyContent: "center", padding: "14px 8px", flexShrink: 0 }}>
          {q.id}
        </div>
        <div style={{ borderLeft: "3px solid #52B788", flex: 1, padding: "13px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14.5, color: "#1a1a1a", lineHeight: 1.45 }}>{q.question}</div>
            {q.type && <div style={{ fontSize: 11, color: "#8db89f", marginTop: 3 }}>Type: {q.type}</div>}
          </div>
          <span style={{ color: "#52B788", fontSize: 17, flexShrink: 0, display: "inline-block", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .2s" }}>▾</span>
        </div>
      </div>

      {isOpen && (
        <div>
          {/* Quick Answer */}
          {q.short_answer && (
            <div>
              <div style={{ background: "#52B788", color: "#fff", fontWeight: 700, fontSize: 11, padding: "5px 16px", letterSpacing: .8, textTransform: "uppercase" }}>⚡ Quick Answer</div>
              <div style={{ background: "#EBF9F0", padding: "13px 18px", fontSize: 14, color: "#1a1a1a", borderBottom: "1px solid #D8F3DC" }}>
                <InlineMathLine text={q.short_answer} mathStyle={isMathLine(q.short_answer)} />
              </div>
            </div>
          )}

          {/* Full Solution */}
          <div>
            <div style={{ background: "#2D6A4F", color: "#fff", fontWeight: 700, fontSize: 11, padding: "5px 16px", letterSpacing: .8, textTransform: "uppercase" }}>📝 Full Solution</div>
            <div style={{ background: "#f9fdf9", padding: "18px 20px", borderBottom: "1px solid #D8F3DC" }}>
              <AnswerBlock text={q.detailed_answer} />
            </div>
          </div>

          {/* Bangla */}
          {q.explanation_bn && (
            <div>
              <div style={{ background: "#52B788", color: "#fff", fontWeight: 700, fontSize: 11, padding: "5px 16px", letterSpacing: .8, textTransform: "uppercase" }}>💡 Concept (বাংলায়)</div>
              <div style={{ background: "#FFFDE7", padding: "13px 18px", fontSize: 13.5, color: "#555", fontFamily: "'Nirmala UI','Hind Siliguri',sans-serif", lineHeight: 1.85, borderBottom: "1px solid #ebe8c8" }}>
                {q.explanation_bn}
              </div>
            </div>
          )}

          {/* Code */}
          {(q.matlab || q.python) && (
            <div style={{ padding: "14px 18px", background: "#0d1f17" }}>
              <div style={{ fontWeight: 700, fontSize: 11, color: "#52B788", marginBottom: 8, textTransform: "uppercase", letterSpacing: .8 }}>⌨️ Code Solutions</div>
              <CodeBlock matlab={q.matlab} python={q.python} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────
export default function SolutionViewer() {
  const [fileList, setFileList] = useState([]);
  const [selected, setSelected] = useState(null);
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [search, setSearch]     = useState("");
  const [expandAll, setExpandAll] = useState(false);

  useEffect(() => {
    fetch("/solutions/index.json")
      .then((r) => r.json())
      .then(setFileList)
      .catch(() => setError("Could not load /public/solutions/index.json"));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true); setError(null); setData(null); setSearch(""); setExpandAll(false);
    fetch(`/solutions/${selected}.json`)
      .then((r) => { if (!r.ok) throw new Error("File not found"); return r.json(); })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [selected]);

  const filtered = (data?.questions || []).filter((q) =>
    !search ||
    (q.question || "").toLowerCase().includes(search.toLowerCase()) ||
    String(q.id || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ fontFamily: "'Sora','Inter',sans-serif", background: "#0d1f17", minHeight: "100vh", color: "#e8f5ee" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#1B4332 0%,#2D6A4F 100%)", padding: "28px 24px 22px", borderBottom: "1px solid rgba(82,183,136,.2)" }}>
        <div style={{ maxWidth: 840, margin: "0 auto" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: -.4 }}>🎓 KUETx Solution Bank</div>
          <div style={{ fontSize: 13, color: "#B7E4C7", marginTop: 5 }}>Past exam solutions — select a file to browse</div>
        </div>
      </div>

      <div style={{ maxWidth: 840, margin: "0 auto", padding: "24px 16px 60px" }}>
        {/* Selector */}
        <select
          value={selected || ""}
          onChange={(e) => setSelected(e.target.value)}
          style={{ width: "100%", background: "#132a1e", border: "1px solid rgba(82,183,136,.3)", borderRadius: 10, padding: "12px 14px", color: "#e8f5ee", fontSize: 14, fontFamily: "inherit", cursor: "pointer", outline: "none" }}
        >
          <option value="" disabled>— Select exam / subject —</option>
          {fileList.map((f) => <option key={f} value={f}>{f.replace(/_/g, " ")}</option>)}
        </select>

        {/* Error */}
        {error && (
          <div style={{ marginTop: 14, background: "rgba(255,107,107,.1)", border: "1px solid rgba(255,107,107,.3)", borderRadius: 10, padding: "13px 18px", color: "#ff6b6b", fontSize: 13 }}>
            ❌ {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: "70px 0", color: "#52B788" }}>
            <div style={{ fontSize: 36, marginBottom: 14 }}>⏳</div>
            <div style={{ fontSize: 14 }}>Loading solutions…</div>
          </div>
        )}

        {/* Content */}
        {data && (
          <>
            {/* Meta card */}
            <div style={{ marginTop: 18, padding: "18px 20px", background: "#132a1e", borderRadius: 12, border: "1px solid rgba(82,183,136,.18)" }}>
              <div style={{ fontWeight: 800, fontSize: 17, color: "#fff", marginBottom: 10 }}>{data.subject}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {[data.subject_code, data.term, data.department, data.exam_year].filter(Boolean).map((m) => (
                  <span key={m} style={{ background: "rgba(82,183,136,.12)", border: "1px solid rgba(82,183,136,.2)", borderRadius: 20, padding: "3px 12px", fontSize: 11, color: "#8db89f" }}>{m}</span>
                ))}
              </div>
              <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "#52B788", fontWeight: 600 }}>{filtered.length} / {data.questions?.length} questions</span>
                <button onClick={() => setExpandAll((x) => !x)} style={{ background: "rgba(82,183,136,.15)", border: "1px solid rgba(82,183,136,.25)", borderRadius: 8, padding: "6px 14px", color: "#52B788", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  {expandAll ? "⬆ Collapse all" : "⬇ Expand all"}
                </button>
              </div>
            </div>

            {/* Search */}
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Search questions by keyword or ID…"
              style={{ width: "100%", marginTop: 10, background: "#132a1e", border: "1px solid rgba(82,183,136,.2)", borderRadius: 10, padding: "11px 14px", color: "#e8f5ee", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
            />

            {/* Question list */}
            <div style={{ marginTop: 16 }}>
              {filtered.length === 0 && (
                <div style={{ textAlign: "center", color: "#4a7a5a", padding: "50px 0", fontSize: 14 }}>No questions match your search.</div>
              )}
              {filtered.map((q) => (
                <QuestionCard key={q.id} q={q} forceOpen={expandAll} />
              ))}
            </div>
          </>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');
        select option { background: #132a1e; }
        input::placeholder { color: #3a6a4a; }
        .katex { font-size: 1.1em; }
        .katex-display { overflow-x: auto; padding: 4px 0; }
      `}</style>
    </div>
  );
}
