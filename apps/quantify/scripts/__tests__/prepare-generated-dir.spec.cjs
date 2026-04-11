/* eslint-disable ts/no-require-imports */
const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const repoRoot = path.resolve(__dirname, '../../../..')
const scriptPath = path.join(repoRoot, 'apps/quantify/scripts/prepare-generated-dir.cjs')

function makeTempAppDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'quantify-generated-dir-'))
}

function runPrepare(appDir) {
  const result = spawnSync(process.execPath, [scriptPath], {
    env: {
      ...process.env,
      QUANTIFY_APP_DIR: appDir,
    },
    encoding: 'utf8',
  })

  assert.equal(result.status, 0, result.stderr || result.stdout)
}

test('replaces a conflicting generated file with directories', () => {
  const appDir = makeTempAppDir()
  fs.writeFileSync(path.join(appDir, 'generated'), 'conflict')

  runPrepare(appDir)

  assert.equal(fs.statSync(path.join(appDir, 'generated')).isDirectory(), true)
  assert.equal(fs.statSync(path.join(appDir, 'generated', 'prisma')).isDirectory(), true)
})

test('replaces a conflicting generated/prisma file with a directory', () => {
  const appDir = makeTempAppDir()
  fs.mkdirSync(path.join(appDir, 'generated'), { recursive: true })
  fs.writeFileSync(path.join(appDir, 'generated', 'prisma'), 'conflict')

  runPrepare(appDir)

  assert.equal(fs.statSync(path.join(appDir, 'generated')).isDirectory(), true)
  assert.equal(fs.statSync(path.join(appDir, 'generated', 'prisma')).isDirectory(), true)
})
