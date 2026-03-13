const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const repoRoot = path.resolve(__dirname, '../..')

test('backend build depends on prisma generate', () => {
  const project = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'apps/backend/project.json'), 'utf8'),
  )

  assert.ok(project.targets['prisma:generate'], 'missing backend prisma:generate target')
  assert.deepEqual(project.targets.build.dependsOn, ['^build', 'prisma:generate'])
})

test('backend prisma client generates into app-local output', () => {
  const baseSchema = fs.readFileSync(
    path.join(repoRoot, 'apps/backend/prisma/schema/base.prisma'),
    'utf8',
  )

  assert.match(baseSchema, /output\s*=\s*"\.\.\/\.\.\/generated\/prisma"/)
})
