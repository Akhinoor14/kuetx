const fs = require('fs');
const p='d:/Skill/kuetx/src/pages/About.jsx';
const lines = fs.readFileSync(p,'utf8').split('\n');
for(let i=0;i<lines.length;i++) console.log((i+1).toString().padStart(3)+': '+lines[i]);
