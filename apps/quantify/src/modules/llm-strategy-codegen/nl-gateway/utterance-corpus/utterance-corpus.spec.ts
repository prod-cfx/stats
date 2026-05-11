import type {
  SemanticActionState,
  SemanticOrchestrationNode,
  SemanticRiskState,
  SemanticSlotState,
  SemanticState,
  SemanticTriggerState,
} from '../../types/semantic-state'
import type { SupportedExecutableUtteranceAtom, UtteranceCorpusCase } from './utterance-corpus.types'
import { NaturalLanguageGatewayService } from '../../services/natural-language-gateway.service'
import { SemanticAtomRegistryService } from '../../services/semantic-atom-registry.service'
import { SemanticOrchestrationRegistryService } from '../../services/semantic-orchestration-registry.service'
import { SemanticSeedExtractorService } from '../../services/semantic-seed-extractor.service'
import { SemanticSeedStateBuilderService } from '../../services/semantic-seed-state-builder.service'
import { SemanticStateProjectionService } from '../../services/semantic-state-projection.service'
import { SemanticSupportClassifierService } from '../../services/semantic-support-classifier.service'
import {
  ATOM_MUTEX,
  CLAUSE_BOUND_PARAM_CHECKS,
  FRAME_KIND_TO_STATE_LOOKUP,
  ORCHESTRATION_KIND_TO_REGISTRY_LOOKUP,
  PHRASE_CONTEXT_MUTEX,
  RENDER_CONTRACT_ATOM_FIELDS,
  readParamPath,
  splitClauses,
} from './corpus-invariants'
import {
  SUPPORTED_EXECUTABLE_UTTERANCE_ATOMS,
  utteranceCorpus,
} from './index'

type CorpusTarget =
  | SemanticTriggerState
  | SemanticActionState
  | SemanticRiskState
  | NonNullable<NonNullable<SemanticState['position']>['constraints']>[number]
  | SemanticOrchestrationNode

