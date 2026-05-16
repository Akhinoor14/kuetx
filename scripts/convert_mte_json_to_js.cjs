const fs = require('fs')
const path = require('path')

const repoRoot = path.resolve(__dirname, '..')
const src = path.join(repoRoot, 'sylla', 'mtecurriculmn.json')
const outDir = path.join(repoRoot, 'data', 'curriculum', 'departments', 'MTE')
const outFile = path.join(outDir, 'index.js')

if (!fs.existsSync(src)) {
  console.error('Source JSON not found:', src)
  process.exit(1)
}

fs.mkdirSync(outDir, { recursive: true })
const data = JSON.parse(fs.readFileSync(src, 'utf8'))
const fileContent = `const mte = ${JSON.stringify(data, null, 2)}\n\nexport default mte;\n`
fs.writeFileSync(outFile, fileContent, 'utf8')
console.log('Wrote', outFile)
