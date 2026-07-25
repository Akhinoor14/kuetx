// Shared formatting helpers for Notice bodies.
//
// Composers (ClassRoster.jsx's CR notice form, AdminDashboard.jsx's
// CommunicationView, FacultyNoticeBroadcast.jsx) let the sender write
// multi-line, spaced-out notices instead of one flat blob of text — a
// blank line starts a new paragraph, a single newline is a soft line
// break within a paragraph. This file is the single place that turns
// that plain-text convention into React nodes, so every place a notice
// body is displayed (Notice.jsx, ClassNoticeFeed.jsx, ClassNoticesPanel.jsx
// — though the latter two currently render raw text directly and were not
// touched by this pass) renders it identically.
//
// Phase 3 of the Notice upgrade adds a constrained MARKDOWN SUBSET on top
// of that same paragraph/br foundation:
//   **bold**, *italic*, ==highlight==   (inline)
//   # H1, ## H2, ### H3                 (block, must start the line)
//   - bullet item                       (block, must start the line)
//   1. numbered item                    (block, must start the line)
//
// Deliberately NOT full markdown, and deliberately NOT an external
// markdown library (bundle size) — this is a small hand-written
// line-by-line tokenizer. Every line's leading characters decide its
// block type; inline markup is then regex-replaced into React nodes
// within that line. Raw HTML / dangerouslySetInnerHTML is never used
// anywhere in this file — everything renders as real React elements, so
// there's no XSS surface from notice bodies.

