const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const appName = process.argv[2]

if (!appName) {
  console.error('Usage: node scripts/runtime/run-prisma-generate.cjs <backend|quantify>')
  process.exit(1)
}

const repoRoot = path.resolve(__dirname, '..', '..')
const appDir = path.join(repoRoot, 'apps', appName)
const rootNodeModules = path.join(repoRoot, 'node_modules')
const appNodeModules = path.join(appDir, 'node_modules')

function ensureAppNodeModulesEntry() {
  if (fs.existsSync(appNodeModules)) {
    return
  }

  const relativeTarget = path.relative(appDir, rootNodeModules)
  fs.symlinkSync(relativeTarget, appNodeModules, 'dir')
}

function assertResolvableFrom(pathsToTry, moduleId) {
  try {
    require.resolve(moduleId, { paths: pathsToTry })
  } catch (error) {
    console.error(`Unable to resolve ${moduleId} from ${pathsToTry.join(', ')}`)
    throw error
  }
}

ensureAppNodeModulesEntry()
assertResolvableFrom([appDir, repoRoot], '@prisma/client/package.json')
assertResolvableFrom([appDir, repoRoot], 'prisma/package.json')

const nextEnv = {
  ...process.env,
  NODE_PATH: [rootNodeModules, appNodeModules, process.env.NODE_PATH]
    .filter(Boolean)
    .join(path.delimiter),
}

const result = spawnSync('prisma', ['generate'], {
  cwd: appDir,
  env: nextEnv,
  stdio: 'inherit',
  shell: true,
})

if (typeof result.status === 'number') {
  process.exit(result.status)
}

if (result.error) {
  throw result.error
}

process.exit(1)
