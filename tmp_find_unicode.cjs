const fs = require('fs');
const s = fs.readFileSync('d:/Skill/kuetx/src/pages/About.jsx','utf8');
const lines = s.split('\n');
for(let i=0;i<lines.length;i++){
  const line = lines[i];
  for(let j=0;j<line.length;j++){
    if(line.charCodeAt(j)>127){
      console.log(i+1, 'charCode', line.charCodeAt(j), 'char', line[j], '|', line.trim());
      break;
    }
  }
}
