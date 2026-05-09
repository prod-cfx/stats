import {
  type CompiledOrchestrationPortfolioRisk,
  evaluateOrchestrationPortfolioRisks,
} from './evaluate-orchestration-portfolio-risks'

const baseRisk = (overrides: Partial<CompiledOrchestrationPortfolioRisk> = {}): CompiledOrchestrationPortfolioRisk => ({
  id: 'risk-1',
  scope: 'portfolio',
  mode: 'enforce',
  thresholdPct: 10,
  effectWhenTriggered: 'block_new_entries',
  ...overrides,
})

describe('evaluateOrchestrationPortfolioRisks', () => {
  it('empty risks → no block, empty observedBreaches', () => {
    expect(evaluateOrchestrationPortfolioRisks([], { drawdownPct: 50 })).toEqual({
      blockEntryLong: false,
      blockEntryShort: false,
      observedBreaches: [],
    })
  })

  it('enforce + dd 12 > threshold 10 → block both', () => {
    expect(evaluateOrchestrationPortfolioRisks([baseRisk({ mode: 'enforce' })], { drawdownPct: 12 })).toEqual({
      blockEntryLong: true,
      blockEntryShort: true,
      observedBreaches: [],
    })
  })

  it('enforce + dd 8 < threshold 10 → no block', () => {
    expect(evaluateOrchestrationPortfolioRisks([baseRisk({ mode: 'enforce' })], { drawdownPct: 8 })).toEqual({
      blockEntryLong: false,
      blockEntryShort: false,
      observedBreaches: [],
    })
  })

  it('enforce + dd 0 (flat) → no block', () => {
    expect(evaluateOrchestrationPortfolioRisks([baseRisk({ mode: 'enforce' })], { drawdownPct: 0 })).toEqual({
      blockEntryLong: false,
      blockEntryShort: false,
      observedBreaches: [],
    })
  })

  it('enforce + dd -5 (equity 增长) → no block', () => {
    expect(evaluateOrchestrationPortfolioRisks([baseRisk({ mode: 'enforce' })], { drawdownPct: -5 })).toEqual({
      blockEntryLong: false,
      blockEntryShort: false,
      observedBreaches: [],
    })
  })

  it('observe + dd 12 > threshold 10 → no block, observedBreaches=[risk.id]', () => {
    expect(
      evaluateOrchestrationPortfolioRisks([baseRisk({ id: 'r-obs', mode: 'observe' })], { drawdownPct: 12 }),
    ).toEqual({
      blockEntryLong: false,
      blockEntryShort: false,
      observedBreaches: ['r-obs'],
    })
  })

  it('observe + dd 8 < threshold → no block, observedBreaches=[]', () => {
    expect(evaluateOrchestrationPortfolioRisks([baseRisk({ mode: 'observe' })], { drawdownPct: 8 })).toEqual({
      blockEntryLong: false,
      blockEntryShort: false,
      observedBreaches: [],
    })
  })

  it('enforce + drawdownPct undefined → fail-closed double block', () => {
    expect(evaluateOrchestrationPortfolioRisks([baseRisk({ mode: 'enforce' })], {})).toEqual({
      blockEntryLong: true,
      blockEntryShort: true,
      observedBreaches: [],
    })
  })

  it('observe + drawdownPct undefined → 完全 no-op', () => {
    expect(evaluateOrchestrationPortfolioRisks([baseRisk({ id: 'r-obs', mode: 'observe' })], {})).toEqual({
      blockEntryLong: false,
      blockEntryShort: false,
      observedBreaches: [],
    })
  })

  it('drawdownPct=NaN → 同 undefined behavior（enforce 阻挡，observe no-op）', () => {
    expect(
      evaluateOrchestrationPortfolioRisks(
        [baseRisk({ id: 'r-enf', mode: 'enforce' }), baseRisk({ id: 'r-obs', mode: 'observe' })],
        { drawdownPct: Number.NaN },
      ),
    ).toEqual({
      blockEntryLong: true,
      blockEntryShort: true,
      observedBreaches: [],
    })
  })

  it('非法 thresholdPct ≤0 → fail-closed 无视 mode', () => {
    expect(
      evaluateOrchestrationPortfolioRisks(
        [baseRisk({ mode: 'observe', thresholdPct: 0 }), baseRisk({ id: 'r2', mode: 'observe', thresholdPct: -1 })],
        { drawdownPct: 50 },
      ),
    ).toEqual({
      blockEntryLong: true,
      blockEntryShort: true,
      observedBreaches: [],
    })
  })

  it('多 risk：一个 enforce 触发 + 一个 observe 触发 → enforce 阻挡 + observe id 入 observedBreaches', () => {
    expect(
      evaluateOrchestrationPortfolioRisks(
        [
          baseRisk({ id: 'r-enf', mode: 'enforce', thresholdPct: 10 }),
          baseRisk({ id: 'r-obs', mode: 'observe', thresholdPct: 5 }),
        ],
        { drawdownPct: 12 },
      ),
    ).toEqual({
      blockEntryLong: true,
      blockEntryShort: true,
      observedBreaches: ['r-obs'],
    })
  })
})