const HEADING_RE = /^(#{1,3})\s+(.*)$/;
const BULLET_RE = /^[-*]\s+(.*)$/;
const NUMBERED_RE = /^\d+\.\s+(.*)$/;

// Inline markup, applied in this order so `**bold**` isn't partially
// consumed by the `*italic*` pass first. Each entry: [regex, wrapper tag].
// Regexes are non-greedy and require non-empty content so `****` or `==`
// alone doesn't collapse into an empty element.
const INLINE_RULES = [
  { re: /\*\*([^*]+?)\*\*/g, tag: 'strong' },
  { re: /==([^=]+?)==/g, tag: 'mark' },
  { re: /\*([^*]+?)\*/g, tag: 'em' },
];

/**
 * Parses a single line's inline markup (**bold**, *italic*, ==highlight==)
 * into an array of strings and React elements. Order-preserving, handles
 * multiple/overlapping-adjacent matches by scanning left to right and only
 * ever wrapping plain-text segments (never re-parsing inside an already
 *-wrapped span), so `**a** *b*` produces two independent elements rather
 * than one over-greedy match.
 */
function parseInline(text, keyPrefix) {
  // Single combined regex so overlapping candidates (bold vs italic vs
  // highlight) are resolved by whichever starts first in the string, not
  // by rule order — avoids **bold** being mangled by the italic pass.
  const combined = /\*\*([^*]+?)\*\*|==([^=]+?)==|\*([^*]+?)\*/g;
  const nodes = [];
  let lastIndex = 0;
  let match;
  let idx = 0;

  while ((match = combined.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    if (match[1] !== undefined) {
      nodes.push(<strong key={`${keyPrefix}-${idx++}`}>{match[1]}</strong>);
    } else if (match[2] !== undefined) {
      nodes.push(
        <mark
          key={`${keyPrefix}-${idx++}`}
          style={{ background: 'color-mix(in srgb, var(--accent) 25%, transparent)', color: 'inherit', borderRadius: 3, padding: '0 2px' }}
        >
          {match[2]}
        </mark>,
      );
    } else if (match[3] !== undefined) {
      nodes.push(<em key={`${keyPrefix}-${idx++}`}>{match[3]}</em>);
    }
    lastIndex = combined.lastIndex;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes.length ? nodes : [text];
}

// Groups consecutive bullet/numbered lines into a single <ul>/<ol>, and
// non-list lines into their own block (heading or a plain-text run that
// keeps the original single-newline-as-<br/> behavior). Headings are
// always their own block (a heading line never merges with neighbors).
function blocksFromParagraph(paragraph, pIdx) {
  const lines = paragraph.split('\n');
  const blocks = [];
  let currentList = null; // { type: 'ul' | 'ol', items: [] }
  let currentPlainLines = null; // array of raw lines being accumulated

  const flushList = () => {
    if (currentList) {
      blocks.push(currentList);
      currentList = null;
    }
  };
  const flushPlain = () => {
    if (currentPlainLines) {
      blocks.push({ type: 'plain', lines: currentPlainLines });
      currentPlainLines = null;
    }
  };

  lines.forEach((rawLine) => {
    const headingMatch = rawLine.match(HEADING_RE);
    const bulletMatch = rawLine.match(BULLET_RE);
    const numberedMatch = rawLine.match(NUMBERED_RE);

    if (headingMatch) {
      flushList();
      flushPlain();
      blocks.push({ type: 'heading', level: headingMatch[1].length, text: headingMatch[2] });
    } else if (bulletMatch) {
      flushPlain();
      if (!currentList || currentList.type !== 'ul') { flushList(); currentList = { type: 'ul', items: [] }; }
      currentList.items.push(bulletMatch[1]);
    } else if (numberedMatch) {
      flushPlain();
      if (!currentList || currentList.type !== 'ol') { flushList(); currentList = { type: 'ol', items: [] }; }
      currentList.items.push(numberedMatch[1]);
    } else {
      flushList();
      if (!currentPlainLines) currentPlainLines = [];
      currentPlainLines.push(rawLine);
    }
  });
  flushList();
  flushPlain();

  const HEADING_SIZE = { 1: 19, 2: 16.5, 3: 14.5 };

  return blocks.map((block, bIdx) => {
    const key = `${pIdx}-${bIdx}`;
    if (block.type === 'heading') {
      const Tag = `h${Math.min(block.level, 3)}`;
      return (
        <Tag key={key} style={{ margin: bIdx === 0 && pIdx === 0 ? '0 0 0.3em' : '0.6em 0 0.3em', fontSize: HEADING_SIZE[block.level], fontWeight: 700, lineHeight: 1.3 }}>
          {parseInline(block.text, key)}
        </Tag>
      );
    }
    if (block.type === 'ul' || block.type === 'ol') {
      const ListTag = block.type === 'ul' ? 'ul' : 'ol';
      return (
        <ListTag key={key} style={{ margin: '0.3em 0', paddingLeft: 20 }}>
          {block.items.map((item, iIdx) => (
            <li key={`${key}-${iIdx}`} style={{ margin: '0.15em 0' }}>{parseInline(item, `${key}-${iIdx}`)}</li>
          ))}
        </ListTag>
      );
    }
    // plain: preserve single-newline-as-<br/> behavior within this run
    return (
      <span key={key}>
        {block.lines.map((line, lIdx, arr) => (
          <span key={lIdx}>
            {parseInline(line, `${key}-${lIdx}`)}
            {lIdx < arr.length - 1 && <br />}
          </span>
        ))}
      </span>
    );
  });
}

/**
 * Splits raw notice body text into paragraphs (blank-line separated),
 * and returns React-renderable nodes with single newlines preserved as
 * <br/>. Leading/trailing blank paragraphs are trimmed; runs of 3+ blank
 * lines collapse to a single paragraph break so a sender mashing Enter
 * doesn't create a wall of empty space.
 *
 * Phase 3: each paragraph is now further tokenized for the supported
 * markdown subset (headings, lists, bold/italic/highlight) before
 * falling back to the original plain-paragraph rendering for any line
 * that isn't a heading or list item.
 */
export function renderFormattedNoticeBody(text) {
  if (!text) return null;
  const normalized = String(text).replace(/\r\n/g, '\n').trim();
  if (!normalized) return null;

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return paragraphs.map((para, pIdx) => (
    <div key={pIdx} style={{ margin: pIdx === 0 ? 0 : '0.7em 0 0' }}>
      {blocksFromParagraph(para, pIdx)}
    </div>
  ));
}

/**
 * Single-line flattened preview — used anywhere space is tight (toast
 * preview, sidebar tooltip, list-row subtitle): collapses all whitespace
 * (paragraph breaks included) down to single spaces, and strips markdown
 * syntax markers so a preview reads as plain text rather than showing
 * literal markup characters (bold/highlight/heading markers).
 */
export function flattenNoticePreview(text) {
  if (!text) return '';
  return String(text)
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\*\*([^*]+?)\*\*/g, '$1')
    .replace(/==([^=]+?)==/g, '$1')
    .replace(/\*([^*]+?)\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}
