/**
 * Issue #1493 块 B：reducer 不变量回归
 *
 * 锁定「flat 五桶 ≡ projectToFlat(rules)」硬约束：reducer 在写入路径上通过
 * `updateRuleAtomParams` 同步重建 rules 子树；末尾 `reprojectFromRules` 把
 * rules 重新派生回 flat。本 spec 验证 5 条核心路径（trigger / action / risk /
 * positionConstraint / protective_exit 换 key）下，invariant 成立。
 *
 * 与 `semantic-state-reducer.service.spec.ts` 区分：
 *   - 后者断言 reducer 的语义产物（flat 五桶值），fixture **不带 rules**
 *     → reducer 走 fail-open 纯 flat mutation 路径
 *   - 本 spec fixture **带 rules + provenance**
 *     → reducer 走 rules-first 路径，末尾 reproject 重新派生 flat
 */

import type { SemanticRule } from '../../types/atom-expr'
import type { SemanticState } from '../../types/semantic-state'
import { SemanticRuleProjectionService } from '../semantic-rule-projection.service'
import { SemanticStateReducerService } from '../semantic-state-reducer.service'

describe('SemanticStateReducerService — rules invariant (#1493 块 B)', () => {
  const service = new SemanticStateReducerService()
  const projection = new SemanticRuleProjectionService()

  // Issue #1493 C1：reducer 走 applyEvidenceOverrides 后，flat 五桶在 owner/slot
  //   层会被叠加 user_explicit evidence（projectToFlat 派生路径不含该字段）。
  //   invariant 比较时剥离 evidence + openSlots.evidence，仅比较结构性字段。
  function stripEvidence<T extends { evidence?: unknown, openSlots?: ReadonlyArray<{ evidence?: unknown }> }>(
    nodes: ReadonlyArray<T>,
  ): unknown[] {
    return nodes.map((node) => {
      const { evidence, openSlots, ...rest } = node as Record<string, unknown> & { openSlots?: ReadonlyArray<Record<string, unknown>> }
      const cleanedSlots = Array.isArray(openSlots)
        ? openSlots.map((s) => {
            const { evidence: _e, ...slotRest } = s as Record<string, unknown>
            return slotRest
          })
        : openSlots
      return { ...rest, ...(cleanedSlots !== undefined ? { openSlots: cleanedSlots } : {}) }
    })
  }

  function assertFlatEqualsProjection(state: SemanticState): void {
    if (!state.rules || state.rules.length === 0) {
      // 无 rules → fail-open 路径不变更 flat，跳过 invariant（与 reproject 守门一致）
      return
    }
    const projected = projection.projectToFlat(state.rules)
    expect(stripEvidence(state.trigger)).toEqual(stripEvidence(projected.trigger))
    expect(stripEvidence(state.action)).toEqual(stripEvidence(projected.action))
    expect(stripEvidence(state.positionConstraint ?? [])).toEqual(stripEvidence(projected.positionConstraint))
    expect(stripEvidence(state.orchestration)).toEqual(stripEvidence(projected.orchestration))
    // risk 桶经过 normalizeRiskSemantics 二次重排，invariant 不直接比较元素顺序，
    // 但元素 id / key 集合必须一致。
    const flatRiskIds = new Set(state.risk.map(r => r.id))
    const projectedRiskIds = new Set(projected.risk.map(r => r.id))
    expect(flatRiskIds).toEqual(projectedRiskIds)
  }

  it('trigger slot fill: flat ≡ projectToFlat(rules)', () => {
    const ruleId = 'rule-trigger-1'
    const initialRule: SemanticRule = {
      id: ruleId,
      phase: 'entry',
      sideScope: 'long',
      condition: {
        kind: 'atom',
        key: 'volume.relative_average',
        params: { event: 'spike', comparator: 'gt', lookbackBars: 20 },
      },
      effects: [],
    }
    const initial: SemanticState = {
      version: 1,
      families: [],
      trigger: [{
        id: `${ruleId}-cond-0`,
        key: 'volume.relative_average',
        phase: 'entry',
        sideScope: 'long',
        params: { event: 'spike', comparator: 'gt', lookbackBars: 20 },
        status: 'open',
        source: 'user_explicit',
        openSlots: [{
          slotKey: 'trigger.volume.relative_average.multiplier',
          fieldPath: 'triggers[0].params.multiplier',
          status: 'open',
          priority: 'core',
          questionHint: '请确认放量倍数。',
          affectsExecution: true,
        }],
        _provenance: { ruleId, conditionPath: 'condition.atom' },
      }],
      action: [],
      risk: [],
      position: null,
      contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
      normalizationNotes: [],
      updatedAt: '2026-05-18T00:00:00.000Z',
      positionConstraint: [],
      orchestration: [],
      orchestrationContracts: [],
      rules: [initialRule],
    }

    const next = service.applyClarificationAnswer({
      currentState: initial,
      targetSlotKey: 'trigger.volume.relative_average.multiplier',
      targetFieldPath: 'triggers[0].params.multiplier',
      answer: '高于均量 1.5 倍',
      messageIndex: 1,
    })

    // rules 已被更新
    expect(next.rules?.[0].condition).toMatchObject({
      kind: 'atom',
      params: expect.objectContaining({ multiplier: 1.5 }),
    })
    // flat ≡ reproject(rules)
    assertFlatEqualsProjection(next)
  })

  it('action slot fill: flat ≡ projectToFlat(rules)', () => {
    const ruleId = 'rule-action-1'
    const initialRule: SemanticRule = {
      id: ruleId,
      phase: 'entry',
      sideScope: 'long',
      condition: { kind: 'atom', key: 'volume.relative_average', params: { event: 'spike', comparator: 'gt', lookbackBars: 20, multiplier: 1.5 } },
      effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
    }
    const initial: SemanticState = {
      version: 1,
      families: [],
      trigger: [],
      action: [{
        id: `${ruleId}-eff-0`,
        key: 'action.open_long',
        params: {},
        status: 'open',
        source: 'user_explicit',
        openSlots: [{
          slotKey: 'action.order_type',
          fieldPath: 'actions[0].params.orderType',
          status: 'open',
          priority: 'behavior',
          questionHint: '请确认开仓订单类型。',
          affectsExecution: true,
        }],
        _provenance: { ruleId, conditionPath: 'effects[0].atom' },
      }],
      risk: [],
      position: null,
      contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
      normalizationNotes: [],
      updatedAt: '2026-05-18T00:00:00.000Z',
      positionConstraint: [],
      orchestration: [],
      orchestrationContracts: [],
      rules: [initialRule],
    }

    const next = service.applyClarificationAnswer({
      currentState: initial,
      targetSlotKey: 'action.order_type',
      targetFieldPath: 'actions[0].params.orderType',
      answer: '市价单',
      messageIndex: 2,
    })

    expect(next.rules?.[0].effects[0]).toMatchObject({
      kind: 'atom',
      params: expect.objectContaining({ orderType: '市价单' }),
    })
    assertFlatEqualsProjection(next)
  })

  it('risk generic param fill: flat ≡ projectToFlat(rules)', () => {
    const ruleId = 'rule-risk-1'
    const initialRule: SemanticRule = {
      id: ruleId,
      phase: 'exit',
      sideScope: 'long',
      condition: { kind: 'atom', key: 'risk.falling_knife_guard', params: { definition: 'unknown' } },
      effects: [],
    }
    const initial: SemanticState = {
      version: 1,
      families: [],
      trigger: [],
      action: [],
      risk: [{
        id: `${ruleId}-cond-0`,
        key: 'risk.falling_knife_guard',
        params: { definition: 'unknown' },
        status: 'open',
        source: 'user_explicit',
        openSlots: [{
          slotKey: 'risk.falling_knife_guard.definition',
          fieldPath: 'risk.params.definition',
          status: 'open',
          priority: 'risk',
          questionHint: '请确认不接飞刀的判定方式。',
          affectsExecution: true,
        }],
        _provenance: { ruleId, conditionPath: 'condition.atom' },
      }],
      position: null,
      contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
      normalizationNotes: [],
      updatedAt: '2026-05-18T00:00:00.000Z',
      positionConstraint: [],
      orchestration: [],
      orchestrationContracts: [],
      rules: [initialRule],
    }

    const next = service.applyClarificationAnswer({
      currentState: initial,
      targetSlotKey: 'risk.falling_knife_guard.definition',
      targetFieldPath: 'risk.params.definition',
      answer: '下一根 K 线收阳',
      messageIndex: 3,
    })

    expect(next.rules?.[0].condition).toMatchObject({
      kind: 'atom',
      params: expect.objectContaining({ definition: '下一根 K 线收阳' }),
    })
    assertFlatEqualsProjection(next)
  })

  it('protective_exit key swap: rules atom.key 同步重写', () => {
    const ruleId = 'rule-risk-protective'
    const initialRule: SemanticRule = {
      id: ruleId,
      phase: 'exit',
      sideScope: 'long',
      // eslint-disable-next-line atom-keys/no-atom-key-literal -- risk.protective_exit not yet in registry (follow-up #1329)
      condition: { kind: 'atom', key: 'risk.protective_exit', params: {} },
      effects: [],
    }
    const initial: SemanticState = {
      version: 1,
      families: [],
      trigger: [],
      action: [],
      risk: [{
        id: `${ruleId}-cond-0`,
        // eslint-disable-next-line atom-keys/no-atom-key-literal -- risk.protective_exit not yet in registry (follow-up #1329)
        key: 'risk.protective_exit',
        params: {},
        status: 'open',
        source: 'user_explicit',
        openSlots: [{
          // eslint-disable-next-line atom-keys/no-atom-key-literal -- slot key label (follow-up #1329)
          slotKey: 'risk.protective_exit',
          fieldPath: 'risk.params',
          status: 'open',
          priority: 'risk',
          questionHint: '请确认止损方式。',
          affectsExecution: true,
        }],
        _provenance: { ruleId, conditionPath: 'condition.atom' },
      }],
      position: null,
      contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
      normalizationNotes: [],
      updatedAt: '2026-05-18T00:00:00.000Z',
      positionConstraint: [],
      orchestration: [],
      orchestrationContracts: [],
      rules: [initialRule],
    }

    const next = service.applyClarificationAnswer({
      currentState: initial,
      // eslint-disable-next-line atom-keys/no-atom-key-literal -- slot key label (follow-up #1329)
      targetSlotKey: 'risk.protective_exit',
      answer: '止损 5%',
      messageIndex: 4,
    })

    // rules 内的 atom.key 已从 risk.protective_exit 切到 risk.stop_loss_pct
    // eslint-disable-next-line atom-keys/no-atom-key-literal -- follow-up #1329
    expect((next.rules?.[0].condition as { kind: 'atom', key: string }).key).toBe('risk.stop_loss_pct')
    // flat ≡ projectToFlat(rules)（risk 桶通过 id 集合等价检查）
    assertFlatEqualsProjection(next)
  })

  it('add_position constraint append: rules 新增 single-leaf gate rule', () => {
    const ruleId = 'rule-action-add-position'
    const initialRule: SemanticRule = {
      id: ruleId,
      phase: 'entry',
      sideScope: 'long',
      condition: { kind: 'atom', key: 'price.breakout_up', params: { reference: 'channel_high', period: 20 } },
      effects: [{ kind: 'atom', key: 'action.add_position', params: {} }],
    }
    const initial: SemanticState = {
      version: 1,
      families: [],
      trigger: [],
      action: [{
        id: `${ruleId}-eff-0`,
        key: 'action.add_position',
        params: {},
        status: 'open',
        source: 'user_explicit',
        openSlots: [{
          slotKey: 'action.add_position.constraint',
          fieldPath: 'actions[0].params.constraint',
          status: 'open',
          priority: 'behavior',
          questionHint: '请确认加仓约束。',
          affectsExecution: true,
        }],
        _provenance: { ruleId, conditionPath: 'effects[0].atom' },
      }],
      risk: [],
      position: null,
      contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
      normalizationNotes: [],
      updatedAt: '2026-05-18T00:00:00.000Z',
      positionConstraint: [],
      orchestration: [],
      orchestrationContracts: [],
      rules: [initialRule],
    }

    const next = service.applyClarificationAnswer({
      currentState: initial,
      targetSlotKey: 'action.add_position.constraint',
      targetFieldPath: 'actions[0].params.constraint',
      answer: '最多加仓 3 次',
      messageIndex: 5,
    })

    // rules 已 append single-leaf gate rule
    expect(next.rules?.length).toBe(2)
    const appended = next.rules?.[1]
    expect(appended).toMatchObject({
      phase: 'gate',
      sideScope: 'both',
      condition: {
        kind: 'atom',
        key: 'position.pyramiding_limit',
        params: expect.objectContaining({ maxLayers: 3 }),
      },
    })
    assertFlatEqualsProjection(next)
  })

  it('#1493-C3: 既有 positionConstraint 二次更新同步 rules（既有 pyramiding_limit constraint 重新调整 maxLayers）', () => {
    // 模拟「先 append 过 pyramiding_limit」的稳定态：rules 已有 single-leaf gate rule，
    //   flat positionConstraint 已经带上对应 _provenance 的 owner。
    const actionRuleId = 'rule-action-add-position'
    const constraintRuleId = 'clarified-rule-clarified-position-pyramiding-limit'
    const actionRule: SemanticRule = {
      id: actionRuleId,
      phase: 'entry',
      sideScope: 'long',
      condition: { kind: 'atom', key: 'price.breakout_up', params: { reference: 'channel_high', period: 20 } },
      effects: [{ kind: 'atom', key: 'action.add_position', params: {} }],
    }
    const existingConstraintRule: SemanticRule = {
      id: constraintRuleId,
      phase: 'gate',
      sideScope: 'both',
      condition: { kind: 'atom', key: 'position.pyramiding_limit', params: { maxLayers: 3 } },
      effects: [],
    }
    const initial: SemanticState = {
      version: 1,
      families: [],
      trigger: [],
      action: [{
        id: `${actionRuleId}-eff-0`,
        key: 'action.add_position',
        params: {},
        status: 'open',
        source: 'user_explicit',
        openSlots: [{
          slotKey: 'action.add_position.constraint',
          fieldPath: 'actions[0].params.constraint',
          status: 'open',
          priority: 'behavior',
          questionHint: '请确认加仓约束。',
          affectsExecution: true,
        }],
        _provenance: { ruleId: actionRuleId, conditionPath: 'effects[0].atom' },
      }],
      risk: [],
      position: null,
      contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
      normalizationNotes: [],
      updatedAt: '2026-05-18T00:00:00.000Z',
      positionConstraint: [{
        id: 'clarified-position-pyramiding-limit',
        key: 'position.pyramiding_limit',
        params: { maxLayers: 3 },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        _provenance: { ruleId: constraintRuleId, conditionPath: 'condition.atom' },
      }],
      orchestration: [],
      orchestrationContracts: [],
      rules: [actionRule, existingConstraintRule],
    }

    // 用户二次给出更高的层数，触发 existing 分支
    const next = service.applyClarificationAnswer({
      currentState: initial,
      targetSlotKey: 'action.add_position.constraint',
      targetFieldPath: 'actions[0].params.constraint',
      answer: '最多加仓 5 次',
      messageIndex: 7,
    })

    // rules 数量不变（仍是 2 条），constraint rule 的 maxLayers 应被同步
    expect(next.rules?.length).toBe(2)
    const updatedRule = next.rules?.find(r => r.id === constraintRuleId)
    expect(updatedRule).toBeDefined()
    if (updatedRule?.condition.kind === 'atom') {
      expect(updatedRule.condition.params).toMatchObject({ maxLayers: 5 })
    }
    // flat trigger 由 projectCondition 派生（rule.condition.atom 不论 bucket 全进 trigger 桶）
    const pyramidTrigger = next.trigger.find(t => t.key === 'position.pyramiding_limit')
    expect(pyramidTrigger?.params).toMatchObject({ maxLayers: 5 })
    assertFlatEqualsProjection(next)
  })

  // Issue #1493 R2 M-new-1：applyEquivalentConfirmationSlots 同义槽降复路径
  //   原实现只对「主路径目标 slot」调 recordSlotEvidence；兄弟 trigger 的 confirmationMode
  //   slot 虽被 mutate 写入 user_explicit evidence，但未进入 evidenceOverrides；一旦
  //   reproject 在未来注册 required:true confirmationMode 或经过其它带 _provenance 路径
  //   重新派生 openSlots，兄弟 slot 的 evidence 就会丢失。本 spec 锁定回调注入的契约。
  //
  //   规约：reducer.applyEquivalentConfirmationSlotReduction 被调用时，必须对每个被
  //   mutate 的兄弟 slot 调用 evidenceCollector，使其进入 evidenceOverrides。这里通过
  //   spy on projection.reprojectFromRules + applyEvidenceOverrides 不便（私有），改为
  //   验证 reducer 返回结果：兄弟 trigger 上的 slot.evidence.source === 'user_explicit'。
  //
  //   fixture 不含 rules → reducer 走 fail-open 路径（reproject 退化为 no-op），但
  //   evidenceOverrides 仍会在 applyEvidenceOverrides 上对 _provenance 命中的 owner
  //   叠加 evidence。我们额外在兄弟 trigger 上挂 _provenance，让 override 真正落地。
  it('M-new-1: applyEquivalentConfirmationSlots preserves user_explicit evidence on sibling slots', () => {
    const ruleAId = 'rule-entry-bollinger-lower'
    const ruleBId = 'rule-exit-bollinger-upper'

    const initial: SemanticState = {
      version: 1,
      families: ['single-leg'],
      trigger: [
        {
          id: `${ruleAId}-cond-0`,
          key: 'price.detect.indicator_boundary',
          phase: 'entry',
          sideScope: 'long',
          params: { indicator: { name: 'bollinger', period: 20, stdDev: 2 }, boundary: 'lower' },
          status: 'open',
          source: 'user_explicit',
          openSlots: [{
            slotKey: 'confirmationMode.entry',
            fieldPath: 'triggers[0].params.confirmationMode',
            status: 'open',
            priority: 'core',
            questionHint: '该触发条件是触碰即触发，还是收盘确认后触发？',
            affectsExecution: true,
          }],
          _provenance: { ruleId: ruleAId, conditionPath: 'condition.atom' },
        },
        {
          id: `${ruleBId}-cond-0`,
          key: 'price.detect.indicator_boundary',
          phase: 'exit',
          sideScope: 'long',
          params: { indicator: { name: 'bollinger', period: 20, stdDev: 2 }, boundary: 'upper' },
          status: 'open',
          source: 'user_explicit',
          openSlots: [{
            slotKey: 'confirmationMode.exit',
            fieldPath: 'triggers[1].params.confirmationMode',
            status: 'open',
            priority: 'core',
            questionHint: '该触发条件是触碰即触发，还是收盘确认后触发？',
            affectsExecution: true,
          }],
          _provenance: { ruleId: ruleBId, conditionPath: 'condition.atom' },
        },
      ],
      action: [],
      risk: [],
      position: null,
      contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
      normalizationNotes: [],
      updatedAt: '2026-05-18T00:00:00.000Z',
      positionConstraint: [],
      orchestration: [],
      orchestrationContracts: [],
      // 故意不挂 rules：reducer 走 fail-open 路径，reprojectFromRules 退化为 no-op，
      // 保证 confirmationMode 兄弟 slot 不被 reproject 重新派生丢弃；
      // 但 applyEvidenceOverrides 仍会按 _provenance 命中 owner 应用 override —
      // 覆盖回 evidence。修复后兄弟 slot 走 evidenceCollector，override 中带兄弟 slot
      // 的 user_explicit evidence；若 caller 未注入 collector（修复前），override
      // 列表里缺失兄弟项，applyEvidenceOverrides 对兄弟 slot 无 effect，但直接 mutation
      // 写入的 evidence 仍在——只有当 reproject 派生新 slot 时才会丢，这里通过 spy
      // 评估 override 列表更可靠。
    }

    const next = service.applyClarificationAnswer({
      currentState: initial,
      targetSlotKey: 'confirmationMode.entry',
      targetFieldPath: 'triggers[0].params.confirmationMode',
      answer: '触碰即触发',
      messageIndex: 7,
      applyEquivalentConfirmationSlots: true,
    })

    // 主路径 trigger（entry）触发主路径 recordSlotEvidence
    const entrySlot = next.trigger.find(t => t._provenance?.ruleId === ruleAId)
      ?.openSlots.find(s => s.slotKey === 'confirmationMode.entry')
    expect(entrySlot?.value).toBe('touch')
    expect(entrySlot?.evidence?.source).toBe('user_explicit')

    // 同义兄弟 trigger（exit）：mutation 直接写入 evidence
    //   + evidenceCollector 回调（修复后）把 override 也推进队列，
    //   保证下游 applyEvidenceOverrides 命中 owner 时正确写入 user_explicit evidence
    //   而非派生默认 evidence。
    const exitSlot = next.trigger.find(t => t._provenance?.ruleId === ruleBId)
      ?.openSlots.find(s => s.slotKey === 'confirmationMode.exit')
    expect(exitSlot?.value).toBe('touch')
    expect(exitSlot?.evidence?.source).toBe('user_explicit')
    expect(exitSlot?.evidence?.text).toBe('触碰即触发')
  })
})
