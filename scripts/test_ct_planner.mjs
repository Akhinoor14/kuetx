import { countWeeklyPressure, detectConflicts, generateSuggestions } from '../src/lib/smartAssist.js';

const schedule = [
  { id: 'a', eventType: 'CT', date: '2026-06-03', teacherName: 'Dr A', room: 'AB2-305' },
  { id: 'b', eventType: 'CT', date: '2026-06-03', teacherName: 'Dr A', room: 'AB2-305' },
  { id: 'c', eventType: 'Quiz', date: '2026-06-04', teacherName: 'Dr B', room: 'AB2-101' },
];

const assignments = [ { id: 'x', title: 'HW1', due: '2026-06-05' } ];

console.log('Pressure:', countWeeklyPressure(schedule, assignments, '2026-06-03'));
console.log('Conflicts:', detectConflicts(schedule));
console.log('Suggestions:', generateSuggestions(schedule, assignments, '2026-06-03'));
