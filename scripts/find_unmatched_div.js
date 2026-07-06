const fs=require('fs');
const p='D:/Skill/kuetx/src/pages/About.jsx';
const s=fs.readFileSync(p,'utf8');
const tokens=[];
for(const m of s.matchAll(/<\/div>|<div[\s>]/g)){
  tokens.push({token:m[0],index:m.index});
}
const lines=s.split(/\r?\n/);
const stack=[];
for(const t of tokens){
  const pre=s.slice(0,t.index);
  const line=pre.split(/\r?\n/).length;
  if(t.token.startsWith('</')){
    stack.pop();
  }else{
    stack.push(line);
  }
}
console.log('unmatched count',stack.length);
if(stack.length) console.log('last unmatched opening <div> at line',stack[stack.length-1]);
else console.log('all divs matched');
