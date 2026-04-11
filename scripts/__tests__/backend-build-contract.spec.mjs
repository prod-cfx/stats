/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../..')

function readPackageJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'))
}

test('shared workspace build scripts execute TypeScript via pnpm exec', () => {
  const sharedPkg = readPackageJson('packages/shared/package.json')
  const configPkg = readPackageJson('packages/config/package.json')
  const contractsPkg = readPackageJson('packages/api-contracts/package.json')

  assert.match(sharedPkg.scripts.build, /\bpnpm exec tsc\b/)
  assert.match(configPkg.scripts.build, /\bpnpm exec tsc\b/)
  assert.match(contractsPkg.scripts.build, /\bpnpm exec tsc\b/)
})

test('backend build script executes local build binaries via pnpm exec', () => {
  const backendPkg = readPackageJson('apps/backend/package.json')

  assert.match(backendPkg.scripts.build, /\bpnpm exec tsc\b/)
  assert.match(backendPkg.scripts.build, /\bpnpm exec tsc-alias\b/)
})
