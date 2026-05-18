const fs = require('fs');

const path = 'src/pages/Attendance.jsx';
let content = fs.readFileSync(path, 'utf-8');

// Fix the most important corrupted characters
// Using regex with literal strings from the file
content = content.replace(/Ã¢â‚¬â€/g, '–');  // en-dash
content = content.replace(/Ã¢â‚¬Â¢/g, '•');  // bullet
content = content.replace(/Ã¢Å"â€œ/g, '✅');  // check mark
content = content.replace(/Ã¢Å"â€"/g, '❌');  // cross mark
content = content.replace(/Ã°Å¸Å½â€°/g, '🔔');  // bell
content = content.replace(/Ã°Å¸â€œâ€¹/g, '📋');  // clipboard
content = content.replace(/Ã°Å¸â€œâ€¦/g, '⚠️');  // warning

// Fix the corrupted comment lines
content = content.replace(/\/\/ Ã¢â€â‚¬Ã¢â€â‚¬ Summary.*?\n/s, '// ────────── Summary ─────────────────────────────────────────────────────────────\n');

fs.writeFileSync(path, content, 'utf-8');
console.log('✓ Fixed encoding issues');
