import { readdirSync, readFileSync, statSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'

const sourceRoot = resolve(__dirname, '../..')

const allowedProcessEnvFiles = new Set([
  'common/env/env.accessor.ts',
  'common/services/env.service.ts',
  'swagger/export-openapi.ts',
])

function toSourcePath(path: string): string {
  return relative(sourceRoot, path).split(sep).join('/')
}

function collectTypeScriptFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const path = resolve(dir, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) {
      return collectTypeScriptFiles(path)
    }
    if (!entry.endsWith('.ts')) {
      return []
    }
    if (entry.endsWith('.spec.ts') || entry.endsWith('.e2e-spec.ts')) {
      return []
    }
    return [path]
  })
}

describe('backend process.env boundary', () => {
  it('keeps direct process.env access in the explicit backend env boundary allowlist', () => {
    const violations = collectTypeScriptFiles(sourceRoot)
      .map(path => ({ path: toSourcePath(path), content: readFileSync(path, 'utf8') }))
      .filter(file => file.content.includes('process.env'))
      .map(file => file.path)
      .filter(path => !allowedProcessEnvFiles.has(path))

    expect(violations).toEqual([])
  })
})
