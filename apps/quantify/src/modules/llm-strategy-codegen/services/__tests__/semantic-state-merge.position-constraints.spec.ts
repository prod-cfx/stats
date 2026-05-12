import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
import { SemanticStateMergeService } from '../semantic-state-merge.service'
import type { SemanticState } from '../../types/semantic-state'

/**
 * 回归：conversation planner LLM 经常只回 position.sizing 不回 position.dca_schedule
 * constraint（prompt 没列 constraints schema）。早期 mergePosition 用 {...weaker, ...stronger}
 * 整段覆盖 constraints 字段，stronger 一旦显式给 `constraints: []` 就会把 seed 抽出的
 * locked dca_schedule / pyramiding_limit 抹掉，导致 UI summary 出现"仓位：100 USDT"
 * 但丢掉 DCA 段。修复后改为按 key union 合并，每个 key 内部按 strength 取强。
 */

describe('semantic-state-merge — position.constraints union merge', () => {
  const extractor = new SemanticSeedExtractorService()
  const builder = new SemanticSeedStateBuilderService()
  const mergeSvc = new SemanticStateMergeService()

  const utterance
    = 'OKX 现货 BTCUSDT 1h，RSI14 低于 30 开始 DCA，价格每跌 5% 补仓一次，每次 100 USDT，最多 4 次，总投入不超过 500 USDT，RSI14 高于 70 卖出。'

  function buildDerivedSizingOnlyPosition(): SemanticState {
    return {
      version: 1,
      families: [],
      triggers: [],
      actions: [],
      risk: [],
      position: {
        mode: 'fixed_quote',
        value: 100,
        status: 'locked',
        source: 'user_explicit',
        positionMode: 'long_only',
        sizing: { kind: 'quote', value: 100, asset: 'USDT' },
        constraints: [],
      } as any,
      contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
      normalizationNotes: [],
      updatedAt: new Date().toISOString(),
    }
  }

  it('persisted locked dca_schedule survives merge with derived planner patch lacking constraints (explicit constraints:[])', () => {
    const patch = extractor.extract(utterance)
    const persisted = builder.build(patch)!
    const derived = buildDerivedSizingOnlyPosition()

    const merged = mergeSvc.merge({ persisted, derived })

    const dca = merged.position?.constraints?.find(c => c.key === 'position.dca_schedule')
    expect(dca).toBeDefined()
    expect(dca!.status).toBe('locked')
    expect((dca!.params as any).maxCount).toBe(4)
    expect((dca!.params as any).triggerMode).toBe('price_interval')
  })

  it('derived adds new constraint key while persisted has dca_schedule — both survive', () => {
    const patch = extractor.extract(utterance)
    const persisted = builder.build(patch)!

    const derived: SemanticState = {
      ...buildDerivedSizingOnlyPosition(),
      position: {
        ...(buildDerivedSizingOnlyPosition().position as any),
        constraints: [
          {
            id: 'derived-pyramiding',
            key: 'position.pyramiding_limit',
            status: 'locked',
            source: 'user_explicit',
            params: { maxLayers: 3 },
            openSlots: [],
          },
        ],
      } as any,
    }

    const merged = mergeSvc.merge({ persisted, derived })
    const keys = (merged.position?.constraints ?? []).map(c => c.key)
    expect(keys).toContain('position.dca_schedule')
    expect(keys).toContain('position.pyramiding_limit')
  })

  it('same key collision — locked persisted beats open derived', () => {
    const patch = extractor.extract(utterance)
    const persisted = builder.build(patch)!

    const derived: SemanticState = {
      ...buildDerivedSizingOnlyPosition(),
      position: {
        ...(buildDerivedSizingOnlyPosition().position as any),
        constraints: [
          {
            id: 'derived-dca-weak',
            key: 'position.dca_schedule',
            status: 'open',
            source: 'inferred',
            params: { maxCount: 999 },
            openSlots: [],
          },
        ],
      } as any,
    }

    const merged = mergeSvc.merge({ persisted, derived })
    const dca = merged.position?.constraints?.find(c => c.key === 'position.dca_schedule')
    expect(dca?.status).toBe('locked')
    expect((dca!.params as any).maxCount).toBe(4)
  })
})

