import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
import { SemanticStateMergeService } from '../semantic-state-merge.service'
import type {
  SemanticPositionConstraintKey,
  SemanticPositionConstraintState,
  SemanticPositionState,
  SemanticState,
} from '../../types/semantic-state'

/**
 * 回归：conversation planner LLM 经常只回 position.sizing 不回 position.dca_schedule
 * constraint（prompt 没列 constraints schema）。早期 mergePosition 用 {...weaker, ...stronger}
 * 整段覆盖 constraints 字段，stronger 一旦显式给 `constraints: []` 就会把 seed 抽出的
 * locked dca_schedule / pyramiding_limit 抹掉，导致 UI summary 出现"仓位：100 USDT"
 * 但丢掉 DCA 段。修复后改为按 key union 合并，每个 key 内部按 strength 取强。
 */

type ConstraintParams = Record<string, unknown>
type SizingSubObject = { kind: 'quote' | 'base'; value: number; asset: string }

function makeConstraint(input: {
  id?: string
  key: SemanticPositionConstraintKey
  status?: SemanticPositionConstraintState['status']
  source?: SemanticPositionConstraintState['source']
  params?: ConstraintParams
  openSlots?: SemanticPositionConstraintState['openSlots']
}): SemanticPositionConstraintState {
  return {
    id: input.id ?? `test-${input.key.replace(/\./g, '-')}`,
    key: input.key,
    status: input.status ?? 'locked',
    source: input.source ?? 'user_explicit',
    params: input.params ?? {},
    openSlots: input.openSlots ?? [],
  }
}

function makePositionState(
  position: Partial<SemanticPositionState> & Pick<SemanticPositionState, 'mode' | 'value' | 'positionMode' | 'status' | 'source'>,
): SemanticState {
  return {
    version: 1,
    families: [],
    triggers: [],
    actions: [],
    risk: [],
    position,
    contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
    normalizationNotes: [],
    updatedAt: new Date().toISOString(),
  }
}

function buildDerivedSizingOnlyPosition(): SemanticState {
  return makePositionState({
    mode: 'fixed_quote',
    value: 100,
    status: 'locked',
    source: 'user_explicit',
    positionMode: 'long_only',
    sizing: { kind: 'quote', value: 100, asset: 'USDT' },
    constraints: [],
  })
}