describe('utterance corpus baseline', () => {
  const corpusCases: readonly UtteranceCorpusCase[] = utteranceCorpus
  const lockedCases = corpusCases.filter(item => item.coverage === 'locked')
  const extractor = new SemanticSeedExtractorService()
  const seedStateBuilder = new SemanticSeedStateBuilderService()
  const atomRegistry = new SemanticAtomRegistryService()
  const orchestrationRegistry = new SemanticOrchestrationRegistryService()
  // #1152 INVARIANT-D：classifier 必须经 orchestrationRegistry 解析 orchestration.nodes，
  //   故显式注入第二参数；其他 invariant 仍能复用同一实例（其逻辑对兼容签名缺省路径无依赖）。
  const supportClassifier = new SemanticSupportClassifierService(atomRegistry, orchestrationRegistry)
  const gateway = new NaturalLanguageGatewayService()

  it('covers the current supported executable utterance atom set with at least 60 cases', () => {
    expect(utteranceCorpus.length).toBeGreaterThanOrEqual(60)

    const ids = new Set(utteranceCorpus.map(item => item.id))
    expect(ids.size).toBe(utteranceCorpus.length)

    // portfolioRisk.drawdown_block 的 NLG 正则强制要求 threshold%，
    // 现阶段无 open-slot/missing-default 语义实现；豁免该约束，待 backend 支持后补齐
    // TODO(#1151): backend 支持"账户回撤后停止开新仓"（无阈值）触发 open-slot 后回收豁免
    const atomsExemptFromOpenSlotCoverage: ReadonlySet<SupportedExecutableUtteranceAtom> = new Set([
      'portfolioRisk.drawdown_block',
    ])

    for (const atomKey of SUPPORTED_EXECUTABLE_UTTERANCE_ATOMS) {
      const cases = utteranceCorpus.filter(item => item.atomKey === atomKey)
      expect(cases.length).toBeGreaterThanOrEqual(3)
      expect(cases.some(item => item.locale === 'zh' || item.locale === 'mixed')).toBe(true)
      expect(cases.some(item => item.locale === 'en' || item.locale === 'mixed')).toBe(true)
      if (!atomsExemptFromOpenSlotCoverage.has(atomKey)) {
        expect(cases.some(item => item.coverage === 'open-slot' || item.coverage === 'missing-default')).toBe(true)
      }
    }
  })

  it.each(corpusCases)('$id parses into the expected atom target', (item) => {
    const state = seedStateBuilder.build(extractor.extract(item.utterance))
    expect(state).not.toBeNull()

    if (!state) {
      throw new Error(`Expected corpus case ${item.id} to build a semantic state`)
    }

    const target = findCorpusTarget(state, item)
    expect(target).toBeDefined()

    if (!target) {
      throw new Error(`Expected corpus case ${item.id} to contain ${item.expected.key}`)
    }

    if (item.expected.status) {
      expect(target.status).toBe(item.expected.status)
    }

    if (item.expected.params) {
      expect(target.params ?? {}).toMatchObject(item.expected.params)
    }

    assertOpenSlots(item, target, state, supportClassifier)
  })

  // =========================================================
  // 不变量 A — NLG → state parity（全 frame kind）
  //   每条 locked utterance 的 NLG frame[] 都必须能在 state 中找到对应 atom。
  //   未来 NLG 新增 frame kind 未在 FRAME_KIND_TO_STATE_LOOKUP 声明 → TS exhaustive 编译失败。
  // =========================================================
  it.each(lockedCases)(
    '$id [INVARIANT-A] 每个 NLG frame 必须能在 state 中找到对应 atom',
    (item) => {
      const frames = gateway.parse(item.utterance)
      const state = seedStateBuilder.build(extractor.extract(item.utterance))
      expect(state).not.toBeNull()
      if (!state) return

      for (const frame of frames) {
        const lookup = FRAME_KIND_TO_STATE_LOOKUP[frame.kind]
        if (lookup === 'no_state_projection') continue
        const matched = lookup(state)
        // 失败信息精准指出"哪个 frame.kind 在 state 找不到落位"
        expect({ caseId: item.id, frameKind: frame.kind, atomFound: matched.length > 0 }).toEqual({
          caseId: item.id,
          frameKind: frame.kind,
          atomFound: true,
        })
      }
    },
  )

  // =========================================================
  // 不变量 B-1 — Atom 互斥矩阵
  //   expected atom 落位时不得共存 ATOM_MUTEX 中声明的互斥 atom。
  // =========================================================
  it.each(lockedCases)(
    '$id [INVARIANT-B1] expected atom 落位时不得共存 ATOM_MUTEX 中声明的互斥 atom',
    (item) => {
      const state = seedStateBuilder.build(extractor.extract(item.utterance))
      expect(state).not.toBeNull()
      if (!state) return

      const peers = ATOM_MUTEX[item.expected.key] ?? []
      if (peers.length === 0) return

      const allKeys = collectAllStateAtomKeys(state)
      for (const peer of peers) {
        expect({ caseId: item.id, forbidden: peer, present: allKeys.includes(peer) }).toEqual({
          caseId: item.id,
          forbidden: peer,
          present: false,
        })
      }
    },
  )

  // =========================================================
  // 不变量 B-2 — 触发短语 vs 风控短语 上下文判定
  //   pattern 命中时 state 不得含 forbidStateAtoms。
  // =========================================================
  it.each(lockedCases)(
    '$id [INVARIANT-B2] phrase context mutex —— 触发短语命中时不得发射风控短语对应 atom',
    (item) => {
      const state = seedStateBuilder.build(extractor.extract(item.utterance))
      expect(state).not.toBeNull()
      if (!state) return

      const allKeys = collectAllStateAtomKeys(state)
      for (const rule of PHRASE_CONTEXT_MUTEX) {
        if (!rule.pattern.test(item.utterance)) continue
        for (const forbidden of rule.forbidStateAtoms) {
          expect({
            caseId: item.id,
            rule: rule.description,
            forbidden,
            present: allKeys.includes(forbidden),
          }).toEqual({
            caseId: item.id,
            rule: rule.description,
            forbidden,
            present: false,
          })
        }
      }
    },
  )

  // =========================================================
  // 不变量 C — Clause-bound param locality（子句号位边界）
  //   受约束参数的值必须出现在含上下文关键词的同一子句内。
  // =========================================================
  it.each(lockedCases)(
    '$id [INVARIANT-C] 子句号位 locality —— 受约束参数必须与上下文关键词同子句',
    (item) => {
      const state = seedStateBuilder.build(extractor.extract(item.utterance))
      expect(state).not.toBeNull()
      if (!state) return

      const clauses = splitClauses(item.utterance)
      const allAtoms: Array<{ key?: string; params?: Record<string, unknown> }> = [
        ...(state.triggers ?? []),
        ...(state.actions ?? []),
        ...(state.risk ?? []),
        ...(state.position?.constraints ?? []),
        ...(state.orchestration?.nodes ?? []),
      ]

      for (const atom of allAtoms) {
        if (!atom.key) continue
        for (const check of CLAUSE_BOUND_PARAM_CHECKS) {
          if (!check.atomKeyMatcher(atom.key)) continue
          const value = readParamPath(atom.params, check.paramFieldPath)
          if (value == null) continue
          const valueStr = String(value)
          const hostClause = clauses.find(
            clause => check.contextKeyword.test(clause) && clause.includes(valueStr),
          )
          // 失败信息精准指出"哪个 atom 的哪个字段在哪个 utterance 上跨子句污染"
          expect({
            caseId: item.id,
            atomKey: atom.key,
            value: valueStr,
            hostClauseFound: hostClause !== undefined,
          }).toEqual({
            caseId: item.id,
            atomKey: atom.key,
            value: valueStr,
            hostClauseFound: true,
          })
        }
      }
    },
  )

  // =========================================================
  // 不变量 E — Conversation render integrity（#1154）
  //   对每条 locked utterance，若 state 中出现 RENDER_CONTRACT_ATOM_FIELDS 声明的 atom，
  //   则 buildConversationView 的相应 summary 段必须包含该 atom 的关键参数值。
  // =========================================================
  const projectionService = new SemanticStateProjectionService()

  // INVARIANT-E sanity（per-key）：每个声明的 atomKey 都必须有 ≥1 条 corpus locked case，
  //   否则该 atom 的渲染契约 spec 形同虚设。
  //   允许暂时缺席的 key 在 RENDER_CONTRACT_ALLOWED_MISSING_FIXTURE 中显式登记，需带 TODO 链接。
  const RENDER_CONTRACT_ALLOWED_MISSING_FIXTURE: ReadonlySet<string> = new Set([
    // TODO(#1154 follow-up)：position.pyramiding_limit 当前通过 action.add_position 的
    //   "最多加仓 N 次" 子句触发，无独立 atomKey='position.pyramiding_limit' 的 fixture；
    //   渲染契约在 semantic-state-projection.service.orchestration.spec.ts 单独覆盖。
    'position.pyramiding_limit',
  ])

  it('[INVARIANT-E sanity] 每个声明 atom 必须有 corpus locked case（或显式登记缺席）', () => {
    const missing: string[] = []
    for (const key of Object.keys(RENDER_CONTRACT_ATOM_FIELDS)) {
      if (RENDER_CONTRACT_ALLOWED_MISSING_FIXTURE.has(key)) continue
      const hit = lockedCases.some(c => c.atomKey === key)
      if (!hit) missing.push(key)
    }
    expect(missing).toEqual([])
  })

  it.each(lockedCases)(
    '$id [INVARIANT-E] locked atom 关键参数必须出现在 buildConversationView 相应 summary 段',
    (item) => {
      const fields = RENDER_CONTRACT_ATOM_FIELDS[item.atomKey]
      if (!fields || fields.length === 0) return

      const state = seedStateBuilder.build(extractor.extract(item.utterance))
      expect(state).not.toBeNull()
      if (!state) return

      // 仅当该 atom 确实在 state 中以 locked 状态出现时才断言
      const atomPresent = [
        ...(state.triggers ?? []),
        ...(state.actions ?? []),
        ...(state.risk ?? []),
        ...(state.position?.constraints ?? []),
      ].some(a => a.key === item.atomKey && a.status === 'locked')
      if (!atomPresent) return

      const view = projectionService.buildConversationView(supportClassifier.classify(state).state)

      for (const fieldSpec of fields) {
        // 解析 params.tiers[0].trigger.threshold 风格的路径
        const pathSegments = fieldSpec.field
          .replace(/\[(\d+)\]/gu, '.$1')
          .split('.')
          .filter(s => s.length > 0)
        // 找到 state 中对应 atom
        const allAtoms: Array<{ key?: string; params?: unknown }> = [
          ...(state.triggers ?? []),
          ...(state.actions ?? []),
          ...(state.risk ?? []),
          ...(state.position?.constraints ?? []),
        ]
        const targetAtom = allAtoms.find(a => a.key === item.atomKey && (a as { status?: string }).status === 'locked')
        if (!targetAtom) continue

        // 路径起点是 atom 本身（field 以 params. 开头），将 atom 作为根
        const rootObj = { params: targetAtom.params }
        const value = readParamPath(rootObj, pathSegments)
        if (value == null) continue

        const segment = fieldSpec.mustAppearIn === 'summary'
          ? view.summary
          : fieldSpec.mustAppearIn === 'riskSummary'
            ? view.riskSummary
            : view.positionSummary

        // 数值参数可能以原始值或百分比形式渲染（如 addRatio=0.2 → "20%"）
        // 候选字符串：原始值 + 百分比转换值（仅对 0<v<1 的纯小数比例适用）
        const numericValue = typeof value === 'number' ? value : null
        const candidates: string[] = [String(value)]
        if (numericValue !== null && numericValue > 0 && numericValue < 1) {
          const pct = numericValue * 100
          candidates.push(String(Number.isInteger(pct) ? pct : pct.toFixed(1).replace(/\.0$/, '')))
        }
        const valueStr = candidates[0]!
        const segmentContains = candidates.some(c => segment.includes(c))

        expect({
          caseId: item.id,
          atomKey: item.atomKey,
          field: fieldSpec.field,
          valueStr,
          mustAppearIn: fieldSpec.mustAppearIn,
          segmentContains,
        }).toEqual({
          caseId: item.id,
          atomKey: item.atomKey,
          field: fieldSpec.field,
          valueStr,
          mustAppearIn: fieldSpec.mustAppearIn,
          segmentContains: true,
        })
      }
    },
  )

  // #1152 INVARIANT-D corpus sanity：必须始终至少 1 条 locked utterance 产出 orchestration locked 节点，
  //   防止 corpus 退化导致 INVARIANT-D 在所有 case 早 return → "47 个假绿"漏报回归
  it('[INVARIANT-D sanity] locked corpus 必须至少 1 条触发 orchestration locked 节点', () => {
    const lockedHits = lockedCases.filter((item) => {
      const state = seedStateBuilder.build(extractor.extract(item.utterance))
      return (state?.orchestration?.nodes ?? []).some(node => node.status === 'locked' && typeof node.key === 'string')
    })
    expect(lockedHits.length).toBeGreaterThan(0)
  })

  // =========================================================
  // 不变量 D — Orchestration → classifier 全量识别（#1152）
  //   每条 locked utterance 的 SemanticOrchestrationNode（status==='locked'）
  //   必须经 SemanticOrchestrationRegistryService 解析；classifier 输出
  //   unknownAtoms 不得含其 key；节点必须在 enriched nextState 中保留。
  // =========================================================
  it.each(lockedCases)(
    '$id [INVARIANT-D] locked orchestration 节点必须被 classifier 识别且 key 透传',
    (item) => {
      const state = seedStateBuilder.build(extractor.extract(item.utterance))
      expect(state).not.toBeNull()
      if (!state) return

      const lockedOrchestrationNodes = (state.orchestration?.nodes ?? [])
        .filter(node => node.status === 'locked' && typeof node.key === 'string')
      if (lockedOrchestrationNodes.length === 0) return

      const classification = supportClassifier.classify(state)
      const enrichedKeys = new Set(
        (classification.state.orchestration?.nodes ?? [])
          .filter(node => node.status === 'locked')
          .map(node => node.key),
      )

      for (const node of lockedOrchestrationNodes) {
        // 静态 exhaustive：未来新增 SemanticOrchestrationContractKind 必须在 LOOKUP 中声明
        expect(ORCHESTRATION_KIND_TO_REGISTRY_LOOKUP[node.kind]).toBe('orchestration_registry')
        expect({
          caseId: item.id,
          kind: node.kind,
          key: node.key,
          unknownHit: classification.unknownAtoms.includes(node.key!),
          preserved: enrichedKeys.has(node.key),
        }).toEqual({
          caseId: item.id,
          kind: node.kind,
          key: node.key,
          unknownHit: false,
          preserved: true,
        })
      }
    },
  )
})

