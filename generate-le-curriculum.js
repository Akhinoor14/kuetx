import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read LE curriculum
const leCurrText = fs.readFileSync('./le curiculumn.json', 'utf-8');
const leCurr = JSON.parse(leCurrText);

// Create term files
const TERMS = ['Y1T1', 'Y1T2', 'Y2T1', 'Y2T2', 'Y3T1', 'Y3T2', 'Y4T1', 'Y4T2'];

TERMS.forEach(term => {
  const termData = leCurr.terms[term];
  if (!termData) return;
  
  // Convert to proper format
  const courses = {};
  Object.entries(termData.courses).forEach(([code, course]) => {
    if (course.topics && course.topics.length > 0) {
      courses[code] = {
        title: course.title,
        topics: course.topics
      };
    }
  });
  
  const output = {
    termKey: term,
    title: termData.title,
    courses: courses
  };
  
  const varName = `LE_TERM_${term.replace('T', '_')}`;
  const filePath = `./src/data/curriculum/departments/LE/terms/${term}.js`;
  const content = `export const ${varName} = ${JSON.stringify(output, null, 2)};\n`;
  
  fs.writeFileSync(filePath, content);
  console.log(`✓ Created ${term}.js`);
});

// Create index.js for LE terms
const importsAndExports = TERMS.map(term => {
  const varName = `LE_TERM_${term.replace('T', '_')}`;
  return {
    import: `import { ${varName} } from './${term}.js';`,
    export: varName
  };
});

const indexContent = `${importsAndExports.map(x => x.import).join('\n')}

export const LE_TERMS = {
${TERMS.map((t, i) => `  '${t}': ${importsAndExports[i].export}`).join(',\n')}
};

export default LE_TERMS;
`;

fs.writeFileSync('./src/data/curriculum/departments/LE/terms/index.js', indexContent);
console.log('✓ Created terms/index.js');

// Similarly create syllabus files
TERMS.forEach(term => {
  const termData = leCurr.terms[term];
  if (!termData) return;
  
  const courses = {};
  Object.entries(termData.courses).forEach(([code, course]) => {
    // Include ALL courses for syllabus (even sessional with no topics)
    courses[code] = {
      title: course.title,
      topics: course.topics || [],
      credits: course.credit,
      contactHours: course.contactHours,
      type: course.type
    };
  });
  
  const output = {
    termKey: term,
    title: termData.title,
    courses: courses
  };
  
  const varName = `LE_SYLLABUS_${term.replace('T', '_')}`;
  const filePath = `./src/data/curriculum/departments/LE/syllabus/${term}.js`;
  const content = `export const ${varName} = ${JSON.stringify(output, null, 2)};\n`;
  
  fs.writeFileSync(filePath, content);
  console.log(`✓ Created syllabus/${term}.js`);
});

// Create syllabus index
const syllabusImports = TERMS.map(term => {
  const varName = `LE_SYLLABUS_${term.replace('T', '_')}`;
  return {
    import: `import { ${varName} } from './${term}.js';`,
    export: varName
  };
});

const syllabusIndexContent = `${syllabusImports.map(x => x.import).join('\n')}

const TERM_SYLLABUS = {
${TERMS.map((t, i) => `  '${t}': ${syllabusImports[i].export}`).join(',\n')}
};

const mergeCourses = () => {
  const all = {};
  Object.values(TERM_SYLLABUS).forEach(term => {
    Object.assign(all, term.courses);
  });
  return all;
};

export const LE_SYLLABUS = {
  sourceFile: 'src/data/curriculum/departments/LE/syllabus/index.js',
  terms: TERM_SYLLABUS,
  courses: mergeCourses()
};

export default LE_SYLLABUS;
`;

fs.writeFileSync('./src/data/curriculum/departments/LE/syllabus/index.js', syllabusIndexContent);
console.log('✓ Created syllabus/index.js');

console.log('\n✅ All LE curriculum files generated!');
