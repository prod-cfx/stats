import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const FRONT_ROOT = join(process.cwd(), 'apps/front/src')

function readFrontSource(relativePath: string) {
  return readFileSync(join(FRONT_ROOT, relativePath), 'utf8')
}

describe('issue #619 center chart panel lazy loading', () => {
  it('lazy loads CenterChartPanel with a Skeleton fallback in the three heavy entrypoints', () => {
    const expectedDynamicImports = [
      ['app/[lng]/page.tsx', /dynamic\(\s*\(\)\s*=>\s*import\('@\/components\/trading\/center-chart-panel'\)/],
      ['app/[lng]/trade/TradingPageClient.tsx', /dynamic\(\s*\(\)\s*=>\s*import\('@\/components\/trading\/center-chart-panel'\)/],
      ['features/dashboards/widgets/contents/KlineWidget.tsx', /dynamic\(\s*\(\)\s*=>\s*import\('@\/components\/trading\/center-chart-panel'\)/],
    ] as const

    for (const [file, dynamicImport] of expectedDynamicImports) {
      const source = readFrontSource(file)
      expect(source, file).toContain("from 'next/dynamic'")
      expect(source, file).toContain("from '@/components/ui/loading'")
      expect(source, file).toMatch(dynamicImport)
      expect(source, file).toContain('loading: () => <Skeleton')
    }
  })
})
