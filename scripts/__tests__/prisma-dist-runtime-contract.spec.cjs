const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const repoRoot = path.resolve(__dirname, '../..')

test('backend dist prisma types can be required at runtime', () => {
  assert.doesNotThrow(() => {
    require(path.join(repoRoot, 'apps/backend/dist/apps/backend/src/prisma/prisma.types.js'))
  })
})

test('quantify dist prisma types can be required at runtime', () => {
  assert.doesNotThrow(() => {
    require(path.join(repoRoot, 'apps/quantify/dist/apps/quantify/src/prisma/prisma.types.js'))
  })
})
