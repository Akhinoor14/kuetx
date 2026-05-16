const fs = require('fs');
const path = 'd:/Skill/kuetx/src/pages/About.jsx';
const lines = fs.readFileSync(path, 'utf8').split('\n');
const stack = [];
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  const openMatches = l.match(/<div[\s>]/g) || [];
  const closeMatches = l.match(/<\/div>/g) || [];
  for (let k=0;k<openMatches.length;k++) stack.push({line:i+1, text: l.trim()});
  for (let k=0;k<closeMatches.length;k++) {
    if (stack.length) stack.pop();
    else console.log('Unmatched close at', i+1, l.trim());
  }
}
if (stack.length) console.log('Unclosed <div> tags at lines:', stack.map(s=>s.line), 'sample:', stack.slice(0,5));
else console.log('All divs matched');
