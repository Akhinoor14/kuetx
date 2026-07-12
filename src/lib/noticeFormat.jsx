// Shared formatting helpers for Notice bodies.
//
// Composers (ClassRoster.jsx's CR notice form, AdminDashboard.jsx's
// CommunicationView) now let the sender write multi-line, spaced-out
// notices instead of one flat blob of text — a blank line starts a new
// paragraph, a single newline is a soft line break within a paragraph.
// This file is the single place that turns that plain-text convention
// into React nodes, so every place a notice body is displayed (Notice.jsx,
// ClassNoticeFeed.jsx, ClassNoticesPanel.jsx) renders it identically.
//
// Deliberately NOT full markdown — just whitespace-aware plain text, kept
// simple so it's readable and predictable for a non-technical CR/Founder
// typing an announcement.

/**
 * Splits raw notice body text into paragraphs (blank-line separated),
 * and returns React-renderable nodes with single newlines preserved as
 * <br/>. Leading/trailing blank paragraphs are trimmed; runs of 3+ blank
 * lines collapse to a single paragraph break so a sender mashing Enter
 * doesn't create a wall of empty space.
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
    <p key={pIdx} style={{ margin: pIdx === 0 ? 0 : '0.7em 0 0' }}>
      {para.split('\n').map((line, lIdx, arr) => (
        <span key={lIdx}>
          {line}
          {lIdx < arr.length - 1 && <br />}
        </span>
      ))}
    </p>
  ));
}

/**
 * Single-line flattened preview — used anywhere space is tight (toast
 * preview, sidebar tooltip, list-row subtitle): collapses all whitespace
 * (paragraph breaks included) down to single spaces.
 */
export function flattenNoticePreview(text) {
  if (!text) return '';
  return String(text).replace(/\s+/g, ' ').trim();
}
