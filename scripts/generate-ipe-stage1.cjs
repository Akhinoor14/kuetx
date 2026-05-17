const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, '..', 'src', 'data', 'curriculum', 'departments', 'IPE');
const termsDir = path.join(baseDir, 'terms');
const syllabusDir = path.join(baseDir, 'syllabus');

const terms = {
  Y1T1: {
    title: 'First Year First Term',
    courses: {
      'IPE 1101': { title: 'Manufacturing Process - I', credit: 3, prerequisite: 'None' },
      'CHEM 1111': { title: 'Chemistry', credit: 3, prerequisite: 'None' },
      'HUM 1111': { title: 'Economics', credit: 3, prerequisite: 'None' },
      'MATH 1111': { title: 'Mathematics-1', credit: 4, prerequisite: 'None' },
      'PHY 1111': { title: 'Modern and Solid State Physics', credit: 4, prerequisite: 'None' },
      'IPE 1102': { title: 'Manufacturing Process - I Sessional', credit: 1.5, prerequisite: 'IPE 1101' },
      'CHEM 1112': { title: 'Chemistry Sessional', credit: 0.75, prerequisite: 'CHEM 1111' },
      'PHY 1112': { title: 'Physics Sessional', credit: 0.75, prerequisite: 'PHY 1111' },
    },
  },
  Y1T2: {
    title: 'First Year Second Term',
    courses: {
      'IPE 1201': { title: 'Manufacturing Process - II', credit: 3, prerequisite: 'IPE 1101' },
      'IPE 1203': { title: 'Engineering Materials', credit: 3, prerequisite: 'None' },
      'IPE 1209': { title: 'Computer Fundamentals & Programming Language', credit: 3, prerequisite: 'None' },
      'HUM 1211': { title: 'Professional English', credit: 3, prerequisite: 'None' },
      'MATH 1211': { title: 'Mathematics - II', credit: 4, prerequisite: 'MATH 1111' },
      'IPE 1202': { title: 'Manufacturing Process - II Sessional', credit: 1.5, prerequisite: 'IPE 1201' },
      'IPE 1210': { title: 'Computer Programming Sessional', credit: 1.5, prerequisite: 'IPE 1209' },
      'HUM 1212': { title: 'English Language Sessional', credit: 0.75, prerequisite: 'HUM 1211' },
      'IPE 1200': { title: 'Engineering Drawing', credit: 1.5, prerequisite: 'None' },
    },
  },
  Y2T1: {
    title: 'Second Year First Term',
    courses: {
      'CSE 2111': { title: 'Data Structures and Algorithms', credit: 3, prerequisite: 'IPE 1209' },
      'EEE 2111': { title: 'Electrical Circuits and Machines', credit: 4, prerequisite: 'None' },
      'HUM 2111': { title: 'Financial, Cost and Management Accounting', credit: 3, prerequisite: 'HUM 1111' },
      'MATH 2111': { title: 'Mathematics - III', credit: 3, prerequisite: 'MATH 1211' },
      'ME 2111': { title: 'Engineering Mechanics and Theory of Machines', credit: 4, prerequisite: 'None' },
      'CSE 2112': { title: 'Data Structures and Algorithms Sessional', credit: 1.5, prerequisite: 'CSE 2111' },
      'EEE 2112': { title: 'Electrical Circuits and Machines Sessional', credit: 1.5, prerequisite: 'EEE 2111' },
      'ME 2112': { title: 'Engineering Mechanics and Theory of Machines Sessional', credit: 0.75, prerequisite: 'ME 2111' },
    },
  },
  Y2T2: {
    title: 'Second Year Second Term',
    courses: {
      'IPE 2207': { title: 'Probability and Statistical Analysis', credit: 3, prerequisite: 'MATH 1211' },
      'IPE 2229': { title: 'Industrial Psychology and Law', credit: 3, prerequisite: 'None' },
      'EEE 2211': { title: 'Electronics', credit: 3, prerequisite: 'EEE 2111' },
      'ME 2213': { title: 'Mechanics of Solid', credit: 3, prerequisite: 'ME 2111' },
      'ME 2215': { title: 'Thermal Engineering and Heat Transfer', credit: 4, prerequisite: 'ME 2111' },
      'IPE 2200': { title: 'Computer Aided Design (CAD) Sessional - I', credit: 0.75, prerequisite: 'IPE 1200' },
      'ME 2216': { title: 'Electronics Sessional', credit: 0.75, prerequisite: 'EEE 2211' },
      'EEE 2212': { title: 'Mechanics of Solid Sessional', credit: 0.75, prerequisite: 'ME 2213' },
      'ME 2214': { title: 'Thermal Engineering and Heat Transfer Sessional', credit: 1.5, prerequisite: 'ME 2215' },
    },
  },
  Y3T1: {
    title: 'Third Year First Term',
    courses: {
      'IPE 3103': { title: 'Engineering Metallurgy', credit: 3, prerequisite: 'None' },
      'IPE 3105': { title: 'Product Design - I', credit: 3, prerequisite: 'None' },
      'IPE 3115': { title: 'Engineering Economy', credit: 3, prerequisite: 'None' },
      'IPE 3119': { title: 'Operations Management', credit: 3, prerequisite: 'None' },
      'ME 3111': { title: 'Fluid Mechanics and Machinery', credit: 3, prerequisite: 'ME 2213' },
      'IPE 3100': { title: 'Computer Aided Design (CAD) Sessional - II', credit: 0.75, prerequisite: 'IPE 2200' },
      'IPE 3104': { title: 'Engineering Metallurgy Sessional', credit: 0.75, prerequisite: 'IPE 3103' },
      'IPE 3106': { title: 'Product Design - I Sessional', credit: 1.5, prerequisite: 'IPE 3105' },
      'ME 3112': { title: 'Fluid Mechanics and Machinery', credit: 0.75, prerequisite: 'ME 3111' },
    },
  },
  Y3T2: {
    title: 'Third Year Second Term',
    courses: {
      'IPE 3205': { title: 'Product Design - II', credit: 3, prerequisite: 'IPE 3105' },
      'IPE 3217': { title: 'Operations Research', credit: 4, prerequisite: 'IPE 2207' },
      'IPE 3219': { title: 'Production Systems Design', credit: 3, prerequisite: 'None' },
      'IPE 3221': { title: 'Quality Management', credit: 3, prerequisite: 'IPE 2207' },
      'IPE 3223': { title: 'Material Handling and Maintenance Management', credit: 3, prerequisite: 'None' },
      'IPE 3200': { title: 'Business Communication Seminar', credit: 0.75, prerequisite: 'HUM 1211' },
      'IPE 3206': { title: 'Product Design - II Sessional', credit: 0.75, prerequisite: 'IPE 3205' },
      'IPE 3218': { title: 'Operations Research Sessional', credit: 0.75, prerequisite: 'IPE 3217' },
      'IPE 3220': { title: 'Production Systems Design Sessional', credit: 0.75, prerequisite: 'IPE 3219' },
      'IPE 3222': { title: 'Quality Management Sessional', credit: 0.75, prerequisite: 'IPE 3221' },
    },
  },
  Y4T1: {
    title: 'Fourth Year First Term',
    courses: {
      'IPE 4109': { title: 'Management Information System Analysis and Design', credit: 3, prerequisite: 'None' },
      'IPE 4125': { title: 'Machine Tools', credit: 3, prerequisite: 'IPE 1201' },
      'IPE 4129': { title: 'Industrial Management and Entrepreneurship Development', credit: 4, prerequisite: 'None' },
      'IPE 4009': { title: 'Systems Modeling and Simulations', credit: 3, prerequisite: 'None' },
      'IPE 4019': { title: 'Logistics and Supply Chain Management', credit: 3, prerequisite: 'None' },
      'IPE 4000': { title: 'Project and Thesis', credit: 1.5, prerequisite: 'None' },
      'IPE 4110': { title: 'MIS Sessional', credit: 0.75, prerequisite: 'IPE 4109' },
      'IPE 4126': { title: 'Machine Tools Sessional', credit: 1.5, prerequisite: 'IPE 4125' },
      'IPE 4002': { title: 'Term Project', credit: 0.75, prerequisite: 'None' },
    },
  },
  Y4T2: {
    title: 'Fourth Year Second Term',
    courses: {
      'IPE 4219': { title: 'Human Factors Engineering and Safety Management', credit: 3, prerequisite: 'None' },
      'IPE 4225': { title: 'Tool Engineering', credit: 3, prerequisite: 'IPE 4125' },
      'IPE 4227': { title: 'CAM and Robotics', credit: 3, prerequisite: 'None' },
      'IPE 4037': { title: 'Mechatronics', credit: 3, prerequisite: 'None' },
      'IPE 4059': { title: 'Project Management', credit: 3, prerequisite: 'None' },
      'IPE 4000': { title: 'Project and Thesis', credit: 3, prerequisite: 'IPE 4000' },
      'IPE 4220': { title: 'Human Factors Engineering Sessional', credit: 0.75, prerequisite: 'IPE 4219' },
      'IPE 4226': { title: 'Tool Engineering Sessional', credit: 0.75, prerequisite: 'IPE 4225' },
      'IPE 4228': { title: 'CAM and Robotics Sessional', credit: 0.75, prerequisite: 'IPE 4227' },
    },
  },
};

