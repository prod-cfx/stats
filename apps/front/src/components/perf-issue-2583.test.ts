import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from '@jest/globals'

const FRONT_ROOT = join(__dirname, '..')

function readFrontSource(relativePath: string) {
  return readFileSync(join(FRONT_ROOT, relativePath), 'utf8')
}

describe('issue #2583 TradingViewChart React Doctor hotspots', () => {
  it('batches TradingView header and dropdown DOM style writes', () => {
    const source = readFrontSource('components/tradingview/TradingViewChart.tsx')

    expect(source).toContain('function assignElementStyles(')
    expect(source).toContain('assignElementStyles(btn, {')
    expect(source).toContain('assignElementStyles(menu, {')
    expect(source).toContain('assignElementStyles(row, {')
    expect(source).toContain('assignElementStyles(aggBtn, {')
    expect(source).toContain('assignElementStyles(aggSwitch, {')
    expect(source).toContain('assignElementStyles(aggKnob, {')
    expect(source).not.toContain("btn.style.fontSize = '12px'")
    expect(source).not.toContain("menu.style.position = 'fixed'")
    expect(source).not.toContain("aggSwitch.style.position = 'relative'")
  })

  it('keeps chart container retry out of await-in-loop patterns', () => {
    const source = readFrontSource('components/tradingview/TradingViewChart.tsx')

    expect(source).toContain('async function waitForChartContainer(')
    expect(source).not.toContain('for (let i = 0; i < 10 && !containerEl; i += 1)')
  })

  it('uses indexed legend matching and one-pass button de-duplication', () => {
    const source = readFrontSource('components/tradingview/TradingViewChart.tsx')

    expect(source).toContain('const createNameCandidateSet = (label: string) =>')
    expect(source).toContain('Array.from(new Set(')
    expect(source).toContain('hasNameCandidateText(nameCandidates, txt)')
    expect(source).toContain('collectVisibleLegendButtons(row)')
    expect(source).not.toContain('.filter((el, idx, arr) => arr.indexOf(el) === idx)')
  })
})
