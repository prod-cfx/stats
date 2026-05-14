/**
 * #1279 #1329 #1331 W1：13 个迁出 orchestration atom 的 summaryTemplate 字节稳定锁。
 *
 * 历史 PRESENTATIONS displayRenderer 已在 Phase 3c/3d/3e 删除，无法直接对比原始 oracle。
 * 改用「字节稳定快照」形态：以代表性 non-empty params 锁住当前 summaryTemplate(zh/en) 输出，
 * 任何静默改字（含空格 / 标点 / unicode / 漏插值）都会触发回归。
 *
 * 对称化（#1329 PR3c Round 1 C1 / C3）：
 *   - 单 ATOM_KEYS × FIXTURE_PARAMS × ['zh', 'en'] 矩阵，13 atom × 2 locale = 26 快照
 *   - 防 zh/en 双 list 不对称导致某 atom 单 locale 漏锁
 *   - FIXTURE_PARAMS 全部 non-empty，防快照锁住 "0 根 K 线/0 档" 破碎默认渲染
 *
 * 维护：summaryTemplate 输出有意调整时同步改本 spec 期望（带 PR 说明）。
 */
import { ATOM_CONTRACT_REGISTRY } from '../atom-contract-registry'
import type { AtomContractKey } from '../atom-contract-types'

const ATOM_KEYS = [
  'gate.regime',
  'portfolioRisk.drawdown_block',
  'portfolioRisk.symbol_exposure_cap',
  'portfolioRisk.substrategy_exposure_cap',
  'program.dynamic_grid',
  'program.fixed_grid_gated',
  'program.adaptive_volatility_grid',
  'program.event_listener',
  'scope.symbol',
  'scope.leg',
  'scope.timeframe',
  'scope.dataSource',
  'scope.subStrategy',
  'gate.subStrategy',
] as const satisfies ReadonlyArray<AtomContractKey>

/**
 * 代表性 non-empty params：每个 atom 提供一组能命中正常渲染路径（非 fallback）的参数，
 * 让快照锁的是真实 user-visible 输出，而不是 "0 档 0 根 K 线" 这类破碎默认。
 *
 * distinctive 数值（如 thresholdPct=15、levelCount=5、stepPct=0.5）同时被 M1 parity 断言消费。
 */
type OrchestrationAtomKey = (typeof ATOM_KEYS)[number]
const FIXTURE_PARAMS: Record<OrchestrationAtomKey, Record<string, unknown>> = {
  'gate.regime': {
    indicator: 'ema',
    period: 50,
    operator: 'GT',
    sideScope: 'long',
  },
  'portfolioRisk.drawdown_block': {
    mode: 'enforce',
    thresholdPct: 15,
  },
  'portfolioRisk.symbol_exposure_cap': {
    notionalCapPct: 30,
    mode: 'enforce',
    effectWhenTriggered: 'block_new_entries',
  },
  'portfolioRisk.substrategy_exposure_cap': {
    notionalCapPct: 40,
    mode: 'enforce',
    effectWhenTriggered: 'block_new_entries',
  },
  'program.dynamic_grid': {
    anchorLookbackBars: 50,
    anchorSide: 'high',
    levelCount: 5,
    step: { mode: 'pct', value: 0.5 },
    onDeactivate: 'cancel',
  },
  'program.fixed_grid_gated': {
    lowerBound: 50000,
    upperBound: 60000,
    levelCount: 10,
    stepPct: 5,
    onDeactivate: 'cancel',
  },
  'program.adaptive_volatility_grid': {
    atrPeriod: 14,
    atrMultiplier: 1.5,
    rangeMultiplier: 3,
    minStepPct: 0.2,
    maxStepPct: 2,
    levelCount: 6,
    onDeactivate: 'cancel',
  },
  'program.event_listener': {
    permissionScope: 'tradingview:alpha',
  },
  'scope.symbol': {
    symbols: ['BTCUSDT', 'ETHUSDT'],
    primarySymbol: 'BTCUSDT',
  },
  'scope.leg': {
    direction: 'long',
    instrumentSymbol: 'BTCUSDT',
  },
  'scope.timeframe': {
    primaryTimeframe: '15m',
    requiredTimeframes: ['1h', '4h'],
    alignmentPolicy: 'strict',
  },
  'scope.dataSource': {
    role: 'primary',
    feedId: 'binance.spot.btcusdt',
    schemaRef: 'ohlcv',
  },
  'scope.subStrategy': {
    subStrategyId: 'trend_a',
    subStrategyLabel: '趋势子策略',
    positionHandlingOnDeactivate: 'close',
    orderHandlingOnDeactivate: 'cancel',
  },
  'gate.subStrategy': {
    effectWhenFalse: 'pause_substrategy',
    subStrategyScopeRef: 'trend_a',
  },
}

