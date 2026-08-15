// scripts/export_syllabus_topics_for_qb.mjs
//
// উদ্দেশ্য: src/data/curriculum/departments/{DEPT}/syllabus/index.js থেকে
// প্রতিটা (department, course-code) জোড়া -> topics[] (syllabus module list)
// বের করে একটা flat lookup JSON বানানো, যেটা পরে Qwen classification
// pipeline (Python script) ব্যবহার করবে course-code দিয়ে topic-candidate
// list পেতে।
//
// গুরুত্বপূর্ণ: lookup-এর key শুধু course code না, বরং "DEPT::CODE" —
// কারণ একই course code (যেমন "CSE 2113") বিভিন্ন department-এ সম্পূর্ণ
// আলাদা course হতে পারে (এক dept-এ "Computer Architecture", অন্য dept-এ
// "Computer Programming")। শুধু course code দিয়ে key বানালে একটা এন্ট্রি
// আরেকটাকে overwrite করে ফেলত।
//
// চালানোর নিয়ম (project root থেকে):
//   node scripts/export_syllabus_topics_for_qb.mjs
//
// Output:
//   scripts/output/syllabus_topics_lookup.json
//
// Output format:
// {
//   "CSE::CSE 2113": {
//     "department": "CSE",
//     "course_code": "CSE 2113",
//     "title": "Computer Architecture",
//     "term": "Y2T1",
//     "topics": [ "...", "..." ]
//   },
//   "ESE::CSE 2113": {
//     "department": "ESE",
//     "course_code": "CSE 2113",
//     "title": "Computer Programming",
//     "term": "Y2T1",
//     "topics": [ "...", "..." ]
//   },
//   ...
// }

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const departmentsDir = path.resolve(__dirname, '..', 'src', 'data', 'curriculum', 'departments');
const outDir = path.resolve(__dirname, 'output');
const outFile = path.join(outDir, 'syllabus_topics_lookup.json');

async function main() {
  if (!fs.existsSync(departmentsDir)) {
    throw new Error('Departments dir not found: ' + departmentsDir);
  }

  const deptFolders = fs.readdirSync(departmentsDir).filter(name => {
    const p = path.join(departmentsDir, name);
    return fs.statSync(p).isDirectory();
  });

  const lookup = {};
  const skippedDepts = [];

  for (const dept of deptFolders) {
    const syllabusIndexPath = path.join(departmentsDir, dept, 'syllabus', 'index.js');
    if (!fs.existsSync(syllabusIndexPath)) {
      skippedDepts.push({ dept, reason: 'no syllabus/index.js' });
      continue;
    }

    try {
      // file:// URL দরকার Windows/Linux দুই জায়গাতেই dynamic import এর জন্য
      const moduleUrl = 'file://' + syllabusIndexPath.split(path.sep).join('/');
      const mod = await import(moduleUrl);
      const syllabus = mod.default || mod[Object.keys(mod)[0]];

      if (!syllabus || !syllabus.terms) {
        skippedDepts.push({ dept, reason: 'unexpected export shape' });
        continue;
      }

      for (const [termKey, termData] of Object.entries(syllabus.terms)) {
        if (!termData || !termData.courses) continue;
        for (const [courseCode, courseData] of Object.entries(termData.courses)) {
          // গুরুত্বপূর্ণ: একই course code একাধিক department-এ ভিন্ন course
          // হিসেবে থাকতে পারে (যেমন "CSE 2113" = CSE dept-এ "Computer
          // Architecture", কিন্তু ESE dept-এ "Computer Programming")।
          // তাই lookup key অবশ্যই dept+code মিলিয়ে বানাতে হবে, নাহলে
          // একটা এন্ট্রি আরেকটাকে overwrite করে ফেলবে।
          const uniqueKey = `${dept}::${courseCode}`;
          lookup[uniqueKey] = {
            department: dept,
            course_code: courseCode,
            title: courseData.title || null,
            term: termKey,
            topics: Array.isArray(courseData.topics) ? courseData.topics : [],
          };
        }
      }

      console.log(`OK   ${dept}: ${Object.keys(syllabus.courses || {}).length} courses`);
    } catch (err) {
      skippedDepts.push({ dept, reason: err.message });
      console.error(`FAIL ${dept}: ${err.message}`);
    }
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(lookup, null, 2), 'utf8');

  console.log('\n=== DONE ===');
  console.log(`Total courses indexed: ${Object.keys(lookup).length}`);
  console.log(`Written to: ${outFile}`);
  if (skippedDepts.length) {
    console.log('\nSkipped/failed departments:');
    skippedDepts.forEach(s => console.log(`  - ${s.dept}: ${s.reason}`));
  }
}

main().catch(err => {
  console.error(err.stack || err);
  process.exit(1);
});
