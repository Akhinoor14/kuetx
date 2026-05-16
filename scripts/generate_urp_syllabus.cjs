const fs = require('fs');
const path = require('path');

const JSON_PATH = path.resolve(__dirname, '..', 'sylla', 'urpcuriculumn.json');
const OUT_DIR = path.resolve(__dirname, '..', 'src', 'data', 'curriculum', 'departments', 'URP', 'syllabus');
const TERM_KEYS = ['Y1T1', 'Y1T2', 'Y2T1', 'Y2T2', 'Y3T1', 'Y3T2', 'Y4T1', 'Y4T2'];

const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });

const toJs = (value, indent = 0) => JSON.stringify(value, null, 2)
  .replace(/^/gm, ' '.repeat(indent));

const buildTermModule = (deptCode, termKey, termData) => {
  const courseEntries = Object.entries(termData?.courses || {});
  const coursesObject = {};

  for (const [courseCode, course] of courseEntries) {
    coursesObject[courseCode] = {
      title: course?.title || '',
      credit: course?.credit ?? null,
      contactHour: course?.contactHour || '',
      topics: Array.isArray(course?.topics) ? course.topics : [],
      sessionalNote: course?.sessionalNote ?? null,
      references: Array.isArray(course?.references) ? course.references : [],
    };
  }

  const moduleObject = {
    termKey,
    title: termData?.title || '',
    courses: coursesObject,
    optionalCourses: Array.isArray(termData?.optionalCourses) ? termData.optionalCourses : [],
    termNotes: Array.isArray(termData?.termNotes) ? termData.termNotes : [],
  };

  return `export const ${deptCode}_SYLLABUS_${termKey} = ${toJs(moduleObject, 0)};\nexport default ${deptCode}_SYLLABUS_${termKey};\n`;
};

(async () => {
  try {
    const raw = fs.readFileSync(JSON_PATH, 'utf8');
    const json = JSON.parse(raw);
    const deptCode = 'URP';
    const terms = json?.terms || {};

    ensureDir(OUT_DIR);

    for (const termKey of TERM_KEYS) {
      const termData = terms[termKey] || { title: '', courses: {}, optionalCourses: [], termNotes: [] };
      const outFile = path.join(OUT_DIR, `${termKey}.js`);
      fs.writeFileSync(outFile, buildTermModule(deptCode, termKey, termData), 'utf8');
      console.log(`Wrote ${path.relative(path.resolve(__dirname, '..'), outFile)}`);
    }

    const indexContent = [
      ...TERM_KEYS.map((k) => `import { URP_SYLLABUS_${k} } from './${k}.js';`),
      "import { URP_SYLLABUS_OPTIONAL } from './optional.js';",
      '',
      'const TERM_SYLLABUS = {',
      ...TERM_KEYS.map((k) => `  ${k}: URP_SYLLABUS_${k},`),
      '};',
      '',
      'const mergeCourses = (...terms) => terms.reduce((acc, term) => ({ ...acc, ...term.courses }), {});',
      '',
      'export const URP_SYLLABUS = {',
      `  sourceFile: ${JSON.stringify(path.relative(path.resolve(__dirname, '..'), JSON_PATH))},`,
      '  terms: TERM_SYLLABUS,',
      '  optional: URP_SYLLABUS_OPTIONAL,',
      '  courses: {',
      `    ...mergeCourses(${TERM_KEYS.map((k) => `URP_SYLLABUS_${k}`).join(', ')}),`,
      '    ...URP_SYLLABUS_OPTIONAL.courses,',
      '  },',
      '};',
      '',
      'export default URP_SYLLABUS;',
      '',
    ].join('\n');

    fs.writeFileSync(path.join(OUT_DIR, 'index.js'), indexContent, 'utf8');
    console.log('Wrote src/data/curriculum/departments/URP/syllabus/index.js');
    process.exit(0);
  } catch (error) {
    console.error('Failed to generate URP syllabus:', error);
    process.exit(1);
  }
})();
