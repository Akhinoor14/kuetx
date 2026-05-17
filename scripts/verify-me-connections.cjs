#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const base = path.join(__dirname, '..', 'src', 'data', 'curriculum', 'departments', 'ME');
const files = [
  'index.js',
  'meta.js',
  'notes.js',
  'optional.js',
  'terms/index.js',
  'syllabus/index.js',
  'syllabus/optional.js',
  'terms/Y1T1.js',
  'terms/Y1T2.js',
  'terms/Y2T1.js',
  'terms/Y2T2.js',
  'terms/Y3T1.js',
  'terms/Y3T2.js',
  'terms/Y4T1.js',
  'terms/Y4T2.js',
  'syllabus/Y1T1.js',
  'syllabus/Y1T2.js',
  'syllabus/Y2T1.js',
  'syllabus/Y2T2.js',
  'syllabus/Y3T1.js',
  'syllabus/Y3T2.js',
  'syllabus/Y4T1.js',
  'syllabus/Y4T2.js',
];

let ok = true;

console.log('ME Department Connection Verification\n' + '='.repeat(60));

for (const rel of files) {
  const full = path.join(base, rel);
  const exists = fs.existsSync(full);
  console.log(`${exists ? '✓' : '✗'} ${rel}`);
  if (!exists) ok = false;
}

const deptIndexPath = path.join(__dirname, '..', 'src', 'data', 'curriculum', 'departments', 'index.js');
const deptIndex = fs.readFileSync(deptIndexPath, 'utf8');
const hasImport = deptIndex.includes("import { ME_DEPARTMENT as ME } from './ME/index.js';");
const hasExport = deptIndex.includes('ME,');

console.log('\nConnection Checks:');
console.log(`${hasImport ? '✓' : '✗'} ME imported in departments/index.js`);
console.log(`${hasExport ? '✓' : '✗'} ME exported in DEPARTMENTS`);

if (!hasImport || !hasExport) {
  ok = false;
}

if (ok) {
  console.log('\n✓✓✓ ME DEPARTMENT FULLY CONNECTED ✓✓✓');
  console.log('Access points:');
  console.log('  - CURRICULUM.departments.ME');
  console.log('  - CURRICULUM.departments.ME.terms.Y1T1');
  console.log('  - CURRICULUM.departments.ME.syllabus.terms.Y1T1');
} else {
  console.log('\n⚠ ME connection check found issues');
}

process.exit(ok ? 0 : 1);