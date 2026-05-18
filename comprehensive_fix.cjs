const fs = require('fs');

const path = 'src/pages/Attendance.jsx';
let content = fs.readFileSync(path, 'utf-8');

// Comprehensive mapping of corrupted UTF-8 sequences
const fixes = [
  // Corrupted dashes and quotes
  ['Ã¢â‚¬â€', '\u2013'],      // en-dash
  ['Ã¢â€ â€™', '\u2019'],      // right single quote  
  ['Ã¢â€°Â¥', '\u00a5'],       // yen
  ['Ã‚Â·', '\u00b7'],         // middle dot
  
  // Corrupted checkmarks and X marks (using direct unicode)
  ['Ã¢Å"â€œ', '\u2705'],      // check mark
  ['Ã¢Å"â€"', '\u274c'],      // cross mark
  
  // Corrupted emoji (using surrogate pairs)
  ['Ã°Å¸Å½â€°', '\ud83d\udd14'],  // bell
  ['Ã°Å¸â€¢Å'', '\u2615'],        // coffee
  ['Ã°Å¸â€œÅ¡', '\ud83d\udd27'],  // wrench
  ['Ã°Å¸â€œâ€¦', '\u26a0\ufe0f'],  // warning
  ['Ã°Å¸â€œâ€¹', '\ud83d\udccb'],  // clipboard
  ['Ã¢â‚¬Â¢', '\u2022'],     // bullet
  
  // Comment lines
  ['// Ã¢â€â‚¬Ã¢â€â‚¬ Summary', '// ────────── Summary'],
];

// Apply all fixes
for (const [corrupted, clean] of fixes) {
  const regex = new RegExp(corrupted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  content = content.replace(regex, clean);
}

// Also handle the long line of repeated corrupted dashes
content = content.replace(/Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬[Ã¢â€â‚¬]+/g, '────────────────────────────────────────────────────────────────');

fs.writeFileSync(path, content, 'utf-8');
console.log('✓ Fixed all remaining encoding issues');
