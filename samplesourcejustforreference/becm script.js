// scripts/generate_becm_from_json.cjs
const fs = require('fs');
const path = require('path');

const INPUT_PATH = path.join(__dirname, '..', 'samplesourcejustforreference', 'abc', 'becm', 'becm syllabus.json');
const OUTPUT_DIR = path.join(__dirname, '..', 'src', 'data', 'curriculum', 'departments', 'BECM');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function writeModule(filePath, data) {
  const content = `export default ${JSON.stringify(data, null, 2)};\n`;
  fs.writeFileSync(filePath, content, 'utf8');
}

const raw = fs.readFileSync(INPUT_PATH, 'utf8');
const source = JSON.parse(raw);

const deptDir = OUTPUT_DIR;
const termsDir = path.join(deptDir, 'terms');
const syllabusDir = path.join(deptDir, 'syllabus');

ensureDir(deptDir);
ensureDir(termsDir);
ensureDir(syllabusDir);

// meta.js
const meta = {
  department: source.department,
  acronym: source.acronym,
  university: source.university,
  effectiveFrom: source.effectiveFrom,
};
writeModule(path.join(deptDir, 'meta.js'), meta);

// notes.js
writeModule(path.join(deptDir, 'notes.js'), []);

// optional.js
writeModule(path.join(deptDir, 'optional.js'), source.optionalGroups || {});

// terms & syllabus
const terms = source.terms;
for (const key of Object.keys(terms)) {
  const term = terms[key];

  const termData = {
    termKey: term.termKey,
    title: term.title,
    courses: term.courses,
    optionalCourses: term.optionalCourses || [],
    termNotes: term.termNotes || [],
  };
  writeModule(path.join(termsDir, `${key}.js`), termData);

  const syllabusForTerm = {};
  for (const code of Object.keys(term.courses)) {
    const course = term.courses[code];
    syllabusForTerm[code] = {
      topics: course.topics || [],
      references: course.references || [],
      sessionalNote: course.sessionalNote,
    };
  }
  writeModule(path.join(syllabusDir, `${key}.js`), syllabusForTerm);
}

// index.js
const indexContent = `
import meta from './meta.js';
import notes from './notes.js';
import optional from './optional.js';

import Y1T1 from './terms/Y1T1.js';
import Y1T2 from './terms/Y1T2.js';
import Y2T1 from './terms/Y2T1.js';
import Y2T2 from './terms/Y2T2.js';
import Y3T1 from './terms/Y3T1.js';
import Y3T2 from './terms/Y3T2.js';
import Y4T1 from './terms/Y4T1.js';
import Y4T2 from './terms/Y4T2.js';

const terms = {
  Y1T1,
  Y1T2,
  Y2T1,
  Y2T2,
  Y3T1,
  Y3T2,
  Y4T1,
  Y4T2,
};

export default {
  meta,
  notes,
  optional,
  terms,
};
`;
fs.writeFileSync(path.join(deptDir, 'index.js'), indexContent.trimStart(), 'utf8');

console.log('BECM curriculum generated successfully.');