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

  it('rejects rules[] with rule missing evidence.text (evidence_text_missing)', () => {
    const patch = {
      rules: [
        {
          id: 'r1',
          phase: 'entry',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'bollinger.touch_lower', params: {} },
          effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
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
          effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
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
          effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
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
          effects: [{ kind: 'atom', key: 'bollinger.touch_lower', params: {} }], // trigger 不能做 effect
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
          effects: [{ kind: 'atom', key: 'grid.range_rebalance', params: { rangeLower: 60000, rangeUpper: 80000, stepPct: 0.5, sideMode: 'both' } }],
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
          effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
          evidence: { text: 'BOLL 下轨开多' },
        },
        {
          id: 'r2-sl',
          phase: 'exit',
          sideScope: 'both',
          condition: { kind: 'atom', key: 'risk.atr_stop', params: {} },
          effects: [{ kind: 'atom', key: 'risk.atr_stop', params: {} }],
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
})
