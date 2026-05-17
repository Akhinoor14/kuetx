#!/usr/bin/env node

/**
 * MSE Skeleton Generator
 * Creates Y2T1-Y4T2 syllabus and terms files with basic structure
 */

const fs = require('fs');
const path = require('path');

const COURSE_DATA = require('../MSE_COURSE_STRUCTURE.cjs').MSE_COURSES;

const OUTPUT_DIR_SYLLABUS = path.join(__dirname, '../src/data/curriculum/departments/MSE/syllabus');
const OUTPUT_DIR_TERMS = path.join(__dirname, '../src/data/curriculum/departments/MSE/terms');

function generateSyllabusFile(termKey, termData) {
  const courses = {};
  
  for (const course of termData.courses) {
    courses[course.code] = {
      title: course.title,
      credit: course.credit,
      contactHour: `${course.theory || course.practical} hrs/week`,
      topics: [],
      sessionalNote: course.code.includes('Sessional') ? `Sessional based on related theory course` : null,
      references: []
    };
  }

  const varName = `MSE_SYLLABUS_${termKey}`;
  return `export const ${varName} = {
\ttermKey: '${termKey}',
\ttitle: '${termData.title}',
\tcourses: ${JSON.stringify(courses, null, 2).replace(/\n/g, '\n\t')},
};
export default ${varName};
`;
}

function generateTermsFile(termKey, termData) {
  const courses = {};
  
  for (const course of termData.courses) {
    courses[course.code] = {
      title: course.title,
      credit: course.credit,
      references: []
    };
    if (course.prerequisite) {
      courses[course.code].prerequisite = course.prerequisite;
    }
  }

  const varName = `MSE_TERMS_${termKey}`;
  return `export const ${varName} = {
\ttermKey: '${termKey}',
\ttitle: '${termData.title}',
\tcourses: ${JSON.stringify(courses, null, 2).replace(/\n/g, '\n\t')},
};
export default ${varName};
`;
}

// Generate Y2T1 through Y4T2
const terms = ['Y2T1', 'Y2T2', 'Y3T1', 'Y3T2', 'Y4T1', 'Y4T2'];

for (const termKey of terms) {
  if (COURSE_DATA[termKey]) {
    const syllabusContent = generateSyllabusFile(termKey, COURSE_DATA[termKey]);
    fs.writeFileSync(path.join(OUTPUT_DIR_SYLLABUS, `${termKey}.js`), syllabusContent, 'utf-8');
    
    const termsContent = generateTermsFile(termKey, COURSE_DATA[termKey]);
    fs.writeFileSync(path.join(OUTPUT_DIR_TERMS, `${termKey}.js`), termsContent, 'utf-8');
    
    console.log(`✓ Generated: ${termKey}.js (syllabus & terms)`);
  }
}

// Generate syllabus index.js
const syllabusTerms = ['Y1T1', 'Y1T2', 'Y2T1', 'Y2T2', 'Y3T1', 'Y3T2', 'Y4T1', 'Y4T2'];
const syllabusIndexContent = `${syllabusTerms
  .map(t => `export { default as MSE_SYLLABUS_${t} } from './${t}.js';`)
  .join('\n')}

export const MSE_SYLLABUS = {
${syllabusTerms.map(t => `  ${t}: require('./${t}.js').default,`).join('\n')}
};

export default MSE_SYLLABUS;
`;

fs.writeFileSync(path.join(OUTPUT_DIR_SYLLABUS, 'index.js'), syllabusIndexContent, 'utf-8');
console.log(`✓ Generated: syllabus/index.js`);

// Generate terms index.js
const termsIndexContent = `${syllabusTerms
  .map(t => `export { default as MSE_TERMS_${t} } from './${t}.js';`)
  .join('\n')}

export const MSE_TERMS = {
${syllabusTerms.map(t => `  ${t}: require('./${t}.js').default,`).join('\n')}
};

export default MSE_TERMS;
`;

fs.writeFileSync(path.join(OUTPUT_DIR_TERMS, 'index.js'), termsIndexContent, 'utf-8');
console.log(`✓ Generated: terms/index.js`);

// Generate optional.js for syllabus
const syllabusOptionalContent = `export const MSE_SYLLABUS_OPTIONAL = {
  Y3T2: [
    {
      code: 'MSE 3207',
      title: 'Materials Recycling and Environmental Aspects',
      credit: 3,
      topics: [],
      references: []
    },
    {
      code: 'MSE 3209',
      title: 'Extractive Metallurgy',
      credit: 3,
      topics: [],
      references: []
    }
  ],
  Y4T2: [
    {
      code: 'MSE 4231',
      title: 'Biomaterials',
      credit: 3,
      topics: [],
      references: []
    },
    {
      code: 'MSE 4233',
      title: 'Nano-structured Materials',
      credit: 3,
      topics: [],
      references: []
    },
    {
      code: 'MSE 4235',
      title: 'Materials in Extreme Environments',
      credit: 3,
      topics: [],
      references: []
    },
    {
      code: 'MSE 4237',
      title: 'Materials and Sustainable Development',
      credit: 3,
      topics: [],
      references: []
    }
  ]
};

export default MSE_SYLLABUS_OPTIONAL;
`;

fs.writeFileSync(path.join(OUTPUT_DIR_SYLLABUS, 'optional.js'), syllabusOptionalContent, 'utf-8');
console.log(`✓ Generated: syllabus/optional.js`);

console.log('\n✓ All MSE skeleton files generated successfully!');
