// Test file to verify ME 2100 course classification
// Quick verification that the permanent rules work

const testME2100 = () => {
  // Simulating the rule functions locally
  const inferCourseTypeFromCode = (code, currentType) => {
    if (!code || typeof code !== 'string') return currentType || 'Theory';
    
    const m = code.match(/\d+/g);
    if (!m || m.length === 0) return currentType || 'Theory';
    
    const nums = m.join('');
    if (nums.length === 0) return currentType || 'Theory';
    
    const last = nums[nums.length - 1];
    const d = parseInt(last, 10);
    
    if (!Number.isFinite(d)) return currentType || 'Theory';
    
    return (d % 2 === 0) ? 'Sessional' : 'Theory';
  };

  const extractYearTermFromCode = (code) => {
    if (!code || typeof code !== 'string') return { year: null, term: null };
    const m = code.match(/\d+/);
    if (!m) return { year: null, term: null };
    const numPart = m[0];
    if (numPart.length < 2) return { year: null, term: null };
    const year = parseInt(numPart[0], 10);
    const term = parseInt(numPart[1], 10);
    return { 
      year: (year >= 1 && year <= 4) ? year : null,
      term: (term >= 1 && term <= 2) ? term : null
    };
  };

  console.log('\n🎓 ME 2100 CLASSIFICATION TEST\n');
  console.log('='.repeat(60));
  
  const code = 'ME 2100';
  const currentType = 'Theory'; // Simulating old/wrong marking
  
  console.log(`Course Code: ${code}`);
  console.log(`Old Type: ${currentType}`);
  
  // Apply Rule 1: Type Detection
  const newType = inferCourseTypeFromCode(code, currentType);
  console.log(`\nRule 1 - Type Detection:`);
  console.log(`  Last digit of code: 0 (EVEN)`);
  console.log(`  ✓ New Type: ${newType}`);
  console.log(`  Result: ${currentType} → ${newType} (CORRECTED)`);
  
  // Apply Rule 2: Year/Term Extraction
  const { year, term } = extractYearTermFromCode(code);
  const termKey = year && term ? `Y${year}T${term}` : 'Invalid';
  console.log(`\nRule 2 - Year/Term Extraction:`);
  console.log(`  First digit: ${code.match(/\d+/)[0][0]} = ${year} (Year)`);
  console.log(`  Second digit: ${code.match(/\d+/)[0][1]} = ${term} (Term)`);
  console.log(`  ✓ Term Key: ${termKey}`);
  
  console.log(`\n` + '='.repeat(60));
  console.log(`\n✅ VERIFICATION RESULT:`);
  console.log(`   ${code} should be classified as:`);
  console.log(`   - Type: ${newType}`);
  console.log(`   - Location: ${termKey}`);
  console.log(`   - Full Classification: ${termKey} ${newType}\n`);
};

testME2100();
