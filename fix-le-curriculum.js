import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read LE curriculum
const leCurrText = fs.readFileSync('./le curiculumn.json', 'utf-8');
const leCurr = JSON.parse(leCurrText);

const TERMS = ['Y1T1', 'Y1T2', 'Y2T1', 'Y2T2', 'Y3T1', 'Y3T2', 'Y4T1', 'Y4T2'];

// Fix term files - export course arrays (same as ESE)
TERMS.forEach(term => {
  const termData = leCurr.terms[term];
  if (!termData) return;
  
  // Convert to array of courses with full structure (include ALL courses, even sessional with no topics)
  const coursesArray = [];
  Object.entries(termData.courses).forEach(([code, course]) => {
    coursesArray.push({
      code: code,
      title: course.title,
      credits: course.credit || 0.75,
      contactHours: course.contactHours || '3/2',
      type: course.type || 'Sessional',
      topics: course.topics || []  // Keep topics array even if empty
    });
  });
  
  // Export as simple name (Y1T1, not LE_TERM_Y1_1)
  const varName = term;
  const filePath = `./src/data/curriculum/departments/LE/terms/${term}.js`;
  const content = `export const ${varName} = ${JSON.stringify(coursesArray, null, 2)};\n`;
  
  fs.writeFileSync(filePath, content);
  console.log(`✓ Fixed ${term}.js (${coursesArray.length} courses)`);
});

// Fix terms/index.js to match ESE pattern
const termsImportsAndExports = TERMS.map(term => {
  return {
    import: `import { ${term} } from './${term}.js';`,
    export: term
  };
});

const termsIndexContent = `${termsImportsAndExports.map(x => x.import).join('\n')}

export const LE_TERMS = {
${TERMS.map(t => `  ${t}`).join(',\n')},
};

export default LE_TERMS;
`;

fs.writeFileSync('./src/data/curriculum/departments/LE/terms/index.js', termsIndexContent);
console.log('✓ Fixed terms/index.js');

// For syllabus, keep the detailed structure (with topics as separate field)
// Syllabus files stay the same as they are (with topics embedded)

console.log('\n✅ LE curriculum fixed to match ESE structure!');
