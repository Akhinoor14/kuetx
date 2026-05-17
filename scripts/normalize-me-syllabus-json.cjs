const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'sylla', 'MECURRICULMN.JSON');
const raw = fs.readFileSync(filePath, 'utf8');

let updated = raw;
updated = updated.replace('"department": "FOR ME DEPT"', '"department": "ME"');
updated = updated.replace('"sourceType": "raw_text"', '"sourceType": "raw_text",\n  "sourceFile": "514024458-KUET-Mechanical-Syllabus.pdf"');
updated = updated.replace(/ΜΕ/g, 'ME');

fs.writeFileSync(filePath, updated, 'utf8');
console.log('Normalized ME syllabus JSON:', filePath);