const optionalCourses = [
  { code: 'IPE 4009', title: 'Systems Modeling and Simulations', credit: 3 },
  { code: 'IPE 4019', title: 'Logistics and Supply Chain Management', credit: 3 },
  { code: 'IPE 4021', title: 'Advanced Tools in Quality Management', credit: 3 },
  { code: 'IPE 4027', title: 'Computer Integrated Manufacturing', credit: 3 },
  { code: 'IPE 4029', title: 'Marketing Management', credit: 3 },
  { code: 'IPE 4037', title: 'Mechatronics', credit: 3 },
  { code: 'IPE 4039', title: 'Human Resource Management', credit: 3 },
  { code: 'IPE 4049', title: 'Organizational Behavior', credit: 3 },
  { code: 'IPE 4059', title: 'Project Management', credit: 3 },
  { code: 'IPE 4069', title: 'Managing Innovations and Technology', credit: 3 },
];

const meta = {
  code: 'IPE',
  name: 'Industrial and Production Engineering',
  acronym: 'IPE',
  university: 'Khulna University of Engineering & Technology',
};

const notes = {
  overview: 'Industrial and Production Engineering curriculum prepared from the approved term-wise course list.',
  source: 'Course-Curriculum-IEM.pdf (IPE department source)',
  effectiveFrom: '2011-12',
};

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