function findCorpusTarget(state: SemanticState, item: UtteranceCorpusCase): CorpusTarget | undefined {
  if (item.expected.owner === 'trigger') {
    return state.triggers.find(target => target.key === item.expected.key)
  }
  if (item.expected.owner === 'action') {
    return state.actions.find(target => target.key === item.expected.key)
  }
  if (item.expected.owner === 'risk') {
    return state.risk.find(target => target.key === item.expected.key)
  }
  if (item.expected.owner === 'orchestrationPortfolioRisk') {
    return state.orchestration?.nodes?.find(
      target => target.kind === 'portfolioRisk' && target.key === item.expected.key,
    )
  }
  return state.position?.constraints?.find(target => target.key === item.expected.key)
}

function assertOpenSlots(
  item: UtteranceCorpusCase,
  target: CorpusTarget,
  state: SemanticState,
  supportClassifier: SemanticSupportClassifierService,
): void {
  const expectedOpenSlotKeys = item.expected.openSlotKeys ?? []
  const targetOpenSlotKeys = collectTargetOpenSlotKeys(target)
  const classifiedOpenSlotKeys = supportClassifier.classify(state).openSlots.map(slot => slot.slotKey)
  const allOpenSlotKeys = new Set([...targetOpenSlotKeys, ...classifiedOpenSlotKeys])

  for (const slotKey of expectedOpenSlotKeys) {
    expect(allOpenSlotKeys.has(slotKey)).toBe(true)
  }

  if (item.coverage === 'open-slot') {
    expect(expectedOpenSlotKeys.length).toBeGreaterThan(0)
    return
  }

  if (expectedOpenSlotKeys.length === 0) {
    expect(targetOpenSlotKeys.filter(slotKey => slotKey.startsWith(slotPrefix(item.atomKey)))).toEqual([])
  }
}

function collectTargetOpenSlotKeys(target: CorpusTarget): string[] {
  return ((target.openSlots ?? []) as readonly SemanticSlotState[]).map(slot => slot.slotKey)
}

function collectAllStateAtomKeys(state: SemanticState): string[] {
  const orchestrationKeys = (state.orchestration?.nodes ?? [])
    .map(n => n.key)
    .filter((k): k is string => typeof k === 'string')
  return [
    ...(state.triggers ?? []).map(t => t.key),
    ...(state.actions ?? []).map(a => a.key),
    ...(state.risk ?? []).map(r => r.key),
    ...(state.position?.constraints ?? []).map(c => c.key),
    ...orchestrationKeys,
  ]
}

function slotPrefix(atomKey: SupportedExecutableUtteranceAtom): string {
  if (atomKey === 'position.dca_schedule') return 'position.dca_schedule'
  return atomKey
}
