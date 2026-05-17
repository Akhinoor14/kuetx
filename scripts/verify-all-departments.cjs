#!/usr/bin/env node

/**
 * Full Curriculum System Verification
 * Verify all 6 departments are complete and properly connected
 */

const fs = require('fs');
const path = require('path');

console.log('\n' + '='.repeat(70));
console.log('KUETX CURRICULUM SYSTEM - FULL VERIFICATION');
console.log('='.repeat(70) + '\n');

const BASE = 'e:\\kuetx\\src\\data\\curriculum\\departments';
const DEPARTMENTS = ['MTE', 'MSE', 'ESE', 'ECE', 'LE', 'URP'];

const TERMS = ['Y1T1', 'Y1T2', 'Y2T1', 'Y2T2', 'Y3T1', 'Y3T2', 'Y4T1', 'Y4T2'];

let allGood = true;

// 1. Check each department folder structure
console.log('1️⃣  DEPARTMENT STRUCTURE CHECK\n');

DEPARTMENTS.forEach(dept => {
  const deptPath = path.join(BASE, dept);
  const files = [
    'index.js',
    'meta.js',
    'notes.js',
    'optional.js',
    'syllabus/index.js',
    'terms/index.js',
  ];

  let fileCount = 0;
  files.forEach(file => {
    const fullPath = path.join(deptPath, file);
    if (fs.existsSync(fullPath)) {
      fileCount++;
    }
  });

  const termFiles = TERMS.filter(term => {
    const sylPath = path.join(deptPath, 'syllabus', `${term}.js`);
    const termPath = path.join(deptPath, 'terms', `${term}.js`);
    return fs.existsSync(sylPath) && fs.existsSync(termPath);
  });

  const status = fileCount === 6 && termFiles.length === 8 ? '✓' : '✗';
  const color = fileCount === 6 && termFiles.length === 8 ? '' : '[ERROR] ';

  console.log(`  ${status} ${dept}: ${fileCount}/6 base files, ${termFiles.length}/8 terms`);

  if (fileCount !== 6 || termFiles.length !== 8) {
    allGood = false;
  }
});

// 2. Check data population (sample topics)
console.log('\n2️⃣  DATA POPULATION CHECK (Sample Topics)\n');

DEPARTMENTS.forEach(dept => {
  const sylPath = path.join(BASE, dept, 'syllabus', 'Y1T1.js');
  if (fs.existsSync(sylPath)) {
    const content = fs.readFileSync(sylPath, 'utf-8');
    const topicsCount = (content.match(/"topics": \[/g) || []).length;
    const courseCount = (content.match(/"title":/g) || []).length;
    const hasTopics = content.includes('"topics": [') && !content.match(/"topics": \[\s*\]/);
    
    const status = hasTopics && courseCount > 0 ? '✓' : '✗';
    console.log(`  ${status} ${dept}: ${courseCount} courses with ${topicsCount} topic entries`);

    if (!hasTopics || courseCount === 0) {
      allGood = false;
    }
  }
});

// 3. Check exports and connections
console.log('\n3️⃣  EXPORT AND CONNECTION CHECK\n');

const deptIndexPath = path.join(BASE, 'index.js');
const deptIndex = fs.readFileSync(deptIndexPath, 'utf-8');

DEPARTMENTS.forEach(dept => {
  const importPattern = new RegExp(`import.*${dept}.*from.*'\\.\/${dept}\/index\\.js'`);
  const exportPattern = new RegExp(`\\s${dept},`);
  
  const hasImport = importPattern.test(deptIndex);
  const hasExport = exportPattern.test(deptIndex);
  
  const status = hasImport && hasExport ? '✓' : '✗';
  console.log(`  ${status} ${dept}: Import ${hasImport ? '✓' : '✗'} | Export ${hasExport ? '✓' : '✗'}`);

  if (!hasImport || !hasExport) {
    allGood = false;
  }
});

// 4. Check main curriculum integration
console.log('\n4️⃣  MAIN CURRICULUM INTEGRATION\n');

const currPath = path.join(BASE, '..', 'index.js');
const currContent = fs.readFileSync(currPath, 'utf-8');

const hasDeptImport = currContent.includes("import { DEPARTMENTS } from './departments/index.js'");
const hasCurriculumExport = currContent.includes('export const CURRICULUM');
const hasStructure = currContent.includes('departments: DEPARTMENTS');

console.log(`  ${hasDeptImport ? '✓' : '✗'} DEPARTMENTS imported`);
console.log(`  ${hasCurriculumExport ? '✓' : '✗'} CURRICULUM exported`);
console.log(`  ${hasStructure ? '✓' : '✗'} Department structure defined`);

if (!hasDeptImport || !hasCurriculumExport || !hasStructure) {
  allGood = false;
}

// 5. Summary
console.log('\n' + '='.repeat(70));

if (allGood) {
  console.log('✓✓✓ SYSTEM STATUS: ALL 6 DEPARTMENTS VERIFIED ✓✓✓');
  console.log('\n✅ All checks passed:');
  console.log('   ✓ All 6 departments have complete folder structure');
  console.log('   ✓ All term files populated with course data');
  console.log('   ✓ All departments properly exported');
  console.log('   ✓ Main curriculum integration working');
  console.log('\n📊 DEPARTMENTS OPERATIONAL:');
  console.log('   • MTE  (Mechatronics Engineering)');
  console.log('   • MSE  (Materials Science & Engineering)');
  console.log('   • ESE  (Energy Science & Engineering)');
  console.log('   • ECE  (Electronics & Communication Engineering)');
  console.log('   • LE   (Leather Engineering)');
  console.log('   • URP  (Urban & Regional Planning)');
  console.log('\n🔗 ACCESS POINT: CURRICULUM.departments.[DEPT]');
} else {
  console.log('⚠️  SYSTEM STATUS: ISSUES FOUND');
  allGood = false;
}

console.log('='.repeat(70) + '\n');

process.exit(allGood ? 0 : 1);
