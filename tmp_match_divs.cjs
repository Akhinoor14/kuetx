const fs = require('fs');
const path = 'd:/Skill/kuetx/src/pages/About.jsx';
const lines = fs.readFileSync(path,'utf8').split('\n');
const stack = [];
const matches = [];
for(let i=0;i<lines.length;i++){
  const l=lines[i];
  const opens=(l.match(/<div[\s>]/g)||[]).length;
  const closes=(l.match(/<\/div>/g)||[]).length;
  for(let k=0;k<opens;k++) stack.push({openLine:i+1, text:l.trim()});
  for(let k=0;k<closes;k++){
    const o = stack.pop();
    if(o) matches.push({open:o.openLine, close:i+1});
    else console.log('unmatched close at', i+1);
  }
}
console.log('total opens', matches.length + stack.length, 'matches', matches.length, 'unclosed', stack.length);
if(stack.length) console.log('unclosed opens at lines', stack.map(s=>s.openLine));
// print a sample of matches for first 20
console.log('sample matches:', matches.slice(0,20));
