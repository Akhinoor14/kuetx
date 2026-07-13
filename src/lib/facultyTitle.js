// facultyTitle.js — shared short-title abbreviation logic used by both
// FacultyDashboard.jsx (hero) and FacultyProfile.jsx (hero), so the two
// stay in sync instead of drifting with separate copies.

const TITLE_SHORT_MAP = [
  // Academic ranks
  [/^professor\s*emeritus$/i, 'Prof. Emeritus'],
  [/^assistant\s*professor$/i, 'Asst. Prof.'],
  [/^associate\s*professor$/i, 'Assoc. Prof.'],
  [/^adjunct\s*professor$/i, 'Adj. Prof.'],
  [/^visiting\s*professor$/i, 'Visiting Prof.'],
  [/^professor$/i, 'Prof.'],
  [/^senior\s*lecturer$/i, 'Sr. Lecturer'],
  [/^junior\s*lecturer$/i, 'Jr. Lecturer'],
  [/^lecturer$/i, 'Lecturer'],
  [/^instructor$/i, 'Instructor'],
  [/^teaching\s*assistant$/i, 'TA'],
  [/^research\s*assistant$/i, 'RA'],
  [/^post[\s-]?doctoral\s*fellow$/i, 'Postdoc'],
  // Leadership / admin designations
  [/^vice[\s-]?chancellor$/i, 'VC'],
  [/^pro[\s-]?vice[\s-]?chancellor$/i, 'Pro-VC'],
  [/^dean$/i, 'Dean'],
  [/^chairman$/i, 'Chairman'],
  [/^head\s*of\s*department$/i, 'HoD'],
  [/^provost$/i, 'Provost'],
  [/^registrar$/i, 'Registrar'],
  [/^deputy\s*registrar$/i, 'Dy. Registrar'],
  [/^assistant\s*registrar$/i, 'Asst. Registrar'],
  [/^proctor$/i, 'Proctor'],
  [/^director$/i, 'Director'],
  [/^deputy\s*director$/i, 'Dy. Director'],
  [/^coordinator$/i, 'Coordinator'],
  [/^advisor$/i, 'Advisor'],
  [/^principal$/i, 'Principal'],
  [/^vice[\s-]?principal$/i, 'Vice Principal'],
];

// Returns a short-form designation tag (e.g. "Professor" -> "Prof.") for a
// given full title string. Falls back to abbreviating leading words to
// initials, keeping the last word full (e.g. "Deputy Registrar" -> "D.
// Registrar"), so something short always shows even for titles we don't
// explicitly recognize.
export function getShortTitle(title) {
  const t = (title || '').trim();
  if (!t) return '';
  for (const [re, short] of TITLE_SHORT_MAP) {
    if (re.test(t)) return short;
  }
  const words = t.split(/\s+/);
  if (words.length === 1) return t;
  return words.map((w, i) => (i === words.length - 1 ? w : `${w[0]}.`)).join(' ');
}
