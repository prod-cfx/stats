import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const FRONT_ROOT = join(__dirname, '..')

function readFront(relativePath: string) {
  return readFileSync(join(FRONT_ROOT, relativePath), 'utf8')
}

describe('perf issue #2607 heavy dependency boundaries', () => {
  it('loads AiQuant marketing Framer Motion features through LazyMotion', () => {
    const source = readFront('components/ai-quant/AiQuantMarketingHome.tsx')

    expect(source).toContain("import { LazyMotion, domAnimation, m, useReducedMotion } from 'framer-motion'")
    expect(source).toContain('<LazyMotion features={domAnimation}>')
    expect(source).not.toContain('import { motion')
    expect(source).not.toContain('<motion.')
  })

  it('keeps aggregated volume presence animation while avoiding direct motion import', () => {
    const source = readFront('components/aggregated-orderbook/AggregatedVolume.tsx')

    expect(source).toContain("import { AnimatePresence, LazyMotion, domAnimation, m } from 'framer-motion'")
    expect(source).toContain('<AnimatePresence>')
    expect(source).toContain('<LazyMotion features={domAnimation}>')
    expect(source).not.toContain('import { AnimatePresence, motion }')
    expect(source).not.toContain('<motion.')
  })

  it('keeps BacktestEquityChart as a wrapper and lazy-loads Recharts body', () => {
    const wrapper = readFront('app/[lng]/ai-quant/backtest/[id]/BacktestEquityChart.tsx')
    const bodyPath = join(FRONT_ROOT, 'app/[lng]/ai-quant/backtest/[id]/BacktestEquityChartRecharts.tsx')

    expect(existsSync(bodyPath)).toBe(true)
    expect(wrapper).toContain("import dynamic from 'next/dynamic'")
    expect(wrapper).toContain("import('./BacktestEquityChartRecharts')")
    expect(wrapper).toContain('BacktestEquityChartRecharts')
    expect(wrapper).not.toContain("from 'recharts'")

    const body = readFileSync(bodyPath, 'utf8')
    expect(body).toContain('react-doctor-disable-next-line react-doctor/prefer-dynamic-import')
    expect(body).toContain("from 'recharts'")
  })
})
