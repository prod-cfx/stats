import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const PRISMA_ROOT = join(__dirname)
const PRISMA_CONFIG_FILE = resolve(__dirname, '../prisma.config.ts')
const TEXT_FILE_EXTENSIONS = new Set(['.prisma', '.ts'])
const SUSPICIOUS_PATTERNS = ['璇风', '閿欒', '鍒涘缓', '娴嬭瘯', '妫€鏌', '缁撴', '涓嶅啀', '蹇呴』', '杩欓噷']

function collectTextFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry)
    const stats = statSync(fullPath)

    if (stats.isDirectory()) {
      return collectTextFiles(fullPath)
    }

    return [...TEXT_FILE_EXTENSIONS].some((ext) => fullPath.endsWith(ext)) ? [fullPath] : []
  })
}

describe('prisma text encoding', () => {
  it('does not contain mojibake markers', () => {
    const offenders = [...collectTextFiles(PRISMA_ROOT), PRISMA_CONFIG_FILE].flatMap((filePath) => {
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
