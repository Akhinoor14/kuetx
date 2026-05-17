const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, '..', 'sylla', 'MECURRICULMN.JSON');
const outDir = path.join(__dirname, '..', 'src', 'data', 'curriculum', 'departments', 'ME', 'syllabus');

const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const termOrder = ['Y1T1', 'Y1T2', 'Y2T1', 'Y2T2', 'Y3T1', 'Y3T2', 'Y4T1', 'Y4T2'];

const titleMap = {
  Y1T1: 'First Year First Term',
  Y1T2: 'First Year Second Term',
  Y2T1: 'Second Year First Term',
  Y2T2: 'Second Year Second Term',
  Y3T1: 'Third Year First Term',
  Y3T2: 'Third Year Second Term',
  Y4T1: 'Fourth Year First Term',
  Y4T2: 'Fourth Year Second Term',
};

const creditToHours = credit => {
  if (credit === 4 || credit === 4.0) return '4 hrs/week';
  if (credit === 3 || credit === 3.0) return '3 hrs/week';
  if (credit === 1.5 || credit === 1.50 || credit === 0.75 || credit === 0.750) return '3/2 hrs/week';
  if (typeof credit === 'string') return credit;
  return null;
};

const jsString = value => JSON.stringify(value, null, 2);

const buildCourseObject = course => {
  const contactHour = course.contactHour || creditToHours(course.credit);
  const sessionalNote = course.sessionalNote ?? (String(course.title || '').toLowerCase().includes('sessional') ? course.title : null);
  return {
    title: course.title,
    credit: course.credit,
    contactHour,
    topics: Array.isArray(course.topics) ? course.topics : [],
    sessionalNote,
    references: Array.isArray(course.references) ? course.references : [],
  };
};

const buildOptionalCourseObject = course => ({
  title: course.title,
  credit: course.credit,
  contactHour: course.contactHour || creditToHours(course.credit),
  topics: Array.isArray(course.topics) ? course.topics : [],
  sessionalNote: course.sessionalNote ?? null,
  references: Array.isArray(course.references) ? course.references : [],
});

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const termExports = [];
const termRefs = [];

for (const termKey of termOrder) {
  const term = data.terms[termKey];
  if (!term) {
    throw new Error(`Missing term in JSON: ${termKey}`);
  }

  const exportName = `ME_SYLLABUS_${termKey}`;
  termExports.push(`import { ${exportName} } from './${termKey}.js';`);
  termRefs.push(`${termKey}: ${exportName}`);

  const courses = {};
  for (const [code, course] of Object.entries(term.courses || {})) {
    courses[code] = buildCourseObject(course);
  }

  const optionalCourses = Array.isArray(term.optionalCourses) ? term.optionalCourses : [];
  const termObj = {
    termKey,
    title: term.title || titleMap[termKey] || termKey,
    courses,
    optionalCourses,
    termNotes: Array.isArray(term.termNotes) ? term.termNotes : [],
  };

  const termContent = `export const ${exportName} = ${jsString(termObj)};\n\nexport default ${exportName};\n`;
  fs.writeFileSync(path.join(outDir, `${termKey}.js`), termContent, 'utf8');
}

const optionalPool = data.extras && data.extras.optional_course_pool ? data.extras.optional_course_pool : {};
const optionalCourses = {};
for (const [code, course] of Object.entries(optionalPool)) {
  optionalCourses[code] = buildOptionalCourseObject(course);
}

const optionalContent = `export const ME_SYLLABUS_OPTIONAL = ${jsString({
  title: 'Optional Courses',
  courses: optionalCourses,
})};\n\nexport default ME_SYLLABUS_OPTIONAL;\n`;
fs.writeFileSync(path.join(outDir, 'optional.js'), optionalContent, 'utf8');

const indexContent = `${termExports.join('\n')}
import { ME_SYLLABUS_OPTIONAL } from './optional.js';

const TERM_SYLLABUS = {
  ${termRefs.join(',\n  ')}
};

const mergeCourses = (...terms) => terms.reduce((acc, term) => ({ ...acc, ...term.courses }), {});

export const ME_SYLLABUS = {
  sourceFile: 'sylla/MECURRICULMN.JSON',
  terms: TERM_SYLLABUS,
  optional: ME_SYLLABUS_OPTIONAL,
  courses: {
    ...mergeCourses(
      ME_SYLLABUS_Y1T1,
      ME_SYLLABUS_Y1T2,
      ME_SYLLABUS_Y2T1,
      ME_SYLLABUS_Y2T2,
      ME_SYLLABUS_Y3T1,
      ME_SYLLABUS_Y3T2,
      ME_SYLLABUS_Y4T1,
      ME_SYLLABUS_Y4T2
    ),
    ...ME_SYLLABUS_OPTIONAL.courses,
  },
};

export default ME_SYLLABUS;
`;
fs.writeFileSync(path.join(outDir, 'index.js'), indexContent, 'utf8');

console.log(`Generated ME syllabus files in ${outDir}`);
