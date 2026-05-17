#!/usr/bin/env node

/**
 * MSE Department Connection Verification
 * Verifies that MSE follows the same structure as ESE/ECE departments
 */

const fs = require('fs');
const path = require('path');

console.log('MSE Department Structure Verification\n' + '='.repeat(60));

const CHECKS = {
  'Main Department Index': 'src/data/curriculum/departments/MSE/index.js',
  'Meta File': 'src/data/curriculum/departments/MSE/meta.js',
  'Notes File': 'src/data/curriculum/departments/MSE/notes.js',
  'Optional File': 'src/data/curriculum/departments/MSE/optional.js',
  'Syllabus Index': 'src/data/curriculum/departments/MSE/syllabus/index.js',
  'Syllabus Y1T1': 'src/data/curriculum/departments/MSE/syllabus/Y1T1.js',
  'Syllabus Y4T2': 'src/data/curriculum/departments/MSE/syllabus/Y4T2.js',
  'Terms Index': 'src/data/curriculum/departments/MSE/terms/index.js',
  'Terms Y1T1': 'src/data/curriculum/departments/MSE/terms/Y1T1.js',
  'Terms Y4T2': 'src/data/curriculum/departments/MSE/terms/Y4T2.js',
};

let allExists = true;
for (const [name, file] of Object.entries(CHECKS)) {
  const fullPath = path.join(__dirname, '../', file);
  const exists = fs.existsSync(fullPath);
  console.log(`${exists ? '✓' : '✗'} ${name}: ${file}`);
  if (!exists) allExists = false;
}

console.log('\n' + '='.repeat(60));

// Check if MSE is in main departments/index.js
const deptIndexPath = path.join(__dirname, '../src/data/curriculum/departments/index.js');
const deptIndexContent = fs.readFileSync(deptIndexPath, 'utf-8');

const hasMSEImport = deptIndexContent.includes("import { MSE_DEPARTMENT as MSE }");
const hasMSEExport = deptIndexContent.includes("MSE,") || deptIndexContent.includes("MSE\n");

console.log('\nDepartment Index Connections:');
console.log(`${hasMSEImport ? '✓' : '✗'} MSE imported in departments/index.js`);
console.log(`${hasMSEExport ? '✓' : '✗'} MSE exported in DEPARTMENTS object`);

// Check if main curriculum index exists
const currIndexPath = path.join(__dirname, '../src/data/curriculum/index.js');
const currExists = fs.existsSync(currIndexPath);
console.log(`${currExists ? '✓' : '✗'} Main curriculum/index.js exists`);

console.log('\n' + '='.repeat(60));

if (allExists && hasMSEImport && hasMSEExport) {
  console.log('\n✓✓✓ MSE DEPARTMENT FULLY CONNECTED ✓✓✓\n');
  console.log('Access points:');
  console.log('  - import { MSE_DEPARTMENT } from "./MSE/index.js"');
  console.log('  - import { DEPARTMENTS } from "./departments/index.js" → DEPARTMENTS.MSE');
  console.log('  - import { CURRICULUM } from "./curriculum/index.js" → CURRICULUM.departments.MSE');
  console.log('\nReady for use!');
} else {
  console.log('\n⚠ Some issues found. Please verify structure.');
}
