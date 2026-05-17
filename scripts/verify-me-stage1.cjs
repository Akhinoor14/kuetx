#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const base = path.join(__dirname, '../src/data/curriculum/departments/ME');
const required = [
  'index.js',
  'meta.js',
  'notes.js',
  'optional.js',
  'syllabus/index.js',
  'terms/index.js',
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
console.log('ME Stage-1 Verification\n' + '='.repeat(50));
for (const rel of required) {
  const full = path.join(base, rel);
  const exists = fs.existsSync(full);
  console.log(`${exists ? '✓' : '✗'} ${rel}`);
  if (!exists) ok = false;
}

const deptIndex = fs.readFileSync(path.join(__dirname, '../src/data/curriculum/departments/index.js'), 'utf-8');
const hasImport = deptIndex.includes("import { ME_DEPARTMENT as ME }");
const hasExport = deptIndex.includes('ME,');
console.log(`\n${hasImport ? '✓' : '✗'} imported in departments/index.js`);
console.log(`${hasExport ? '✓' : '✗'} exported in DEPARTMENTS`);

if (!hasImport || !hasExport) ok = false;

console.log('\n' + (ok ? '✓ ME stage-1 is ready' : '✗ ME stage-1 has issues'));
process.exit(ok ? 0 : 1);
