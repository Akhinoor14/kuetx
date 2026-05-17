#!/usr/bin/env node
/**
 * VERIFY ME DEPARTMENT COURSE CLASSIFICATION RULES
 * Validates that all ME courses follow the permanent rules:
 * - Rule 1: Last digit determines type (even = Sessional, odd = Theory)
 * - Rule 2: First two digits determine Year/Term placement
 */

const fs = require('fs');
const path = require('path');

// Import the store functions
async function runVerification() {
  try {
    const storePath = path.resolve(__dirname, 'src', 'store', 'store.js');
    const store = await import('file://' + storePath);
    const { inferCourseTypeFromCode, extractYearTermFromCode } = store;

    const curriculumPath = path.resolve(__dirname, 'src', 'data', 'curriculum', 'index.js');
    const curriculum = await import('file://' + curriculumPath);
    const CURRICULUM = curriculum.CURRICULUM || { departments: {} };

    console.log('\n🎓 COURSE CLASSIFICATION RULES VERIFICATION\n');
    console.log('='.repeat(80));

    const meDept = CURRICULUM.departments?.ME;
    if (!meDept) {
      console.log('❌ ME department not found');
      return;
    }

    const meTerms = meDept.terms || {};
    const meTermKeys = Object.keys(meTerms).sort();

    let issueCount = 0;
    let totalCourses = 0;

    for (const termKey of meTermKeys) {
      const termData = meTerms[termKey];
      if (!Array.isArray(termData)) continue;

      console.log(`\n📍 ${termKey}`);
      console.log('-'.repeat(80));

      for (const course of termData) {
        totalCourses++;
        const code = course.code;
        const type = course.type;

        // Rule 1: Type detection
        const expectedType = inferCourseTypeFromCode(code);
        const typeMatch = type === expectedType;

        // Rule 2: Year/Term extraction
        const { year, term } = extractYearTermFromCode(code);
        const expectedTermKey = year && term ? `Y${year}T${term}` : null;
        const placementMatch = expectedTermKey === termKey;

        // Display result
        const status = (typeMatch && placementMatch) ? '✓' : '⚠️';
        console.log(`  ${status} ${code.padEnd(15)} | Type: ${type?.padEnd(10)} | Location: ${termKey}`);

        // Log issues
        if (!typeMatch) {
          console.log(`     └─ ❌ Type Issue: Expected '${expectedType}' but got '${type}'`);
          issueCount++;
        }
        if (!placementMatch && expectedTermKey) {
          console.log(`     └─ ⚠️  Placement: Code suggests ${expectedTermKey} but placed in ${termKey}`);
          issueCount++;
        }
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log(`\n📊 VERIFICATION SUMMARY`);
    console.log(`   Total Courses Checked: ${totalCourses}`);
    console.log(`   Issues Found: ${issueCount}`);

    if (issueCount === 0) {
      console.log(`\n✅ ALL RULES VERIFIED SUCCESSFULLY`);
      console.log(`   ✓ All course types follow the permanent rule`);
      console.log(`   ✓ All courses are placed in correct terms`);
    } else {
      console.log(`\n⚠️  ISSUES DETECTED - REVIEW REQUIRED`);
    }

    console.log('\n🎓 RULES APPLIED:');
    console.log('   Rule 1: Last digit determines type (even=Sessional, odd=Theory)');
    console.log('   Rule 2: First two digits determine Year/Term (Y2T1, etc.)');
    console.log('   Rule 3: ME 2100 should be Y2T1 Sessional');
    console.log('\n');

  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

runVerification();
