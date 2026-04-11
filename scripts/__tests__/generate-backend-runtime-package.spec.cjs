const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const repoRoot = path.resolve(__dirname, '../..')
const scriptPath = path.join(repoRoot, 'scripts/runtime/generate-backend-runtime-package.mjs')

test('backend runtime package absorbs external dependencies from workspace packages', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backend-runtime-pkg-'))
  const outputPath = path.join(tempDir, 'package.json')

  execFileSync('node', [
    scriptPath,
    '--app-package', path.join(repoRoot, 'apps/backend/package.json'),
    '--root-package', path.join(repoRoot, 'package.json'),
    '--output', outputPath,
    '--include-pnpm',
  ], { cwd: repoRoot })

  const runtimePackage = JSON.parse(fs.readFileSync(outputPath, 'utf8'))

  assert.equal(runtimePackage.dependencies['@ai/api-contracts'], undefined)
  assert.equal(runtimePackage.dependencies['@ai/shared'], undefined)
  assert.equal(runtimePackage.dependencies['@net/config'], undefined)
  assert.equal(runtimePackage.dependencies['@zodios/core'], '^10.9.6')
  assert.equal(runtimePackage.dependencies['zod'], '^3.24.2')
})