const ensureDir = dir => fs.mkdirSync(dir, { recursive: true });
const write = (file, content) => fs.writeFileSync(file, content, 'utf8');

ensureDir(termsDir);
ensureDir(syllabusDir);

write(path.join(baseDir, 'meta.js'), `export const IPE_META = ${JSON.stringify(meta, null, 2)};\n\nexport default IPE_META;\n`);
write(path.join(baseDir, 'notes.js'), `export const IPE_NOTES = ${JSON.stringify(notes, null, 2)};\n\nexport default IPE_NOTES;\n`);
write(path.join(baseDir, 'optional.js'), `export const IPE_OPTIONAL_COURSES = ${JSON.stringify(optionalCourses, null, 2)};\n\nexport default IPE_OPTIONAL_COURSES;\n`);
write(path.join(syllabusDir, 'index.js'), `export const IPE_SYLLABUS = {};\n\nexport default IPE_SYLLABUS;\n`);

const termNames = [];
for (const [termKey, term] of Object.entries(terms)) {
  const exportName = `IPE_TERMS_${termKey}`;
  termNames.push({ termKey, exportName });
  const content = `export const ${exportName} = ${JSON.stringify({
    termKey,
    title: term.title || titleMap[termKey] || termKey,
    courses: term.courses,
  }, null, 2)};\n\nexport default ${exportName};\n`;
  write(path.join(termsDir, `${termKey}.js`), content);
}

write(path.join(termsDir, 'index.js'), `${termNames.map(({ termKey, exportName }) => `import { ${exportName} } from './${termKey}.js';`).join('\n')}\n\nexport const IPE_TERMS = {\n${termNames.map(({ termKey, exportName }) => `  ${termKey}: ${exportName},`).join('\n')}\n};\n\nexport default IPE_TERMS;\n`);

write(path.join(baseDir, 'index.js'), `import { IPE_META } from './meta.js';\nimport { IPE_TERMS } from './terms/index.js';\nimport { IPE_OPTIONAL_COURSES } from './optional.js';\nimport { IPE_NOTES } from './notes.js';\nimport { IPE_SYLLABUS } from './syllabus/index.js';\n\nexport const IPE_DEPARTMENT = {\n  meta: IPE_META,\n  terms: IPE_TERMS,\n  optional: IPE_OPTIONAL_COURSES,\n  notes: IPE_NOTES,\n  syllabus: IPE_SYLLABUS,\n};\n\nexport default IPE_DEPARTMENT;\n`);

console.log('Generated IPE stage-1 department files');
