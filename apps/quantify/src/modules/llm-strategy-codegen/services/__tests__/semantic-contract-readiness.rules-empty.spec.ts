/**
 * Issue #1493 块 D — readiness 以 rules tree 为权威。
 *
 * 覆盖（验收标准 #19/#21/#24）：
 *  - rules 非空但 flat 强制清空 → normalize() 入口 reproject 重建 flat → ready 由 rules 判定
 *  - rules 含 AND(a,b) → projectToFlat 拆叶子但 combinationContract 挂在首叶子，
 *    不会被拆成 2 条独立 trigger entry（结构性"AND 不被拆散"契约）
 *  - rules=[] + flat 非空 → 走 legacy flat 路径（块 D 注释明确：full rules-only
 *    切流留给后续 PR；本 spec 仅锁定"rules 空时不退化、走原 flat 路径"行为）
 *  - rules 非空时 normalize() 返回的 state.trigger 已被 reproject 覆盖（与传入的
 *    flat 完全无关），证实 flat ≡ projection(rules)
 */
import type { AtomExpr, SemanticRule } from '../../types/atom-expr'
import type { SemanticState } from '../../types/semantic-state'
import { SemanticContractReadinessService } from '../semantic-contract-readiness.service'

function atom(key: string, params: Record<string, unknown> = {}): AtomExpr {
  return { kind: 'atom', key, params }
}

function andExpr(...children: AtomExpr[]): AtomExpr {
  return { kind: 'and', children }
}

function rule(partial: Partial<SemanticRule> & { id: string; condition: AtomExpr }): SemanticRule {
  return {
    id: partial.id,
    phase: partial.phase ?? 'entry',
    sideScope: partial.sideScope ?? 'both',
    condition: partial.condition,
    effects: partial.effects ?? [],
  }
}

function baseState(overrides: Partial<SemanticState> = {}): SemanticState {
  return {
    version: 1,
    families: [],
    trigger: [],
    action: [],
    risk: [],
    positionConstraint: [],
    orchestration: [],
    orchestrationContracts: [],
    position: null,
    contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
    normalizationNotes: [],
    updatedAt: '2026-05-18T00:00:00.000Z',
    ...overrides,
  }
}

function lockedExecutableContext(): SemanticState['contextSlots'] {
  return {
    exchange: { slotKey: 'exchange', fieldPath: 'contextSlots.exchange', value: 'okx', status: 'locked', priority: 'context', questionHint: '请选择交易所', affectsExecution: true },
    symbol: { slotKey: 'symbol', fieldPath: 'contextSlots.symbol', value: 'BTCUSDT', status: 'locked', priority: 'context', questionHint: '请选择交易标的', affectsExecution: true },
    marketType: { slotKey: 'marketType', fieldPath: 'contextSlots.marketType', value: 'perp', status: 'locked', priority: 'context', questionHint: '请选择市场类型', affectsExecution: true },
    timeframe: { slotKey: 'timeframe', fieldPath: 'contextSlots.timeframe', value: '15m', status: 'locked', priority: 'context', questionHint: '请选择周期', affectsExecution: true },
  }
}

