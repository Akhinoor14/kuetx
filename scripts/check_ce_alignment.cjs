const fs = require('fs');
const path = require('path');

const base = path.join('src', 'data', 'curriculum', 'departments', 'CE');
const termDir = path.join(base, 'terms');
const sylDir = path.join(base, 'syllabus');
const terms = ['Y1T1', 'Y1T2', 'Y2T1', 'Y2T2', 'Y3T1', 'Y3T2', 'Y4T1', 'Y4T2'];

let ok = true;

for (const termKey of terms) {
  const termPath = path.join(termDir, `${termKey}.js`);
  const sylPath = path.join(sylDir, `${termKey}.js`);
  if (!fs.existsSync(termPath) || !fs.existsSync(sylPath)) {
    console.log('Missing', termKey);
    ok = false;
    continue;
  }

  const termText = fs.readFileSync(termPath, 'utf8');
  const sylText = fs.readFileSync(sylPath, 'utf8');

  const termCodes = Array.from(termText.matchAll(/"code":\s*"([^"]+)"/g)).map(match => match[1]);
  const sylCodes = Array.from(sylText.matchAll(/"([^"]+)":\s*\{\s*"title"/g))
    .map(match => match[1])
    .filter(code => !['termKey', 'title', 'courses', 'optionalCourses', 'termNotes'].includes(code));

  const termSet = new Set(termCodes);
  const sylSet = new Set(sylCodes);

  const termMissing = Array.from(sylSet).filter(code => !termSet.has(code));
  const sylMissing = Array.from(termSet).filter(code => !sylSet.has(code));

  if (termMissing.length || sylMissing.length) {
    ok = false;
    console.log(termKey, 'termMissing', termMissing, 'sylMissing', sylMissing);
  }
}

if (ok) {
  console.log('CE term/syllabus codes aligned');
}
