import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from '@jest/globals'

const FRONT_ROOT = join(__dirname, '..')

function readFrontSource(relativePath: string) {
  return readFileSync(join(FRONT_ROOT, relativePath), 'utf8')
}

describe('issue #2584 layout hydration flicker cleanup', () => {
  it('removes mount gates from layout and shared UI hydration guards', () => {
    const sources = [
      'components/layout/LanguageSwitcher.tsx',
      'components/layout/ThemeToggle.tsx',
      'components/ui/ConfirmDialog.tsx',
      'components/ui/toast.tsx',
    ].map(readFrontSource)

    for (const source of sources) {
      expect(source).not.toContain('setMounted(true)')
      expect(source).not.toMatch(/const \[mounted/)
      expect(source).not.toMatch(/if \(!mounted\)/)
    }
  })

  it('keeps navbar copyright year stable instead of recomputing after hydration', () => {
    const source = readFrontSource('components/layout/Navbar.tsx')

    expect(source).toContain('const year = COPYRIGHT_YEAR')
    expect(source).not.toContain('useSyncExternalStore')
    expect(source).not.toContain('getCurrentYearSnapshot')
    expect(source).not.toContain('getServerYearSnapshot')
  })
})
