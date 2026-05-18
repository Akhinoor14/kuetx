const fs = require('fs');

const path = 'src/pages/Attendance.jsx';
let content = fs.readFileSync(path, 'utf-8');

// Map of corrupted sequences to their replacements
const replacements = [
  // Corrupted en-dashes  
  ['Ã¢â‚¬â€', '\u2013'],  // en-dash
  ['Ã¢â‚¬â€™', '\u2019'],  // right single quotation mark
  ['Ã¢â‚¬â€š', '\u201a'],  // single low-9 quotation mark
  
  // Corrupted emoji/symbols - using escaped Unicode
  ['Ã°Å¸Å½â€°', '\ud83d\udd14'],  // bell
  ['Ã°Å¸â€¢Å'', '\ud83d\udd15'],  // no bell
  ['Ã°Å¸â€œÅ¡', '\ud83d\udd27'],  // wrench
  ['Ã°Å¸â€œâ€¦', '\ud83d\udd15'],  // generic "no" icon  
  ['Ã°Å¸â€œâ€¹', '\ud83d\udccb'],  // clipboard
  ['Ã¢Å"â€œ', '\u2705'],  // check mark
  ['Ã¢Å"â€"', '\u274c'],  // cross mark
  ['Ã¢â€ â€™', '\u2019'],  // apostrophe
  ['Ã¢â‚¬Â¢', '\u2022'],  // bullet
];

// Apply all replacements
for (const [corrupted, clean] of replacements) {
  const regex = new RegExp(corrupted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  content = content.replace(regex, clean);
}

// Fix the remaining corrupted comment line around line 529
content = content.replace(/\/\/ Ã¢â€â‚¬.*?Summary.*?\n/g, '// ────────── Summary ─────────────────────────────────────────────────────────────\n');

fs.writeFileSync(path, content, 'utf-8');
console.log('✓ Fixed all encoding issues in Attendance.jsx');
