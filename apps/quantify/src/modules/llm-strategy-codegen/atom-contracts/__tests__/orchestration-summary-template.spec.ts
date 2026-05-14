/**
 * #1279 #1329 #1331 W1：13 个迁出 orchestration atom 的 summaryTemplate 字节稳定锁。
 *
 * 历史 PRESENTATIONS displayRenderer 已在 Phase 3c/3d/3e 删除，无法直接对比原始 oracle。
 * 改用「字节稳定快照」形态：以代表性 params 锁住当前 summaryTemplate(zh) 输出，
 * 任何静默改字（含空格 / 标点 / unicode）都会触发回归。
 *
 * 维护：summaryTemplate 输出有意调整时同步改本 spec 期望（带 PR 说明）。
 */
import { ATOM_CONTRACT_REGISTRY } from '../atom-contract-registry'
import type { AtomContractKey } from '../atom-contract-types'

/** 13 atom × 代表性 params 输入。空 params {} 表示走 atom 默认 path。 */
const CASES: ReadonlyArray<{
  atomKey: AtomContractKey
  label: string
  params: Record<string, unknown>
}> = [
  { atomKey: 'gate.regime', label: 'mode=enforce', params: { mode: 'enforce' } },
  { atomKey: 'portfolioRisk.drawdown_block', label: 'mode=enforce thresholdPct=10', params: { mode: 'enforce', thresholdPct: 10 } },
  { atomKey: 'portfolioRisk.symbol_exposure_cap', label: '空 params', params: {} },
  { atomKey: 'portfolioRisk.substrategy_exposure_cap', label: '空 params', params: {} },
  { atomKey: 'program.dynamic_grid', label: '空 params', params: {} },
  { atomKey: 'program.fixed_grid_gated', label: '空 params', params: {} },
  { atomKey: 'program.adaptive_volatility_grid', label: '空 params', params: {} },
  { atomKey: 'program.event_listener', label: '空 params', params: {} },
  { atomKey: 'scope.symbol', label: '空 params', params: {} },
  { atomKey: 'scope.leg', label: '空 params', params: {} },
  { atomKey: 'scope.timeframe', label: '空 params', params: {} },
  { atomKey: 'scope.dataSource', label: '空 params', params: {} },
  { atomKey: 'scope.subStrategy', label: '空 params', params: {} },
]

describe('#1331 W1：13 orchestration atom summaryTemplate 字节稳定锁', () => {
  it.each(CASES)(
    'summaryTemplate(params, zh) 非空且为 string：$atomKey ($label)',
    ({ atomKey, params }) => {
      const entry = ATOM_CONTRACT_REGISTRY[atomKey]
      const output = entry.display.summaryTemplate(params, 'zh')
      expect(typeof output).toBe('string')
      expect(output.length).toBeGreaterThan(0)
      // 字节稳定快照（Jest inline snapshot 不强制，留 toMatchSnapshot 以便首次 run 自动写入 .snap）
      expect(output).toMatchSnapshot(`${atomKey} ${params ? JSON.stringify(params) : '{}'}`)
    },
  )

  it('publicName.zh 与 #1331 C1 回滚后值一致（key invariant：never break userspace）', () => {
    expect(ATOM_CONTRACT_REGISTRY['scope.leg'].display.publicName.zh).toBe('策略腿')
    expect(ATOM_CONTRACT_REGISTRY['scope.timeframe'].display.publicName.zh).toBe('周期范围')
    expect(ATOM_CONTRACT_REGISTRY['scope.dataSource'].display.publicName.zh).toBe('数据源')
    expect(ATOM_CONTRACT_REGISTRY['program.adaptive_volatility_grid'].display.publicName.zh).toBe('ATR 自适应网格')
  })
})
