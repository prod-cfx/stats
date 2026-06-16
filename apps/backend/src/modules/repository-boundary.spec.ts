import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const modulesRoot = __dirname

function collectTsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const path = join(dir, entry)
    const stat = statSync(path)

    if (stat.isDirectory()) {
      return collectTsFiles(path)
    }

    return path.endsWith('.ts') ? [path] : []
  })
}

describe('backend repository boundary', () => {
  it('keeps txHost.tx access inside repositories or explicit infrastructure', () => {
    const allowedFiles = new Set<string>()
    const violations = collectTsFiles(modulesRoot)
      .filter(file => !file.endsWith('.spec.ts'))
      .filter(file => !file.endsWith('repository.ts'))
      .map(file => ({ file, source: readFileSync(file, 'utf8') }))
      .filter(({ file, source }) => source.includes('txHost.tx') && !allowedFiles.has(relative(modulesRoot, file)))
      .map(({ file }) => relative(modulesRoot, file))

    expect(violations).toEqual([])
  })
})
