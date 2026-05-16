#!/usr/bin/env node

/**
 * MTE Curriculum JSON to Term-wise JS Converter
 * Reads mtecurriculmn.json and generates Y1T1.js, Y1T2.js, etc.
 * Output: src/data/curriculum/departments/MTE/syllabus/ & terms/
 */

const fs = require('fs');
const path = require('path');

// Configuration
const INPUT_FILE = path.join(__dirname, '../sylla/mtecurriculmn.json');
const OUTPUT_DIR_SYLLABUS = path.join(__dirname, '../src/data/curriculum/departments/MTE/syllabus');
const OUTPUT_DIR_TERMS = path.join(__dirname, '../src/data/curriculum/departments/MTE/terms');

// Ensure output directories exist
[OUTPUT_DIR_SYLLABUS, OUTPUT_DIR_TERMS].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✓ Created directory: ${dir}`);
  }
});

// Read the JSON file
let curriculumData;
try {
  const jsonContent = fs.readFileSync(INPUT_FILE, 'utf-8');
  curriculumData = JSON.parse(jsonContent);
  console.log(`✓ Loaded curriculum data: ${curriculumData.department}`);
} catch (err) {
  console.error(`✗ Failed to read/parse JSON: ${err.message}`);
  process.exit(1);
}

// Helper: Generate syllabus file content
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

  const varName = `MTE_SYLLABUS_${termKey}`;
  const content = `export const ${varName} = {
\ttermKey: '${termKey}',
\ttitle: '${termData.title}',
\tcourses: ${JSON.stringify(courses, null, 2).replace(/\n/g, '\n\t')},
};
export default ${varName};
`;

  return content;
}

// Helper: Generate terms file content (minimal - references only)
function generateTermsFile(termKey, termData) {
  const courses = {};

  for (const [courseCode, courseData] of Object.entries(termData.courses || {})) {
    courses[courseCode] = {
      title: courseData.title,
      credit: courseData.credit,
      references: courseData.references || []
    };
  }

  const varName = `MTE_TERMS_${termKey}`;
  const content = `export const ${varName} = {
\ttermKey: '${termKey}',
\ttitle: '${termData.title}',
\tcourses: ${JSON.stringify(courses, null, 2).replace(/\n/g, '\n\t')},
};
export default ${varName};
`;

  return content;
}

// Main processing
let successCount = 0;
let errorCount = 0;

for (const [termKey, termData] of Object.entries(curriculumData.terms || {})) {
  if (!['Y1T1', 'Y1T2', 'Y2T1', 'Y2T2', 'Y3T1', 'Y3T2', 'Y4T1', 'Y4T2'].includes(termKey)) {
    console.warn(`⚠ Skipping unknown term: ${termKey}`);
    continue;
  }

  try {
    // Generate syllabus file
    const syllabusContent = generateSyllabusFile(termKey, termData);
    const syllabusPath = path.join(OUTPUT_DIR_SYLLABUS, `${termKey}.js`);
    fs.writeFileSync(syllabusPath, syllabusContent, 'utf-8');
    console.log(`✓ Generated: ${termKey}.js (syllabus)`);

    // Generate terms file
    const termsContent = generateTermsFile(termKey, termData);
    const termsPath = path.join(OUTPUT_DIR_TERMS, `${termKey}.js`);
    fs.writeFileSync(termsPath, termsContent, 'utf-8');
    console.log(`✓ Generated: ${termKey}.js (terms)`);

    successCount++;
  } catch (err) {
    console.error(`✗ Failed to generate files for ${termKey}: ${err.message}`);
    errorCount++;
  }
}

// Generate index.js files
try {
  const syllabusTerms = Object.keys(curriculumData.terms || {})
    .filter(k => ['Y1T1', 'Y1T2', 'Y2T1', 'Y2T2', 'Y3T1', 'Y3T2', 'Y4T1', 'Y4T2'].includes(k))
    .sort();

  const syllabusIndexContent = `${syllabusTerms
    .map(t => `export { default as MTE_SYLLABUS_${t} } from './${t}.js';`)
    .join('\n')}

export const MTE_SYLLABUS = {
${syllabusTerms.map(t => `  ${t}: require('./${t}.js').default,`).join('\n')}
};

export default MTE_SYLLABUS;
`;

  fs.writeFileSync(path.join(OUTPUT_DIR_SYLLABUS, 'index.js'), syllabusIndexContent, 'utf-8');
  console.log(`✓ Generated: index.js (syllabus)`);

  const termsIndexContent = `${syllabusTerms
    .map(t => `export { default as MTE_TERMS_${t} } from './${t}.js';`)
    .join('\n')}

export const MTE_TERMS = {
${syllabusTerms.map(t => `  ${t}: require('./${t}.js').default,`).join('\n')}
};

export default MTE_TERMS;
`;

  fs.writeFileSync(path.join(OUTPUT_DIR_TERMS, 'index.js'), termsIndexContent, 'utf-8');
  console.log(`✓ Generated: index.js (terms)`);
} catch (err) {
  console.error(`✗ Failed to generate index files: ${err.message}`);
  errorCount++;
}

// Summary
console.log('\n' + '='.repeat(60));
console.log(`✓ Success: ${successCount} term files generated`);
if (errorCount > 0) {
  console.log(`✗ Errors: ${errorCount}`);
  process.exit(1);
} else {
  console.log('✓ All files generated successfully!');
  console.log(`\nGenerated files in:`);
  console.log(`  - ${OUTPUT_DIR_SYLLABUS}/`);
  console.log(`  - ${OUTPUT_DIR_TERMS}/`);
}
