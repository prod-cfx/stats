/**
 * Issue #1445：planner 输出 schema 硬校验 + metric stub 单测
 *
 * 覆盖验收标准：
 *   - 旧 atoms[] 形态 → schema reject (legacy_flat_field)
 *   - rules[] 但缺 condition → reject (rule_shape_invalid)
 *   - rules[] 但缺 evidence.text → reject (evidence_text_missing)
 *   - 合规 rules[] → 通过
 *   - evidence.text 非 user message 子串 → warning (evidence_text_not_substring)，不阻断脚本生成
 *   - condition 内叶子来自 action 桶 → reject (condition_leaf_bucket_invalid)
 *   - effects 内叶子来自 trigger 桶 → reject (effects_leaf_bucket_invalid)
 *   - 用 cmp9d849x0nyxx5qsf0wdfcp3 原 user message + 9 个扁平 atoms[] → reject
 *   - metric 在 reject 路径有计数（结构化 logger.warn stub）
 */
import { Logger } from '@nestjs/common'
import { PlannerDispatcherMergeService } from '../planner-dispatcher-merge.service'

describe('PlannerDispatcherMergeService.validatePlannerSemanticPatch (#1445)', () => {
  const svc = new PlannerDispatcherMergeService()
  const userMessage = '5min K 线里面 价格在 EMA20/60/144 上方时做多开仓 都位于下方只开空 入场是 BOLL 下轨开多 上轨开空 币安 BTCUSDT 永续 风控亏损 5% 止损'
  const typedEffects = (
    roles: Partial<Record<'actions' | 'risks' | 'positions' | 'orchestration' | 'programs', ReadonlyArray<Record<string, unknown>>>> = {},
  ) => ({
    actions: roles.actions ?? [],
    risks: roles.risks ?? [],
    positions: roles.positions ?? [],
    orchestration: roles.orchestration ?? [],
    programs: roles.programs ?? [],
  })

  it('dedupes equivalent planner and dispatcher typed rules by semantic signature', () => {
    const planner = {
      rules: [{
        id: 'entry-long-15m-ema-stack',
        phase: 'entry',
        sideScope: 'long',
        condition: {
          kind: 'and',
          children: [
            { kind: 'atom', key: 'indicator.above', params: { indicator: 'ema', 'reference.period': 20, timeframe: '15m' } },
            { kind: 'atom', key: 'indicator.above', params: { indicator: 'ema', 'reference.period': 60, timeframe: '15m' } },
          ],
        },
        effects: typedEffects({ actions: [{ kind: 'atom', key: 'action.open_long', params: {} }] }),
        evidence: { text: '价格在 ema20 ema60 上方时做多开仓' },
      }],
    }
    const dispatcher = {
      rules: [{
        id: 'dispatcher-typed-rule-1',
        phase: 'entry',
        sideScope: 'long',
        condition: {
          kind: 'and',
          children: [
            { kind: 'atom', key: 'indicator.above', params: { timeframe: '15m', 'reference.period': 60, indicator: 'ema' } },
            { kind: 'atom', key: 'indicator.above', params: { timeframe: '15m', 'reference.period': 20, indicator: 'ema' } },
          ],
        },
        effects: typedEffects({ actions: [{ kind: 'atom', key: 'action.open_long', params: { phase: 'entry' } }] }),
        evidence: { text: '价格在 ema20 ema60 上方时做多开仓' },
      }],
    }

    const merged = svc.mergePlannerAndDispatcherPatches(planner as never, dispatcher as never)

    expect(merged?.rules).toHaveLength(1)
    expect(merged?.rules?.[0]?.id).toBe('entry-long-15m-ema-stack')
    expect(JSON.stringify(merged?.rules)).not.toContain('dispatcher-typed-rule-1')
  })

  it('rejects legacy flat atoms[] form (no rules[])', () => {
    const patch = {
      atoms: [
        { key: 'indicator.above', phase: 'entry' },
        { key: 'bollinger.touch_lower', phase: 'entry' },
      ],
    }
    const result = svc.validatePlannerSemanticPatch(patch, userMessage)
    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.reasons).toEqual(expect.arrayContaining(['legacy_flat_field']))
      expect(result.reasons).toEqual(expect.arrayContaining(['rules_missing_or_empty']))
      expect(result.reminder).toMatch(/rules-first/)
    }
  })

  it('rejects rules[] missing condition (rule_shape_invalid)', () => {
    const patch = {
      rules: [
        {
          id: 'r1',
          phase: 'entry',
          sideScope: 'long',
          // condition missing
          effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
          evidence: { text: '5min K 线' },
        },
      ],
    }
    const result = svc.validatePlannerSemanticPatch(patch, userMessage)
    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.reasons).toContain('rule_shape_invalid')
    }
  })

  it('rejects rules[] missing effects (rule_shape_invalid)', () => {
    const patch = {
      rules: [
        {
          id: 'r1',
          phase: 'entry',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'bollinger.touch_lower', params: {} },
          evidence: { text: 'BOLL 下轨开多' },
        },
      ],
    }
    const result = svc.validatePlannerSemanticPatch(patch, userMessage)
    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.reasons).toContain('rule_shape_invalid')
    }
  })

  it('rejects typed effects object missing a required role (rule_shape_invalid)', () => {
    const patch = {
      rules: [
        {
          id: 'r1',
          phase: 'entry',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'bollinger.touch_lower', params: {} },
          effects: {
            actions: [{ kind: 'atom', key: 'action.open_long', params: {} }],
            risks: [],
            positions: [],
            orchestration: [],
          },
          evidence: { text: 'BOLL 下轨开多' },
        },
      ],
    }
    const result = svc.validatePlannerSemanticPatch(patch, userMessage)
    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.reasons).toContain('rule_shape_invalid')
    }
  })

  it('rejects bare effects arrays (rule_shape_invalid)', () => {
    const patch = {
      rules: [
        {
          id: 'r1',
          phase: 'entry',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'bollinger.touch_lower', params: {} },
          effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
          evidence: { text: 'BOLL 下轨开多' },
        },
      ],
    }
    const result = svc.validatePlannerSemanticPatch(patch, userMessage)
    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.reasons).toContain('rule_shape_invalid')
    }
  })

  it('rejects rules[] with rule missing evidence.text (evidence_text_missing)', () => {
    const patch = {
      rules: [
        {
          id: 'r1',
          phase: 'entry',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'bollinger.touch_lower', params: {} },
          effects: typedEffects({ actions: [{ kind: 'atom', key: 'action.open_long', params: {} }] }),
          // evidence missing
        },
      ],
    }
    const result = svc.validatePlannerSemanticPatch(patch, userMessage)
    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.reasons).toContain('evidence_text_missing')
    }
  })

  it('downgrades non-substring evidence.text to warning without rejecting valid rules', () => {
    const patch = {
      rules: [
        {
          id: 'r1',
          phase: 'entry',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'bollinger.touch_lower', params: {} },
          effects: typedEffects({ actions: [{ kind: 'atom', key: 'action.open_long', params: {} }] }),
          evidence: { text: '不在 user message 中的内容 zzz' },
        },
      ],
    }
    const result = svc.validatePlannerSemanticPatch(patch, userMessage)
    expect(result.ok).toBe(true)
    if (result.ok === true) {
      expect(result.warnings).toContain('evidence_text_not_substring')
    }
  })

  it('downgrades typed role effect leaf evidence mismatch to warning', () => {
    const patch = {
      rules: [
        {
          id: 'r1',
          phase: 'entry',
          sideScope: 'both',
          condition: { kind: 'atom', key: 'bollinger.touch_lower', params: {} },
          effects: {
            actions: [{
              kind: 'atom',
              key: 'action.open_long',
              params: {},
              evidence: { text: '不在 user message 中的 action evidence' },
            }],
            risks: [],
            positions: [],
            orchestration: [],
            programs: [],
          },
          evidence: { text: 'BTCUSDT' },
        },
      ],
    }

    const result = svc.validatePlannerSemanticPatch(patch, 'BTCUSDT 启动策略')
    expect(result.ok).toBe(true)
    if (result.ok === true) {
      expect(result.warnings).toContain('evidence_text_not_substring')
    }
  })

  it('rejects when condition leaf comes from action bucket (condition_leaf_bucket_invalid)', () => {
    const patch = {
      rules: [
        {
          id: 'r1',
          phase: 'entry',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'action.open_long', params: {} }, // action 不能做 condition
          effects: typedEffects({ actions: [{ kind: 'atom', key: 'action.open_long', params: {} }] }),
          evidence: { text: '5min K 线' },
        },
      ],
    }
    const result = svc.validatePlannerSemanticPatch(patch, userMessage)
    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.reasons).toContain('condition_leaf_bucket_invalid')
    }
  })

  it('rejects when effects leaf comes from trigger bucket (effects_leaf_bucket_invalid)', () => {
    const patch = {
      rules: [
        {
          id: 'r1',
          phase: 'entry',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'bollinger.touch_lower', params: {} },
          effects: typedEffects({ actions: [{ kind: 'atom', key: 'bollinger.touch_lower', params: {} }] }), // trigger 不能做 effect
          evidence: { text: '5min K 线' },
        },
      ],
    }
    const result = svc.validatePlannerSemanticPatch(patch, userMessage)
    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.reasons).toContain('effects_leaf_bucket_invalid')
    }
  })

  it('accepts grid range rebalance inside effects.programs for program-phase rule (#1691 staging30 s10)', () => {
    // 复现 staging30 s10 主链路 regression：planner 对「价格区间 + 双向网格 + 止损止盈」
    // 用户输入产出 phase=program 规则，condition=grid.range_rebalance；planner 同时把
    // grid.range_rebalance（bucket=positionConstraint，作为程序载体）放进 effects.programs。
    // 修复前 role gate 仅接受 program.* atom，导致 effects_leaf_bucket_invalid，10 轮均无脚本产出。
    const userMessage = '在 OKX 交易 BTCUSDT 永续合约，15m 周期，价格区间 79200-80200，采用双向网格，每格间距 0.1%，单笔使用 10% 资金，按入场均价亏损 5% 止损、盈利 10% 止盈'
    const patch = {
      rules: [{
        id: 'program-bidirectional-grid-range',
        phase: 'program',
        sideScope: 'both',
        condition: {
          kind: 'atom',
          key: 'grid.range_rebalance',
          params: { rangeLower: 79200, rangeUpper: 80200, stepPct: 0.1, sideMode: 'both' },
        },
        effects: typedEffects({
          risks: [
            { kind: 'atom', key: 'risk.stop_loss_pct', params: { basis: 'entry_avg_price', scope: 'position', effect: 'close', valuePct: 5, direction: 'down', basisSource: 'user_explicit' } },
            { kind: 'atom', key: 'risk.take_profit_pct', params: { basis: 'entry_avg_price', scope: 'position', effect: 'close', valuePct: 10, direction: 'up', basisSource: 'user_explicit' } },
            // 重复条目模拟 planner 多轮累积叠加；validator 不应因重复阻断。
            { kind: 'atom', key: 'risk.stop_loss_pct', params: { basis: 'entry_avg_price', scope: 'position', effect: 'close', valuePct: 5, direction: 'down', basisSource: 'user_explicit' } },
            { kind: 'atom', key: 'risk.take_profit_pct', params: { basis: 'entry_avg_price', scope: 'position', effect: 'close', valuePct: 10, direction: 'up', basisSource: 'user_explicit' } },
          ],
          programs: [{ kind: 'atom', key: 'grid.range_rebalance', params: { rangeLower: 79200, rangeUpper: 80200, stepPct: 0.1, sideMode: 'both' } }],
        }),
        evidence: { text: '价格区间 79200-80200，采用双向网格' },
      }],
    }

    const result = svc.validatePlannerSemanticPatch(patch, userMessage)

    expect(result.ok).toBe(true)
    if (result.ok === false) {
      expect(result.reasons).not.toContain('effects_leaf_bucket_invalid')
    }
  })

  it('still rejects non-whitelisted positionConstraint atom inside effects.programs', () => {
    // 防止对所有 positionConstraint 桶放行造成的回退：只有 CONDITION_ALLOWED_POSITION_CONSTRAINT_ATOMS
    // 白名单上的 atom（当前仅 grid.range_rebalance）可作 program body。
    const patch = {
      rules: [{
        id: 'program-role-invalid',
        phase: 'program',
        sideScope: 'both',
        condition: { kind: 'atom', key: 'execution.on_start', params: {} },
        effects: typedEffects({
          programs: [{ kind: 'atom', key: 'position.dca_schedule', params: {} }],
        }),
        evidence: { text: '启动后运行' },
      }],
    }
    const result = svc.validatePlannerSemanticPatch(patch, '启动后运行')
    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.reasons).toContain('effects_leaf_bucket_invalid')
    }
  })

  it('accepts grid range rebalance as a rules-tree condition leaf', () => {
    const patch = {
      rules: [
        {
          id: 'grid-range',
          phase: 'entry',
          sideScope: 'both',
          condition: {
            kind: 'atom',
            key: 'grid.range_rebalance',
            params: { rangeLower: 60000, rangeUpper: 80000, stepPct: 0.5, sideMode: 'both' },
          },
          effects: typedEffects({ positions: [{ kind: 'atom', key: 'grid.range_rebalance', params: { rangeLower: 60000, rangeUpper: 80000, stepPct: 0.5, sideMode: 'both' } }] }),
          evidence: { text: '价格区间 60000-80000，采用双向网格，每格间距 0.5%' },
        },
      ],
    }

    const result = svc.validatePlannerSemanticPatch(
      patch,
      '价格区间 60000-80000，采用双向网格，每格间距 0.5%',
    )

    expect(result.ok).toBe(true)
  })

  it('passes for a compliant rules[] patch', () => {
    const patch = {
      rules: [
        {
          id: 'r1-boll-long',
          phase: 'entry',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'bollinger.touch_lower', params: {} },
          effects: typedEffects({ actions: [{ kind: 'atom', key: 'action.open_long', params: {} }] }),
          evidence: { text: 'BOLL 下轨开多' },
        },
        {
          id: 'r2-sl',
          phase: 'exit',
          sideScope: 'both',
          condition: { kind: 'atom', key: 'risk.atr_stop', params: {} },
          effects: typedEffects({ risks: [{ kind: 'atom', key: 'risk.atr_stop', params: {} }] }),
          evidence: { text: '5% 止损' },
        },
      ],
    }
    const result = svc.validatePlannerSemanticPatch(patch, userMessage)
    expect(result.ok).toBe(true)
  })

  it('cmp9d849x0nyxx5qsf0wdfcp3 replay: 9 flat atoms[] form must be rejected (not silently passed)', () => {
    // 用户实际策略输入触发的 planner 退化输出：扁平 9-10 个 atom 而非 rules-tree
    const patch = {
      atoms: [
        { key: 'indicator.above', phase: 'entry', params: { indicator: 'EMA', period: 20 } },
        { key: 'indicator.above', phase: 'entry', params: { indicator: 'EMA', period: 60 } },
        { key: 'indicator.above', phase: 'entry', params: { indicator: 'EMA', period: 144 } },
        { key: 'indicator.below', phase: 'entry', params: { indicator: 'EMA', period: 20 } },
        { key: 'indicator.below', phase: 'entry', params: { indicator: 'EMA', period: 60 } },
        { key: 'indicator.below', phase: 'entry', params: { indicator: 'EMA', period: 144 } },
        { key: 'bollinger.touch_lower', phase: 'entry', params: {} },
        { key: 'action.open_long', phase: 'entry', params: {} },
        { key: 'action.open_short', phase: 'entry', params: {} },
      ],
    }
    const result = svc.validatePlannerSemanticPatch(patch, userMessage)
    expect(result.ok).toBe(false)
    if (result.ok === false) {
      // 主链路必须 reject 而非走 merge 生成 4 条并列 entry
      expect(result.reasons).toEqual(expect.arrayContaining(['legacy_flat_field', 'rules_missing_or_empty']))
    }
  })

  it('rejects non-object planner semanticPatch', () => {
    expect(svc.validatePlannerSemanticPatch(null, userMessage).ok).toBe(false)
    expect(svc.validatePlannerSemanticPatch('not an object', userMessage).ok).toBe(false)
    expect(svc.validatePlannerSemanticPatch([], userMessage).ok).toBe(false)
  })

  it('emitPlannerSchemaRejectMetric writes structured metric line to logger.warn', () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    try {
      svc.emitPlannerSchemaRejectMetric('initial', 1)
      svc.emitPlannerSchemaRejectMetric('retry', 1)
      const calls = warnSpy.mock.calls.map(args => String(args[0]))
      expect(calls.some(s => s.includes('metric=planner_schema_reject_total') && s.includes('stage=initial'))).toBe(true)
      expect(calls.some(s => s.includes('metric=planner_schema_reject_total') && s.includes('stage=retry'))).toBe(true)
    }
    finally {
      warnSpy.mockRestore()
    }
  })

  // Issue #1633 C1：subset-condition entry/exit rule fold pass
  describe('Issue #1633 C1: foldSubsetConditionRules', () => {
    it('folds state-only entry into and(state,event) entry sharing lifecycle action key', () => {
      // staging s18 复测复现：planner 把同语义入场拆成两条 entry rule
      const merged: { rules: unknown[] } = {
        rules: [
          {
            id: 'r-entry-state-only',
            phase: 'entry',
            sideScope: 'long',
            condition: { kind: 'atom', key: 'price.candle_pattern', params: { pattern: 'engulfing' } },
            effects: typedEffects({ actions: [{ kind: 'atom', key: 'action.open_long', params: {} }] }),
            evidence: { text: '看涨吞没形态' },
          },
          {
            id: 'r-entry-state-and-event',
            phase: 'entry',
            sideScope: 'long',
            condition: {
              kind: 'and',
              children: [
                { kind: 'atom', key: 'price.candle_pattern', params: { pattern: 'engulfing' } },
                { kind: 'atom', key: 'volume.threshold', params: { multiplier: 1.5 } },
              ],
            },
            // superset 这条被错误改成 add_position
            effects: typedEffects({ actions: [{ kind: 'atom', key: 'action.open_long', params: {} }] }),
            evidence: { text: '看涨吞没形态 + 放量' },
          },
        ],
      }
      const result = svc.mergePlannerAndDispatcherPatches(merged as never, null)
      expect(result?.rules).toHaveLength(1)
      const folded = result?.rules?.[0]
      expect(folded?.condition?.kind).toBe('and')
      // 保留 subset rule 的身份 + effects（带正确的 open_long）
      expect(folded?.id).toBe('r-entry-state-only')
    })

    it('does NOT fold when conditions are disjoint (no subset relation)', () => {
      const merged: { rules: unknown[] } = {
        rules: [
          {
            id: 'r1',
            phase: 'entry',
            sideScope: 'long',
            condition: { kind: 'atom', key: 'bollinger.touch_lower', params: {} },
            effects: typedEffects({ actions: [{ kind: 'atom', key: 'action.open_long', params: {} }] }),
            evidence: { text: 'BOLL 下轨' },
          },
          {
            id: 'r2',
            phase: 'entry',
            sideScope: 'long',
            condition: {
              kind: 'and',
              children: [
                { kind: 'atom', key: 'indicator.above', params: { indicator: 'ema', period: 20 } },
                { kind: 'atom', key: 'volume.threshold', params: { multiplier: 2 } },
              ],
            },
            effects: typedEffects({ actions: [{ kind: 'atom', key: 'action.open_long', params: {} }] }),
            evidence: { text: 'EMA 上方 + 放量' },
          },
        ],
      }
      const result = svc.mergePlannerAndDispatcherPatches(merged as never, null)
      expect(result?.rules).toHaveLength(2)
    })

    it('does NOT fold when condition contains or/not/sequence (non-and superset)', () => {
      const merged: { rules: unknown[] } = {
        rules: [
          {
            id: 'r1',
            phase: 'entry',
            sideScope: 'long',
            condition: { kind: 'atom', key: 'bollinger.touch_lower', params: {} },
            effects: typedEffects({ actions: [{ kind: 'atom', key: 'action.open_long', params: {} }] }),
            evidence: { text: 'BOLL 下轨' },
          },
          {
            id: 'r2',
            phase: 'entry',
            sideScope: 'long',
            condition: {
              kind: 'or',
              children: [
                { kind: 'atom', key: 'bollinger.touch_lower', params: {} },
                { kind: 'atom', key: 'volume.threshold', params: { multiplier: 2 } },
              ],
            },
            effects: typedEffects({ actions: [{ kind: 'atom', key: 'action.open_long', params: {} }] }),
            evidence: { text: 'BOLL 下轨或放量' },
          },
        ],
      }
      const result = svc.mergePlannerAndDispatcherPatches(merged as never, null)
      // or 不是合法 superset 形态 → 不折叠
      expect(result?.rules).toHaveLength(2)
    })

    it('does NOT fold when rules do not share any lifecycle action', () => {
      const merged: { rules: unknown[] } = {
        rules: [
          {
            id: 'r1',
            phase: 'entry',
            sideScope: 'long',
            condition: { kind: 'atom', key: 'bollinger.touch_lower', params: {} },
            effects: typedEffects({ actions: [{ kind: 'atom', key: 'action.open_long', params: {} }] }),
            evidence: { text: 'BOLL 下轨开多' },
          },
          {
            id: 'r2',
            phase: 'entry',
            sideScope: 'short',
            condition: {
              kind: 'and',
              children: [
                { kind: 'atom', key: 'bollinger.touch_lower', params: {} },
                { kind: 'atom', key: 'volume.threshold', params: { multiplier: 2 } },
              ],
            },
            effects: typedEffects({ actions: [{ kind: 'atom', key: 'action.open_short', params: {} }] }),
            evidence: { text: 'BOLL 下轨放量开空' },
          },
        ],
      }
      const result = svc.mergePlannerAndDispatcherPatches(merged as never, null)
      // 无共享 lifecycle action (open_long vs open_short) → 不折叠
      expect(result?.rules).toHaveLength(2)
    })
  })
})
