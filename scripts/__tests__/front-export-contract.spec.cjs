const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const repoRoot = path.resolve(__dirname, '../..')

test('front exportDist depends on build of upstream workspace deps', () => {
  const project = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'apps/front/project.json'), 'utf8'),
  )

  assert.ok(project.targets.exportDist, 'missing front exportDist target')
  assert.deepEqual(project.targets.exportDist.dependsOn, ['^build'])
})