describe('#1493 块 D — readiness rules-as-source-of-truth', () => {
  const svc = new SemanticContractReadinessService()

  it('rules 非空 + flat 强制清空：normalize() 入口 reproject 把 flat 由 rules 重建', () => {
    const rules: SemanticRule[] = [
      rule({
        id: 'r1',
        phase: 'entry',
        condition: atom('bollinger.touch_lower'),
        effects: [atom('action.open_long')],
      }),
      rule({
        id: 'r2',
        phase: 'exit',
        condition: atom('price.cross_above_ma', { period: 20 }),
        effects: [atom('action.close_long'), atom('risk.stop_loss_pct', { pct: 5 })],
      }),
    ]
    // 传入 flat=[] 强制证伪：rules 才是真源
    const state = baseState({ rules, trigger: [], action: [], risk: [], contextSlots: lockedExecutableContext() })

    const result = svc.normalize(state)

    // flat 已由 reproject 重建：trigger / action / risk 桶都不再是空
    expect(result.state.trigger.length).toBeGreaterThan(0)
    expect(result.state.action.length).toBeGreaterThan(0)
    expect(result.state.risk.length).toBeGreaterThan(0)
    // ready 由 evaluateRulesReadiness 决定（entry+exit+risk 齐备）
    expect(result.ready).toBe(true)
  })

  it('rules AND(a, b) 多叶子：reproject 后 trigger 多叶展开，combinationContract 挂在首叶子（不被拆散）', () => {
    const rules: SemanticRule[] = [
      rule({
        id: 'r1',
        phase: 'entry',
        condition: andExpr(
          atom('bollinger.touch_lower'),
          atom('volume.threshold', { multiplier: 2 }),
        ),
        effects: [atom('action.open_long')],
      }),
      rule({
        id: 'r2',
        phase: 'exit',
        condition: atom('price.cross_above_ma'),
        effects: [atom('action.close_long'), atom('risk.stop_loss_pct', { pct: 3 })],
      }),
    ]
    // 上游"flat 拆开成多 entry"伪造：reproject 会把它彻底覆盖
    const state = baseState({
      rules,
      contextSlots: lockedExecutableContext(),
      trigger: [
        // 假装上游错误地把 AND 拆成两条独立 trigger（没 combinationContract）
        // 验证：normalize 后这套伪造 flat 被 reproject 替换
        { id: 'fake-a', key: 'bollinger.touch_lower', phase: 'entry', params: {}, status: 'locked', source: 'user_explicit', openSlots: [], contracts: [] } as never,
        { id: 'fake-b', key: 'volume.threshold', phase: 'entry', params: {}, status: 'locked', source: 'user_explicit', openSlots: [], contracts: [] } as never,
      ],
    })

    const result = svc.normalize(state)

    // reproject 后 entry rule 的 AND 两叶子在 trigger 桶里，且首叶子带 combinationContract
    const entryTriggers = result.state.trigger.filter(t => t.phase === 'entry')
    expect(entryTriggers.length).toBe(2)
    const isCombinationContract = (c: { capabilities?: ReadonlyArray<{ object?: string }> }) =>
      (c.capabilities ?? []).some(cap => cap.object === 'predicate_group')
    const firstHasCombination = (entryTriggers[0].contracts ?? []).some(isCombinationContract)
    expect(firstHasCombination).toBe(true)
    // 第二个叶子不该带 combinationContract（语义"不被拆散"——一组 AND 共享一个 combination 描述）
    const secondHasCombination = (entryTriggers[1].contracts ?? []).some(isCombinationContract)
    expect(secondHasCombination).toBe(false)
    // rules 判定：entry + exit + risk 齐备
    expect(result.ready).toBe(true)
  })

  it('rules=[] + flat 非空：保留 legacy 路径（块 D 注释说明 full rules-only 切流留后续）', () => {
    // 老 fixture：直接构造 flat，rules undefined
    const state = baseState({
      trigger: [{
        id: 'legacy-trigger',
        key: 'bollinger.touch_lower',
        phase: 'entry',
        params: {},
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        support: { supportStatus: 'supported_executable' },
        contracts: [{
          id: 'tc-1',
          kind: 'trigger',
          capabilities: [],
          requires: [],
          params: {},
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
        }],
      }] as never,
      action: [{
        id: 'legacy-action',
        key: 'open_long',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        support: { supportStatus: 'supported_executable' },
        contracts: [{
          id: 'ac-1',
          kind: 'action',
          capabilities: [],
          requires: [],
          params: {},
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
        }],
      }] as never,
    })

    const result = svc.normalize(state)

    // legacy 路径：normalize 不应抛错，flat 不被清空（rules empty → reproject no-op）
    expect(result.state.trigger.length).toBe(1)
    expect(result.state.action.length).toBe(1)
    // 关键不变量：legacy 路径保留了原 flat 数据（id/key 未被改写），证明 reproject 没误清
    expect(result.state.trigger[0].id).toBe('legacy-trigger')
    expect(result.state.action[0].id).toBe('legacy-action')
  })

  it('rules 非空时即便上游传入 flat 与 rules 不一致也以 rules 为准（反向投影 invariant）', () => {
    const rules: SemanticRule[] = [
      rule({
        id: 'r1',
        phase: 'entry',
        condition: atom('bollinger.touch_lower'),
        effects: [atom('action.open_long')],
      }),
    ]
    // 上游错误：flat 写了一个 rules 里没有的 trigger（key 错乱）
    const state = baseState({
      rules,
      trigger: [{
        id: 'wrong-key-trigger',
        key: 'price.breakout_up',
        phase: 'entry',
        params: {},
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        contracts: [],
      }] as never,
    })

    const result = svc.normalize(state)

    // reproject 后 trigger 桶只能含 bollinger.touch_lower（来自 rules）
    const keys = result.state.trigger.map(t => t.key)
    expect(keys).toContain('bollinger.touch_lower')
    expect(keys).not.toContain('price.breakout_up')
  })
})
