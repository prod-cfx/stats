/* eslint-disable ts/no-require-imports */
const fs = require('node:fs')
const path = require('node:path')

const appDir = process.env.QUANTIFY_APP_DIR
  ? path.resolve(process.env.QUANTIFY_APP_DIR)
  : path.resolve(__dirname, '..')

const generatedDir = path.join(appDir, 'generated')
const prismaGeneratedDir = path.join(generatedDir, 'prisma')

function ensureDirectory(targetDir) {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true })
    return 'created'
  }

  const stat = fs.lstatSync(targetDir)

  if (stat.isDirectory()) {
    return 'kept'
  }

  if (stat.isSymbolicLink()) {
    try {
      if (fs.statSync(targetDir).isDirectory()) {
        return 'kept-symlink'
      }
    }
    catch {}
  }

  fs.rmSync(targetDir, { recursive: true, force: true })
  fs.mkdirSync(targetDir, { recursive: true })
  return 'replaced'
}

const generatedStatus = ensureDirectory(generatedDir)
const prismaStatus = ensureDirectory(prismaGeneratedDir)

console.log(
  `Prepared quantify Prisma output directories (generated: ${generatedStatus}, prisma: ${prismaStatus})`,
)
