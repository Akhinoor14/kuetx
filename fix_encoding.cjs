const fs = require('fs');

const path = 'src/pages/Attendance.jsx';
let content = fs.readFileSync(path, 'utf-8');

// Simple replacements to fix the corrupted content
// Replace the regex line  
content = content.split('\n').map((line, idx) => {
  // Line 48: Fix the regex with corrupted dash
  if (line.includes('[A-Z]{2,6}') && line.includes('3,4}') && line.includes('Ã')) {
    return "    .replace(/^\\s*[A-Z]{2,6}\\s*\\d{3,4}\\s*[-–:]/i, '')";
  }
  // Line 105: Fix the comment with corrupted dashes
  if (line.includes('Daily Log') && line.includes('Ã')) {
    return '// ────────── Daily Log ─────────────────────────────────────────────────────────────';
  }
  return line;
}).join('\n');

fs.writeFileSync(path, content, 'utf-8');
console.log('✓ Fixed encoding issues in Attendance.jsx');
