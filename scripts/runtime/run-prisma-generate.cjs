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
const prismaClientPackagePath = path.join(rootNodeModules, '@prisma', 'client', 'package.json')
const appPrismaClientPackagePath = path.join(appNodeModules, '@prisma', 'client', 'package.json')
const prismaCliPackagePath = path.join(rootNodeModules, 'prisma', 'package.json')
const appPrismaCliPackagePath = path.join(appNodeModules, 'prisma', 'package.json')

function ensureAppNodeModulesEntry(force = false) {
  if (fs.existsSync(appNodeModules)) {
    if (!force) return
    fs.rmSync(appNodeModules, { recursive: true, force: true })
  }

  const relativeTarget = path.relative(appDir, rootNodeModules)
  fs.symlinkSync(relativeTarget, appNodeModules, 'dir')
}

function modulePackageExists() {
  return fs.existsSync(appPrismaClientPackagePath) || fs.existsSync(prismaClientPackagePath)
}

function prismaCliExists() {
  return fs.existsSync(appPrismaCliPackagePath) || fs.existsSync(prismaCliPackagePath)
}

function runWorkspaceInstall() {
  const installResult = spawnSync('pnpm', ['install', '--frozen-lockfile'], {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
    shell: true,
  })
  if (typeof installResult.status === 'number' && installResult.status !== 0) {
    process.exit(installResult.status)
  }
  if (installResult.error) {
    throw installResult.error
  }
}

ensureAppNodeModulesEntry()

if (!modulePackageExists() || !prismaCliExists()) {
  runWorkspaceInstall()
  if (!fs.existsSync(appNodeModules)) {
    ensureAppNodeModulesEntry()
  }
}

if (!modulePackageExists() || !prismaCliExists()) {
  console.error(
    `Unable to resolve Prisma packages after install. appDir=${appDir} rootDir=${repoRoot} ` +
    `appPrismaClient=${fs.existsSync(appPrismaClientPackagePath)} rootPrismaClient=${fs.existsSync(prismaClientPackagePath)} ` +
    `appPrismaCli=${fs.existsSync(appPrismaCliPackagePath)} rootPrismaCli=${fs.existsSync(prismaCliPackagePath)}`,
  )
  process.exit(1)
}

const nextEnv = {
  ...process.env,
  NODE_PATH: [rootNodeModules, appNodeModules, process.env.NODE_PATH]
    .filter(Boolean)
    .join(path.delimiter),
}

const result = spawnSync('pnpm', ['exec', 'prisma', 'generate'], {
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