const LOCALES = ['zh', 'en'] as const

describe('#1331 W1：13 orchestration atom summaryTemplate 字节稳定锁（zh/en 对称）', () => {
  // matrix: atom × locale，13 × 2 = 26 cases
  const matrix: ReadonlyArray<{ atomKey: AtomContractKey; locale: 'zh' | 'en' }> =
    ATOM_KEYS.flatMap((atomKey) => LOCALES.map((locale) => ({ atomKey, locale })))

  it.each(matrix)(
    'summaryTemplate($atomKey, $locale) 非空且字节稳定',
    ({ atomKey, locale }) => {
      const entry = ATOM_CONTRACT_REGISTRY[atomKey]
      const params = FIXTURE_PARAMS[atomKey]
      const output = entry.display.summaryTemplate(params, locale)
      expect(typeof output).toBe('string')
      expect(output.length).toBeGreaterThan(0)
      expect(output).toMatchSnapshot(`${atomKey}-${locale}`)
    },
  )

  /**
   * M1 parity：zh 与 en 输出双边都含 FIXTURE_PARAMS 中的 distinctive 数值，
   * 防止某个 locale 渲染成纯 publicName fallback（参数未注入）。
   *
   * 排除：
   *   - portfolioRisk.drawdown_block：corpus stub，en 路径合规返回 publicName
   *   - scope.subStrategy：positionHandling/orderHandling 在 en/zh 路径均不直接渲染参数数字
   */
  const PARITY_DISTINCTIVE: Partial<Record<OrchestrationAtomKey, string>> = {
    'gate.regime': '50',
    'portfolioRisk.symbol_exposure_cap': '30',
    'portfolioRisk.substrategy_exposure_cap': '40',
    'program.dynamic_grid': '0.5',
    'program.fixed_grid_gated': '50000',
    'program.adaptive_volatility_grid': '14',
    'program.event_listener': 'tradingview',
    'scope.symbol': 'BTCUSDT',
    'scope.leg': 'BTCUSDT',
    'scope.timeframe': '15m',
    'scope.dataSource': 'binance',
    'gate.subStrategy': 'trend_a',
  }

  it.each(
    Object.entries(PARITY_DISTINCTIVE) as Array<[OrchestrationAtomKey, string]>,
  )('summaryTemplate(%s) zh/en 双边均含 distinctive 值 %s', (atomKey, distinctive) => {
    const entry = ATOM_CONTRACT_REGISTRY[atomKey]
    const params = FIXTURE_PARAMS[atomKey]
    const zhOut = entry.display.summaryTemplate(params, 'zh')
    const enOut = entry.display.summaryTemplate(params, 'en')
    expect(zhOut.toLowerCase()).toContain(distinctive.toLowerCase())
    expect(enOut.toLowerCase()).toContain(distinctive.toLowerCase())
  })

  it('publicName.zh 与 #1331 C1 回滚后值一致（key invariant：never break userspace）', () => {
    expect(ATOM_CONTRACT_REGISTRY['scope.leg'].display.publicName.zh).toBe('策略腿')
    expect(ATOM_CONTRACT_REGISTRY['scope.timeframe'].display.publicName.zh).toBe('周期范围')
    expect(ATOM_CONTRACT_REGISTRY['scope.dataSource'].display.publicName.zh).toBe('数据源')
    expect(ATOM_CONTRACT_REGISTRY['program.adaptive_volatility_grid'].display.publicName.zh).toBe('ATR 自适应网格')
  })
})
