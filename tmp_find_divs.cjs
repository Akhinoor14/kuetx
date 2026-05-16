const fs = require('fs');
const path = 'd:/Skill/kuetx/src/pages/About.jsx';
const lines = fs.readFileSync(path, 'utf8').split('\n');
let count = 0;
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  const opens = (l.match(/<div[\s>]/g) || []).length;
  const closes = (l.match(/<\/div>/g) || []).length;
  count += opens - closes;
  if (opens || closes) console.log(`${i+1}: open ${opens} close ${closes} balance ${count} | ${l.trim()}`);
}
console.log('final balance', count);
