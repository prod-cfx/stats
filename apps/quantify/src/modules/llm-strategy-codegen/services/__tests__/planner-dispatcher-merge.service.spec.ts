import type { CodegenSemanticPatch } from '../../types/codegen-semantic-patch'
import { collectAtomLeaves, listRuleEffects } from '../../types/atom-expr'
import { GenericSeedDispatcher } from '../generic-seed-dispatcher.service'
import { PlannerDispatcherMergeService } from '../planner-dispatcher-merge.service'

describe.skip('PlannerDispatcherMergeService legacy five-bucket merge spec', () => {
  const svc = new PlannerDispatcherMergeService()

  it('returns null when both inputs are null/empty', () => {
    expect(svc.mergePlannerAndDispatcherPatches(null, null)).toBeNull()
    expect(svc.mergePlannerAndDispatcherPatches(undefined, undefined)).toBeNull()
    expect(svc.mergePlannerAndDispatcherPatches({}, {})).toBeNull()
  })

  it('returns planner content when only planner present', () => {
    const planner: CodegenSemanticPatch = { triggers: [{ key: 'trigger.candle_break_above', phase: 'entry' }] }
    // Issue #1443：planner-only 路径现在 clone（不再严格引用相等），且过滤 always-on
    //   action 噪音 rule；内容等价即可
    expect(svc.mergePlannerAndDispatcherPatches(planner, null)).toEqual(planner)
  })

  it('returns dispatcher unchanged when only dispatcher present', () => {
    const dispatcher: CodegenSemanticPatch = { atoms: [{ key: 'grid.range_rebalance' }] }
    expect(svc.mergePlannerAndDispatcherPatches(null, dispatcher)).toBe(dispatcher)
  })

  it('preserves dispatcher program phase when building rules fallback', () => {
    const dispatcher = {
      atoms: [
        {
          key: 'grid.range_rebalance',
          phase: 'program',
          sideScope: 'both',
          params: { centerOffsetPct: 0.4, levels: 10, perGridSizing: 10, sideMode: 'both' },
          evidence: { text: '上下各 0.4% 共 10 格，每格 10U' },
        },
        {
          key: 'program.fixed_grid_gated',
          phase: 'program',
          sideScope: 'both',
          params: { levelCount: 10, stepPct: 0.4 },
          evidence: { text: '上下各 0.4% 共 10 格，每格 10U' },
        },
      ],
    } as unknown as CodegenSemanticPatch

    const fallback = svc.buildRulesTreeFallbackFromDispatcher(dispatcher, '上下各 0.4% 共 10 格，每格 10U')
    const gridRule = fallback?.rules?.find(rule => rule.condition.kind === 'atom' && rule.condition.key === 'grid.range_rebalance')

    expect(gridRule?.phase).toBe('program')
    expect((gridRule?.effects as { programs?: unknown[] } | undefined)?.programs).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'program.fixed_grid_gated' }),
    ]))
  })

  it('dedupes atoms by (key, phase, stableParamsHash) — planner wins identity match', () => {
    const planner: CodegenSemanticPatch = {
      atoms: [{ key: 'trigger.candle_break_above', phase: 'entry', source: 'user_explicit' as never }],
    }
    const dispatcher: CodegenSemanticPatch = {
      atoms: [{ key: 'trigger.candle_break_above', phase: 'entry', source: 'derived' as never }],
    }
    const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
    expect(merged?.atoms).toHaveLength(1)
    expect((merged?.atoms?.[0] as { source?: string }).source).toBe('user_explicit')
  })

  it('keeps siblings with different params (different stable hash)', () => {
    const planner: CodegenSemanticPatch = {
      atoms: [{ key: 'reference.period', phase: 'entry', params: { value: 20 } }],
    }
    const dispatcher: CodegenSemanticPatch = {
      atoms: [{ key: 'reference.period', phase: 'entry', params: { value: 60 } }],
    }
    const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
    expect(merged?.atoms).toHaveLength(2)
  })

  it('cross-bucket complement: planner trigger atom + dispatcher positionConstraint atom both kept', () => {
    const planner: CodegenSemanticPatch = {
      atoms: [{ key: 'trigger.candle_break_above', phase: 'entry' }],
    }
    const dispatcher: CodegenSemanticPatch = {
      atoms: [{ key: 'grid.range_rebalance', params: { lower: 100, upper: 200 } }],
    }
    const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
    const keys = (merged?.atoms ?? []).map(a => a.key).sort()
    expect(keys).toEqual(['grid.range_rebalance', 'trigger.candle_break_above'])
  })

  it('contextSlots shallow-merges; planner wins when both have same field', () => {
    const planner: CodegenSemanticPatch = { contextSlots: { symbol: 'BTC' } }
    const dispatcher: CodegenSemanticPatch = { contextSlots: { symbol: 'ETH', timeframe: '15m' } }
    const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
    expect(merged?.contextSlots).toEqual({ symbol: 'BTC', timeframe: '15m' })
  })

  it('position: only dispatcher → returned as-is', () => {
    const dispatcher: CodegenSemanticPatch = {
      position: { mode: 'fixed', value: 100, positionMode: 'one-way' } as never,
    }
    const merged = svc.mergePlannerAndDispatcherPatches(null, dispatcher)
    expect(merged?.position?.value).toBe(100)
  })

  it('position: both present → dispatcher preferred, constraints union+dedup', () => {
    const planner: CodegenSemanticPatch = {
      position: {
        mode: 'fixed',
        value: 50,
        positionMode: 'one-way',
        constraints: [
          { key: 'position.dca_schedule' as never, params: { step: 1 } },
          { key: 'position.size_cap' as never, params: { cap: 0.5 } },
        ],
      } as never,
    }
    const dispatcher: CodegenSemanticPatch = {
      position: {
        mode: 'fixed',
        value: 100,
        positionMode: 'one-way',
        constraints: [
          { key: 'position.dca_schedule' as never, params: { step: 1 } },
          { key: 'position.max_leverage' as never, params: { x: 3 } },
        ],
      } as never,
    }
    const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
    expect(merged?.position?.value).toBe(100)
    const keys = (merged?.position?.constraints ?? []).map(c => c.key).sort()
    expect(keys).toEqual(['position.dca_schedule', 'position.max_leverage', 'position.size_cap'])
  })

  it('orchestration.nodes union: planner empty, dispatcher has program.event_listener', () => {
    const dispatcher: CodegenSemanticPatch = {
      orchestration: { nodes: [{ key: 'program.event_listener', kind: 'program' } as never] },
    }
    const merged = svc.mergePlannerAndDispatcherPatches({ triggers: [{ key: 't', phase: 'entry' }] }, dispatcher)
    expect(merged?.orchestration?.nodes).toHaveLength(1)
    expect((merged?.orchestration?.nodes?.[0] as { key: string }).key).toBe('program.event_listener')
  })

  it('S1 scenario: planner trigger/action/risk + dispatcher grid.range_rebalance atom → all buckets populated', () => {
    const planner: CodegenSemanticPatch = {
      triggers: [{ key: 'trigger.candle_break_above', phase: 'entry' }],
      actions: [{ key: 'action.open_long' }],
      risk: [{ key: 'risk.stop_loss_atr', params: { multiplier: 2 } }],
    }
    const dispatcher: CodegenSemanticPatch = {
      atoms: [{ key: 'grid.range_rebalance', params: { lower: 100, upper: 200 } }],
    }
    const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
    expect(merged?.triggers).toHaveLength(1)
    expect(merged?.actions).toHaveLength(1)
    expect(merged?.risk).toHaveLength(1)
    expect(merged?.atoms?.[0].key).toBe('grid.range_rebalance')
  })

  // Issue #1395 Wave 4：rules[] 表达式树是 planner 独有产物，必须被 merge 透传，
  // 否则下游 readiness / projection / IR compiler 全部退化到 atoms[] 路径。
  it('Wave 4: propagates planner rules[] through merge (planner-only)', () => {
    const planner = {
      rules: [{
        id: 'entry-seq',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'oscillator.rsi_lte', params: { period: 14, threshold: 35 } },
        effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
      }],
    } as unknown as CodegenSemanticPatch
    const merged = svc.mergePlannerAndDispatcherPatches(planner, null)
    expect((merged as { rules?: unknown[] })?.rules).toHaveLength(1)
  })

  it('Wave 4: rules[] alone counts as non-empty patch (no atoms/triggers)', () => {
    const planner = {
      rules: [{ id: 'r1', phase: 'entry', sideScope: 'both', condition: { kind: 'atom', key: 'x.y', params: {} }, effects: [] }],
    } as unknown as CodegenSemanticPatch
    const dispatcher: CodegenSemanticPatch = { atoms: [{ key: 'grid.range_rebalance' }] }
    const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
    // Issue #1443 真因复测：dispatcher.atoms 现在按 bucket 过滤 lift——
    //   grid.range_rebalance.bucket='positionConstraint' 不在 LIFT_ALLOWED_BUCKETS
    //   （只允 trigger/risk），不 lift。planner 原 rule 保留。atoms 桶仍透传。
    const rules = (merged as { rules?: Array<{ id?: string }> })?.rules
    expect(rules).toHaveLength(1)
    expect(rules?.[0].id).toBe('r1')           // planner 原 rule 保留
    expect(merged?.atoms).toHaveLength(1)       // atoms 桶仍透传（dispatch 链路用）
  })

  it('Wave 4: planner rules wins over dispatcher rules (planner is authoritative for tree)', () => {
    const planner = {
      rules: [{ id: 'planner-rule', phase: 'entry', sideScope: 'long', condition: { kind: 'atom', key: 'a.b', params: {} }, effects: [] }],
    } as unknown as CodegenSemanticPatch
    const dispatcher = {
      rules: [{ id: 'dispatcher-rule', phase: 'exit', sideScope: 'long', condition: { kind: 'atom', key: 'c.d', params: {} }, effects: [] }],
      atoms: [{ key: 'x' }],
    } as unknown as CodegenSemanticPatch
    const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
    const rules = (merged as { rules?: Array<{ id?: string }> })?.rules
    // R-B 升级（审查问题 #5）：dispatcher.rules 仍被 planner.rules 覆盖（核心语义不变），
    //   但 dispatcher.atoms[x] 通过 lift 加为新 rule（id 形如 dispatcher-lift-*）。
    //   planner-rule 仍保留作为第一条，验证"planner is authoritative for tree" 语义。
    expect(rules?.[0].id).toBe('planner-rule')
    expect(rules?.find(r => r.id === 'dispatcher-rule')).toBeUndefined()
    expect(rules).toHaveLength(3)
    expect(rules?.[1].id).toMatch(/^dispatcher-lift-/u)
    expect(rules?.[2].id).toMatch(/^dispatcher-lift-/u)
  })

  it('orchestration nodes dedupe by id when present', () => {
    const planner: CodegenSemanticPatch = {
      orchestration: { nodes: [{ id: 'n1', key: 'program.dynamic_grid', kind: 'program' } as never] },
    }
    const dispatcher: CodegenSemanticPatch = {
      orchestration: { nodes: [{ id: 'n1', key: 'program.dynamic_grid', kind: 'program' } as never] },
    }
    const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
    expect(merged?.orchestration?.nodes).toHaveLength(1)
  })

  it('execution-slot merge does not mutate planner rules with dispatcher lifecycle effects or params', () => {
    const planner = {
      contextSlots: { symbol: 'BTCUSDT' },
      rules: [{
        id: 'planner-r1',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'price.percent_change', params: { direction: 'down' } },
        effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
      }],
    } as unknown as CodegenSemanticPatch
    const dispatcher = {
      contextSlots: { exchange: 'okx' },
      atoms: [{
        key: 'action.add_position',
        sideScope: 'long',
        params: { addMode: 'drawdown_pct', drawdownThreshold: 5 },
      }],
      position: {
        constraints: [{
          key: 'position.dca_schedule',
          params: { triggerMode: 'time_interval' },
        }],
      },
    } as unknown as CodegenSemanticPatch

    const merged = svc.mergeDeterministicExecutionSlots(planner, dispatcher)

    expect(merged?.contextSlots).toEqual({ symbol: 'BTCUSDT', exchange: 'okx' })
    expect((merged as { rules?: unknown[] })?.rules).toEqual((planner as { rules: unknown[] }).rules)
  })

  it('execution-slot merge repairs planner ATR take-profit drift and keeps dispatcher sizing for stage1 case 7', () => {
    const text = 'OKX 合约 BTCUSDT 1m，使用布林带 5,1。价格触及或突破上轨时做空，价格触及或突破下轨时做多；多单在价格回到中轨时平仓，空单在价格回到中轨时平仓；单笔仓位 10%，止损 1%，止盈 1.5%。'
    const planner = {
      rules: [{
        id: 'entry-long-boll-5-1-touch-lower',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'bollinger.touch_lower', params: { band: 'lower', period: 5, stdDev: 1 } },
        effects: {
          actions: [{ kind: 'atom', key: 'action.open_long', params: {} }],
          risks: [
            { kind: 'atom', key: 'risk.stop_loss_pct', params: { basis: 'entry_avg_price', valuePct: 1 } },
            { kind: 'atom', key: 'risk.atr_take_profit', params: { period: 14, multiple: 1.5 } },
          ],
          positions: [],
          orchestration: [],
          programs: [],
        },
      }],
    } as unknown as CodegenSemanticPatch
    const dispatcher = new GenericSeedDispatcher().dispatch(text) as CodegenSemanticPatch

    const merged = svc.mergeDeterministicExecutionSlots(planner, dispatcher, text)
    const ruleEffects = ((merged?.rules ?? []) as Array<{ effects: unknown }>)
      .flatMap(rule => listRuleEffects(rule.effects as never))
      .flatMap(effect => collectAtomLeaves(effect))
    const keys = ruleEffects.map(effect => effect.key)

    expect(merged?.position?.sizing).toEqual({ kind: 'ratio', value: 0.1, unit: 'ratio' })
    expect(keys).not.toContain('risk.atr_take_profit')
    expect(ruleEffects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'risk.take_profit_pct',
        params: expect.objectContaining({ valuePct: 1.5, basis: 'entry_avg_price' }),
      }),
    ]))
  })

  it('execution-slot merge restores dispatcher pullback reclaim when planner collapses stage1 case 17 to MA120 entry', () => {
    const text = 'ETH 日线在 MA120 上方时，只做多；价格回踩 MA20 后重新站上 MA20 买入,ETH 日线在 MA120 下方时平仓'
    const planner = {
      rules: [
        {
          id: 'entry-long-ma120-up-ma20-reclaim',
          phase: 'entry',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'indicator.above', params: { indicator: 'ma', reference: { period: 120 } } },
          effects: { actions: [{ kind: 'atom', key: 'action.open_long', params: {} }], risks: [], positions: [], orchestration: [], programs: [] },
        },
        {
          id: 'exit-close-when-ma120-down',
          phase: 'exit',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'indicator.below', params: { indicator: 'ma', reference: { period: 120 } } },
          effects: { actions: [{ kind: 'atom', key: 'action.close_long', params: {} }], risks: [], positions: [], orchestration: [], programs: [] },
        },
      ],
    } as unknown as CodegenSemanticPatch
    const dispatcher = new GenericSeedDispatcher().dispatch(text) as CodegenSemanticPatch

    const merged = svc.mergeDeterministicExecutionSlots(planner, dispatcher, text)
    const serializedRules = JSON.stringify(merged?.rules)

    expect(serializedRules).toContain('condition.sequence')
    expect(serializedRules).toContain('pullback_reclaim')
    expect(serializedRules).toContain('indicator.above')
    expect(serializedRules).toContain('indicator.below')
  })

  it('execution-slot merge does not append single EMA entries already covered by planner AND rule', () => {
    const planner = {
      rules: [
        {
          id: 'entry-long-ema-stack-15m',
          phase: 'entry',
          sideScope: 'long',
          condition: {
            kind: 'and',
            children: [
              { kind: 'atom', key: 'indicator.above', params: { indicator: 'ema', 'reference.period': 20 } },
              { kind: 'atom', key: 'indicator.above', params: { indicator: 'ema', 'reference.period': 60 } },
              { kind: 'atom', key: 'indicator.above', params: { indicator: 'ema', 'reference.period': 144 } },
            ],
          },
          effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
        },
        {
          id: 'exit-long-below-ema20-15m',
          phase: 'exit',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'indicator.below', params: { indicator: 'ema', 'reference.period': 20 } },
          effects: [{ kind: 'atom', key: 'action.close_long', params: {} }],
        },
      ],
    } as unknown as CodegenSemanticPatch
    const dispatcher = {
      atoms: [
        { key: 'indicator.above', phase: 'entry', sideScope: 'long', params: { indicator: 'ema', 'reference.period': 20 } },
        { key: 'indicator.above', phase: 'entry', sideScope: 'long', params: { indicator: 'ema', 'reference.period': 60 } },
        { key: 'indicator.above', phase: 'entry', sideScope: 'long', params: { indicator: 'ema', 'reference.period': 144 } },
        { key: 'indicator.below', phase: 'exit', sideScope: 'long', params: { indicator: 'ema', 'reference.period': 20 } },
        { key: 'action.open_long', phase: 'entry', sideScope: 'long', params: { phase: 'entry' } },
        { key: 'action.close_long', phase: 'exit', sideScope: 'long', params: { phase: 'exit' } },
      ],
    } as unknown as CodegenSemanticPatch

    const merged = svc.mergeDeterministicExecutionSlots(planner, dispatcher)

    expect((merged as { rules?: Array<{ id?: string }> })?.rules?.map(rule => rule.id)).toEqual([
      'entry-long-ema-stack-15m',
      'exit-long-below-ema20-15m',
    ])
  })

  it('builds one multi-timeframe EMA entry rule instead of three independent open-long rules', () => {
    const text = '15min 1h 4h的价格都在ema20的上方买入 15min跌破ema20卖出 再币安交易所 btcusdt永续合约'
    const dispatcher = new GenericSeedDispatcher().dispatch(text) as CodegenSemanticPatch

    const patch = svc.buildRulesTreeFallbackFromDispatcher(dispatcher, text)
    const entryRules = patch?.rules?.filter(rule => rule.phase === 'entry') ?? []
    const exitRules = patch?.rules?.filter(rule => rule.phase === 'exit') ?? []

    expect(entryRules).toHaveLength(1)
    expect(entryRules[0]).toEqual(expect.objectContaining({
      phase: 'entry',
      sideScope: 'long',
      effects: expect.objectContaining({
        actions: [expect.objectContaining({ key: 'action.open_long' })],
      }),
      condition: expect.objectContaining({ kind: 'and' }),
    }))
    const children = (entryRules[0]?.condition as { children?: Array<{ params?: Record<string, unknown> }> }).children ?? []
    expect(children.map(child => child.params?.timeframe).sort()).toEqual(['15m', '1h', '4h'])
    expect(exitRules).toHaveLength(1)
  })

  it('repairs staging case 19 into one MA trend plus RSI reclaim entry rule', () => {
    const text = 'BTC 1小时 MA50 在 MA200 上方时，只在 RSI 跌破 35 后重新上穿 35 买入，RSI 超过 65 卖出。'
    const planner = {
      rules: [
        {
          id: 'entry-ma50-above-ma200-rsi-breakdown-recover',
          phase: 'entry',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'indicator.above', params: { indicator: 'ma', reference: { period: 200 }, period: 50 } },
          effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
        },
        {
          id: 'exit-rsi-over-65',
          phase: 'exit',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'oscillator.rsi_gte', params: { period: 14, value: 65 } },
          effects: [{ kind: 'atom', key: 'action.close_long', params: {} }],
        },
        {
          id: 'deterministic-rule-1',
          phase: 'entry',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'indicator.above', params: { indicator: 'ma', 'reference.period': 50 } },
          effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
        },
        {
          id: 'deterministic-rule-4',
          phase: 'entry',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'indicator.cross_over', params: { indicator: 'rsi', period: 35, value: 35 } },
          effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
        },
      ],
    } as unknown as CodegenSemanticPatch
    const dispatcher = new GenericSeedDispatcher().dispatch(text) as CodegenSemanticPatch

    const merged = svc.mergeDeterministicExecutionSlots(planner, dispatcher, text)
    const entryRules = merged?.rules?.filter(rule => rule.phase === 'entry') ?? []
    const serialized = JSON.stringify(entryRules)

    expect(entryRules).toHaveLength(1)
    expect(serialized).toContain('condition.sequence')
    expect(serialized).toContain('rsi_reclaim')
    expect(serialized).toContain('indicator.above')
    expect(serialized).toContain('"period":50')
    expect(serialized).toContain('"reference.period":200')
    expect(JSON.stringify(merged?.rules)).toContain('oscillator.rsi_gte')
  })

  it('repairs plaza RSI reversal into one reclaim entry with explicit threshold and risk sizing', () => {
    const text = '基于 OKX 模拟盘 ETH-USDT 现货 15m，创建 RSI 反转策略。入场规则：RSI14 从 38 下方向上穿回 38 时买入；出场规则：RSI14 高于 64 时卖出平仓；风控：仓位 25%，不使用杠杆，止损 5%，止盈 0.5%。'
    const planner = {
      rules: [
        {
          id: 'entry-rsi-lte-noisy',
          phase: 'entry',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'oscillator.rsi_lte', params: {} },
          effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
        },
        {
          id: 'entry-rsi-gte-noisy',
          phase: 'entry',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'oscillator.rsi_gte', params: {} },
          effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
        },
        {
          id: 'exit-rsi64',
          phase: 'exit',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'oscillator.rsi_gte', params: { period: 14, value: 64 } },
          effects: [{ kind: 'atom', key: 'action.close_long', params: {} }],
        },
      ],
    } as unknown as CodegenSemanticPatch
    const dispatcher = new GenericSeedDispatcher().dispatch(text) as CodegenSemanticPatch

    const merged = svc.mergeDeterministicExecutionSlots(planner, dispatcher, text)
    const entryRules = merged?.rules?.filter(rule => rule.phase === 'entry') ?? []
    const serialized = JSON.stringify(merged)

    expect(entryRules).toHaveLength(1)
    expect(serialized).toContain('condition.sequence')
    expect(serialized).toContain('rsi_reclaim')
    expect(serialized).toContain('"threshold":38')
    expect(serialized).toContain('oscillator.rsi_gte')
    expect(serialized).toContain('"value":64')
    expect(serialized).toContain('risk.stop_loss_pct')
    expect(serialized).toContain('risk.take_profit_pct')
    expect(merged?.position?.sizing).toEqual({ kind: 'ratio', unit: 'ratio', value: 0.25 })
  })

  it('repairs plaza MACD exit tuple and keeps explicit position/risk controls', () => {
    const text = '基于 OKX 模拟盘 ETH-USDT-SWAP 合约 15m，创建 MACD 16/34/12 金叉做多、死叉平多策略。入场规则：MACD DIF 上穿 DEA 时做多开仓；出场规则：MACD DIF 下穿 DEA 时平多；本策略只做多，不做空；风控：仓位 35%，2 倍杠杆，止损 2%，止盈 0.5%。'
    const planner = {
      rules: [
        {
          id: 'entry-macd-16-34-12',
          phase: 'entry',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'indicator.cross_over', params: { indicator: 'macd', fastPeriod: 16, slowPeriod: 34, signalPeriod: 12 } },
          effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
        },
        {
          id: 'exit-macd-default-noisy',
          phase: 'exit',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'indicator.cross_under', params: { indicator: 'macd', fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } },
          effects: [{ kind: 'atom', key: 'action.close_long', params: {} }],
        },
        {
          id: 'risk-stop-loss',
          phase: 'exit',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'risk.stop_loss_pct', params: { basis: 'entry_avg_price', valuePct: 2 } },
          effects: [{ kind: 'atom', key: 'action.close_long', params: {} }],
        },
      ],
    } as unknown as CodegenSemanticPatch
    const dispatcher = new GenericSeedDispatcher().dispatch(text) as CodegenSemanticPatch

    const merged = svc.mergeDeterministicExecutionSlots(planner, dispatcher, text)
    const exitMacd = merged?.rules
      ?.filter(rule => rule.phase === 'exit')
      .flatMap(rule => collectAtomLeaves(rule.condition))
      .find(leaf => leaf.key === 'indicator.cross_under' && leaf.params?.indicator === 'macd')
    const serialized = JSON.stringify(merged)

    expect(exitMacd?.params).toEqual(expect.objectContaining({ indicator: 'macd', fastPeriod: 16, slowPeriod: 34, signalPeriod: 12 }))
    expect(serialized).not.toContain('"fastPeriod":12,"slowPeriod":26,"signalPeriod":9')
    expect(serialized).toContain('risk.stop_loss_pct')
    expect(serialized).toContain('risk.take_profit_pct')
    expect(merged?.position?.sizing).toEqual({ kind: 'ratio', unit: 'ratio', value: 0.35 })
  })

  it('builds plaza MACD dispatcher fallback without duplicate risk rules or open sizing slot', () => {
    const text = '基于 OKX 模拟盘 ETH-USDT-SWAP 合约 15m，创建 MACD 16/34/12 金叉做多、死叉平多策略。入场规则：MACD DIF 上穿 DEA 时做多开仓；出场规则：MACD DIF 下穿 DEA 时平多；本策略只做多，不做空；风控：仓位 35%，2 倍杠杆，止损 2%，止盈 0.5%。'
    const dispatcher = new GenericSeedDispatcher().dispatch(text) as CodegenSemanticPatch

    const fallback = svc.buildRulesTreeFallbackFromDispatcher(dispatcher, text)
    const rules = fallback?.rules ?? []
    const entryRule = rules.find(rule => rule.phase === 'entry')
    const flatRiskLeaves = rules.flatMap(rule => listRuleEffects(rule.effects).flatMap(effect => collectAtomLeaves(effect)))
      .filter(leaf => leaf.key === 'risk.stop_loss_pct' || leaf.key === 'risk.take_profit_pct')
    const stopLossConditionRules = rules.filter(rule =>
      collectAtomLeaves(rule.condition).some(leaf => leaf.key === 'risk.stop_loss_pct'),
    )
    const gateRiskRules = rules.filter(rule =>
      rule.phase === 'gate'
      && listRuleEffects(rule.effects).some(effect =>
        collectAtomLeaves(effect).some(leaf => leaf.key === 'risk.stop_loss_pct' || leaf.key === 'risk.take_profit_pct'),
      ),
    )

    expect(entryRule).toBeDefined()
    expect(listRuleEffects(entryRule?.effects ?? []).flatMap(effect => collectAtomLeaves(effect)).map(leaf => leaf.key).sort()).toEqual([
      'action.open_long',
      'risk.stop_loss_pct',
      'risk.take_profit_pct',
    ])
    expect(flatRiskLeaves.map(leaf => leaf.key).sort()).toEqual(['risk.stop_loss_pct', 'risk.take_profit_pct'])
    expect(stopLossConditionRules).toHaveLength(0)
    expect(gateRiskRules).toHaveLength(0)
    expect(fallback?.position?.sizing).toEqual({ kind: 'ratio', unit: 'ratio', value: 0.35 })
    expect(fallback?.position?.openSlots).toEqual([])
  })

  it('dedupes weaker dispatcher percent-change entry when planner rule already carries same entry with risks', () => {
    const text = '在okx交易所 我想买btc 3分钟之内跌百分1买入 15分钟之内涨百分2卖出 单笔用百分10资金 止损5% 止盈10%'
    const planner = {
      rules: [
        {
          id: 'entry-btc-drop-1-in-3m',
          phase: 'entry',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'price.percent_change', params: { basis: 'entry_avg_price', window: '3m', valuePct: 1, direction: 'down' } },
          effects: {
            actions: [{ kind: 'atom', key: 'action.open_long', params: {} }],
            risks: [
              { kind: 'atom', key: 'risk.stop_loss_pct', params: { basis: 'entry_avg_price', valuePct: 5 } },
              { kind: 'atom', key: 'risk.take_profit_pct', params: { basis: 'entry_avg_price', valuePct: 10 } },
            ],
            positions: [],
            orchestration: [],
            programs: [],
          },
        },
        {
          id: 'exit-btc-rise-2-in-15m',
          phase: 'exit',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'price.percent_change', params: { basis: 'current_price', window: '15m', valuePct: 2, direction: 'up' } },
          effects: [{ kind: 'atom', key: 'action.close_long', params: {} }],
        },
      ],
    } as unknown as CodegenSemanticPatch
    const dispatcher = new GenericSeedDispatcher().dispatch(text) as CodegenSemanticPatch

    const merged = svc.mergeDeterministicExecutionSlots(planner, dispatcher, text)
    const entryRules = merged?.rules?.filter(rule => rule.phase === 'entry') ?? []
    const serialized = JSON.stringify(merged?.rules)

    expect(entryRules).toHaveLength(1)
    expect(serialized).not.toContain('deterministic-rule')
  })

  it('keeps the volume rebound part for consecutive bearish candles in staging case 18', () => {
    const text = 'BTC 连续跌三根 15 分钟 K 线后，如果下一根开始放量反弹就买一点。'
    const dispatcher = new GenericSeedDispatcher().dispatch(text) as CodegenSemanticPatch

    const patch = svc.buildRulesTreeFallbackFromDispatcher(dispatcher, text)
    const entry = patch?.rules?.find(rule => rule.phase === 'entry')
    const serialized = JSON.stringify(entry)

    expect(entry).toBeDefined()
    expect(serialized).toContain('condition.sequence')
    expect(serialized).toContain('pattern_then_volume_spike')
    expect(serialized).toContain('"count":3')
    expect(serialized).toContain('"direction":"down"')
    expect(serialized).toContain('"reboundDirection":"up"')
    expect(serialized).toContain('"nextBarOnly":"true"')
  })

  it('restores missing BOLL upper-band exit for staging case 20', () => {
    const text = 'ETH 15分钟触碰布林带下轨，并且成交量高于过去 20 根均量的 1.5 倍时买入，上轨卖出。'
    const planner = {
      rules: [{
        id: 'entry-boll-lower-vol-1p5',
        phase: 'entry',
        sideScope: 'long',
        condition: {
          kind: 'and',
          children: [
            { kind: 'atom', key: 'bollinger.touch_lower', params: { period: 20, stdDev: 2 } },
            { kind: 'atom', key: 'volume.threshold', params: { mode: 'relative_to_sma', refWindow: 20, multiplier: 1.5 } },
          ],
        },
        effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
      }],
    } as unknown as CodegenSemanticPatch
    const dispatcher = new GenericSeedDispatcher().dispatch(text) as CodegenSemanticPatch

    const merged = svc.mergeDeterministicExecutionSlots(planner, dispatcher, text)
    const exitRule = merged?.rules?.find(rule => rule.phase === 'exit' && JSON.stringify(rule.condition).includes('bollinger.touch_upper'))

    expect(exitRule).toBeDefined()
    expect(listRuleEffects(exitRule?.effects)).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'action.close_long' }),
    ]))
  })

  it('does not append ambiguous dispatcher fallback rules when planner already covers BOLL long-short flow', () => {
    const text = 'OKX 合约 BTCUSDT 15m，价格触及/突破布林带(20,2)上轨时做空，触及/突破下轨时做多；多单在价格回到布林带中轨(MA20)时平仓，空单在价格跌破布林带中轨(MA20)时平仓；单笔仓位 10%。'
    const planner = {
      rules: [
        {
          id: 'entry-long-boll-lower',
          phase: 'entry',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'bollinger.touch_lower', params: { band: 'lower', period: 20, stdDev: 2, confirmationMode: 'touch' } },
          effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
        },
        {
          id: 'entry-short-boll-upper',
          phase: 'entry',
          sideScope: 'short',
          condition: { kind: 'atom', key: 'bollinger.touch_upper', params: { band: 'upper', period: 20, stdDev: 2, confirmationMode: 'touch' } },
          effects: [{ kind: 'atom', key: 'action.open_short', params: {} }],
        },
        {
          id: 'exit-long-boll-middle',
          phase: 'exit',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'bollinger.touch_middle', params: { band: 'middle', period: 20, stdDev: 2, confirmationMode: 'breakout' } },
          effects: [{ kind: 'atom', key: 'action.close_long', params: {} }],
        },
        {
          id: 'exit-short-boll-middle',
          phase: 'exit',
          sideScope: 'short',
          condition: { kind: 'atom', key: 'bollinger.touch_middle', params: { band: 'middle', period: 20, stdDev: 2, confirmationMode: 'breakout' } },
          effects: [{ kind: 'atom', key: 'action.close_short', params: {} }],
        },
      ],
    } as unknown as CodegenSemanticPatch
    const dispatcher = new GenericSeedDispatcher().dispatch(text) as CodegenSemanticPatch

    const merged = svc.mergeDeterministicExecutionSlots(planner, dispatcher, text)
    const serialized = JSON.stringify(merged?.rules)

    expect(merged?.rules).toHaveLength(4)
    expect(serialized).not.toContain('deterministic-rule')
    expect(serialized).not.toContain('action.open_short","kind":"atom","params":{"phase":"entry"}},{"key":"action.open_long')
  })

  it('dedupes stop-loss rules whose params differ only by legacy phase field', () => {
    const text = '入场：15m k线里面 价格在ema20 ema60 ema144上方时做多开仓；出场：15m k线里面 价格低于ema20时平多；止损：5%；仓位：10usdt'
    const dispatcher = new GenericSeedDispatcher().dispatch(text) as CodegenSemanticPatch
    const fallback = svc.buildRulesTreeFallbackFromDispatcher(dispatcher, text)
    const stopLossRules = fallback?.rules?.filter(rule => JSON.stringify(rule.condition).includes('risk.stop_loss_pct')) ?? []

    expect(stopLossRules).toHaveLength(1)
  })

  it('does not turn grid stop loss into an entry open rule', () => {
    const text = '在 OKX 交易 BTCUSDT 永续合约，15m 周期，价格区间 60000-80000，采用双向网格，每格间距 0.5%，单笔使用 10% 资金，按入场均价亏损 5% 止损、盈利 10% 止盈'
    const dispatcher = new GenericSeedDispatcher().dispatch(text) as CodegenSemanticPatch
    const fallback = svc.buildRulesTreeFallbackFromDispatcher(dispatcher, text)
    const serialized = JSON.stringify(fallback?.rules)
    const riskEntryRules = fallback?.rules?.filter(rule =>
      rule.phase === 'entry'
      && JSON.stringify(rule.condition).includes('risk.stop_loss_pct')
      && JSON.stringify(rule.effects).includes('action.open_'),
    ) ?? []

    expect(serialized).toContain('grid.range_rebalance')
    expect(riskEntryRules).toHaveLength(0)
  })

  it('hydrates planner multi-timeframe EMA children for staging case 24', () => {
    const text = '15min 1h 4h的价格都在ema20的上方买入 15min跌破ema20卖出 再币安交易所 btcusdt永续合约'
    const planner = {
      rules: [{
        id: 'entry-mtf-ema20-above',
        phase: 'entry',
        sideScope: 'long',
        condition: {
          kind: 'and',
          children: [
            { kind: 'atom', key: 'indicator.above', params: { indicator: 'ema', reference: { period: 20 } } },
            { kind: 'atom', key: 'indicator.above', params: { indicator: 'ema', reference: { period: 20 } } },
            { kind: 'atom', key: 'indicator.above', params: { indicator: 'ema', reference: { period: 20 } } },
          ],
        },
        effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
      }],
    } as unknown as CodegenSemanticPatch
    const dispatcher = new GenericSeedDispatcher().dispatch(text) as CodegenSemanticPatch

    const merged = svc.mergeDeterministicExecutionSlots(planner, dispatcher, text)
    const entry = merged?.rules?.find(rule => rule.id === 'entry-mtf-ema20-above')
    const children = (entry?.condition as { children?: Array<{ params?: Record<string, unknown> }> } | undefined)?.children ?? []

    expect(children.map(child => child.params?.timeframe).sort()).toEqual(['15m', '1h', '4h'])
  })

  it('restores RSI 70 exit and dedupes long-only stop loss for staging case 26', () => {
    const text = 'BTC/USDT 4h，RSI 跌破 30 开多，RSI 回到 70 平仓，止损 2%'
    const dispatcher = new GenericSeedDispatcher().dispatch(text) as CodegenSemanticPatch
    const fallback = svc.buildRulesTreeFallbackFromDispatcher(dispatcher, text)
    const serialized = JSON.stringify(fallback?.rules)
    const stopLossRules = fallback?.rules?.filter(rule => JSON.stringify(rule.condition).includes('risk.stop_loss_pct')) ?? []

    expect(serialized).toContain('oscillator.rsi_gte')
    expect(serialized).toContain('70')
    expect(stopLossRules).toHaveLength(1)
    expect(JSON.stringify(stopLossRules[0])).toContain('action.close_long')
    expect(JSON.stringify(stopLossRules[0])).not.toContain('action.close_short')
  })

  it('keeps drawdown circuit breaker without event-listener or empty stop-loss noise for staging case 28', () => {
    const text = 'SOL 1d，EMA20 上穿 EMA60 开多，下穿平仓，最大回撤 15% 熔断'
    const dispatcher = new GenericSeedDispatcher().dispatch(text) as CodegenSemanticPatch
    const fallback = svc.buildRulesTreeFallbackFromDispatcher(dispatcher, text)
    const serialized = JSON.stringify(fallback?.rules)

    expect(serialized).toContain('portfolioRisk.drawdown_block')
    expect(serialized).toContain('15')
    expect(serialized).not.toContain('program.event_listener')
    expect(serialized).not.toContain('risk.stop_loss_pct')
  })

  it('replaces planner range-position add rule with profit add-position lifecycle for staging case 29', () => {
    const text = 'BTC 1h 突破前高开多，盈利 3% 后加仓 50%，最多加 3 层'
    const planner = {
      rules: [
        {
          id: 'entry-breakout-prev-high-long',
          phase: 'entry',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'price.breakout_up', params: { period: 1, reference: 'channel_high' } },
          effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
        },
        {
          id: 'add-long-after-profit-3pct-50x3',
          phase: 'entry',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'price.range_position_gte', params: { lookbackBars: 20, thresholdPct: 3 } },
          effects: [],
        },
      ],
    } as unknown as CodegenSemanticPatch
    const dispatcher = new GenericSeedDispatcher().dispatch(text) as CodegenSemanticPatch

    const merged = svc.mergeDeterministicExecutionSlots(planner, dispatcher, text)
    const serialized = JSON.stringify(merged?.rules)
    const addRule = merged?.rules?.find(rule => JSON.stringify(rule.condition).includes('price.percent_change'))

    expect(serialized).not.toContain('price.range_position_gte')
    expect(addRule).toBeDefined()
    expect(listRuleEffects(addRule?.effects)).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'action.add_position' }),
    ]))
    expect(JSON.stringify(merged?.position)).toContain('position.pyramiding_limit')
  })

  it('keeps DCA daily buy and drawdown add amount for staging case 30', () => {
    const text = 'ETH 现货每天定投 100 USDT，回撤 5% 加投 200 USDT'
    const dispatcher = new GenericSeedDispatcher().dispatch(text) as CodegenSemanticPatch
    const fallback = svc.buildRulesTreeFallbackFromDispatcher(dispatcher, text)
    const effects = (fallback?.rules ?? []).flatMap(rule => listRuleEffects(rule.effects))
    const dca = effects.find((effect): effect is Extract<typeof effect, { kind: 'atom' }> =>
      effect.kind === 'atom' && effect.key === 'position.dca_schedule')
    const add = effects.find((effect): effect is Extract<typeof effect, { kind: 'atom' }> =>
      effect.kind === 'atom' && effect.key === 'action.add_position' && JSON.stringify(effect).includes('drawdown_pct'))

    expect(dca?.params).toEqual(expect.objectContaining({
      triggerMode: 'time_interval',
      perOrderSizing: { kind: 'quote', value: 100, asset: 'USDT' },
    }))
    expect(add?.params).toEqual(expect.objectContaining({
      addMode: 'drawdown_pct',
      drawdownThreshold: 5,
      sizing: { kind: 'quote', value: 200, asset: 'USDT' },
    }))
  })

  it('does not promote DCA drawdown or exit percentages to top-level position sizing during merge fallback', () => {
    const text = 'rulesMainflow.missing_exit_rules: 补充退出：价格相对入场均价下跌 5% 时卖出退出。'
    const dispatcher = new GenericSeedDispatcher().dispatch(text) as CodegenSemanticPatch
    const fallback = svc.buildRulesTreeFallbackFromDispatcher(dispatcher, text)

    expect(fallback?.position?.sizing).toBeUndefined()
  })

  it('drops empty position-constraint condition rules before planner schema validation', () => {
    const text = 'semantic.action.add_position.constraint: 最多加投 1 次；按原策略：回撤 5% 时加投 200 USDT。'
    const planner = {
      rules: [
        {
          id: 'clarified-position-pyramiding-limit',
          phase: 'gate',
          sideScope: 'both',
          condition: { kind: 'atom', key: 'position.pyramiding_limit', params: { maxLayers: 1 } },
          effects: [],
          evidence: { text },
        },
      ],
    } as unknown as CodegenSemanticPatch
    const dispatcher = new GenericSeedDispatcher().dispatch(text) as CodegenSemanticPatch

    const merged = svc.mergeDeterministicExecutionSlots(planner, dispatcher, text)

    expect(merged?.rules?.some(rule =>
      JSON.stringify(rule.condition).includes('position.pyramiding_limit')
      && listRuleEffects(rule.effects).length === 0,
    )).toBe(false)
  })

  it('keeps DCA lifecycle entry on an event condition when planner emits position presence noise', () => {
    const text = 'executionContext.timeframe: 1d'
    const planner = {
      position: {
        mode: 'fixed_ratio',
        value: 0.05,
        sizing: { kind: 'ratio', unit: 'ratio', value: 0.05 },
        positionMode: 'long_only',
        status: 'locked',
        openSlots: [],
      },
      rules: [
        {
          id: 'entry-dca-daily',
          phase: 'entry',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'position.no_position', params: { sideScope: 'both' }, evidence: { text } },
          effects: {
            actions: [],
            risks: [],
            positions: [{ kind: 'atom', key: 'position.dca_schedule', params: { interval: '1d', perOrderBudget: 100 } }],
            orchestration: [],
            programs: [],
          },
          evidence: { text },
        },
      ],
    } as unknown as CodegenSemanticPatch

    const merged = svc.mergeDeterministicExecutionSlots(planner, {}, text)

    expect(merged?.rules?.[0]?.condition).toEqual(expect.objectContaining({
      key: 'execution.on_start',
    }))
    expect(JSON.stringify(merged?.rules)).not.toContain('position.no_position')
    expect(merged?.position?.sizing).toBeUndefined()
    expect(merged?.position?.mode).toBe('constraint_only')
  })

  it('execution-slot merge does not append EMA cross rules when planner params are richer', () => {
    const planner = {
      rules: [
        {
          id: 'entry-ema7-crossup-ema21-long',
          phase: 'entry',
          sideScope: 'long',
          condition: {
            kind: 'atom',
            key: 'indicator.cross_over',
            params: { value: 21, period: 7, semantic: 'cross_up', indicator: 'ema', fastPeriod: 7, slowPeriod: 21, signalPeriod: 9 },
          },
          effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
        },
        {
          id: 'exit-ema7-crossdown-ema21-close-long',
          phase: 'exit',
          sideScope: 'long',
          condition: {
            kind: 'atom',
            key: 'indicator.cross_under',
            params: { value: 21, period: 7, semantic: 'cross_down', indicator: 'ema', fastPeriod: 7, slowPeriod: 21, signalPeriod: 9 },
          },
          effects: [{ kind: 'atom', key: 'action.close_long', params: {} }],
        },
      ],
    } as unknown as CodegenSemanticPatch
    const dispatcher = {
      atoms: [
        { key: 'indicator.cross_over', phase: 'entry', sideScope: 'long', params: { value: 21, period: 7, indicator: 'ema', fastPeriod: 7, slowPeriod: 21 } },
        { key: 'indicator.cross_under', phase: 'exit', sideScope: 'long', params: { value: 21, period: 7, indicator: 'ema', fastPeriod: 7, slowPeriod: 21 } },
        { key: 'action.open_long', phase: 'entry', sideScope: 'long', params: {} },
        { key: 'action.close_long', phase: 'exit', sideScope: 'long', params: {} },
      ],
    } as unknown as CodegenSemanticPatch

    const merged = svc.mergeDeterministicExecutionSlots(planner, dispatcher)

    expect((merged as { rules?: Array<{ id?: string }> })?.rules?.map(rule => rule.id)).toEqual([
      'entry-ema7-crossup-ema21-long',
      'exit-ema7-crossdown-ema21-close-long',
    ])
  })

  it('execution-slot merge does not append MACD cross rules when dispatcher has only indicator name', () => {
    const planner = {
      rules: [
        {
          id: 'entry-macd-cross-golden',
          phase: 'entry',
          sideScope: 'long',
          condition: {
            kind: 'atom',
            key: 'indicator.cross_over',
            params: { value: 0, period: 0, semantic: 'cross_up', indicator: 'macd', fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
          },
          effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
        },
        {
          id: 'exit-macd-cross-dead',
          phase: 'exit',
          sideScope: 'long',
          condition: {
            kind: 'atom',
            key: 'indicator.cross_under',
            params: { value: 0, period: 0, semantic: 'cross_down', indicator: 'macd', fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
          },
          effects: [{ kind: 'atom', key: 'action.close_long', params: {} }],
        },
      ],
    } as unknown as CodegenSemanticPatch
    const dispatcher = {
      atoms: [
        { key: 'indicator.cross_over', phase: 'entry', sideScope: 'long', params: { indicator: 'macd' } },
        { key: 'indicator.cross_under', phase: 'exit', sideScope: 'long', params: { indicator: 'macd' } },
        { key: 'action.open_long', phase: 'entry', sideScope: 'long', params: {} },
        { key: 'action.close_long', phase: 'exit', sideScope: 'long', params: {} },
      ],
    } as unknown as CodegenSemanticPatch

    const merged = svc.mergeDeterministicExecutionSlots(planner, dispatcher)

    expect((merged as { rules?: Array<{ id?: string }> })?.rules?.map(rule => rule.id)).toEqual([
      'entry-macd-cross-golden',
      'exit-macd-cross-dead',
    ])
  })

  it('execution-slot merge does not append MA and MACD component rules when planner has compound rules', () => {
    const planner = {
      rules: [
        {
          id: 'entry-sol-ma100-macd-golden-long',
          phase: 'entry',
          sideScope: 'long',
          condition: {
            kind: 'and',
            children: [
              { kind: 'atom', key: 'indicator.above', params: { indicator: 'ma', 'reference.period': 100 } },
              { kind: 'atom', key: 'indicator.cross_over', params: { indicator: 'macd', fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } },
            ],
          },
          effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
        },
        {
          id: 'exit-sol-ma100-or-macd-dead-long',
          phase: 'exit',
          sideScope: 'long',
          condition: {
            kind: 'or',
            children: [
              { kind: 'atom', key: 'indicator.below', params: { indicator: 'ma', 'reference.period': 100 } },
              { kind: 'atom', key: 'indicator.cross_under', params: { indicator: 'macd', fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } },
            ],
          },
          effects: [{ kind: 'atom', key: 'action.close_long', params: {} }],
        },
      ],
    } as unknown as CodegenSemanticPatch
    const dispatcher = {
      atoms: [
        { key: 'indicator.above', phase: 'entry', sideScope: 'long', params: { indicator: 'ma', referenceRole: 'long_term', 'reference.period': 100, timeframeOverride: 'true' } },
        { key: 'indicator.cross_over', phase: 'entry', sideScope: 'long', params: { indicator: 'macd' } },
        { key: 'indicator.below', phase: 'exit', sideScope: 'long', params: { indicator: 'ma', referenceRole: 'long_term', 'reference.period': 100, timeframeOverride: 'true' } },
        { key: 'indicator.cross_under', phase: 'exit', sideScope: 'long', params: { indicator: 'macd', period: 100, fastPeriod: 100 } },
        { key: 'action.open_long', phase: 'entry', sideScope: 'long', params: {} },
        { key: 'action.close_long', phase: 'exit', sideScope: 'long', params: {} },
      ],
    } as unknown as CodegenSemanticPatch

    const merged = svc.mergeDeterministicExecutionSlots(planner, dispatcher)

    expect((merged as { rules?: Array<{ id?: string }> })?.rules?.map(rule => rule.id)).toEqual([
      'entry-sol-ma100-macd-golden-long',
      'exit-sol-ma100-or-macd-dead-long',
    ])
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Issue #1428 R-B：rules-first 路径下 dispatcher atom lift 为 single-leaf rule
  //   （cross-clause inheritance 回归——planner 直产 rules 时 dispatcher 通过
  //   #1383 派生的 sibling/mirror 必须仍在 rules-tree 上可见）
  // ───────────────────────────────────────────────────────────────────────────
  it('R-B: rules 非空时 lift dispatcher atom 缺失 leaf 为 single-leaf rule（atoms 总集）', () => {
    const planner = {
      rules: [{
        id: 'planner-r1',
        phase: 'entry',
        sideScope: 'short',
        condition: { kind: 'atom', key: 'bollinger.touch_upper', params: { period: 20, stdDev: 2 } },
        effects: [{ kind: 'atom', key: 'action.open_short', params: {} }],
      }],
    } as unknown as CodegenSemanticPatch
    // Issue #1441：R-B 只收 atoms 总集；dispatcher 同时往 atoms 和 triggers 写
    const dispatcher: CodegenSemanticPatch = {
      atoms: [{
        key: 'bollinger.touch_lower',
        phase: 'entry',
        sideScope: 'long',
        params: { period: 20, stdDev: 2 },
      }],
    }
    const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
    const rules = (merged as { rules?: Array<{ id: string, condition: { key?: string } }> })?.rules
    expect(rules).toHaveLength(1)
    expect(rules?.[0].id).toMatch(/^dispatcher-lift-/u)
    expect(rules?.[0].condition.key).toBe('bollinger.touch_lower')
  })

  it('R-B: rules 中已有同签名 leaf 时不重复 lift', () => {
    const planner = {
      rules: [{
        id: 'planner-r1',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'bollinger.touch_lower', params: { period: 20, stdDev: 2 } },
        effects: [],
      }],
    } as unknown as CodegenSemanticPatch
    const dispatcher: CodegenSemanticPatch = {
      atoms: [{ key: 'bollinger.touch_lower', phase: 'entry', sideScope: 'long', params: { period: 20, stdDev: 2 } }],
    }
    const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
    expect((merged as { rules?: unknown[] })?.rules).toHaveLength(1)
  })

  it('R-B: rules 为空时不 lift（dispatcher-only 路径保持原行为）', () => {
    const dispatcher: CodegenSemanticPatch = {
      atoms: [{ key: 'bollinger.touch_lower', phase: 'entry', sideScope: 'long', params: {} }],
    }
    const merged = svc.mergePlannerAndDispatcherPatches({}, dispatcher)
    expect((merged as { rules?: unknown[] })?.rules).toBeUndefined()
  })

  it('R-B: dispatcher.atoms 桶里 cross-clause 派生 atom 也被 lift（审查问题 #5）', () => {
    // dispatcher 的 GenericSeedDispatcher 既写 triggers 也写 atoms 桶（cross-clause
    //   inheritance pass 走 atomItems.push）。lift 必须收 atoms 桶否则漏 sibling。
    const planner = {
      rules: [{
        id: 'planner-r1',
        phase: 'entry',
        sideScope: 'short',
        condition: { kind: 'atom', key: 'bollinger.touch_upper', params: {} },
        effects: [],
      }],
    } as unknown as CodegenSemanticPatch
    const dispatcher: CodegenSemanticPatch = {
      atoms: [{ key: 'bollinger.touch_lower', phase: 'entry', sideScope: 'long', params: {} }],
    }
    const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
    // R2 审查加固：断言长度 + 形如 lift id + sideScope + phase 全检
    const rules = (merged as { rules?: Array<{ id: string, phase: string, sideScope: string, condition: { key?: string } }> })?.rules
    expect(rules).toHaveLength(2)
    expect(rules?.[1].id).toMatch(/^dispatcher-lift-/u)
    expect(rules?.[1].condition.key).toBe('bollinger.touch_lower')
    expect(rules?.[1].phase).toBe('entry')
    expect(rules?.[1].sideScope).toBe('long')
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Issue #1443：always-on condition + action effects 噪音 rule 过滤
  //   planner/dispatcher 误产「condition=execution.on_start + effects=action.close_long」
  //   这种"启动即平仓"无条件兜底 rule（用户没明确说），让 UI 出现「出场：平多」无条件
  //   动作的噪音。merge 阶段整条丢弃。risk effects 允许 always-on（"挂止损"合理）。
  // ───────────────────────────────────────────────────────────────────────────
  it('Issue #1443 真因复测：dispatcher.atoms 含 action bucket atom（如 close_long）→ 不 lift（避免 "出场：平多" noise）', () => {
    // 用户实测复测：planner 完整产 entry rule + risk rules，但 dispatcher 把"卖出"
    //   抽到 action.close_long 进 patch.atoms 总集。R-B 一刀切 lift 会把 close_long
    //   作为 single-leaf rule，UI 渲染 "出场：平多"（condition 被错渲染成 action 名）。
    //   按 contract.bucket 过滤后 action 类不 lift。
    const planner = {
      rules: [{
        id: 'planner-r1',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'price.percent_change', params: { direction: 'down', valuePct: -1 } },
        effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
      }],
    } as unknown as CodegenSemanticPatch
    const dispatcher: CodegenSemanticPatch = {
      atoms: [
        // action bucket atom → 应被过滤不 lift
        { key: 'action.close_long', phase: 'exit', sideScope: 'long', params: {} },
        // 真 trigger atom → 允许 lift
        { key: 'bollinger.touch_lower', phase: 'entry', sideScope: 'long', params: { period: 20, stdDev: 2 } },
      ],
    }
    const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
    const rules = (merged as { rules?: Array<{ id: string, condition: { key?: string } }> })?.rules ?? []
    // 应只有 2 条：planner 原 entry + lift bollinger.touch_lower
    expect(rules).toHaveLength(2)
    // 确认 action.close_long 没被 lift
    expect(rules.some(r => r.condition.key === 'action.close_long')).toBe(false)
    // 确认 bollinger.touch_lower 被 lift
    expect(rules.some(r => r.condition.key === 'bollinger.touch_lower')).toBe(true)
  })

  it('Issue #1443: always-on condition + action effects → 整条 rule 丢弃', () => {
    const planner = {
      rules: [
        // 正常 entry rule（保留）
        {
          id: 'planner-r-entry',
          phase: 'entry',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'price.percent_change', params: { direction: 'down', valuePct: -1, window: '3m' } },
          effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
        },
        // 噪音 always-on + close_long（丢弃）
        {
          id: 'noise-r-exit',
          phase: 'exit',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'execution.on_start', params: { timing: 'on_start' } },
          effects: [{ kind: 'atom', key: 'action.close_long', params: {} }],
        },
      ],
    } as unknown as CodegenSemanticPatch
    const merged = svc.mergePlannerAndDispatcherPatches(planner, null)
    const rules = (merged as { rules?: Array<{ id: string }> })?.rules
    expect(rules).toHaveLength(1)
    expect(rules?.[0].id).toBe('planner-r-entry')
  })

  it('Issue #1443: always-on condition + risk effects → 保留（持续生效合理）', () => {
    const planner = {
      rules: [{
        id: 'planner-r-stop',
        phase: 'exit',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'execution.on_start', params: { timing: 'on_start' } },
        effects: [{ kind: 'atom', key: 'risk.stop_loss_pct', params: { valuePct: 5, basis: 'entry_avg_price' } }],
      }],
    } as unknown as CodegenSemanticPatch
    const merged = svc.mergePlannerAndDispatcherPatches(planner, null)
    const rules = (merged as { rules?: unknown[] })?.rules
    expect(rules).toHaveLength(1)
  })

  it('Issue #1443: always-on DCA lifecycle rule drops mixed action noise only', () => {
    const planner = {
      rules: [{
        id: 'planner-r-dca',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'execution.on_start', params: { timing: 'on_start' } },
        effects: [
          { kind: 'atom', key: 'position.dca_schedule', params: { triggerMode: 'time_interval' } },
          { kind: 'atom', key: 'action.close_long', params: {} },
        ],
      }],
    } as unknown as CodegenSemanticPatch
    const merged = svc.mergePlannerAndDispatcherPatches(planner, null)
    const rules = (merged as unknown as { rules?: Array<{ effects: ReadonlyArray<{ key?: string }> }> })?.rules
    expect(rules).toHaveLength(1)
    expect(rules?.[0].effects).toEqual([
      expect.objectContaining({ key: 'position.dca_schedule' }),
    ])
  })

  it('Issue #1443: 非 always-on condition + action effects → 保留（正常业务 rule）', () => {
    const planner = {
      rules: [{
        id: 'planner-r-entry',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'price.percent_change', params: { direction: 'down' } },
        effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
      }],
    } as unknown as CodegenSemanticPatch
    const merged = svc.mergePlannerAndDispatcherPatches(planner, null)
    const rules = (merged as { rules?: unknown[] })?.rules
    expect(rules).toHaveLength(1)
  })

  it('Issue #1441: dispatcher.actions 桶不被 lift（避免「入场（双向）：开多」孤立 rule）', () => {
    // 用户实测策略 1 复测：UI 出现「入场（双向）：开多」「出场（双向）：平多」孤立 rule
    //   根因：R-B lift dispatcher.actions 桶把 action.open_long / action.close_long
    //   作为 condition.key 提升为 single-leaf rule。action atom 语义上应是某 entry/exit
    //   rule 的 effects，不应独立成 condition leaf。
    const planner = {
      rules: [{
        id: 'planner-r1',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'price.percent_change', params: { direction: 'down', valuePct: -1 } },
        effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
      }],
    } as unknown as CodegenSemanticPatch
    // Issue #1441 通用收紧：dispatcher.actions 子桶**不**参与 lift（R-B 现在只收
    //   `dispatcher.atoms` 总集；actions/triggers/risk 子桶不再走 lift 路径）。
    // 注：CodegenSemanticPatch.actions 类型无 sideScope 字段，故 fixture 不带。
    const dispatcher: CodegenSemanticPatch = {
      actions: [
        { key: 'action.open_long', phase: 'entry', params: {} },
        { key: 'action.close_long', phase: 'exit', params: {} },
      ],
    }
    const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
    const rules = (merged as { rules?: Array<{ id: string, condition: { key?: string } }> })?.rules
    // 只剩 planner 原 rule，actions 桶**不**被 lift（无 dispatcher-lift-* rule）
    expect(rules).toHaveLength(1)
    expect(rules?.[0].id).toBe('planner-r1')
    // 确认无任何 dispatcher-lift- 前缀 rule
    expect(rules?.some(r => r.id.startsWith('dispatcher-lift-'))).toBe(false)
  })

  // Issue #1441 用户实测策略 1 复测复现：planner + dispatcher 同 atom 不同 phase/params
  //   场景下，旧 R-B 收 atoms+triggers+risk 三桶可能引入重复孤立 rule。新 R-B 只收
  //   atoms 总集，重复源头消除。
  it('Issue #1441: R-B 只收 atoms 总集——子桶重复 atom 不引入额外孤立 rule', () => {
    const planner = {
      rules: [{
        id: 'planner-entry',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'price.percent_change', params: { direction: 'down', valuePct: -1, window: '3m' } },
        effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
      }],
    } as unknown as CodegenSemanticPatch
    // dispatcher 既写 atoms 总集 又写 triggers 子视图（同一 atom 同 phase 同 sideScope 同 params）
    const dispatcher: CodegenSemanticPatch = {
      atoms: [
        { key: 'price.percent_change', phase: 'entry', sideScope: 'long', params: { direction: 'down', valuePct: -1, window: '3m' } },
        { key: 'price.percent_change', phase: 'exit', sideScope: 'long', params: { direction: 'up', valuePct: 2, window: '15m' } },
      ],
      triggers: [
        { key: 'price.percent_change', phase: 'entry', sideScope: 'long', params: { direction: 'down', valuePct: -1, window: '3m' } },
        { key: 'price.percent_change', phase: 'exit', sideScope: 'long', params: { direction: 'up', valuePct: 2, window: '15m' } },
      ],
    }
    const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
    const rules = (merged as { rules?: Array<{ id: string, phase: string, condition: { key?: string, params?: Record<string, unknown> } }> })?.rules
    // Issue #1443：lift dedup 改为 key-only。planner.entry 已含 price.percent_change
    //   key → dispatcher 同 key 任何 phase/sideScope/params 一律不 lift（避免重复 sibling）。
    //   设计取舍：宁可丢 dispatcher.exit 边角识别，也不引入 sibling 重复噪音；用户期望
    //   planner 自己产完整 entry + exit rules，dispatcher 仅作 atom-key 兜底。
    expect(rules).toHaveLength(1)
    expect(rules?.[0].phase).toBe('entry')
    expect(rules?.[0].id).toBe('planner-entry')
  })

  it('R-B: dispatcher risk 桶 phase=risk 被 lift 时归位为 exit', () => {
    const planner = {
      rules: [{
        id: 'planner-r1',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'price.percent_change', params: { direction: 'up', valuePct: 1 } },
        effects: [],
      }],
    } as unknown as CodegenSemanticPatch
    // Issue #1441：R-B 只收 atoms 总集；dispatcher 同时写 atoms（phase=risk）与 risk 子桶
    //   phase=risk → liftPhase 归位为 'exit'（rule.phase 不允许 risk）
    const dispatcher: CodegenSemanticPatch = {
      atoms: [{ key: 'risk.stop_loss_pct', phase: 'risk', params: { pct: 5 } }],
    }
    const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
    const rules = (merged as { rules?: Array<{ phase: string, condition: { key?: string } }> })?.rules
    expect(rules).toHaveLength(2)
    const stopLossRule = rules?.find(r => r.condition.key === 'risk.stop_loss_pct')
    expect(stopLossRule?.phase).toBe('exit')
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Issue #1428 R-D：rules leaf params dispatcher-first override
  //   （dispatcher regex 抽到的用户原话精细 params 必须覆盖 LLM 默认值填充）
  // ───────────────────────────────────────────────────────────────────────────
  it('R-D: planner leaf params 缺关键 slot 时 dispatcher strict superset 直接覆盖', () => {
    const planner = {
      rules: [{
        id: 'planner-r1',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'price.percent_change', params: { direction: 'down' } },
        effects: [],
      }],
    } as unknown as CodegenSemanticPatch
    // dispatcher 抽到完整 params：direction + valuePct + window
    const dispatcher: CodegenSemanticPatch = {
      atoms: [{
        key: 'price.percent_change',
        phase: 'entry',
        sideScope: 'long',
        params: { direction: 'down', valuePct: -1, window: '3m' },
      }],
    }
    const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
    const leaf = (merged as { rules?: Array<{ condition: { params?: Record<string, unknown> } }> })?.rules?.[0].condition
    expect(leaf?.params).toEqual({ direction: 'down', valuePct: -1, window: '3m' })
  })

  it('R-D: planner leaf params 与 dispatcher params 值冲突时保留 planner（不强行覆盖）', () => {
    const planner = {
      rules: [{
        id: 'planner-r1',
        phase: 'entry',
        sideScope: 'long',
        // planner 给的 period 与 dispatcher 不同 → 不算 superset → 不覆盖
        condition: { kind: 'atom', key: 'bollinger.touch_upper', params: { period: 20, stdDev: 2 } },
        effects: [],
      }],
    } as unknown as CodegenSemanticPatch
    // Issue #1441：R-B 只收 atoms 总集；Issue #1443：lift dedup 改 key-only
    const dispatcher: CodegenSemanticPatch = {
      atoms: [{
        key: 'bollinger.touch_upper',
        phase: 'entry',
        sideScope: 'long',
        params: { period: 5, stdDev: 1 },
      }],
    }
    const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
    const leaf = (merged as { rules?: Array<{ condition: { params?: Record<string, unknown> } }> })?.rules?.[0].condition
    // 值冲突 → 保留 planner 版本（R-D strict superset 不命中）
    expect(leaf?.params).toEqual({ period: 20, stdDev: 2 })
    // Issue #1443：planner 已含 bollinger.touch_upper key → dispatcher 同 key 不再 lift
    //   （旧实现会 lift 第二条 (5,1) → 引入重复 sibling；新设计宁可丢边角识别也不重复）
    expect((merged as { rules?: unknown[] })?.rules).toHaveLength(1)
  })

  it('R-D: dispatcher 无同 key entry → planner params 不变', () => {
    const planner = {
      rules: [{
        id: 'planner-r1',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'oscillator.rsi_lte', params: { threshold: 35 } },
        effects: [],
      }],
    } as unknown as CodegenSemanticPatch
    const dispatcher: CodegenSemanticPatch = {
      atoms: [{ key: 'unrelated.atom', params: { x: 1 } }],
    }
    const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
    const leaf = (merged as { rules?: Array<{ condition: { params?: Record<string, unknown> } }> })?.rules?.[0].condition
    expect(leaf?.params).toEqual({ threshold: 35 })
  })

  it('R-D: planner leaf params 空 + dispatcher 含 params → 覆盖（degenerate superset）', () => {
    const planner = {
      rules: [{
        id: 'planner-r1',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'price.percent_change', params: {} },
        effects: [],
      }],
    } as unknown as CodegenSemanticPatch
    const dispatcher: CodegenSemanticPatch = {
      atoms: [{
        key: 'price.percent_change',
        phase: 'entry',
        sideScope: 'long',
        params: { direction: 'down', valuePct: -1 },
      }],
    }
    const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
    const leaf = (merged as { rules?: Array<{ condition: { params?: Record<string, unknown> } }> })?.rules?.[0].condition
    expect(leaf?.params).toEqual({ direction: 'down', valuePct: -1 })
  })

  it('R-D: sideScope 不匹配时不覆盖（审查问题 #4 负断言）', () => {
    const planner = {
      rules: [{
        id: 'planner-r1',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'bollinger.touch_upper', params: { period: 20 }, sideScope: 'long' },
        effects: [],
      }],
    } as unknown as CodegenSemanticPatch
    // dispatcher 标 sideScope='short'，且 params 是 superset → 但 sideScope 不匹配且
    //   也不是 dispatcher 'both'（不会触发 both 回退）→ 不应覆盖
    const dispatcher: CodegenSemanticPatch = {
      atoms: [{ key: 'bollinger.touch_upper', phase: 'entry', sideScope: 'short', params: { period: 20, stdDev: 2 } }],
    }
    const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
    const leaf = (merged as { rules?: Array<{ condition: { params?: Record<string, unknown> } }> })?.rules?.[0].condition
    // sideScope 不匹配 → 保留 planner params
    expect(leaf?.params).toEqual({ period: 20 })
  })

  it('R-D: OR 嵌套节点的 leaf 也参与 override（审查问题 #4 补 or 用例）', () => {
    const planner = {
      rules: [{
        id: 'planner-r1',
        phase: 'exit',
        sideScope: 'long',
        condition: {
          kind: 'or',
          children: [
            { kind: 'atom', key: 'indicator.below', params: { indicator: 'ma' } },
            { kind: 'atom', key: 'indicator.cross_under', params: {} },
          ],
        },
        effects: [],
      }],
    } as unknown as CodegenSemanticPatch
    const dispatcher: CodegenSemanticPatch = {
      atoms: [
        { key: 'indicator.below', phase: 'exit', sideScope: 'long', params: { indicator: 'ma', period: 100 } },
        { key: 'indicator.cross_under', phase: 'exit', sideScope: 'long', params: { indicator: 'macd' } },
      ],
    }
    const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
    const children = (merged as { rules?: Array<{ condition: { children?: Array<{ params?: Record<string, unknown> }> } }> })?.rules?.[0].condition.children
    expect(children?.[0].params).toEqual({ indicator: 'ma', period: 100 })
    expect(children?.[1].params).toEqual({ indicator: 'macd' })
  })

  it('R-D: NOT 嵌套节点的 leaf 也参与 override（审查问题 #4 补 not 用例）', () => {
    const planner = {
      rules: [{
        id: 'planner-r1',
        phase: 'entry',
        sideScope: 'long',
        condition: {
          kind: 'not',
          child: { kind: 'atom', key: 'gate.regime', params: {} },
        },
        effects: [],
      }],
    } as unknown as CodegenSemanticPatch
    const dispatcher: CodegenSemanticPatch = {
      atoms: [{ key: 'gate.regime', phase: 'entry', sideScope: 'long', params: { regime: 'trending' } }],
    }
    const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
    const child = (merged as { rules?: Array<{ condition: { child?: { params?: Record<string, unknown> } } }> })?.rules?.[0].condition.child
    expect(child?.params).toEqual({ regime: 'trending' })
  })

  it('Major #2 fail-open: lift/override 异常时 merged 保留原 planner rules + logger 报警两次', () => {
    // 注入一个 throw 的 rule.condition.kind getter 强制 collectAtomLeaves 抛错
    const badCondition: unknown = new Proxy({ kind: 'atom', key: 'k', params: {} }, {
      get(target, prop) {
        if (prop === 'kind') throw new Error('forced for fail-open test')
        return (target as Record<string | symbol, unknown>)[prop]
      },
    })
    const planner = {
      rules: [{
        id: 'planner-r1',
        phase: 'entry',
        sideScope: 'long',
        condition: badCondition,
        effects: [],
      }],
    } as unknown as CodegenSemanticPatch
    const dispatcher: CodegenSemanticPatch = {
      atoms: [{ key: 'something', params: { x: 1 } }],
    }
    // R2 审查加固：spy Logger.warn，断言异常被两个 pass 各报警一次（不被悄悄吞）
    const warnSpy = jest.spyOn((svc as unknown as { logger: { warn: (m: string) => void } }).logger, 'warn').mockImplementation(() => undefined)
    try {
      const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
      expect(merged).not.toBeNull()
      // rules 原样保留（与传入 planner.rules 引用相等，证明没被部分 mutated）
      const rules = (merged as { rules?: unknown[] })?.rules
      expect(rules).toBeDefined()
      expect(rules).toHaveLength(1)
      // atoms 透传不受影响（在 try/catch 之前已设置）
      expect(merged?.atoms).toHaveLength(1)
      // 两个 pass 各报警一次
      // Issue #1443：增加 filter pass 后可能 warn 3 次（override + lift + filter）
      expect(warnSpy.mock.calls.length).toBeGreaterThanOrEqual(2)
      expect(warnSpy.mock.calls.some(call => String(call[0]).includes('overrideRulesLeafParamsFromDispatcher'))).toBe(true)
      expect(warnSpy.mock.calls.some(call => String(call[0]).includes('liftDispatcherAtomsIntoRules'))).toBe(true)
    }
    finally {
      warnSpy.mockRestore()
    }
  })

  it('R-D: 嵌套 AND/OR 节点的 leaf 也参与 override', () => {
    const planner = {
      rules: [{
        id: 'planner-r1',
        phase: 'entry',
        sideScope: 'long',
        condition: {
          kind: 'and',
          children: [
            { kind: 'atom', key: 'price.percent_change', params: { direction: 'down' } },
            { kind: 'atom', key: 'volume.threshold', params: {} },
          ],
        },
        effects: [],
      }],
    } as unknown as CodegenSemanticPatch
    const dispatcher: CodegenSemanticPatch = {
      atoms: [
        { key: 'price.percent_change', phase: 'entry', sideScope: 'long', params: { direction: 'down', valuePct: -1, window: '3m' } },
        { key: 'volume.threshold', phase: 'entry', sideScope: 'long', params: { mode: 'relative_to_sma', multiplier: 1.5 } },
      ],
    }
    const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
    const children = (merged as { rules?: Array<{ condition: { children?: Array<{ key?: string, params?: Record<string, unknown> }> } }> })?.rules?.[0].condition.children
    expect(children?.[0].params).toEqual({ direction: 'down', valuePct: -1, window: '3m' })
    expect(children?.[1].params).toEqual({ mode: 'relative_to_sma', multiplier: 1.5 })
  })
})
