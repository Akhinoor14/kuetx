// facultyTitle.js — shared short-title abbreviation logic used by both
// FacultyDashboard.jsx (hero) and FacultyProfile.jsx (hero), so the two
// stay in sync instead of drifting with separate copies.

const TITLE_SHORT_MAP = [
  // Academic ranks
  [/^assistant\s*professor$/i, 'Asst. Prof.'],
  [/^associate\s*professor$/i, 'Assoc. Prof.'],
  [/^adjunct\s*professor$/i, 'Adj. Prof.'],
  [/^visiting\s*professor$/i, 'Visiting Prof.'],
  [/^professor$/i, 'Prof.'],
  [/^lecturer$/i, 'Lecturer'],
  [/^part[\s-]?time\s*lecturer$/i, 'Part-time Lecturer'],
  [/^instructor$/i, 'Instructor'],
  [/^teaching\s*assistant$/i, 'TA'],
  [/^research\s*assistant$/i, 'RA'],
  [/^post[\s-]?doctoral\s*fellow$/i, 'Postdoc'],
  // Institutional office (Vice-Chancellor tier and Registrar's office) —
  // kept per explicit request; every other admin/office designation
  // (Chairman, HoD, Provost, Proctor, Director, Coordinator, Advisor,
  // Principal, Vice Principal) was removed since those are official
  // administrative posts, not a teacher's academic rank/designation,
  // which is what this list is meant to represent.
  [/^vice[\s-]?chancellor$/i, 'VC'],
  [/^pro[\s-]?vice[\s-]?chancellor$/i, 'Pro-VC'],
  [/^registrar$/i, 'Registrar'],
  [/^deputy\s*registrar$/i, 'Dy. Registrar'],
  [/^assistant\s*registrar$/i, 'Asst. Registrar'],
];

// Returns a short-form designation tag (e.g. "Professor" -> "Prof.") for a
// given full title string. Falls back to abbreviating leading words to
// initials, keeping the last word full (e.g. "Deputy Registrar" -> "D.
// Registrar"), so something short always shows even for titles we don't
// explicitly recognize.
export function getShortTitle(title) {
  // BUGFIX: matching was done on the raw trimmed string only, so anything
  // that wasn't a byte-for-byte match against these patterns — double
  // spaces from a pasted title, "Adjunct Prof" instead of the full
  // "Adjunct Professor", "Head of the Department" instead of "Head of
  // Department" — silently fell through to the per-word-initials
  // fallback below and produced genuinely broken-looking output (e.g.
  // "Head of the Department" -> "H. o. t. Department"). Since the "Other"
  // free-text field in FacultyProfileSetupModal lets faculty type
  // anything, near-miss variants of an already-recognized title are the
  // common case here, not the exception. Collapsing internal whitespace
  // before matching (regexes already ignore case via /i) fixes the
  // double-space class of miss; it does not and should not try to fix
  // wording variants like "Adjunct Prof" — that's a genuinely different
  // string and guessing at it risks mapping the wrong title.
  const t = (title || '').trim().replace(/\s+/g, ' ');
  if (!t) return '';

  for (const [re, short] of TITLE_SHORT_MAP) {
    if (re.test(t)) return short;
  }
  const words = t.split(' ');
  if (words.length === 1) return t;
  // Small filler words read poorly abbreviated to a single letter+period
  // ("Head of the Department" -> "H. o. t. Department") — keep these
  // spelled out in full and only abbreviate the substantive words.
  const FILLERS = new Set(['of', 'the', 'and', 'for', 'to', 'in']);
  return words
    .map((w, i) => {
      if (i === words.length - 1) return w;
      if (FILLERS.has(w.toLowerCase())) return w;
      return `${w[0]}.`;
    })
    .join(' ');
}

/**
 * "Prof. Rahman" — same title-prefix + name composition FacultyDashboard.jsx
 * and FacultyProfile.jsx already use in their hero display, pulled out here
 * so every OTHER place a faculty member's name gets shown to someone else
 * (notices, marks PDFs, class rosters, etc.) uses the identical format
 * instead of a bare name with the title silently dropped.
 * Falls back to the bare name if no title is set — title is optional.
 */
export function getFacultyDisplayName(name, title) {
  const shortTitle = getShortTitle(title);
  const cleanName = (name || '').trim() || 'Faculty';
  return shortTitle ? `${shortTitle} ${cleanName}` : cleanName;
}