describe('semantic-state-merge — position.constraints union merge', () => {
  const extractor = new SemanticSeedExtractorService()
  const builder = new SemanticSeedStateBuilderService()
  const mergeSvc = new SemanticStateMergeService()

  const utterance
    = 'OKX 现货 BTCUSDT 1h，RSI14 低于 30 开始 DCA，价格每跌 5% 补仓一次，每次 100 USDT，最多 4 次，总投入不超过 500 USDT，RSI14 高于 70 卖出。'

  it('persisted locked dca_schedule survives merge with derived planner patch lacking constraints (explicit constraints:[])', () => {
    const patch = extractor.extract(utterance)
    const persisted = builder.build(patch)!
    const derived = buildDerivedSizingOnlyPosition()

    const merged = mergeSvc.merge({ persisted, derived })

    const constraints = merged.position?.constraints ?? []
    expect(constraints.filter(c => c.key === 'position.dca_schedule')).toHaveLength(1)
    const dca = constraints.find(c => c.key === 'position.dca_schedule')!
    expect(dca.status).toBe('locked')
    const params = dca.params as Record<string, unknown>
    expect(params.maxCount).toBe(4)
    expect(params.triggerMode).toBe('price_interval')
    // M6 修复：必须断言 perOrderSizing / capitalCap 内嵌 discriminated-union 字段完整保留，
    // 否则 mergePositionConstraintParams 退化为顶层 spread 时无法及时报警
    expect(params.perOrderSizing).toEqual({ kind: 'quote', value: 100, asset: 'USDT' })
    expect(params.capitalCap).toEqual({ kind: 'quote', value: 500, asset: 'USDT' })
  })

  it('derived adds new constraint key while persisted has dca_schedule — both survive', () => {
    const patch = extractor.extract(utterance)
    const persisted = builder.build(patch)!

    const derived: SemanticState = makePositionState({
      ...(buildDerivedSizingOnlyPosition().position as SemanticPositionState),
      constraints: [
        makeConstraint({
          id: 'derived-pyramiding',
          key: 'position.pyramiding_limit',
          params: { maxLayers: 3 },
        }),
      ],
    })

    const merged = mergeSvc.merge({ persisted, derived })
    const constraints = merged.position?.constraints ?? []
    const keys = constraints.map(c => c.key)
    expect(keys).toContain('position.dca_schedule')
    expect(keys).toContain('position.pyramiding_limit')
    expect(constraints).toHaveLength(2)
  })

  it('same key collision — locked persisted beats open derived', () => {
    const patch = extractor.extract(utterance)
    const persisted = builder.build(patch)!

    const derived: SemanticState = makePositionState({
      ...(buildDerivedSizingOnlyPosition().position as SemanticPositionState),
      constraints: [
        makeConstraint({
          id: 'derived-dca-weak',
          key: 'position.dca_schedule',
          status: 'open',
          source: 'inferred',
          params: { maxCount: 999 },
        }),
      ],
    })

    const merged = mergeSvc.merge({ persisted, derived })
    const dca = merged.position?.constraints?.find(c => c.key === 'position.dca_schedule')
    expect(dca?.status).toBe('locked')
    expect((dca!.params as Record<string, unknown>).maxCount).toBe(4)
  })

  it('M1 nested sub-object — derived patch with partial perOrderSizing must NOT flatten persisted contract', () => {
    // 直接断言 M1 修复：mergePositionConstraintParams 对 perOrderSizing 这类 plain object
    // 字段必须做内层 spread，不能把 stronger 的 `{ value: 50 }` 整段替换 weaker 的
    // `{ kind:'quote', value:100, asset:'USDT' }` —— 否则 SemanticPositionSizingContract
    // discriminated-union 形态破坏，下游序列化报错。
    const persistedFull = makePositionState({
      mode: 'fixed_quote',
      value: 0,
      positionMode: 'long_only',
      status: 'locked',
      source: 'user_explicit',
      constraints: [
        makeConstraint({
          key: 'position.dca_schedule',
          status: 'locked',
          source: 'inferred',
          params: {
            maxCount: 4,
            triggerMode: 'price_interval',
            priceIntervalPct: 5,
            perOrderSizing: { kind: 'quote', value: 100, asset: 'USDT' } satisfies SizingSubObject,
            capitalCap: { kind: 'quote', value: 500, asset: 'USDT' } satisfies SizingSubObject,
          },
        }),
      ],
    })

    const derivedPartial: SemanticState = makePositionState({
      mode: 'fixed_quote',
      value: 0,
      positionMode: 'long_only',
      status: 'locked',
      source: 'user_explicit',
      constraints: [
        makeConstraint({
          key: 'position.dca_schedule',
          // 同状态同源：触发 tie-break，stronger=derived（因为 `> 0` 等强偏 derived）
          status: 'locked',
          source: 'inferred',
          params: {
            // 只回部分字段：value 想覆盖到 50，但 kind/asset 缺失
            perOrderSizing: { value: 50 },
          },
        }),
      ],
    })

    const merged = mergeSvc.merge({ persisted: persistedFull, derived: derivedPartial })
    const dca = merged.position?.constraints?.find(c => c.key === 'position.dca_schedule')!
    const params = dca.params as Record<string, unknown>

    // 顶层标量没被压扁
    expect(params.maxCount).toBe(4)
    expect(params.triggerMode).toBe('price_interval')
    expect(params.priceIntervalPct).toBe(5)

    // 关键：perOrderSizing sub-object 字段级合并，value 更新但 kind/asset 不丢
    expect(params.perOrderSizing).toEqual({ kind: 'quote', value: 50, asset: 'USDT' })

    // capitalCap derived 未涉及，整段保留
    expect(params.capitalCap).toEqual({ kind: 'quote', value: 500, asset: 'USDT' })
  })

  it('M4 deep clone — merging must NOT mutate caller persisted/derived references', () => {
    // 防回归：旧版本直接 byKey.set(constraint, constraint) 入引用，下游 normalize 会反向污染入参
    const persistedDca = makeConstraint({
      key: 'position.dca_schedule',
      params: { maxCount: 3, marker: 'persisted-original' },
    })
    const derivedDca = makeConstraint({
      key: 'position.dca_schedule',
      status: 'open',
      source: 'inferred',
      params: { maxCount: 5, marker: 'derived-original' },
    })

    const persistedSnapshot = JSON.stringify(persistedDca)
    const derivedSnapshot = JSON.stringify(derivedDca)

    const persisted: SemanticState = makePositionState({
      mode: 'constraint_only',
      value: 0,
      positionMode: 'long_only',
      status: 'locked',
      source: 'user_explicit',
      constraints: [persistedDca],
    })
    const derived: SemanticState = makePositionState({
      mode: 'constraint_only',
      value: 0,
      positionMode: 'long_only',
      status: 'locked',
      source: 'user_explicit',
      constraints: [derivedDca],
    })

    const merged = mergeSvc.merge({ persisted, derived })
    const mergedDca = merged.position?.constraints?.find(c => c.key === 'position.dca_schedule')
    expect(mergedDca).toBeDefined()
    // 改 merged.params 不应反向污染入参
    ;(mergedDca!.params as Record<string, unknown>).marker = 'mutated-by-test'
    expect(JSON.stringify(persistedDca)).toBe(persistedSnapshot)
    expect(JSON.stringify(derivedDca)).toBe(derivedSnapshot)
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
      label: '"DCA" 大写英文动词触发 — 每跌 3% × 50 USDT × 5 次',
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
      // NOTE: seed extractor 当前对英文 utterance 仅识别 triggerMode='price_interval'，
      // 不抽 maxCount/priceIntervalPct/perOrderSizing/capitalCap（参见 utterance-corpus
      // 中 `position-dca-schedule-en-locked-price-drop` 的 openSlotKeys）。本 case 只
      // 断言 merge 不丢已识别的字段——英文 NLP 增强应作为独立 issue 跟进。
      label: '英文 DCA / drops 2% — extractor 仅识别 triggerMode（其余 slot 缺失，nlp 限制）',
      utterance: 'DCA every time price drops 2%, each order 100 USDT, max 3 times, total capital 500 USDT, stop if previous low breaks.',
      expectTriggerMode: 'price_interval',
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
      const params = constraint!.params as Record<string, unknown>
      if (c.expectTriggerMode) {
        expect(params.triggerMode).toBe(c.expectTriggerMode)
      }
      if (typeof c.expectMaxCount === 'number') {
        expect(params.maxCount).toBe(c.expectMaxCount)
      }
      if (typeof c.expectPriceIntervalPct === 'number') {
        expect(params.priceIntervalPct).toBe(c.expectPriceIntervalPct)
      }
      if (typeof c.expectPerOrderSizingQuote === 'number') {
        expect(params.perOrderSizing).toEqual(
          expect.objectContaining({ kind: 'quote', value: c.expectPerOrderSizingQuote, asset: 'USDT' }),
        )
      }
      if (typeof c.expectCapitalCapQuote === 'number') {
        expect(params.capitalCap).toEqual(
          expect.objectContaining({ kind: 'quote', value: c.expectCapitalCapQuote, asset: 'USDT' }),
        )
      }
      if (c.expectExitRuleDefined) {
        expect(params.exitRule).toBeDefined()
      }
    })

    it(`survives merge with planner empty-constraints patch — ${c.label}`, () => {
      const patch = extractor.extract(c.utterance)
      const persisted = builder.build(patch)
      expect(persisted).not.toBeNull()
      const seedDca = persisted!.position?.constraints?.find(item => item.key === 'position.dca_schedule')
      expect(seedDca).toBeDefined()

      const merged = mergeSvc.merge({ persisted: persisted!, derived: buildDerivedSizingOnlyPosition() })
      const allConstraints = merged.position?.constraints ?? []
      // 数组完整性：每个 key 只能存在一份，dca_schedule 必须有且仅有 1 份
      const dcaConstraints = allConstraints.filter(item => item.key === 'position.dca_schedule')
      expect(dcaConstraints).toHaveLength(1)
      const mergedDca = dcaConstraints[0]!
      // status 必须是 locked 或 open，不能被弱化到 superseded
      expect(['locked', 'open']).toContain(mergedDca.status)

      const mergedParams = mergedDca.params as Record<string, unknown>

      // 关键参数与 seed 完全一致 —— derived 没回任何 dca 字段，应该原封不动
      const seedParams = (seedDca!.params ?? {}) as Record<string, unknown>
      if (typeof c.expectMaxCount === 'number') {
        expect(mergedParams.maxCount).toBe(c.expectMaxCount)
      }
      if (c.expectTriggerMode) {
        expect(mergedParams.triggerMode).toBe(c.expectTriggerMode)
      }
      if (typeof c.expectPriceIntervalPct === 'number') {
        expect(mergedParams.priceIntervalPct).toBe(c.expectPriceIntervalPct)
      }
      if (typeof c.expectPerOrderSizingQuote === 'number') {
        // 嵌套对象保留完整 discriminated-union 形态（kind + value + asset），不能被压扁
        expect(mergedParams.perOrderSizing).toEqual(seedParams.perOrderSizing)
      }
      if (typeof c.expectCapitalCapQuote === 'number') {
        expect(mergedParams.capitalCap).toEqual(seedParams.capitalCap)
      }
      if (c.expectExitRuleDefined) {
        expect(mergedParams.exitRule).toEqual(seedParams.exitRule)
      }
    })
  }
})
