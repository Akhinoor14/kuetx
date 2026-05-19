#!/usr/bin/env node

/**
 * EEE Curriculum JSON to JS Converter
 * Reads eeecuriculmn.json and populates Y1T1.js, Y1T2.js, etc. with detailed content
 * Matches structure of MTE, MSE, ESE, ECE
 */

const fs = require('fs');
const path = require('path');

// Configuration
const INPUT_FILE = path.join(__dirname, '../sylla/eeecuriculmn.json');
const OUTPUT_DIR_SYLLABUS = path.join(__dirname, '../src/data/curriculum/departments/EEE/syllabus');
const OUTPUT_DIR_TERMS = path.join(__dirname, '../src/data/curriculum/departments/EEE/terms');

// Read JSON
let curriculumData;
try {
  const jsonContent = fs.readFileSync(INPUT_FILE, 'utf-8');
  curriculumData = JSON.parse(jsonContent);
  console.log(`✓ Loaded curriculum: EEE (Electrical and Electronic Engineering)`);
} catch (err) {
  console.error(`✗ Failed to read/parse JSON: ${err.message}`);
  process.exit(1);
}

// Generate syllabus file with full details (including optional courses)
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

  // Add optional courses if they exist
  for (const courseData of (termData.optionalCourses || [])) {
    const courseCode = courseData.courseCode;
    courses[courseCode] = {
      title: courseData.title,
      credit: courseData.credit,
      contactHour: courseData.contactHour,
      topics: courseData.topics || [],
      sessionalNote: courseData.sessionalNote || null,
      references: courseData.references || []
    };
  }

  const varName = `EEE_SYLLABUS_${termKey}`;
  const content = `export const ${varName} = {
\ttermKey: '${termKey}',
\ttitle: '${termData.title}',
\tcourses: ${JSON.stringify(courses, null, 2).replace(/\n/g, '\n\t')},
};
export default ${varName};
`;

  return content;
}

// Generate terms file (with references and optional courses)
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

  // Add optional courses if they exist
  for (const courseData of (termData.optionalCourses || [])) {
    const courseCode = courseData.courseCode;
    courses[courseCode] = {
      title: courseData.title,
      credit: courseData.credit,
      references: courseData.references || []
    };
    if (courseData.prerequisite && courseData.prerequisite !== 'None') {
      courses[courseCode].prerequisite = courseData.prerequisite;
    }
  }

  const varName = `EEE_TERMS_${termKey}`;
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
    .map(t => `export { default as EEE_SYLLABUS_${t} } from './${t}.js';`)
    .join('\n')}

export const EEE_SYLLABUS = {
${validTerms.map(t => `  ${t}: require('./${t}.js').default,`).join('\n')}
};

export default EEE_SYLLABUS;
`;

  fs.writeFileSync(path.join(OUTPUT_DIR_SYLLABUS, 'index.js'), syllabusIndexContent, 'utf-8');

  const termsIndexContent = `${validTerms
    .map(t => `export { default as EEE_TERMS_${t} } from './${t}.js';`)
    .join('\n')}

export const EEE_TERMS = {
${validTerms.map(t => `  ${t}: require('./${t}.js').default,`).join('\n')}
};

export default EEE_TERMS;
`;

  fs.writeFileSync(path.join(OUTPUT_DIR_TERMS, 'index.js'), termsIndexContent, 'utf-8');
  console.log(`✓ Updated: syllabus/index.js & terms/index.js`);
} catch (err) {
  console.error(`✗ Failed to update index files: ${err.message}`);
  errorCount++;
}

// Generate optional.js with all electives organized by track
try {
  const powerCourses = [];
  const electronicsCourses = [];
  const communicationCourses = [];
  
  // Collect all optional courses from Y4T1 and Y4T2
  const y4t1Optional = curriculumData.terms['Y4T1']?.optionalCourses || [];
  const y4t2Optional = curriculumData.terms['Y4T2']?.optionalCourses || [];
  
  // Categorize by track based on course code patterns
  function categorizeByTrack(courses) {
    for (const course of courses) {
      const courseCode = course.courseCode?.replace('EEE ', '').trim() || '';
      const courseNum = parseInt(courseCode);
      
      // Track categorization logic based on course codes
      // Power: 414x, 424x, 4243, 4245, 4247
      // Electronics: 416x, 426x, 4269
      // Communication: 418x, 428x
      
      if ((courseNum >= 4140 && courseNum < 4150) ||  // 414x
          (courseNum >= 4240 && courseNum < 4250) ||  // 424x
          courseNum === 4245 || courseNum === 4247 ||  // 4245, 4247
          courseNum === 4243) {  // 4243
        powerCourses.push(course);
      } else if ((courseNum >= 4160 && courseNum < 4170) ||  // 416x
                 (courseNum >= 4260 && courseNum < 4270) ||  // 426x (but not communication-related)
                 courseNum === 4269) {  // 4269
        electronicsCourses.push(course);
      } else if ((courseNum >= 4180 && courseNum < 4190) ||  // 418x
                 (courseNum >= 4280 && courseNum < 4290)) {  // 428x
        communicationCourses.push(course);
      }
    }
  }
  
  categorizeByTrack(y4t1Optional);
  categorizeByTrack(y4t2Optional);

  const optionalContent = `export const EEE_OPTIONAL_COURSES = {
  power: [
${powerCourses.map(c => `    {
      code: '${c.courseCode}',
      title: '${c.title.replace(/'/g, "\\'")}',
      credit: ${c.credit},
      contactHour: '${c.contactHour}'
    }`).join(',\n')}
  ],
  electronics: [
${electronicsCourses.map(c => `    {
      code: '${c.courseCode}',
      title: '${c.title.replace(/'/g, "\\'")}',
      credit: ${c.credit},
      contactHour: '${c.contactHour}'
    }`).join(',\n')}
  ],
  communication: [
${communicationCourses.map(c => `    {
      code: '${c.courseCode}',
      title: '${c.title.replace(/'/g, "\\'")}',
      credit: ${c.credit},
      contactHour: '${c.contactHour}'
    }`).join(',\n')}
  ]
};

export default EEE_OPTIONAL_COURSES;
`;

  const optionalPath = path.join(__dirname, '../src/data/curriculum/departments/EEE/optional.js');
  fs.writeFileSync(optionalPath, optionalContent, 'utf-8');
  console.log(`✓ Generated: optional.js with all elective courses (Power, Electronics, Communication)`);
} catch (err) {
  console.error(`✗ Failed to generate optional.js: ${err.message}`);
  errorCount++;
}

// Summary
console.log('\n' + '='.repeat(60));
console.log(`✓ Success: ${successCount} term files populated`);
if (errorCount > 0) {
  console.log(`✗ Errors: ${errorCount}`);
  process.exit(1);
} else {
  console.log('✓ All EEE files populated successfully!');
  console.log(`\nPopulated files in:`);
  console.log(`  - ${OUTPUT_DIR_SYLLABUS}/`);
  console.log(`  - ${OUTPUT_DIR_TERMS}/`);
}
