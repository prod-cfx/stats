const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const repoRoot = path.resolve(__dirname, '../..')

test('shared package exports quantify runtime subpaths', () => {
  assert.doesNotThrow(() => {
    require.resolve('@ai/shared/constants/error-codes', {
      paths: [path.join(repoRoot, 'apps/quantify')],
    })
  })
})

test('quantify package start script points at built entry file', () => {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'apps/quantify/package.json'), 'utf8'),
  )
  assert.equal(
    pkg.scripts.start,
    'TS_NODE_BASEURL=./dist node -r tsconfig-paths/register dist/apps/quantify/src/main.js',
  )
})

test('backend package start script points at built entry file', () => {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'apps/backend/package.json'), 'utf8'),
  )
  assert.equal(
    pkg.scripts.start,
    'TS_NODE_BASEURL=./dist node -r tsconfig-paths/register dist/apps/backend/src/main.js',
  )
})

test('quantify runtime locates workspace root dynamically', () => {
  const mainSource = fs.readFileSync(
    path.join(repoRoot, 'apps/quantify/src/main.ts'),
    'utf8',
  )

  assert.match(mainSource, /pnpm-workspace\.yaml/)
})

test('backend runtime locates workspace root dynamically', () => {
  const mainSource = fs.readFileSync(
    path.join(repoRoot, 'apps/backend/src/main.ts'),
    'utf8',
  )

  assert.match(mainSource, /pnpm-workspace\.yaml/)
})

test('quantify declares runtime deps needed by bundled workspace config code', () => {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'apps/quantify/package.json'), 'utf8'),
  )

  assert.equal(pkg.dependencies.zod, '^3.24.2')
})
