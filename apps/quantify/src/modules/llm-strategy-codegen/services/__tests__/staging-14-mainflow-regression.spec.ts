import type { SemanticState } from '../../types/semantic-state'
import type { CodegenSemanticPatch } from '../../types/codegen-semantic-patch'
import { CURRENT_SEMANTIC_VERSION } from '../../nl-gateway/version-gate/version-gate'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CodegenConversationService } from '../codegen-conversation.service'
import { GenericSeedDispatcher } from '../generic-seed-dispatcher.service'
import { RulesMainflowReaderService } from '../rules-mainflow-reader.service'
import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
import { SemanticSupportClassifierService } from '../semantic-support-classifier.service'

type StagingCase = {
  id: string
  prompt: string
  expectedKeys: string[]
  forbiddenOpenSlots?: string[]
  expectedText?: string[]
  canonicalMustBuild?: boolean
}

const CASES: StagingCase[] = [
  {
    id: 'A1',
    prompt: 'BTCUSDT 15m。未平仓量增加并且突破 20 根高点时开多。',
    expectedKeys: ['openInterest.condition', 'price.breakout_up', 'action.open_long'],
    canonicalMustBuild: true,
  },
  {
    id: 'A2',
    prompt: 'OKX 合约 BTCUSDT 15m，价格触及指标下边界时开多，每次固定 100 USDT，使用 5 倍杠杆，并用 ATR14 的 2 倍止损。',
    expectedKeys: ['price.detect.indicator_boundary', 'action.open_long', 'risk.atr_stop', 'position.fixed_notional', 'position.leverage'],
    canonicalMustBuild: true,
  },
  {
    id: 'A3',
    prompt: 'OKX 合约 BTCUSDT 15m，RSI14 高于 70 时用限价单减仓 50%，突破 70000 后下条件单开多。',
    expectedKeys: ['oscillator.rsi_gte', 'action.reduce_position', 'action.limit_order', 'price.breakout_up', 'action.conditional_order', 'action.open_long'],
    canonicalMustBuild: true,
  },
  {
    id: 'A4',
    prompt: 'OKX 合约 BTCUSDT 1h，启用 DCA 程序，每回撤 3% 买入一次，最多执行 5 次。',
    expectedKeys: ['program.dca'],
    forbiddenOpenSlots: ['position.sizing', 'rulesMainflow.missing_exit_rules'],
    canonicalMustBuild: true,
  },
  {
    id: 'A5',
    prompt: 'OKX 现货 BTC 和 ETH 做 50% 50% 等权组合，每天执行 rebalance 再平衡。',
    expectedKeys: ['program.rebalance'],
    expectedText: ['BTCUSDT', 'ETHUSDT', 'spot'],
    forbiddenOpenSlots: ['position.sizing', 'rulesMainflow.missing_exit_rules'],
    canonicalMustBuild: true,
  },
  {
    id: 'A6',
    prompt: 'OKX 合约 BTCUSDT 和 ETHUSDT 做多空双腿价差，BTC 腿做多、ETH 腿做空，价差扩大时开仓。',
    expectedKeys: ['orderbook.spread_condition', 'scope.leg', 'action.open_long', 'action.open_short'],
    expectedText: ['BTCUSDT', 'ETHUSDT'],
    canonicalMustBuild: true,
  },
  {
    id: 'A7',
    prompt: 'OKX BTCUSDT 永续 1m，盘口价差小于 0.03% 且买一卖一深度比超过 2 倍时，只用 post-only 限价单开多，亏损 1% 止损。',
    expectedKeys: ['orderbook.spread_condition', 'orderbook.depth_ratio', 'execution.post_only', 'action.limit_order', 'action.open_long', 'risk.stop_loss_pct'],
    forbiddenOpenSlots: ['position.sizing', 'rulesMainflow.missing_entry_rules'],
    canonicalMustBuild: true,
  },
  {
    id: 'A8',
    prompt: 'OKX 合约 BTC 和 ETH 15m，EMA20 上穿 EMA50 开多。账户当天亏损超过 5% 后停止新开仓，最多同时持有 3 个仓位。',
    expectedKeys: ['indicator.cross_over', 'action.open_long', 'risk.daily_loss_limit', 'risk.kill_switch', 'position.max_concurrent_positions'],
    expectedText: ['BTCUSDT', 'ETHUSDT'],
    canonicalMustBuild: true,
  },
  {
    id: 'A9',
    prompt: 'BTCUSDT 5m，RSI14 高于 70 时 reduce-only 限价平多，如果 3 根 K 线没成交就追价一次。',
    expectedKeys: ['oscillator.rsi_gte', 'execution.reduce_only', 'action.limit_order', 'action.close_long', 'execution.limit_chase'],
    forbiddenOpenSlots: ['position.sizing', 'rulesMainflow.missing_entry_rules'],
    canonicalMustBuild: true,
  },
  {
    id: 'B1',
    prompt: 'OKX 永续 BTCUSDT 和 ETHUSDT 15m 都按 EMA20 上穿 EMA50 开多，单笔使用 10% 仓位，亏损 3% 止损。',
    expectedKeys: ['indicator.cross_over', 'action.open_long', 'risk.stop_loss_pct', 'position.sizing'],
    expectedText: ['BTCUSDT', 'ETHUSDT'],
    canonicalMustBuild: true,
  },
  {
    id: 'B2',
    prompt: 'BTCUSDT 15m。EMA20 上穿开多，但需要 OKX orderbook imbalance 大于 60% 确认。',
    expectedKeys: ['indicator.cross_over', 'orderbook.imbalance', 'action.open_long'],
    forbiddenOpenSlots: ['position.sizing', 'rulesMainflow.missing_exit_rules'],
    canonicalMustBuild: true,
  },
  {
    id: 'B3',
    prompt: 'OKX 合约 BTCUSDT 15m，价格维持在震荡区间内时开多，单笔 10% 仓位。跌破震荡区间下沿时平多。',
    expectedKeys: ['pattern.range', 'action.open_long', 'position.sizing', 'price.range_position_lte', 'action.close_long'],
    canonicalMustBuild: true,
  },
  {
    id: 'B4',
    prompt: 'OKX 合约 BTCUSDT 15m，开启马丁程序，亏损后按 2 倍补单，最多补 3 次。',
    expectedKeys: ['program.martingale'],
    forbiddenOpenSlots: ['rulesMainflow.missing_exit_rules'],
    canonicalMustBuild: true,
  },
  {
    id: 'B5',
    prompt: 'OKX 合约 BTCUSDT 15m，突破 70000 后用 iceberg 冰山单买入 1000 USDT，拆成每次 100 USDT。',
    expectedKeys: ['price.breakout_up', 'program.iceberg', 'action.open_long'],
    forbiddenOpenSlots: ['rulesMainflow.missing_exit_rules'],
    canonicalMustBuild: true,
  },
]