/**
 * 第二层回归：广覆盖 DCA 话术语料 ——
 * 不是修一句"用户原话"，而是要把"任何会被 seed extractor 识别为 dca_schedule 的话术"
 * 都过一遍 merge 路径，保证 planner LLM 哪怕用空 constraints patch 覆盖，DCA 都不会丢。
 * 触发模式 / 限次 / 资金上限 / 退出规则 / 中英文 / 单句无上下文 都要覆盖。
 */
describe('semantic-state-merge — DCA wording corpus survives planner empty-constraints merge', () => {
  const extractor = new SemanticSeedExtractorService()
  const builder = new SemanticSeedStateBuilderService()
  const mergeSvc = new SemanticStateMergeService()

  function derivedEmptyConstraints(): SemanticState {
    return {
      version: 1,
      families: [],
      triggers: [],
      actions: [],
      risk: [],
      position: {
        mode: 'fixed_quote',
        value: 100,
        status: 'locked',
        source: 'user_explicit',
        positionMode: 'long_only',
        sizing: { kind: 'quote', value: 100, asset: 'USDT' },
        constraints: [],
      } as any,
      contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
      normalizationNotes: [],
      updatedAt: new Date().toISOString(),
    }
  }

  type CorpusCase = {
    label: string
    utterance: string
    expectTriggerMode?: 'price_interval' | 'time_interval' | 'signal'
    expectMaxCount?: number
    expectPriceIntervalPct?: number
    expectPerOrderSizingQuote?: number
    expectCapitalCapQuote?: number
    expectExitRuleDefined?: boolean
  }

  const cases: CorpusCase[] = [
    {
      label: '用户原话：RSI14<30 触发 DCA + 每跌 5% + 100 USDT × 4 次 + 500 USDT cap',
      utterance: 'OKX 现货 BTCUSDT 1h，RSI14 低于 30 开始 DCA，价格每跌 5% 补仓一次，每次 100 USDT，最多 4 次，总投入不超过 500 USDT，RSI14 高于 70 卖出。',
      expectTriggerMode: 'price_interval',
      expectPriceIntervalPct: 5,
      expectMaxCount: 4,
      expectPerOrderSizingQuote: 100,
      expectCapitalCapQuote: 500,
    },
    {
      label: '简化：每跌 2% 补仓 + 最多 3 次',
      utterance: '每跌 2% 补仓一次，最多 3 次。',
      expectTriggerMode: 'price_interval',
      expectPriceIntervalPct: 2,
      expectMaxCount: 3,
    },
    {
      label: '每跌 5% + 每次 100 USDT + 最多 4 次 + cap 500 + 跌破前低停止',
      utterance: '每跌 5% 补仓一次，每次 100 USDT，最多 4 次，总投入不超过 500 USDT，跌破前低停止。',
      expectTriggerMode: 'price_interval',
      expectPriceIntervalPct: 5,
      expectMaxCount: 4,
      expectPerOrderSizingQuote: 100,
      expectCapitalCapQuote: 500,
      expectExitRuleDefined: true,
    },
    {
      label: '"定投补仓" + capital cap + 最多 4 次',
      utterance: 'OKX 合约 BTCUSDT 15m，MA20 上穿 MA50 开多，定投补仓，总投入不超过 500 USDT，最多 4 次，每次 100 USDT，跌破前低停止补仓。',
      expectMaxCount: 4,
      expectPerOrderSizingQuote: 100,
      expectCapitalCapQuote: 500,
      expectExitRuleDefined: true,
    },
    {
      label: '"DCA" 大写英文动词触发',
      utterance: 'OKX 现货 BTCUSDT 1h，启动 DCA，每跌 3% 补仓 50 USDT，最多 5 次。',
      expectTriggerMode: 'price_interval',
      expectPriceIntervalPct: 3,
      expectMaxCount: 5,
      expectPerOrderSizingQuote: 50,
    },
    {
      label: '"定投" 时间间隔模式 — 每天补仓 100 USDT × 30 次',
      utterance: 'OKX 合约 BTCUSDT 15m，MA20 上穿 MA50 开多，每天定投补仓 100 USDT，最多 30 次，总投入 3000 USDT，跌破前低停止补仓。',
      expectTriggerMode: 'time_interval',
      expectMaxCount: 30,
      expectPerOrderSizingQuote: 100,
      expectCapitalCapQuote: 3000,
      expectExitRuleDefined: true,
    },
    {
      label: '英文 DCA / drops 2% / max 3 / total 500 / break prev low stop',
      utterance: 'DCA every time price drops 2%, each order 100 USDT, max 3 times, total capital 500 USDT, stop if previous low breaks.',
      expectTriggerMode: 'price_interval',
      expectPriceIntervalPct: 2,
    },
    {
      label: '只有最多 3 次（其余 slot 缺失）',
      utterance: 'OKX 合约 BTCUSDT 15m，MA20 上穿 MA50 开多，定投补仓最多 3 次。',
      expectMaxCount: 3,
    },
    {
      label: '只指定每次 50 USDT 补仓（其余 slot 缺失）',
      utterance: 'OKX 合约 BTCUSDT 15m，定投补仓 每次 50 USDT。',
      expectPerOrderSizingQuote: 50,
    },
    {
      label: '"DCA 触发" 信号驱动模式',
      utterance: 'OKX 现货 BTCUSDT 1h，RSI14 低于 30 信号触发 DCA，每次 100 USDT，最多 4 次。',
      expectTriggerMode: 'signal',
      expectMaxCount: 4,
      expectPerOrderSizingQuote: 100,
    },
  ]

  for (const c of cases) {
    it(`seed extractor recognizes dca_schedule — ${c.label}`, () => {
      const patch = extractor.extract(c.utterance)
      const constraint = patch.position?.constraints?.find(item => item.key === 'position.dca_schedule')
      expect(constraint).toBeDefined()
      if (c.expectTriggerMode) {
        expect((constraint!.params as any)?.triggerMode).toBe(c.expectTriggerMode)
      }
      if (typeof c.expectMaxCount === 'number') {
        expect((constraint!.params as any)?.maxCount).toBe(c.expectMaxCount)
      }
      if (typeof c.expectPriceIntervalPct === 'number') {
        expect((constraint!.params as any)?.priceIntervalPct).toBe(c.expectPriceIntervalPct)
      }
      if (typeof c.expectPerOrderSizingQuote === 'number') {
        const perOrder = (constraint!.params as any)?.perOrderSizing
        expect(perOrder?.kind).toBe('quote')
        expect(perOrder?.value).toBe(c.expectPerOrderSizingQuote)
      }
      if (typeof c.expectCapitalCapQuote === 'number') {
        const cap = (constraint!.params as any)?.capitalCap
        expect(cap?.kind).toBe('quote')
        expect(cap?.value).toBe(c.expectCapitalCapQuote)
      }
      if (c.expectExitRuleDefined) {
        expect((constraint!.params as any)?.exitRule).toBeDefined()
      }
    })

    it(`survives merge with planner empty-constraints patch — ${c.label}`, () => {
      const patch = extractor.extract(c.utterance)
      const persisted = builder.build(patch)
      expect(persisted).not.toBeNull()
      const seedDca = persisted!.position?.constraints?.find(item => item.key === 'position.dca_schedule')
      expect(seedDca).toBeDefined()

      const merged = mergeSvc.merge({ persisted: persisted!, derived: derivedEmptyConstraints() })
      const mergedDca = merged.position?.constraints?.find(item => item.key === 'position.dca_schedule')
      expect(mergedDca).toBeDefined()
      // 关键不变量：merge 不能把 seed 抽出的 dca_schedule 抹掉
      // 状态不必强制 locked（slot 不全时 seed builder 会给 open），但必须存在
      expect(['locked', 'open']).toContain(mergedDca!.status)

      // 关键参数不能丢
      if (typeof c.expectMaxCount === 'number') {
        expect((mergedDca!.params as any)?.maxCount).toBe(c.expectMaxCount)
      }
      if (c.expectTriggerMode) {
        expect((mergedDca!.params as any)?.triggerMode).toBe(c.expectTriggerMode)
      }
    })
  }
})
