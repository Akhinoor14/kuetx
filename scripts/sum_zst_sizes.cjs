const fs = require('fs').promises;
const path = require('path');

async function walk(dir){
  let files = [];
  try{
    const entries = await fs.readdir(dir);
    for(const e of entries){
      const full = path.join(dir, e);
      const s = await fs.stat(full);
      if(s.isDirectory()) files = files.concat(await walk(full));
      else if(s.isFile() && full.toLowerCase().endsWith('.pdf.zst')) files.push({path: full, size: s.size});
    }
  }catch(e){}
  return files;
}

function hr(bytes){
  const units = ['B','KB','MB','GB','TB'];
  let i=0; let b = bytes;
  while(b>=1024 && i<units.length-1){ b/=1024; i++; }
  return `${b.toFixed(2)} ${units[i]}`;
}

(async function(){
  const target = require('path').resolve(__dirname, '..', 'src', 'data', 'QUESTION Bank');
  const files = await walk(target);
  const total = files.reduce((s,f)=>s+f.size,0);
  const out = {count: files.length, total_bytes: total, total_human: hr(total)};
  console.log(JSON.stringify(out, null, 2));
})();
