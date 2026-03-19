const fs = require('node:fs')
const path = require('node:path')

const appName = process.argv[2]

if (!appName) {
  console.error('Usage: node scripts/copy-prisma-client-to-dist.cjs <app-name>')
  process.exit(1)
}

const repoRoot = path.resolve(__dirname, '..')
const sourceDir = path.join(repoRoot, 'apps', appName, 'generated', 'prisma')
const targetDir = path.join(repoRoot, 'apps', appName, 'dist', 'apps', appName, 'generated', 'prisma')

if (!fs.existsSync(sourceDir)) {
  console.error(`Generated Prisma client not found: ${sourceDir}`)
  process.exit(1)
}

fs.mkdirSync(path.dirname(targetDir), { recursive: true })
fs.rmSync(targetDir, { recursive: true, force: true })
fs.cpSync(sourceDir, targetDir, { recursive: true })

console.log(`Copied Prisma client for ${appName} -> ${path.relative(repoRoot, targetDir)}`)
