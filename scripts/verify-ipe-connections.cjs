#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const base = path.join(__dirname, '..', 'src', 'data', 'curriculum', 'departments', 'IPE');
const files = [
  'index.js',
  'meta.js',
  'notes.js',
  'optional.js',
  'terms/index.js',
  'syllabus/index.js',
  'terms/Y1T1.js',
  'terms/Y1T2.js',
  'terms/Y2T1.js',
  'terms/Y2T2.js',
  'terms/Y3T1.js',
  'terms/Y3T2.js',
  'terms/Y4T1.js',
  'terms/Y4T2.js',
];

let ok = true;

console.log('IPE Department Connection Verification\n' + '='.repeat(60));

for (const rel of files) {
  const full = path.join(base, rel);
  const exists = fs.existsSync(full);
  console.log(`${exists ? '✓' : '✗'} ${rel}`);
  if (!exists) ok = false;
}

const deptIndexPath = path.join(__dirname, '..', 'src', 'data', 'curriculum', 'departments', 'index.js');
const deptIndex = fs.readFileSync(deptIndexPath, 'utf8');
const hasImport = deptIndex.includes("import { IPE_DEPARTMENT as IPE } from './IPE/index.js';");
const hasExport = deptIndex.includes('IPE,');

console.log('\nConnection Checks:');
console.log(`${hasImport ? '✓' : '✗'} IPE imported in departments/index.js`);
console.log(`${hasExport ? '✓' : '✗'} IPE exported in DEPARTMENTS`);

if (!hasImport || !hasExport) {
  ok = false;
}

if (ok) {
  console.log('\n✓✓✓ IPE DEPARTMENT FULLY CONNECTED ✓✓✓');
  console.log('Access points:');
  console.log('  - CURRICULUM.departments.IPE');
  console.log('  - CURRICULUM.departments.IPE.terms.Y1T1');
} else {
  console.log('\n⚠ IPE connection check found issues');
}

process.exit(ok ? 0 : 1);
