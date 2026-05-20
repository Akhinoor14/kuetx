const fs = require('fs').promises;
const path = require('path');

async function statSafe(p){
  try { return await fs.stat(p); } catch(e){ return null; }
}

async function tree(dir, root){
  const name = path.basename(dir);
  const rel = path.relative(root, dir).split(path.sep).join('/');
  const node = { name, type: 'directory', relative_path: rel || '.', absolute_path: dir, children: [] };
  let entries;
  try { entries = await fs.readdir(dir); } catch(e){ return node; }
  for(const entry of entries){
    const full = path.join(dir, entry);
    const s = await statSafe(full);
    if(!s) continue;
    if(s.isDirectory()) node.children.push(await tree(full, root));
    else if(s.isFile()){
      node.children.push({
        name: entry,
        type: 'file',
        relative_path: path.relative(root, full).split(path.sep).join('/'),
        absolute_path: full,
        size: s.size
      });
    }
  }
  return node;
}

(async function main(){
  const scriptDir = __dirname;
  const target = path.resolve(scriptDir, '..', 'src', 'data', 'QUESTION Bank');
  const out = path.join(target, 'question_bank_structure.json');
  console.log('Scanning:', target);
  const t = await tree(target, target);
  await fs.writeFile(out, JSON.stringify(t, null, 2), 'utf8');
  console.log('Wrote', out);
})();