describe('staging 14 strategy mainflow regression matrix', () => {
  const dispatcher = new GenericSeedDispatcher()
  const seedBuilder = new SemanticSeedStateBuilderService()
  const rulesReader = new RulesMainflowReaderService()
  const classifier = new SemanticSupportClassifierService(new SemanticAtomRegistryService())
  const canonicalBuilder = new CanonicalSpecBuilderService()
  const noop = () => undefined
  const stubObj = new Proxy({}, { get: () => noop }) as never
  const conversation = new CodegenConversationService(
    stubObj,
    stubObj,
    stubObj,
    stubObj,
    stubObj,
    stubObj,
    stubObj,
    stubObj,
    stubObj,
    stubObj,
    stubObj,
  ) as unknown as {
    normalizeSemanticContractReadiness: (state: SemanticState, strategyVersion: { deployedAtSemanticVersion: string | null }) => SemanticState
  }

  function buildState(prompt: string): SemanticState {
    const patch = dispatcher.dispatch(prompt) as CodegenSemanticPatch
    const state = seedBuilder.build(patch, prompt)
    expect(state).not.toBeNull()
    return conversation.normalizeSemanticContractReadiness(
      state as SemanticState,
      { deployedAtSemanticVersion: CURRENT_SEMANTIC_VERSION },
    )
  }

  function keysFrom(state: SemanticState): string[] {
    return rulesReader.readFacts(state).map(fact => fact.key)
  }

  it.each(CASES)('$id keeps supported strategy semantics in rules mainflow', (testCase) => {
    const state = buildState(testCase.prompt)
    const keys = keysFrom(state)

    expect(keys).toEqual(expect.arrayContaining(testCase.expectedKeys))
    if (testCase.expectedText) {
      const serialized = JSON.stringify(state)
      for (const text of testCase.expectedText) {
        expect(serialized).toContain(text)
      }
    }
  })

  it.each(CASES.filter(testCase => testCase.forbiddenOpenSlots?.length))('$id does not ask slots already answered by supported strategy semantics', (testCase) => {
    const state = buildState(testCase.prompt)
    const classification = classifier.classify(state)
    const openSlotKeys = classification.openSlots.map(slot => slot.slotKey)

    expect(openSlotKeys).not.toEqual(expect.arrayContaining(testCase.forbiddenOpenSlots ?? []))
  })

  it.each(CASES.filter(testCase => testCase.canonicalMustBuild))('$id projects rules mainflow into canonical spec without unsupported fallback', (testCase) => {
    const state = buildState(testCase.prompt)
    const spec = canonicalBuilder.buildFromSemanticState(state)
    const serialized = JSON.stringify(spec)
    const executableSurfaceCount = spec.rules.length
      + spec.orderPrograms.length
      + (spec.orchestration?.programs?.length ?? 0)

    expect(executableSurfaceCount).toBeGreaterThan(0)
    expect(serialized).toContain(testCase.expectedKeys[0])
    if (testCase.expectedText) {
      for (const text of testCase.expectedText) {
        expect(serialized).toContain(text)
      }
    }
  })

  it('repairs pair-spread leg entry when planner mislabels 做空 leg as close/exit', () => {
    const prompt = 'OKX 合约 BTCUSDT 和 ETHUSDT 做多空双腿价差，BTC 腿做多、ETH 腿做空，价差扩大时开仓。'
    const rules = (dispatcher as unknown as {
      buildTypedRulesFromFlatPatch: (patch: CodegenSemanticPatch, message: string) => SemanticState['rules']
    }).buildTypedRulesFromFlatPatch({
      triggers: [{ key: 'orderbook.spread_condition', phase: 'exit', params: { operator: 'lt', valuePct: 0.03 } }],
      actions: [{ key: 'action.close_long', phase: 'exit', params: {} }],
    } as CodegenSemanticPatch, prompt)

    expect(rules).toHaveLength(1)
    expect(rules[0]?.phase).toBe('entry')
    expect(rules[0]?.condition.key).toBe('orderbook.spread_condition')
    expect(rules[0]?.effects.actions.map(action => action.key)).toEqual(expect.arrayContaining(['action.open_long', 'action.open_short']))
    expect(rules[0]?.effects.actions.map(action => action.key)).not.toContain('action.close_long')
  })
})
