// Quick validation script: compare simplified Marks.jsx continuous calc vs accurate kuet300 logic
const GRADE_SCALE = [
  { grade: 'A+', minPct: 80 },
  { grade: 'A', minPct: 75 },
  { grade: 'A-', minPct: 70 },
  { grade: 'B+', minPct: 65 },
  { grade: 'B', minPct: 60 },
  { grade: 'B-', minPct: 55 },
  { grade: 'C+', minPct: 50 },
  { grade: 'C', minPct: 45 },
  { grade: 'D', minPct: 40 },
  { grade: 'F', minPct: 0 },
];

const clamp = (v, min, max) => Math.min(max, Math.max(min, Number.isFinite(+v) ? +v : 0));

const getAttendanceMarks = (pct) => {
  if (pct >= 90) return 10;
  if (pct >= 85) return 9;
  if (pct >= 80) return 8;
  if (pct >= 75) return 7;
  if (pct >= 70) return 6;
  if (pct >= 65) return 5;
  if (pct >= 60) return 4;
  return 0;
};

const calcHallNeeded = (targetMinPct, continuousMarks) => {
  const targetTotal = (targetMinPct / 100) * 300;
  const hallNeeded = Math.max(0, Math.ceil(targetTotal - continuousMarks));
  return Math.min(210, hallNeeded);
};

// Simplified Marks.jsx continuous
function continuousSimplified({ct1, ct2, assign1, assign2, bonus1, bonus2, attPct}){
  const ctTotal = clamp(ct1,0,30) + clamp(ct2,0,30);
  const bonusTotal = clamp(bonus1,0,10) + clamp(bonus2,0,10);
  const assignmentTotal = clamp(assign1,0,10) + clamp(assign2,0,10);
  const attendanceBasePerTeacher = attPct !== null ? (getAttendanceMarks(attPct) / 10) * 15 : 0;
  const attendanceTotal = attendanceBasePerTeacher * 2;
  const currentContinuous = ctTotal + assignmentTotal + attendanceTotal + bonusTotal;
  return { ctTotal, assignmentTotal, attendanceTotal, bonusTotal, currentContinuous };
}

// Accurate kuet300 logic mirrored from store.computeCourseGrade
function continuousAccurate({ct1, ct2, ctBonus1, ctBonus2, assign1, assign2, attPct, useAuto=true, attManual1=0, attManual2=0}){
  const ctTeacher1 = clamp(ct1,0,30);
  const ctTeacher2 = clamp(ct2,0,30);
  const ctBonusA = clamp(ctBonus1,0,30);
  const ctBonusB = clamp(ctBonus2,0,30);
  const ctEffective1 = clamp(ctTeacher1 + ctBonusA, 0, 30);
  const ctEffective2 = clamp(ctTeacher2 + ctBonusB, 0, 30);
  const assignment1 = clamp(assign1,0,15);
  const assignment2 = clamp(assign2,0,15);
  const attendancePerTeacher = attPct !== null ? (getAttendanceMarks(attPct) / 10) * 15 : 0;
  const attendanceCap1 = Math.max(0, 15 - assignment1);
  const attendanceCap2 = Math.max(0, 15 - assignment2);
  const attendanceFromAuto1 = Math.min(attendancePerTeacher, attendanceCap1);
  const attendanceFromAuto2 = Math.min(attendancePerTeacher, attendanceCap2);
  const attendance1 = useAuto ? attendanceFromAuto1 : clamp(attManual1,0,attendanceCap1);
  const attendance2 = useAuto ? attendanceFromAuto2 : clamp(attManual2,0,attendanceCap2);
  const teacherContinuous1 = ctEffective1 + assignment1 + attendance1;
  const teacherContinuous2 = ctEffective2 + assignment2 + attendance2;
  const totalContinuous = teacherContinuous1 + teacherContinuous2; // max 90
  return { teacherContinuous1, teacherContinuous2, totalContinuous };
}

function testCase(name, inputs){
  console.log('---', name, '---');
  const s = continuousSimplified(inputs);
  const a = continuousAccurate({ct1: inputs.ct1, ct2: inputs.ct2, ctBonus1: inputs.bonus1, ctBonus2: inputs.bonus2, assign1: inputs.assign1, assign2: inputs.assign2, attPct: inputs.attPct});
  console.log('Simplified continuous:', s.currentContinuous);
  console.log('  breakdown CT', s.ctTotal, 'Assign', s.assignmentTotal, 'Att', s.attendanceTotal, 'Bonus', s.bonusTotal);
  console.log('Accurate continuous:', a.totalContinuous);
  // compute hall needed for A+
  const targetMinPct = GRADE_SCALE.find(g=>g.grade==='A+').minPct;
  console.log('Hall needed (simplified):', calcHallNeeded(targetMinPct, s.currentContinuous));
  console.log('Hall needed (accurate):', calcHallNeeded(targetMinPct, a.totalContinuous));
  console.log('');
}

// Run scenarios
// 1. All zeros, no attendance
testCase('All zero/no attendance', {ct1:0, ct2:0, assign1:0, assign2:0, bonus1:0, bonus2:0, attPct: null});
// 2. High CTs and assignments and full attendance
testCase('High CTs & Assignments & 90% attendance', {ct1:30, ct2:30, assign1:10, assign2:10, bonus1:0, bonus2:0, attPct:90});
// 3. Moderate CTs, assignments reduce attendance cap
testCase('Moderate CTs, assignments 15 each reduce attendance', {ct1:25, ct2:20, assign1:15, assign2:15, bonus1:5, bonus2:5, attPct:90});
// 4. Mixed: one teacher heavy, other light
testCase('One teacher heavy', {ct1:30, ct2:10, assign1:12, assign2:2, bonus1:2, bonus2:1, attPct:85});
// 5. Edge: assignments cause attendance cap zero on one side
testCase('Assignment cap zero', {ct1:10, ct2:10, assign1:15, assign2:0, bonus1:0, bonus2:0, attPct:90});

console.log('Note: Simplified logic (Marks.jsx) may overcount continuous because it does not apply per-teacher attendance caps.');
console.log('Recommendation: compute continuous per teacher and apply attendance cap: attendance <= max(0,15 - assignment).');
