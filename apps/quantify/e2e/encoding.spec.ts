import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const E2E_ROOT = join(__dirname)
const TEXT_FILE_EXTENSIONS = new Set(['.ts', '.md', '.json'])
const SUSPICIOUS_PATTERNS = ['璇风', '閿欒', '鍒涘缓', '娴嬭瘯', '妫€鏌', '缁撴']

function collectTextFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry)
    const stats = statSync(fullPath)

    if (stats.isDirectory()) {
      return collectTextFiles(fullPath)
    }

    if (fullPath.endsWith('encoding.spec.ts')) {
      return []
    }

    return [...TEXT_FILE_EXTENSIONS].some((ext) => fullPath.endsWith(ext)) ? [fullPath] : []
  })
}

describe('e2e text encoding', () => {
  it('does not contain mojibake markers', () => {
    const offenders = collectTextFiles(E2E_ROOT).flatMap((filePath) => {
      if (filePath.endsWith('encoding.spec.ts')) {
        return []
      }

      const content = readFileSync(filePath, 'utf8')
      const matchedPattern = SUSPICIOUS_PATTERNS.find((pattern) => content.includes(pattern))

      return matchedPattern ? [[filePath, matchedPattern] as const] : []
    })

    expect(offenders).toEqual([])
  })
})
