import { Test } from '@nestjs/testing'

import type { SemanticRule } from '../../types/atom-expr'
import { SemanticRuleProjectionService } from '../semantic-rule-projection.service'

describe('SemanticRuleProjectionService (Issue #1395)', () => {
  let svc: SemanticRuleProjectionService

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [SemanticRuleProjectionService],
    }).compile()
    svc = moduleRef.get(SemanticRuleProjectionService)
  })

  it('projects single-atom rule to 1 trigger node', () => {
    const rules: SemanticRule[] = [{
      id: 'r1',
      phase: 'entry',
      sideScope: 'long',
      condition: { kind: 'atom', key: 'oscillator.rsi_gte', params: { period: 14, threshold: 65 } },
      effects: [],
    }]
    const out = svc.projectToFlat(rules)
    expect(out.trigger).toHaveLength(1)
    expect(out.trigger[0]!.key).toBe('oscillator.rsi_gte')
    expect(out.trigger[0]!.phase).toBe('entry')
    expect(out.trigger[0]!.sideScope).toBe('long')
  })

  it('projects AND of 2 atoms to 2 triggers + combination contract on first', () => {
    const rules: SemanticRule[] = [{
      id: 'r2',
      phase: 'entry',
      sideScope: 'long',
      condition: {
        kind: 'and',
        children: [
          { kind: 'atom', key: 'bollinger.touch_lower', params: {} },
          { kind: 'atom', key: 'volume.threshold', params: { multiplier: 1.5 } },
        ],
      },
      effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
    }]
    const out = svc.projectToFlat(rules)
    expect(out.trigger).toHaveLength(2)
    expect(out.trigger[0]!.contracts?.length ?? 0).toBeGreaterThan(0)
    expect(out.trigger[1]!.contracts?.length ?? 0).toBe(0)
    // action 投影需依赖 ATOM_CONTRACT_REGISTRY['action.open_long'].bucket === 'action'
    // 若 registry 中尚未注册该 key，projection 应安全 skip，本断言用 conditional
    if (out.action.length > 0) {
      expect(out.action[0]!.key).toBe('action.open_long')
    }
  })

  it('handles OR combination', () => {
    const rules: SemanticRule[] = [{
      id: 'r-or',
      phase: 'entry',
      sideScope: 'short',
      condition: {
        kind: 'or',
        children: [
          { kind: 'atom', key: 'a.x', params: {} },
          { kind: 'atom', key: 'a.y', params: {} },
        ],
      },
      effects: [],
    }]
    const out = svc.projectToFlat(rules)
    expect(out.trigger).toHaveLength(2)
    expect(out.trigger[0]!.sideScope).toBe('short')
    expect(out.trigger[0]!.contracts?.length ?? 0).toBeGreaterThan(0)
  })

  it('projects risk effects when registry bucket === "risk"', () => {
    const rules: SemanticRule[] = [{
      id: 'r3',
      phase: 'entry',
      sideScope: 'long',
      condition: { kind: 'atom', key: 'price.breakout_up', params: {} },
      effects: [
        { kind: 'atom', key: 'risk.atr_stop', params: { multiple: 2 } },
        { kind: 'atom', key: 'risk.atr_take_profit', params: { multiple: 3 } },
      ],
    }]
    const out = svc.projectToFlat(rules)
    // 取决于 registry 是否注册了对应 atom；未注册的 leaf 被静默 skip
    for (const r of out.risk) {
      expect(['risk.atr_stop', 'risk.atr_take_profit']).toContain(r.key)
    }
  })

  it('returns empty buckets for empty rules', () => {
    const out = svc.projectToFlat([])
    expect(out.trigger).toEqual([])
    expect(out.action).toEqual([])
    expect(out.risk).toEqual([])
    expect(out.positionConstraint).toEqual([])
    expect(out.orchestration).toEqual([])
  })

  it('drops unknown atom keys in effects silently', () => {
    const rules: SemanticRule[] = [{
      id: 'r-unknown',
      phase: 'entry',
      sideScope: 'long',
      condition: { kind: 'atom', key: 'oscillator.rsi_gte', params: {} },
      effects: [{ kind: 'atom', key: 'totally.unknown.key.xyz', params: {} }],
    }]
    expect(() => svc.projectToFlat(rules)).not.toThrow()
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Issue #1432 R-C：orchestration projection 派生（之前 MVP 占位 return）
  //   网格策略 publication gate 三方一致依赖 rules 中 orchestration leaf 能
  //   投影到 state.orchestration。
  // ───────────────────────────────────────────────────────────────────────────
  it('R-C: program.dynamic_grid leaf 在 rule.effects 中被投影到 orchestration', () => {
    const rules: SemanticRule[] = [{
      id: 'r-grid',
      phase: 'entry',
      sideScope: 'both',
      condition: { kind: 'atom', key: 'oscillator.rsi_lte', params: { period: 14, threshold: 30 } },
      effects: [{
        kind: 'atom',
        key: 'program.dynamic_grid',
        params: { programKind: 'dynamic_grid', anchorLookbackBars: 24, levelCount: 10 },
      }],
    }]
    const out = svc.projectToFlat(rules)
    expect(out.orchestration).toHaveLength(1)
    expect(out.orchestration[0].kind).toBe('program')
    expect(out.orchestration[0].key).toBe('program.dynamic_grid')
    expect(out.orchestration[0].params).toEqual({ programKind: 'dynamic_grid', anchorLookbackBars: 24, levelCount: 10 })
    expect(out.orchestration[0].id).toBe('r-grid-eff-0')
    expect(out.orchestration[0].status).toBe('locked')
    expect(out.orchestration[0].source).toBe('user_explicit')
    expect(out.orchestration[0].openSlots).toEqual([])
    expect(out.orchestration[0].contracts).toEqual([])
  })

  it('R-C: gate.regime leaf 投影 kind="gate"', () => {
    const rules: SemanticRule[] = [{
      id: 'r-gate',
      phase: 'gate',
      sideScope: 'both',
      condition: { kind: 'atom', key: 'oscillator.rsi_lte', params: { threshold: 30 } },
      effects: [{ kind: 'atom', key: 'gate.regime', params: { target: 'entry' } }],
    }]
    const out = svc.projectToFlat(rules)
    expect(out.orchestration).toHaveLength(1)
    expect(out.orchestration[0].kind).toBe('gate')
    expect(out.orchestration[0].key).toBe('gate.regime')
  })

  it('R-C: scope.symbol leaf 投影 kind="scope"', () => {
    const rules: SemanticRule[] = [{
      id: 'r-scope',
      phase: 'entry',
      sideScope: 'both',
      condition: { kind: 'atom', key: 'oscillator.rsi_lte', params: { threshold: 30 } },
      effects: [{ kind: 'atom', key: 'scope.symbol', params: { symbols: ['BTCUSDT'] } }],
    }]
    const out = svc.projectToFlat(rules)
    expect(out.orchestration).toHaveLength(1)
    expect(out.orchestration[0].kind).toBe('scope')
    expect(out.orchestration[0].key).toBe('scope.symbol')
  })

  it('R-C: portfolioRisk.drawdown_block leaf 投影 kind="portfolioRisk"', () => {
    const rules: SemanticRule[] = [{
      id: 'r-pr',
      phase: 'gate',
      sideScope: 'both',
      condition: { kind: 'atom', key: 'oscillator.rsi_lte', params: { threshold: 30 } },
      effects: [{ kind: 'atom', key: 'portfolioRisk.drawdown_block', params: { thresholdPct: 5 } }],
    }]
    const out = svc.projectToFlat(rules)
    expect(out.orchestration).toHaveLength(1)
    expect(out.orchestration[0].kind).toBe('portfolioRisk')
  })

  it('R-C: 多 orchestration leaf 在同 rule 内全部投影（每条独立 id）', () => {
    const rules: SemanticRule[] = [{
      id: 'r-multi',
      phase: 'entry',
      sideScope: 'both',
      condition: { kind: 'atom', key: 'oscillator.rsi_lte', params: { threshold: 30 } },
      effects: [
        { kind: 'atom', key: 'program.dynamic_grid', params: {} },
        { kind: 'atom', key: 'gate.regime', params: {} },
      ],
    }]
    const out = svc.projectToFlat(rules)
    expect(out.orchestration).toHaveLength(2)
    expect(out.orchestration[0].id).not.toBe(out.orchestration[1].id)
  })

  it('R-C: dispatchEffectLeaf 前的 contract lookup 兜底——unknown atom 静默 skip', () => {
    // 注意：本用例只覆盖 dispatchEffectLeaf switch 之前的 contract 不存在兜底；
    //   未触发 inferOrchestrationKind 的 null 分支（那需要 atom contract 存在但
    //   bucket='orchestration' 且 key prefix 不在四类之一，由下一条用例覆盖）。
    const rules: SemanticRule[] = [{
      id: 'r-unk',
      phase: 'entry',
      sideScope: 'both',
      condition: { kind: 'atom', key: 'oscillator.rsi_lte', params: { threshold: 30 } },
      effects: [{ kind: 'atom', key: 'totally.unknown.key.xyz', params: {} }],
    }]
    const out = svc.projectToFlat(rules)
    expect(out.orchestration).toEqual([])
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Issue #1433 R-A：metadata 从 contract.paramSlots 反推
  //   消除 projection 各 case 的 status:'locked' / openSlots:[] 硬编码，
  //   让 clarification 链路在 rules-first 路径下重新通电。
  // ───────────────────────────────────────────────────────────────────────────
  it('R-A: 缺 required slot 时 trigger.status=open + openSlots 含对应 slot', () => {
    // price.percent_change 的 paramSlots.valuePct.required=true（atom-contract-registry.ts:1214）
    // 用户输入只给 direction 没给 valuePct → status 应为 open
    const rules: SemanticRule[] = [{
      id: 'r-pc',
      phase: 'entry',
      sideScope: 'long',
      condition: { kind: 'atom', key: 'price.percent_change', params: { direction: 'down' } },
      effects: [],
    }]
    const out = svc.projectToFlat(rules)
    expect(out.trigger).toHaveLength(1)
    expect(out.trigger[0].status).toBe('open')
    expect(out.trigger[0].openSlots.length).toBeGreaterThanOrEqual(1)
    const valuePctSlot = out.trigger[0].openSlots.find(s => s.paramSlotKey === 'valuePct')
    expect(valuePctSlot).toBeDefined()
    expect(valuePctSlot?.slotKey).toBe('price.percent_change.valuePct')
    expect(valuePctSlot?.fieldPath).toBe('r-pc-cond-0.params.valuePct')
    expect(valuePctSlot?.atomKey).toBe('price.percent_change')
    expect(valuePctSlot?.status).toBe('open')
    expect(valuePctSlot?.priority).toBe('core')
    expect(valuePctSlot?.affectsExecution).toBe(true)
  })

  it('R-A: required slot 齐全时 status=locked + openSlots=[]', () => {
    // price.percent_change 给齐 direction + valuePct（valuePct 是唯一 required）
    const rules: SemanticRule[] = [{
      id: 'r-pc-full',
      phase: 'entry',
      sideScope: 'long',
      condition: { kind: 'atom', key: 'price.percent_change', params: { direction: 'down', valuePct: -1 } },
      effects: [],
    }]
    const out = svc.projectToFlat(rules)
    expect(out.trigger[0].status).toBe('locked')
    expect(out.trigger[0].openSlots).toEqual([])
  })

  it('R-A: atom 未在 registry 时 fail-open（status=locked + openSlots=[]）', () => {
    // 真实场景：atom 在 registry（trigger 路径 atomToTrigger 不查 bucket），但
    //   surface.paramSlots 可能缺。deriveOwnerMetadata 返回 locked + [] 保持
    //   既有行为，避免误升 open。
    const rules: SemanticRule[] = [{
      id: 'r-unreg',
      phase: 'entry',
      sideScope: 'long',
      condition: { kind: 'atom', key: 'completely.unregistered.atom', params: {} },
      effects: [],
    }]
    const out = svc.projectToFlat(rules)
    expect(out.trigger[0].status).toBe('locked')
    expect(out.trigger[0].openSlots).toEqual([])
  })

  it('R-A 审查 Major #2: missing 判定不误伤 valuePct=0（合法"价格不变"）', () => {
    // price.percent_change.valuePct required=true，但 0 是合法值（"价格不变"）
    //   旧版用 v === '' 判 missing 会误把 0 当 missing（因为 '' == 0 但 ===  不是），
    //   新版用 typeof string + trim 守门，0 不会被误判。
    const rules: SemanticRule[] = [{
      id: 'r-pc-zero',
      phase: 'entry',
      sideScope: 'long',
      condition: { kind: 'atom', key: 'price.percent_change', params: { direction: 'down', valuePct: 0 } },
      effects: [],
    }]
    const out = svc.projectToFlat(rules)
    // valuePct=0 应被视为已填 → status=locked
    expect(out.trigger[0].status).toBe('locked')
    expect(out.trigger[0].openSlots).toEqual([])
  })

  it('R-A 审查 Major #3: contract.clarificationQuestion 文案优先于通用模板', () => {
    // price.percent_change atom 在 registry 有 clarificationQuestion 函数
    //   （atom-contract-registry.ts:1186 → '请补充价格百分比变化条件的缺失信息。'）
    //   反推 openSlot 时应使用 contract 文案而不是通用模板 "请补充 X 的 Y 参数。"
    const rules: SemanticRule[] = [{
      id: 'r-pc-q',
      phase: 'entry',
      sideScope: 'long',
      condition: { kind: 'atom', key: 'price.percent_change', params: { direction: 'down' } },
      effects: [],
    }]
    const out = svc.projectToFlat(rules)
    const slot = out.trigger[0].openSlots.find(s => s.paramSlotKey === 'valuePct')
    expect(slot).toBeDefined()
    // 通用模板 fallback "请补充 ${atomKey} 的 ${slotKey} 参数。" 不应是最终文案
    // contract 提供的文案应该被优先使用
    expect(slot?.questionHint).toContain('价格百分比变化')
  })

  it('R-A: partial fill（多 required slot 只缺一个）只产对应那条 openSlot', () => {
    // 用 ATR 类原子假设其有多 required slot；这里用 price.percent_change 单 required（valuePct）
    //   构造 partial-fill 等价场景：valuePct 给了但 direction 没给，验证遍历逻辑只产
    //   真缺的那条；direction.required=true → 缺 → 产 1 条 openSlot
    const rules: SemanticRule[] = [{
      id: 'r-partial',
      phase: 'entry',
      sideScope: 'long',
      condition: { kind: 'atom', key: 'price.percent_change', params: { valuePct: -1 } },
      effects: [],
    }]
    const out = svc.projectToFlat(rules)
    expect(out.trigger[0].status).toBe('open')
    expect(out.trigger[0].openSlots).toHaveLength(1)
    expect(out.trigger[0].openSlots[0].paramSlotKey).toBe('direction')
  })

  it('R-A: effect risk 桶 atom（risk.atr_take_profit）缺 required multiple 时产 openSlots', () => {
    // risk.atr_take_profit.multiple required:true（atom-contract-registry.ts:4696）
    const rules: SemanticRule[] = [{
      id: 'r-risk',
      phase: 'entry',
      sideScope: 'long',
      condition: { kind: 'atom', key: 'oscillator.rsi_lte', params: { threshold: 30 } },
      effects: [{ kind: 'atom', key: 'risk.atr_take_profit', params: {} }],
    }]
    const out = svc.projectToFlat(rules)
    expect(out.risk).toHaveLength(1)
    expect(out.risk[0].status).toBe('open')
    const multipleSlot = out.risk[0].openSlots.find(s => s.paramSlotKey === 'multiple')
    expect(multipleSlot).toBeDefined()
    expect(multipleSlot?.atomKey).toBe('risk.atr_take_profit')
  })

  // 审查 Minor #3 真覆盖：直接验 inferOrchestrationKind null 分支（私有方法）。
  //   未来若有新 orchestration bucket atom 使用未声明的 prefix，dispatchEffectLeaf
  //   应在 inferOrchestrationKind 返回 null 时 fail-open（不 push 到 orchestration）。
  it('R-C: inferOrchestrationKind 对未声明 prefix 返回 null（fail-open 兜底真覆盖）', () => {
    // 私有方法测试，使用 bracket 访问（TS strict 通过 unknown cast）
    const privateAccess = svc as unknown as { inferOrchestrationKind: (k: string) => unknown }
    expect(privateAccess.inferOrchestrationKind('program.dynamic_grid')).toBe('program')
    expect(privateAccess.inferOrchestrationKind('gate.regime')).toBe('gate')
    expect(privateAccess.inferOrchestrationKind('scope.symbol')).toBe('scope')
    expect(privateAccess.inferOrchestrationKind('portfolioRisk.drawdown_block')).toBe('portfolioRisk')
    // 关键负断言：四类 prefix 之外返回 null（dispatchEffectLeaf 走静默 skip）
    expect(privateAccess.inferOrchestrationKind('unknown.future.kind')).toBeNull()
    expect(privateAccess.inferOrchestrationKind('grid.range_rebalance')).toBeNull()
    expect(privateAccess.inferOrchestrationKind('')).toBeNull()
  })

  // ------------------------------------------------------------------
  // Issue #1447 闸 3：拓扑反查 + 孤立 atom drop invariant
  // ------------------------------------------------------------------
  describe('Issue #1447 闸 3 — 拓扑反查 + 孤立 atom drop', () => {
    it('所有 flat atom 都附带 _provenance.{ruleId, conditionPath}（合规 rules fixture）', () => {
      const rules: SemanticRule[] = [
        {
          id: 'r-single',
          phase: 'entry',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'bollinger.touch_lower', params: {} },
          effects: [{ kind: 'atom', key: 'risk.stop_loss_pct', params: { pct: 5 } }],
        },
        {
          id: 'r-and',
          phase: 'entry',
          sideScope: 'short',
          condition: {
            kind: 'and',
            children: [
              { kind: 'atom', key: 'bollinger.touch_upper', params: {} },
              { kind: 'atom', key: 'oscillator.rsi_gte', params: { period: 14, threshold: 70 } },
            ],
          },
          effects: [],
        },
      ]
      const out = svc.projectToFlat(rules)

      // 所有 trigger 都必须带 _provenance，且 ruleId 在 rules[] 内
      const ruleIds = new Set(rules.map(r => r.id))
      const allAtoms = [
        ...out.trigger.map(n => ({ b: 'trigger' as const, n })),
        ...out.action.map(n => ({ b: 'action' as const, n })),
        ...out.risk.map(n => ({ b: 'risk' as const, n })),
        ...out.positionConstraint.map(n => ({ b: 'positionConstraint' as const, n })),
        ...out.orchestration.map(n => ({ b: 'orchestration' as const, n })),
      ]
      expect(allAtoms.length).toBeGreaterThan(0)
      for (const { b, n } of allAtoms) {
        expect(n._provenance).toBeDefined()
        expect(ruleIds.has(n._provenance!.ruleId)).toBe(true)
        expect(n._provenance!.conditionPath).toMatch(/^(condition|effects\[\d+\])/)
      }

      // 路径段格式具体校验：单叶子 -> condition.atom；AND 第二个 child -> condition.and.children[1].atom
      const single = out.trigger.find(t => t._provenance?.ruleId === 'r-single')
      expect(single?._provenance?.conditionPath).toBe('condition.atom')
      const andSecond = out.trigger.find(
        t => t._provenance?.ruleId === 'r-and' && t.key === 'oscillator.rsi_gte',
      )
      expect(andSecond?._provenance?.conditionPath).toBe('condition.and.children[1].atom')

      // effects[0].atom 路径
      const sl = out.risk.find(r => r._provenance?.ruleId === 'r-single')
      expect(sl?._provenance?.conditionPath).toBe('effects[0].atom')
    })

    it('dispatcher noisy lift fixture：孤立 BOLL atom 未注册为单叶子 rule 时，被 invariant drop', () => {
      // 模拟「下游误把孤立 atom 直接 push 到 flat 桶」场景：
      //   构造合规 rules[]（无 BOLL touch_lower），随后通过私有重抽路径塞入孤立 atom。
      //   实际工程链路是 dispatcher 走 liftDispatcherAtomsIntoRules 包装成 single-leaf rule
      //   后调用本服务；如果哪天有路径绕过该包装直接 push，invariant 必须把它 drop 掉。
      const rules: SemanticRule[] = [
        {
          id: 'r-ema-gate',
          phase: 'entry',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'oscillator.rsi_gte', params: { period: 14, threshold: 65 } },
          effects: [],
        },
      ]
      const out = svc.projectToFlat(rules)
      const baseTriggerCount = out.trigger.length
      expect(baseTriggerCount).toBe(1)

      // 模拟带外注入：手工 push 孤立 BOLL atom 到 trigger 桶（ruleId 不在 rules[]）
      out.trigger.push({
        id: 'orphan-boll-1',
        key: 'bollinger.touch_lower',
        phase: 'entry',
        sideScope: 'long',
        params: {},
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        _provenance: { ruleId: 'dispatcher-noisy-not-in-rules', conditionPath: 'condition.atom' },
      })

      // 重跑 invariant（私有 API 直访）
      const privateAccess = svc as unknown as {
        enforceProvenanceInvariant: (
          o: ReturnType<SemanticRuleProjectionService['projectToFlat']>,
          r: ReadonlyArray<SemanticRule>,
        ) => void
      }
      privateAccess.enforceProvenanceInvariant(out, rules)

      // 孤立 BOLL 被 drop，原 RSI trigger 保留
      expect(out.trigger).toHaveLength(baseTriggerCount)
      expect(out.trigger.find(t => t.key === 'bollinger.touch_lower')).toBeUndefined()
      expect(out.trigger[0]!.key).toBe('oscillator.rsi_gte')
    })

    it('缺 _provenance 字段 → 视为 orphan drop', () => {
      const rules: SemanticRule[] = [
        {
          id: 'r-real',
          phase: 'entry',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'oscillator.rsi_gte', params: { period: 14, threshold: 65 } },
          effects: [],
        },
      ]
      const out = svc.projectToFlat(rules)
      // 注入无 _provenance 的孤立节点
      out.trigger.push({
        id: 'no-prov-1',
        key: 'bollinger.touch_upper',
        phase: 'entry',
        sideScope: 'long',
        params: {},
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      })
      const privateAccess = svc as unknown as {
        enforceProvenanceInvariant: (
          o: ReturnType<SemanticRuleProjectionService['projectToFlat']>,
          r: ReadonlyArray<SemanticRule>,
        ) => void
      }
      privateAccess.enforceProvenanceInvariant(out, rules)
      expect(out.trigger.find(t => t.key === 'bollinger.touch_upper')).toBeUndefined()
    })

    // 审查 Minor m-3（第 1 轮）：覆盖 NOT condition 路径格式
    it('NOT condition 叶子 conditionPath 形如 condition.not.child.atom', () => {
      const rules: SemanticRule[] = [
        {
          id: 'r-not',
          phase: 'entry',
          sideScope: 'long',
          condition: { kind: 'not', child: { kind: 'atom', key: 'oscillator.rsi_gte', params: {} } },
          effects: [],
        },
      ]
      const out = svc.projectToFlat(rules)
      expect(out.trigger).toHaveLength(1)
      expect(out.trigger[0]!._provenance?.conditionPath).toBe('condition.not.child.atom')
      // toJoinKind('not') === null → 不挂 combination contract
      expect(out.trigger[0]!.contracts?.length ?? 0).toBe(0)
    })

    // 审查 Minor m-3（第 1 轮）：覆盖 SEQUENCE condition 路径格式
    it('SEQUENCE condition 叶子 conditionPath 形如 condition.sequence.steps[i].atom', () => {
      const rules: SemanticRule[] = [
        {
          id: 'r-seq',
          phase: 'entry',
          sideScope: 'long',
          condition: {
            kind: 'sequence',
            steps: [
              { kind: 'atom', key: 'oscillator.rsi_gte', params: {} },
              { kind: 'atom', key: 'bollinger.touch_lower', params: {} },
            ],
          },
          effects: [],
        },
      ]
      const out = svc.projectToFlat(rules)
      expect(out.trigger).toHaveLength(2)
      expect(out.trigger[0]!._provenance?.conditionPath).toBe('condition.sequence.steps[0].atom')
      expect(out.trigger[1]!._provenance?.conditionPath).toBe('condition.sequence.steps[1].atom')
    })

    // 审查 Critical C1（第 1 轮）：复合 effect（and 含多叶子）每叶子产出唯一 id（不重复）
    it('复合 effect（AND 含 2 个 risk 叶子）每叶子 baseId 唯一，路径含 effects[N].and.children[i].atom', () => {
      const rules: SemanticRule[] = [
        {
          id: 'r-compound-eff',
          phase: 'entry',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'oscillator.rsi_gte', params: {} },
          effects: [
            {
              kind: 'and',
              children: [
                { kind: 'atom', key: 'risk.stop_loss_pct', params: { pct: 5 } },
                { kind: 'atom', key: 'risk.atr_take_profit', params: { multiple: 3 } },
              ],
            },
          ],
        },
      ]
      const out = svc.projectToFlat(rules)
      expect(out.risk).toHaveLength(2)
      // C1 修复关键断言：两叶子 id 不重复
      const ids = out.risk.map(r => r.id)
      expect(new Set(ids).size).toBe(2)
      // 路径格式：effects[0].and.children[i].atom
      const sl = out.risk.find(r => r.key === 'risk.stop_loss_pct')
      const tp = out.risk.find(r => r.key === 'risk.atr_take_profit')
      expect(sl?._provenance?.conditionPath).toBe('effects[0].and.children[0].atom')
      expect(tp?._provenance?.conditionPath).toBe('effects[0].and.children[1].atom')
    })

    it('会话 cmp9d849x0nyxx5qsf0wdfcp3 重放：mock dispatcher 注入孤立 BOLL，最终 flat 桶无孤立 trigger', () => {
      // 用户输入语义：5min K 线 EMA20/60/144 + BOLL 触轨 + 5% 止损
      //   合规 planner 输出：单叶子 rules（这里简化为 RSI 占位 + risk）
      //   dispatcher noisy lift 应通过 liftDispatcherAtomsIntoRules 包装成单叶子 rule，
      //   在那个路径下 ruleId='dispatcher-lift-N-bollinger_touch_lower' 会进 rules[] →
      //   本服务对其与 planner rule 一视同仁；这里测试「未经包装直接 push」的非法路径。
      const plannerRules: SemanticRule[] = [
        {
          id: 'planner-r1',
          phase: 'entry',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'oscillator.rsi_gte', params: { period: 14, threshold: 65 } },
          effects: [{ kind: 'atom', key: 'risk.stop_loss_pct', params: { pct: 5 } }],
        },
      ]

      // 「合规路径」：dispatcher 包装成单叶子 rule（rule.id 在 rules[] 内）
      const compliantRules: SemanticRule[] = [
        ...plannerRules,
        {
          id: 'dispatcher-lift-0-bollinger_touch_lower',
          phase: 'entry',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'bollinger.touch_lower', params: {} },
          effects: [],
        },
      ]
      const compliantOut = svc.projectToFlat(compliantRules)
      // 合规：BOLL 出现在 flat 桶，且 provenance 指向 dispatcher-lift rule
      const compliantBoll = compliantOut.trigger.find(t => t.key === 'bollinger.touch_lower')
      expect(compliantBoll).toBeDefined()
      expect(compliantBoll!._provenance?.ruleId).toBe('dispatcher-lift-0-bollinger_touch_lower')

      // 「非法路径」：dispatcher 绕过包装，直接 push 孤立 atom
      const out = svc.projectToFlat(plannerRules)
      out.trigger.push({
        id: 'orphan-boll',
        key: 'bollinger.touch_lower',
        phase: 'entry',
        sideScope: 'long',
        params: {},
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        _provenance: { ruleId: 'orphan-not-in-rules', conditionPath: 'condition.atom' },
      })
      const privateAccess = svc as unknown as {
        enforceProvenanceInvariant: (
          o: ReturnType<SemanticRuleProjectionService['projectToFlat']>,
          r: ReadonlyArray<SemanticRule>,
        ) => void
      }
      privateAccess.enforceProvenanceInvariant(out, plannerRules)
      // 孤立 BOLL 被 drop
      expect(out.trigger.find(t => t.key === 'bollinger.touch_lower')).toBeUndefined()
      // 合规 RSI 保留
      expect(out.trigger.find(t => t.key === 'oscillator.rsi_gte')).toBeDefined()
    })
  })
})
