#!/usr/bin/env node

/**
 * MSE Curriculum JSON to JS Converter
 * Reads MSEcuriculumn.json and populates Y1T1.js, Y1T2.js, etc. with detailed content
 * Matches structure of MTE, ESE, ECE
 */

const fs = require('fs');
const path = require('path');

// Configuration
const INPUT_FILE = path.join(__dirname, '../sylla/MSEcuriculumn.json');
const OUTPUT_DIR_SYLLABUS = path.join(__dirname, '../src/data/curriculum/departments/MSE/syllabus');
const OUTPUT_DIR_TERMS = path.join(__dirname, '../src/data/curriculum/departments/MSE/terms');

// Read JSON
let curriculumData;
try {
  const jsonContent = fs.readFileSync(INPUT_FILE, 'utf-8');
  curriculumData = JSON.parse(jsonContent);
  console.log(`✓ Loaded curriculum: MSE (Materials Science and Engineering)`);
} catch (err) {
  console.error(`✗ Failed to read/parse JSON: ${err.message}`);
  process.exit(1);
}

// Generate syllabus file with full details
function generateSyllabusFile(termKey, termData) {
  const courses = {};

  for (const [courseCode, courseData] of Object.entries(termData.courses || {})) {
    courses[courseCode] = {
      title: courseData.title,
      credit: courseData.credit,
      contactHour: courseData.contactHour,
      topics: courseData.topics || [],
      sessionalNote: courseData.sessionalNote || null,
      references: courseData.references || []
    };
  }

  const varName = `MSE_SYLLABUS_${termKey}`;
  const content = `export const ${varName} = {
\ttermKey: '${termKey}',
\ttitle: '${termData.title}',
\tcourses: ${JSON.stringify(courses, null, 2).replace(/\n/g, '\n\t')},
};
export default ${varName};
`;

  return content;
}

// Generate terms file (with references)
function generateTermsFile(termKey, termData) {
  const courses = {};

  for (const [courseCode, courseData] of Object.entries(termData.courses || {})) {
    courses[courseCode] = {
      title: courseData.title,
      credit: courseData.credit,
      references: courseData.references || []
    };
    if (courseData.prerequisite && courseData.prerequisite !== 'None') {
      courses[courseCode].prerequisite = courseData.prerequisite;
    }
  }

  const varName = `MSE_TERMS_${termKey}`;
  const content = `export const ${varName} = {
\ttermKey: '${termKey}',
\ttitle: '${termData.title}',
\tcourses: ${JSON.stringify(courses, null, 2).replace(/\n/g, '\n\t')},
};
export default ${varName};
`;

  return content;
}

// Process each term
let successCount = 0;
let errorCount = 0;
const validTerms = ['Y1T1', 'Y1T2', 'Y2T1', 'Y2T2', 'Y3T1', 'Y3T2', 'Y4T1', 'Y4T2'];

for (const termKey of validTerms) {
  const termData = curriculumData.terms[termKey];
  if (!termData) {
    console.warn(`⚠ Skipping missing term: ${termKey}`);
    continue;
  }

  try {
    // Generate and write syllabus file
    const syllabusContent = generateSyllabusFile(termKey, termData);
    const syllabusPath = path.join(OUTPUT_DIR_SYLLABUS, `${termKey}.js`);
    fs.writeFileSync(syllabusPath, syllabusContent, 'utf-8');

    // Generate and write terms file
    const termsContent = generateTermsFile(termKey, termData);
    const termsPath = path.join(OUTPUT_DIR_TERMS, `${termKey}.js`);
    fs.writeFileSync(termsPath, termsContent, 'utf-8');

    console.log(`✓ Populated: ${termKey}.js (syllabus & terms with full details)`);
    successCount++;
  } catch (err) {
    console.error(`✗ Failed to populate ${termKey}: ${err.message}`);
    errorCount++;
  }
}

// Regenerate index files
try {
  const syllabusIndexContent = `${validTerms
    .map(t => `export { default as MSE_SYLLABUS_${t} } from './${t}.js';`)
    .join('\n')}

export const MSE_SYLLABUS = {
${validTerms.map(t => `  ${t}: require('./${t}.js').default,`).join('\n')}
};

export default MSE_SYLLABUS;
`;

  fs.writeFileSync(path.join(OUTPUT_DIR_SYLLABUS, 'index.js'), syllabusIndexContent, 'utf-8');

  const termsIndexContent = `${validTerms
    .map(t => `export { default as MSE_TERMS_${t} } from './${t}.js';`)
    .join('\n')}

export const MSE_TERMS = {
${validTerms.map(t => `  ${t}: require('./${t}.js').default,`).join('\n')}
};

export default MSE_TERMS;
`;

  fs.writeFileSync(path.join(OUTPUT_DIR_TERMS, 'index.js'), termsIndexContent, 'utf-8');
  console.log(`✓ Updated: syllabus/index.js & terms/index.js`);
} catch (err) {
  console.error(`✗ Failed to update index files: ${err.message}`);
  errorCount++;
}

// Summary
console.log('\n' + '='.repeat(60));
console.log(`✓ Success: ${successCount} term files populated`);
if (errorCount > 0) {
  console.log(`✗ Errors: ${errorCount}`);
  process.exit(1);
} else {
  console.log('✓ All MSE files populated successfully!');
  console.log(`\nPopulated files in:`);
  console.log(`  - ${OUTPUT_DIR_SYLLABUS}/`);
  console.log(`  - ${OUTPUT_DIR_TERMS}/`);
}
