const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const repoRoot = path.resolve(__dirname, '../..')

test('quantify build depends on prisma generate', () => {
  const project = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'apps/quantify/project.json'), 'utf8'),
  )

  assert.ok(project.targets['prisma:generate'], 'missing quantify prisma:generate target')
  assert.deepEqual(project.targets.build.dependsOn, ['^build', 'prisma:generate'])
})

test('quantify prisma client generates into app-local output', () => {
  const baseSchema = fs.readFileSync(
    path.join(repoRoot, 'apps/quantify/prisma/schema/base.prisma'),
    'utf8',
  )

  assert.match(baseSchema, /output\s*=\s*"\.\.\/\.\.\/generated\/prisma"/)
})

test('quantify prisma generation prepares the generated output path first', () => {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'apps/quantify/package.json'), 'utf8'),
  )

  assert.match(pkg.scripts['prisma:generate'], /prepare-generated-dir\.cjs/)
})
