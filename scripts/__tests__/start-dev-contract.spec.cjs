const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')

const repoRoot = path.resolve(__dirname, '../..')

function readPackageJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'))
}

function hasArg(script, arg) {
  return new RegExp(`(^|\\s)${arg.replaceAll('-', '\\-')}(\\s|$)`).test(script)
}

for (const appPath of ['apps/backend/package.json', 'apps/quantify/package.json']) {
  test(`${appPath} dev script uses ts-node-dev for Nest metadata compatibility`, () => {
    const pkg = readPackageJson(appPath)

    assert.match(pkg.scripts.dev, /^ts-node-dev /)
    assert.equal(hasArg(pkg.scripts.dev, '--transpile-only=false'), true)
    assert.doesNotMatch(pkg.scripts.dev, /^tsx watch /)
  })
}
