import { createHash } from 'crypto'

import { Inject, Injectable, Logger, Optional } from '@nestjs/common'

import type {
  MarketInstrumentQuote,
  MarketInstrumentQuoteSource,
  MarketInstrumentSymbolResolution,
  MarketInstrumentSymbolSource,
} from '../types/market-instrument-symbol'
import type {
  SemanticActionState,
  SemanticAtomContract,
  SemanticCapability,
  SemanticCapabilityDomain,
  SemanticCapabilityShape,
  SemanticEffect,
  SemanticEvidence,
  SemanticNodeStatus,
  SemanticOrchestrationNode,
  SemanticOrderRequirement,
  SemanticPositionConstraintState,
  SemanticPositionSizingContract,
  SemanticPriority,
  SemanticRequirement,
  SemanticRiskState,
  SemanticRuntimeRequirement,
  SemanticSlotState,
  SemanticSource,
  SemanticState,
  SemanticStateRequirement,
  SemanticTriggerState,
} from '../types/semantic-state'
import { FIRST_WAVE_TRIGGER_ATOMS } from '../constants/canonical-strategy-capabilities'
import { ATOM_CONTRACT_REGISTRY, DCA_PER_ORDER_BUDGET_CAPABILITY } from '../atom-contracts/atom-contract-registry'
import { UNSUPPORTED_SKIP } from '../atom-contracts/atom-contract-types'
import { toSemanticSupportOpenSlot } from '../types/semantic-atom-support'
import { MarketInstrumentSymbolResolverService } from './market-instrument-symbol-resolver.service'
import { PerTradeSizingResolver } from './per-trade-sizing-resolver.service'
import type { SizingAnchor, SizingAxis } from './per-trade-sizing-resolver.service'
import { SemanticAtomRegistryService } from './semantic-atom-registry.service'
import { buildTriggerCombinationContract, isTriggerPredicateGroupContract, normalizeRiskSemantic } from './semantic-state-normalization'
import { validateSemanticRiskContract } from './strategy-semantic-contracts'
import type { AtomExprAtom, SemanticRule } from '../types/atom-expr'
import { collectAtomLeaves } from '../types/atom-expr'
import { readFlatActions, readFlatTriggers } from '../types/semantic-state-flat-readers'

// DEPRECATED Task 6: legacy aggregate shape; new SemanticState splits into orchestration + orchestrationContracts
type SemanticOrchestrationState = { nodes: SemanticOrchestrationNode[], contracts: readonly unknown[] }

// Issue #1223: 出口 evidence invariant 模式
//   throw  — 违规立即抛出（spec 测试需显式传入）
//   drop   — 违规静默丢弃 + logger.warn（全环境默认；测试 fixture 含无 evidence atom，兼容存量）
//   off    — 关闭检查（跳过 invariant）
export type EvidenceInvariantMode = 'throw' | 'drop' | 'off'
export const SEMANTIC_SEED_EVIDENCE_INVARIANT_MODE = 'SEMANTIC_SEED_EVIDENCE_INVARIANT_MODE'

type SemanticPatchRecord = Record<string, unknown>
type ContextField = 'exchange' | 'symbol' | 'marketType' | 'timeframe'
type SlotValueRead =
  | { present: true, value: string | number | boolean | null }
  | { present: false }

const CONTEXT_QUESTION_HINTS: Record<ContextField, string> = {
  exchange: '请确认交易所（binance / okx / hyperliquid）。',
  symbol: '请确认策略交易标的（例如 BTCUSDT）。',
  marketType: '请确认市场类型（现货或合约/perp）。',
  timeframe: '请确认策略主周期（例如 15m 或 1h）。',
}
// Issue #1279 PR2 C-state-builder: SYNTHESIZABLE_* 集合 REGISTRY 派生 / 文档化
//
// SYNTHESIZABLE_TRIGGER_KEYS：已经从 FIRST_WAVE_TRIGGER_ATOMS 派生（FIRST_WAVE
//   本身从 ATOM_CONTRACT_REGISTRY 过滤 canonicalWave === 'first-wave'），属于
//   REGISTRY 派生路径。保持原样。
const SYNTHESIZABLE_TRIGGER_KEYS = new Set<string>(FIRST_WAVE_TRIGGER_ATOMS)

// SYNTHESIZABLE_ACTION_KEYS：verb-derived 硬编码 action 标签（open_long /
//   close_long / open_short / close_short），**不是** atom-key —— ATOM_CONTRACT_
//   REGISTRY 中不存在以这些为 key 的 entry。无法 REGISTRY 派生。保持字面量集合，
//   显式标注 non-registry 性质。
const SYNTHESIZABLE_ACTION_KEYS = new Set<string>([
  'open_long',
  'close_long',
  'open_short',
  'close_short',
])

// SYNTHESIZABLE_POSITION_LIFECYCLE_ACTION_KEYS：bucket === 'action' 的 atom-key 派生
//   + 显式 union 'action.reduce_position'（legacy 接收的虚拟 atom，registry 暂未声明）。
//   PR2c cleanup 时若 registry 补齐 action.reduce_position，可去掉 union。
// Issue #1391 review M6：dedupe identity hash 应排除的派生字段（不参与语义区分）。
//   memoryKey：partial_take_profit 的 deterministic hash 副产物，纯本地推导
//   evidenceText/evidence：seed-builder 注入的 trace info，不是 surface paramSlot
//   _spotSideModeAutoCorrection：M5 注入的 fail-safe 备注，纯文档字段
//   注意：sourceText（verbatim-clause extractor 抽出的合法 paramSlot，如 candle_pattern）
//   不在此集合——它是识别要素而非派生字段。
const STATE_DERIVED_PARAM_KEYS: ReadonlySet<string> = new Set<string>([
  'memoryKey',
  'evidenceText',
  'evidence',
  '_spotSideModeAutoCorrection',
])

const SYNTHESIZABLE_POSITION_LIFECYCLE_ACTION_KEYS: ReadonlySet<string> = new Set<string>([
  ...Object.entries(ATOM_CONTRACT_REGISTRY)
    .filter(([, contract]) => (contract as { bucket: string }).bucket === 'action')
    .map(([key]) => key),
  'action.reduce_position', // legacy virtual atom；registry 未声明 → PR2c 补齐后可去掉
])

// SYNTHESIZABLE_GRID_ACTION_KEYS：grid 相关的虚拟 action 标签集合（place_limit_grid /
//   grid_ladder / grid.ladder / action.grid_ladder / maintain_limit_ladder），**不是**
//   atom-key —— registry 中只有 grid.range_rebalance（bucket: 'positionConstraint'）。
//   这些 key 是 IR compiler 与 trading-execution 之间的中间合约 ID，不在 registry 范围内。
//   保持字面量集合。
const SYNTHESIZABLE_GRID_ACTION_KEYS = new Set<string>([
  'place_limit_grid',
  'grid_ladder',
  'grid.ladder',
  'action.grid_ladder',
  'maintain_limit_ladder',
])

// SYNTHESIZABLE_POSITION_MODES：position sizing mode 字符串枚举，与 atom-key 体系
//   完全无关；属于 SemanticPositionSizingContract 的 mode 字段值域。保持字面量。
const SYNTHESIZABLE_POSITION_MODES = new Set<string>(['fixed_ratio', 'fixed_quote', 'fixed_qty'])
const LEVEL_SET_DENSITY_SLOT_KEY = 'contract.shape.price.level_set.density'
const MARKET_INSTRUMENT_QUOTES: readonly MarketInstrumentQuote[] = ['FDUSD', 'USDT', 'USDC', 'BUSD', 'TUSD', 'USD']

// PR3.7 helpers: map NormalizedSizing axis back to SemanticPositionSizingContract + legacy mode string

// Caller MUST guard against risk_budget axis — not representable in SemanticPositionSizingContract (PR4+).
// base_qty is now projectable: NormalizedSizing carries asset; caller skips if asset is absent.
type ProjectableSizingAxis = Exclude<SizingAxis, 'risk_budget'>

function legacySizingFromNormalized(axis: ProjectableSizingAxis, value: number, asset?: string): SemanticPositionSizingContract {
  switch (axis) {
    case 'notional_quote':
      // asset is guaranteed to be a valid quote symbol by callers; fallback 'USDT' is always valid.
      return { kind: 'quote', value, asset: (asset ?? 'USDT') as 'USDT' | 'USDC' | 'USD' }
    case 'base_qty':
      return { kind: 'base', value, asset: asset ?? '' }
    case 'equity_ratio':
      // Resolver normalizes equity_ratio to 0-1; SemanticPositionSizingContract ratio uses unit='ratio'
      return { kind: 'ratio', value, unit: 'ratio' }
  }
}

function legacyModeFromAxis(axis: ProjectableSizingAxis): string {
  switch (axis) {
    case 'notional_quote': return 'fixed_quote'
    case 'base_qty': return 'fixed_qty'
    case 'equity_ratio': return 'fixed_ratio'
  }
}

@Injectable()
export class SemanticSeedStateBuilderService {
  private readonly logger = new Logger(SemanticSeedStateBuilderService.name)

  private readonly evidenceInvariantMode: EvidenceInvariantMode

  constructor(
    private readonly symbolResolver: MarketInstrumentSymbolResolverService = new MarketInstrumentSymbolResolverService(),
    private readonly semanticAtomRegistry: SemanticAtomRegistryService = new SemanticAtomRegistryService(),
    private readonly sizingResolver: PerTradeSizingResolver = new PerTradeSizingResolver(),
    @Optional() @Inject(SEMANTIC_SEED_EVIDENCE_INVARIANT_MODE)
    evidenceInvariantMode?: EvidenceInvariantMode,
  ) {
    // Default to 'drop' in all environments; callers can inject 'throw' for
    // strict validation (spec tests) or 'off' to disable the invariant.
    // We do NOT default to 'throw' in dev/test because existing test fixtures
    // use mock planner patches without evidence on every atom.
    this.evidenceInvariantMode = evidenceInvariantMode ?? 'drop'
  }

  build(semanticPatchInput: unknown, message?: string): SemanticState | null {
    if (!this.isRecord(semanticPatchInput)) {
      return null
    }

    // #1364 AC-3: 服务端按 ATOM_CONTRACT_REGISTRY[key].bucket 归桶 —
    // patch.atoms[] 是单数组单数源，LLM 不再决定 bucket。
    // 兼容存量 5 桶 patch shape（triggers/actions/risk/...）以便内部 caller 渐进迁移。
    let semanticPatch: SemanticPatchRecord = semanticPatchInput

    // Issue #1395: rules[] → 单叶子 atoms[] 派生
    //   设计 spec docs/superpowers/specs/2026-05-15-atom-expression-tree-design.md
    //   - 每条 rule.condition 的所有叶子 atom lift 为 patch.atoms[] 条目（phase 由 rule.phase 派生）
    //   - 每条 rule.effects[] 的所有叶子 atom 同样 lift（phase 由 atom 自身 contract.bucket 决定；
    //     当前简单透传 rule.phase，下游 dispatchAtomsByContractBucket 会按 contract.surface.phaseResolver 覆写）
    //   - rules[] 保留到 state.rules，供 IR compiler 接表达式树
    //   - liftedAtoms 与 patch.atoms 并行存在；下游 coalesceDuplicateBucketEntries 按 identity 折叠
    const explicitRules: SemanticRule[] = Array.isArray(semanticPatch.rules)
      ? (semanticPatch.rules as SemanticRule[]).filter((r): r is SemanticRule => this.isRecord(r) && typeof (r as Record<string, unknown>).id === 'string')
      : []
    if (explicitRules.length > 0) {
      const liftedAtoms: Array<Record<string, unknown>> = []
      for (const rule of explicitRules) {
        const condLeaves = collectAtomLeaves(rule.condition)
        for (const leaf of condLeaves) {
          liftedAtoms.push(this.liftAtomLeafToPatchItem(leaf, rule, rule.phase === 'gate' ? 'gate' : (rule.phase === 'exit' ? 'exit' : 'entry')))
        }
        for (const eff of rule.effects) {
          for (const leaf of collectAtomLeaves(eff)) {
            // phase 透传 rule.phase；dispatchAtomsByContractBucket 内会按 contract.surface.phaseResolver
            // 'fixed-entry|exit|gate' 强制覆写到合约期望相位，无需此处精细推断。
            liftedAtoms.push(this.liftAtomLeafToPatchItem(leaf, rule, rule.phase === 'gate' ? 'gate' : (rule.phase === 'exit' ? 'exit' : 'entry')))
          }
        }
      }
      const existingAtoms = Array.isArray(semanticPatch.atoms) ? semanticPatch.atoms : []
      semanticPatch = { ...semanticPatch, atoms: [...existingAtoms, ...liftedAtoms] }
    }

    if (Array.isArray(semanticPatch.atoms)) {
      const dispatched = this.dispatchAtomsByContractBucket(semanticPatch.atoms)
      semanticPatch = {
        ...semanticPatch,
        triggers: this.mergeUniqueAtomPatchItems(
          Array.isArray(semanticPatch.triggers) ? semanticPatch.triggers : [],
          dispatched.trigger,
        ),
        actions: this.mergeUniqueAtomPatchItems(
          Array.isArray(semanticPatch.actions) ? semanticPatch.actions : [],
          dispatched.action,
        ),
        risk: this.mergeUniqueAtomPatchItems(
          Array.isArray(semanticPatch.risk) ? semanticPatch.risk : [],
          dispatched.risk,
        ),
        position: this.mergePositionConstraintPatch(
          semanticPatch.position ?? semanticPatch.positionUpdate,
          dispatched.positionConstraint,
        ),
        orchestration: this.mergeOrchestrationPatch(
          semanticPatch.orchestration,
          dispatched.orchestration,
        ),
      }
    }
    // Note: legacy 5-bucket patch shape (triggers/actions/risk) remains accepted for
    // backward compatibility with internal callers; new patches should use atoms[].

    const legacyDispatched = this.dispatchLegacyBucketArraysByContractBucket(semanticPatch)
    const positionPatchInput = this.mergePositionConstraintPatch(
      semanticPatch.position ?? semanticPatch.positionUpdate,
      legacyDispatched.positionConstraint,
    )
    const orchestrationPatchInput = this.mergeOrchestrationPatch(
      semanticPatch.orchestration,
      legacyDispatched.orchestration,
    )

    const rawTriggerItems = Array.isArray(semanticPatch.triggers)
      ? semanticPatch.triggers
      : (Array.isArray(semanticPatch.triggerUpdates) ? semanticPatch.triggerUpdates : [])
    const rawActionItems = Array.isArray(semanticPatch.actions)
      ? semanticPatch.actions
      : (Array.isArray(semanticPatch.actionUpdates) ? semanticPatch.actionUpdates : [])
    const rawRiskItems = Array.isArray(semanticPatch.risk)
      ? semanticPatch.risk
      : (Array.isArray(semanticPatch.riskUpdates) ? semanticPatch.riskUpdates : [])
    const triggerItems = this.filterLegacyItemsByRegistryBucket(rawTriggerItems, 'trigger')
    const actionItems = this.filterLegacyItemsByRegistryBucket(rawActionItems, 'action')
    const riskItems = this.filterLegacyItemsByRegistryBucket(rawRiskItems, 'risk')

    // Issue #1223: 出口 evidence invariant — 仅在调用方显式提供 message 时启用
    //   - source === 'system_default' 跳过（系统默认占位 atom 不要求 evidence）
    //   - throw 模式：atom 缺 evidence、空串或非子串均视为违规，统一抛出
    //   - drop 模式：仅当 atom 已显式设置 evidence 但内容非法（空串/非子串）时才 drop；
    //     atom 完全不带 evidence 时仅 warn，不 drop（向后兼容未迁移的 planner patch）
    //   - off 模式：跳过检查
    const evidenceInvariantViolations: string[] = []
    // violations that should cause the atom to be dropped in drop-mode
    const dropViolations = new Set<string>()
    const evidenceMode = this.evidenceInvariantMode
    const checkEvidenceInvariant = (
      items: unknown[],
      kind: 'trigger' | 'action' | 'risk',
    ): void => {
      if (evidenceMode === 'off' || typeof message !== 'string') return
      for (const [itemIndex, item] of items.entries()) {
        if (!this.isRecord(item)) continue
        if (item.source === 'system_default') continue
        const evidence = this.isRecord(item.evidence) ? item.evidence : null
        const hasEvidenceField = evidence !== null || item.evidence !== undefined
        const evidenceText = evidence && typeof evidence.text === 'string' ? evidence.text : null
        const key = typeof item.key === 'string' ? item.key : '<unknown-key>'
        const phase = typeof item.phase === 'string' ? `/${item.phase}` : ''
        // Include array index to avoid atomId collision when multiple atoms share the same key+phase
        // (e.g. multi-MA strategies with several indicator.above/entry triggers)
        const atomId = `${kind}[${itemIndex}:${key}${phase}]`
        let reason: string | null = null
        if (!hasEvidenceField || evidenceText === null) {
          reason = 'missing evidence.text'
          // missing evidence is warn-only in drop mode (backward-compatible)
        } else if (evidenceText === '') {
          reason = 'evidence.text is empty string'
          dropViolations.add(atomId)
        } else if (!message.includes(evidenceText)) {
          reason = 'evidence.text not a substring of message'
          dropViolations.add(atomId)
        }
        if (reason !== null) {
          evidenceInvariantViolations.push(`${atomId}: ${reason}`)
        }
      }
    }
    checkEvidenceInvariant(triggerItems, 'trigger')
    checkEvidenceInvariant(actionItems, 'action')
    checkEvidenceInvariant(riskItems, 'risk')
    if (evidenceInvariantViolations.length > 0) {
      if (evidenceMode === 'throw') {
        throw new Error(
          `SemanticSeedStateBuilderService evidence invariant violated (#1223): ${evidenceInvariantViolations.join('; ')}`,
        )
      } else {
        // drop mode: log all violations; only atoms in dropViolations are filtered below
        this.logger.warn(
          `event=evidence_invariant_drop count=${evidenceInvariantViolations.length} violations=${evidenceInvariantViolations.join('; ')}`,
        )
      }
    }
    const filterByEvidenceInvariant = (
      items: unknown[],
      kind: 'trigger' | 'action' | 'risk',
    ): unknown[] => {
      if (evidenceMode !== 'drop' || typeof message !== 'string' || dropViolations.size === 0) return items
      return items.filter((item, index) => {
        if (!this.isRecord(item)) return true
        if (item.source === 'system_default') return true
        const key = typeof item.key === 'string' ? item.key : '<unknown-key>'
        const phase = typeof item.phase === 'string' ? `/${item.phase}` : ''
        return !dropViolations.has(`${kind}[${index}:${key}${phase}]`)
      })
    }
    const positionUpdateRaw = this.toPositionState(positionPatchInput)
    const contextSlots = this.toContextSlots(
      semanticPatch.contextSlots ?? semanticPatch.contextUpdates ?? semanticPatch.context,
    )
    // Issue #1391：spot 市场下 sideMode='both' / 'short_only' 与现货语义冲突——
    //   按 marketType 上下文 fail-safe 派生 long_only。registry-driven：任何带 sideMode
    //   字段的 positionConstraint atom 都受影响，不只 grid。
    const positionUpdate = this.applySpotSideModeConstraint(positionUpdateRaw, contextSlots)

    const triggerUpdatesRaw = filterByEvidenceInvariant(triggerItems, 'trigger')
      .map((item, index) => this.toTriggerState(item, index))
      .filter((item): item is SemanticTriggerState => item !== null)
    // Issue #1391：seed-builder 通用桶去重（registry-driven，作用于所有 atom 不是单策略）
    //   dispatcher 在跨子句继承 / planner-dispatcher merge / 重复 clause 命中等场景下
    //   会输出多份同 (key, phase, sideScope, paramsHash) 节点；mergeRisk 等 bucket merge
    //   只在 persisted-state 路径跑，纯 seed 一次性输入跑不到——这里在 build() 出口
    //   按统一 identity 折叠，保留最强者（locked > open）。
    const triggerUpdates = this.coalesceDuplicateBucketEntries(triggerUpdatesRaw, {
      sideScopeAware: true,
    })
    const groupedTriggerUpdates = this.withMovingAverageStackCombinationContracts(triggerUpdates)
    // Action 桶不参与通用 dedupe：action.params 常为空 {}，差异完全靠 contracts.capabilities.shape
    //   承载（如 per_order_budget=50 vs 80），按 params hash 折叠会错误吞掉合法 multi-leg 配置
    //   （PR3.9 spec 'isMultiLeg=true with two per_order_budget' 即此场景）。
    const actionUpdates = filterByEvidenceInvariant(actionItems, 'action')
      .map((item, index) => this.toActionState(item, index))
      .filter((item): item is SemanticActionState => item !== null)
    const riskUpdates = this.coalesceDuplicateBucketEntries(
      filterByEvidenceInvariant(riskItems, 'risk')
        .map((item, index) => this.toRiskState(item, index))
        .filter((item): item is SemanticRiskState => item !== null),
      { sideScopeAware: false },
    )
    const orchestration = this.toOrchestrationState(orchestrationPatchInput)
    const positionConstraints = positionUpdate?.constraints ?? []

    if (
      triggerUpdates.length === 0
      && actionUpdates.length === 0
      && riskUpdates.length === 0
      && !positionUpdate
      && !Object.values(contextSlots).some(Boolean)
      && !orchestration
    ) {
      return null
    }

    // Issue #1395 (mute-spider) Stage I.C: 把 planner 写入 semanticPatch.__zodQuarantine 透传到
    //   state.diagnostics.zodQuarantine（数据透传层，下游 reader 不消费；供 follow-up 观测）。
    const zodQuarantine = this.extractZodQuarantine(semanticPatch)

    return this.withRequiredSeedOpenSlots({
      version: 1,
      families: [],
      trigger: groupedTriggerUpdates,
      action: actionUpdates,
      risk: riskUpdates,
      position: positionUpdate,
      positionConstraint: positionConstraints,
      orchestration: orchestration?.nodes ?? [],
      orchestrationContracts: [],
      contextSlots,
      normalizationNotes: [],
      updatedAt: new Date().toISOString(),
      // Issue #1395: 透传 rules[] 到 state，供 IR compiler (compileAtomExpr) 接表达式树
      ...(explicitRules.length > 0 ? { rules: explicitRules } : {}),
      ...(zodQuarantine ? { diagnostics: { zodQuarantine } } : {}),
    })
  }

  /**
   * Issue #1395 — 单个 AtomExpr 叶子 → atoms[] patch 条目
   *
   * 派生规则：
   *   - key/params 直接来源于叶子
   *   - phase 由调用方传入（rule.phase 已规整为 trigger phase 联合类型）
   *   - sideScope 优先叶子，缺省取 rule.sideScope
   *   - id 派生为 `${rule.id}-leaf-${key}` 便于排查；下游 toTriggerState/toActionState
   *     需要时会被覆盖
   */
  private liftAtomLeafToPatchItem(
    leaf: AtomExprAtom,
    rule: SemanticRule,
    phase: 'entry' | 'exit' | 'gate',
  ): Record<string, unknown> {
    return {
      id: `${rule.id}-leaf-${leaf.key}`,
      key: leaf.key,
      phase,
      sideScope: leaf.sideScope ?? rule.sideScope,
      params: { ...leaf.params },
      status: 'locked',
      source: 'user_explicit',
    }
  }

  private withMovingAverageStackCombinationContracts(
    triggers: SemanticTriggerState[],
  ): SemanticTriggerState[] {
    const groups = new Map<number, { groupId: string }>()
    const candidates = new Map<string, Array<{ trigger: SemanticTriggerState, index: number, period: number }>>()

    triggers.forEach((trigger, index) => {
      const period = this.readMovingAverageReferencePeriod(trigger.params)
      const indicator = this.readMovingAverageIndicator(trigger.params)
      if (
        period === null
        || !indicator
        || (trigger.key !== ATOM_CONTRACT_REGISTRY['indicator.above'].key && trigger.key !== ATOM_CONTRACT_REGISTRY['indicator.below'].key)
        || (trigger.phase !== 'entry' && trigger.phase !== 'exit')
      ) {
        return
      }

      const sideScope = trigger.sideScope ?? 'long'
      const timeframe = this.readTrimmedString(trigger.params.timeframe) ?? ''
      const groupKey = [
        trigger.phase,
        sideScope,
        trigger.key,
        indicator,
        timeframe,
      ].join(':')
      candidates.set(groupKey, [...(candidates.get(groupKey) ?? []), { trigger, index, period }])
    })

    for (const members of candidates.values()) {
      const periods = Array.from(new Set(members.map(member => member.period))).sort((left, right) => left - right)
      if (periods.length < 2) continue

      const first = members[0]!.trigger
      const sideScope = first.sideScope ?? 'long'
      const indicator = this.readMovingAverageIndicator(first.params)
      if (!indicator) continue

      const direction = first.key === ATOM_CONTRACT_REGISTRY['indicator.above'].key ? 'above' : 'below'
      const timeframe = this.readTrimmedString(first.params.timeframe)
      const groupId = `${first.phase}-${sideScope}-${indicator}-${direction}-stack${timeframe ? `-${timeframe}` : ''}-${periods.join('-')}`
      for (const member of members) {
        groups.set(member.index, { groupId })
      }
    }

    if (groups.size === 0) {
      return triggers
    }

    return triggers.map((trigger, index) => {
      const group = groups.get(index)
      if (!group) {
        return trigger
      }

      return {
        ...trigger,
        contracts: [
          ...(trigger.contracts ?? []).filter(contract => !this.isCombinationContract(contract)),
          buildTriggerCombinationContract({
            groupId: group.groupId,
            join: 'AND',
            phase: trigger.phase,
            sideScope: trigger.sideScope,
          }),
        ],
      }
    })
  }

  private readMovingAverageReferencePeriod(params: Record<string, unknown>): number | null {
    const directPeriod = params['reference.period']
    if (this.hasPositiveFiniteNumber(directPeriod)) {
      return directPeriod
    }

    const reference = params.reference
    if (this.isRecord(reference) && this.hasPositiveFiniteNumber(reference.period)) {
      return reference.period
    }

    return null
  }

  private readMovingAverageIndicator(params: Record<string, unknown>): string | null {
    const indicator = this.readTrimmedString(params.indicator)?.toLowerCase()
    if (indicator === 'ma' || indicator === 'sma' || indicator === 'ema') {
      return indicator
    }

    return null
  }

  private isCombinationContract(contract: SemanticAtomContract): boolean {
    return isTriggerPredicateGroupContract(contract)
  }

  // #1364 AC-3: 单一真相源 — 按 ATOM_CONTRACT_REGISTRY[key].bucket 服务端归桶。
  // patch.atoms[] 输入侧 LLM 不再决定 bucket；未知 key warn-drop（fail-closed）。
  // 同时按 contract.surface.phaseResolver=fixed-* 强制覆写 LLM 提供的 phase。
  private dispatchAtomsByContractBucket(atoms: unknown[]): {
    trigger: unknown[]
    action: unknown[]
    risk: unknown[]
    positionConstraint: unknown[]
    orchestration: unknown[]
  } {
    const out = {
      trigger: [] as unknown[],
      action: [] as unknown[],
      risk: [] as unknown[],
      positionConstraint: [] as unknown[],
      orchestration: [] as unknown[],
    }
    for (const atom of atoms) {
      if (!this.isRecord(atom)) continue
      const key = typeof atom.key === 'string' ? atom.key : null
      if (key === null) {
        this.logger.warn(`[#1364] atoms[] entry missing key field — dropped`)
        continue
      }
      const contract = (ATOM_CONTRACT_REGISTRY as Record<string, { bucket?: string, surface?: { phaseResolver?: string } } | undefined>)[key]
      if (!contract || typeof contract.bucket !== 'string') {
        this.logger.warn(`[#1364] atoms[] unknown key dropped: key=${key}`)
        continue
      }
      // phase enforcement: fixed-entry / fixed-exit / fixed-gate -> server 覆写
      const resolver = contract.surface?.phaseResolver
      let normalized: Record<string, unknown> = atom
      if (typeof resolver === 'string' && resolver.startsWith('fixed-')) {
        normalized = { ...atom, phase: resolver.slice('fixed-'.length) }
      }
      switch (contract.bucket) {
        case 'trigger': out.trigger.push(normalized); break
        case 'action': out.action.push(normalized); break
        case 'risk': out.risk.push(normalized); break
        case 'positionConstraint': out.positionConstraint.push(normalized); break
        case 'orchestration': out.orchestration.push(normalized); break
        default:
          this.logger.warn(`[#1364] atoms[] unknown bucket dropped: key=${key} bucket=${contract.bucket}`)
      }
    }
    return out
  }

  private dispatchLegacyBucketArraysByContractBucket(semanticPatch: SemanticPatchRecord): {
    trigger: unknown[]
    action: unknown[]
    risk: unknown[]
    positionConstraint: unknown[]
    orchestration: unknown[]
  } {
    const out = {
      trigger: [] as unknown[],
      action: [] as unknown[],
      risk: [] as unknown[],
      positionConstraint: [] as unknown[],
      orchestration: [] as unknown[],
    }
    const inputs = [
      ...(Array.isArray(semanticPatch.triggers) ? semanticPatch.triggers : []),
      ...(Array.isArray(semanticPatch.triggerUpdates) ? semanticPatch.triggerUpdates : []),
      ...(Array.isArray(semanticPatch.actions) ? semanticPatch.actions : []),
      ...(Array.isArray(semanticPatch.actionUpdates) ? semanticPatch.actionUpdates : []),
      ...(Array.isArray(semanticPatch.risk) ? semanticPatch.risk : []),
      ...(Array.isArray(semanticPatch.riskUpdates) ? semanticPatch.riskUpdates : []),
    ]
    if (inputs.length === 0) return out
    return this.dispatchAtomsByContractBucket(inputs)
  }

  private filterLegacyItemsByRegistryBucket(
    items: unknown[],
    bucket: 'trigger' | 'action' | 'risk',
  ): unknown[] {
    return items.filter((item) => {
      if (!this.isRecord(item) || typeof item.key !== 'string') {
        return true
      }
      const contract = (ATOM_CONTRACT_REGISTRY as Record<string, { bucket?: string } | undefined>)[item.key]
      return !contract || contract.bucket === bucket
    })
  }

  private mergePositionConstraintPatch(existing: unknown, constraints: unknown[]): unknown {
    if (constraints.length === 0) {
      return existing
    }

    const existingConstraints = this.isRecord(existing) && Array.isArray(existing.constraints)
      ? existing.constraints
      : []
    const base = this.isRecord(existing)
      ? existing
      : {
          mode: 'constraint_only',
          value: 0,
          positionMode: 'long_only',
          status: 'locked',
          source: 'derived',
        }

    return {
      ...base,
      constraints: this.coalescePositionConstraintPatches([...existingConstraints, ...constraints]),
    }
  }

  // Issue #1391：spot 市场强制 sideMode=long_only fail-safe（review M5 升级）
  //   任何 positionConstraint atom 声明 sideMode='both'/'short_only' 而 contextSlots.marketType='spot' 时，
  //   覆写为 'long_only'，并在 atom 上挂 evidence note + 通过 logger.warn 告知此次自动调整，
  //   避免静默改写违反 Never break userspace。registry-driven：不针对 grid 单 atom。
  private applySpotSideModeConstraint(
    position: SemanticState['position'],
    contextSlots: SemanticState['contextSlots'],
  ): SemanticState['position'] {
    if (!position) return position
    const marketType = contextSlots.marketType?.value
    if (marketType !== 'spot') return position
    const constraints = position.constraints
    if (!Array.isArray(constraints) || constraints.length === 0) return position
    const adjusted = constraints.map((c) => {
      const sideMode = (c.params as { sideMode?: unknown } | undefined)?.sideMode
      if (sideMode !== 'both' && sideMode !== 'short_only') return c
      // Issue #1391 follow-up：grid.range_rebalance 的 sideMode='both' 语义是
      //   buy-low / sell-high 循环（sell 平掉网格底仓，不是真做空），
      //   现货完全支持。spot fail-safe 强制 long_only 会破坏用户"相邻网格自动挂反向单"
      //   这种合法双向网格表达。grid bidirectional 现货语义安全，跳过约束。
      if (c.key === ATOM_CONTRACT_REGISTRY['grid.range_rebalance'].key && sideMode === 'both') {
        return c
      }
      const note = `市场类型为 spot，原始 sideMode=${String(sideMode)} 自动调整为 long_only（现货不支持做空）`
      this.logger.warn(`[Issue#1391] applySpotSideModeConstraint: ${note} (atom=${c.key})`)
      return {
        ...c,
        params: { ...c.params, sideMode: 'long_only', _spotSideModeAutoCorrection: note },
      }
    })
    return { ...position, constraints: adjusted }
  }

  // Issue #1391：通用桶去重 helper（按 key+phase+sideScope+stable params hash + openSlots 签名）
  //   作用面：trigger/action/risk 三桶 build() 收口；orchestration / position.constraints 已有
  //   各自专用合并路径不重复。规则与 SemanticStateMergeService.dedupeByAtomIdentity 一致
  //   保留 locked > open，等强保留先到。memoryKey/timestamp 等派生字段从 hash 排除。
  private coalesceDuplicateBucketEntries<T extends {
    key: string
    status: 'open' | 'locked' | 'superseded'
    params?: Record<string, unknown>
    openSlots?: ReadonlyArray<{ slotKey?: string, fieldPath?: string, status?: string }>
    phase?: 'entry' | 'exit' | 'gate' | 'risk' | undefined
    sideScope?: 'long' | 'short' | 'both' | null
  }>(
    entries: T[],
    options: { sideScopeAware: boolean },
  ): T[] {
    if (entries.length <= 1) return entries
    const out: T[] = []
    const indexByIdentity = new Map<string, number>()
    const rank = (s: T['status']): number => s === 'locked' ? 2 : s === 'superseded' ? 1 : 0
    for (const entry of entries) {
      const phase = entry.phase ?? '__nophase__'
      const sideScope = options.sideScopeAware ? (entry.sideScope ?? '__noside__') : ''
      const paramsHash = this.stableParamsHashIgnoringDerivedFields(entry.params ?? {})
      const slotSig = (entry.openSlots ?? [])
        .map(s => `${s.slotKey ?? ''}@${(s as { fieldPath?: string }).fieldPath ?? ''}`)
        .sort()
        .join(',')
      const identity = `${entry.key}|${phase}|${sideScope}|${paramsHash}|${slotSig}`
      const existingIdx = indexByIdentity.get(identity)
      if (existingIdx === undefined) {
        indexByIdentity.set(identity, out.length)
        out.push(entry)
        continue
      }
      const incumbent = out[existingIdx]!
      if (rank(entry.status) > rank(incumbent.status)) {
        out[existingIdx] = entry
      }
    }
    return out
  }

  // Issue #1391 review M6：硬编码字段黑名单不可持续——sourceText 在 candle_pattern 是合法
  //   verbatim-clause 识别 paramSlot（atom-contract-registry.ts 中 paramSlots.sourceText），
  //   不是派生字段。仅保留确实是 server 派生（不影响 identity 的副产物）的字段：memoryKey
  //   （partial_take_profit 的 deterministic hash）+ evidenceText / evidence （seed builder
  //   注入的 trace info，不是 surface 抽取的 slot）。
  private stableParamsHashIgnoringDerivedFields(params: Record<string, unknown>): string {
    const sortedEntries = Object.entries(params)
      .filter(([k]) => !STATE_DERIVED_PARAM_KEYS.has(k))
      .sort(([a], [b]) => a.localeCompare(b))
    const normalized: Record<string, unknown> = {}
    for (const [k, v] of sortedEntries) {
      normalized[k] = this.normalizeForHash(v)
    }
    return JSON.stringify(normalized)
  }

  private normalizeForHash(v: unknown): unknown {
    if (v === null || typeof v !== 'object') return v
    if (Array.isArray(v)) return v.map(x => this.normalizeForHash(x))
    const obj = v as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(obj).sort()) {
      out[k] = this.normalizeForHash(obj[k])
    }
    return out
  }

  private coalescePositionConstraintPatches(constraints: unknown[]): unknown[] {
    const out: unknown[] = []
    for (const constraint of constraints) {
      if (!this.isRecord(constraint) || typeof constraint.key !== 'string') {
        out.push(constraint)
        continue
      }

      const constraintKey = this.positionConstraintPatchDedupeKey(constraint)
      const existingIndex = out.findIndex(item =>
        this.isRecord(item)
        && this.positionConstraintPatchDedupeKey(item) === constraintKey,
      )
      if (existingIndex < 0) {
        out.push(constraint)
        continue
      }

      const existing = out[existingIndex]
      out[existingIndex] = this.isRecord(existing)
        ? this.mergeConstraintPatchRecords(existing, constraint)
        : constraint
    }

    return out
  }

  private positionConstraintPatchDedupeKey(constraint: Record<string, unknown>): string {
    const params = this.readParams(constraint.params)
    const sortedParams = Object.fromEntries(
      Object.entries(params).sort(([left], [right]) => left.localeCompare(right)),
    )
    return JSON.stringify({
      key: constraint.key,
      params: sortedParams,
    })
  }

  private mergeConstraintPatchRecords(
    existing: Record<string, unknown>,
    incoming: Record<string, unknown>,
  ): Record<string, unknown> {
    const existingParams = this.readParams(existing.params)
    const incomingParams = this.readParams(incoming.params)
    const existingOpenSlots = this.readOpenSlots(existing.openSlots)
    const incomingOpenSlots = this.readOpenSlots(incoming.openSlots)

    return {
      ...existing,
      ...incoming,
      id: this.readTrimmedString(existing.id) ?? this.readTrimmedString(incoming.id),
      params: { ...existingParams, ...incomingParams },
      evidence: existing.evidence ?? incoming.evidence,
      openSlots: [...existingOpenSlots, ...incomingOpenSlots],
      contracts: incoming.contracts ?? existing.contracts,
    }
  }

  private mergeUniqueAtomPatchItems(existing: unknown[], incoming: unknown[]): unknown[] {
    if (existing.length === 0) {
      return incoming
    }
    if (incoming.length === 0) {
      return existing
    }

    const seen = new Set(existing.map(item => this.atomPatchItemDedupeKey(item)))
    const out = [...existing]
    for (const item of incoming) {
      const key = this.atomPatchItemDedupeKey(item)
      if (seen.has(key)) {
        continue
      }
      seen.add(key)
      out.push(item)
    }

    return out
  }

  private atomPatchItemDedupeKey(item: unknown): string {
    if (!this.isRecord(item)) {
      return `raw:${JSON.stringify(item)}`
    }

    const params = this.readParams(item.params)
    const sortedParams = Object.fromEntries(
      Object.entries(params).sort(([left], [right]) => left.localeCompare(right)),
    )
    return JSON.stringify({
      key: item.key,
      phase: item.phase,
      sideScope: item.sideScope,
      params: sortedParams,
    })
  }

  // Merge 现有 patch.orchestration 与 atoms[] 派生 orchestration nodes。
  // 现有 patch.orchestration shape: { nodes: [...], contracts: [...] }
  // atoms[] 派生项需补 kind（按 key prefix 推断 gate.* / scope.* / program.* / portfolioRisk.*）。
  private mergeOrchestrationPatch(existing: unknown, atomNodes: unknown[]): unknown {
    const inferred: Record<string, unknown>[] = []
    for (const atom of atomNodes) {
      if (!this.isRecord(atom)) continue
      const key = typeof atom.key === 'string' ? atom.key : ''
      let kind: 'gate' | 'scope' | 'program' | 'portfolioRisk' | undefined
      if (key.startsWith('gate.')) kind = 'gate'
      else if (key.startsWith('scope.')) kind = 'scope'
      else if (key.startsWith('program.')) kind = 'program'
      else if (key.startsWith('portfolioRisk.')) kind = 'portfolioRisk'
      if (!kind) continue
      inferred.push({ ...atom, kind })
    }
    if (!this.isRecord(existing)) {
      if (inferred.length === 0) return undefined
      return { nodes: inferred, contracts: [] }
    }
    const existingNodes = Array.isArray(existing.nodes) ? existing.nodes : []
    return {
      ...existing,
      nodes: [...existingNodes, ...inferred],
    }
  }

  private toOrchestrationState(value: unknown): SemanticOrchestrationState | undefined {
    if (!this.isRecord(value)) {
      return undefined
    }
    const rawNodes = Array.isArray(value.nodes) ? value.nodes : []
    const nodes = rawNodes
      .map((item, index) => this.toOrchestrationNode(item, index))
      .filter((item): item is SemanticOrchestrationNode => item !== null)
    if (nodes.length === 0) {
      return undefined
    }
    return { nodes, contracts: [] }
  }

  private toOrchestrationNode(update: unknown, index: number): SemanticOrchestrationNode | null {
    if (!this.isRecord(update)) {
      return null
    }
    const kind = update.kind
    if (kind !== 'gate' && kind !== 'scope' && kind !== 'program' && kind !== 'portfolioRisk') {
      return null
    }
    const key = this.readTrimmedString(update.key) ?? undefined
    const params = this.readParams(update.params)
    const openSlots = this.readOpenSlots(update.openSlots)
    const evidence = this.readEvidence(update.evidence)
    const status: SemanticNodeStatus = update.status === 'open' || update.status === 'locked'
      ? update.status
      : (openSlots.length > 0 ? 'open' : 'locked')
    const target = this.isRecord(update.target)
      ? (update.target as unknown as SemanticOrchestrationNode['target'])
      : undefined
    const activeWhen = this.isRecord(update.activeWhen)
      ? (update.activeWhen as unknown as SemanticOrchestrationNode['activeWhen'])
      : undefined
    const effectWhenFalse = update.effectWhenFalse === 'block_new_entries'
      ? update.effectWhenFalse
      : undefined
    const mode = update.mode === 'observe' || update.mode === 'enforce'
      ? update.mode
      : undefined
    const scope = update.scope === 'portfolio' || update.scope === 'symbol' || update.scope === 'subStrategy'
      ? update.scope
      : undefined
    const thresholdPct = typeof update.thresholdPct === 'number' && Number.isFinite(update.thresholdPct)
      ? update.thresholdPct
      : undefined
    const support = this.isRecord(update.support)
      ? (update.support as unknown as SemanticOrchestrationNode['support'])
      : undefined

    const programKind = update.programKind === 'fixed_grid_gated'
      || update.programKind === 'dynamic_grid'
      || update.programKind === 'adaptive_volatility_grid'
      || update.programKind === 'event_listener'
      ? update.programKind
      : undefined
    const activeWhenRef = this.readTrimmedString(update.activeWhenRef) ?? undefined
    const onDeactivate = update.onDeactivate === 'cancel'
      || update.onDeactivate === 'keep'
      || update.onDeactivate === 'close'
      ? update.onDeactivate
      : undefined
    const rebuildPolicy = update.rebuildPolicy === 'static'
      || update.rebuildPolicy === 'anchor_on_state_change'
      || update.rebuildPolicy === 'atr_window'
      || update.rebuildPolicy === 'on_schema_version_bump'
      ? update.rebuildPolicy
      : undefined
    const gridParams = this.isRecord(update.gridParams)
      ? this.normalizeGridParams(update.gridParams)
      : undefined
    const sizing = this.isRecord(update.sizing)
      ? this.normalizeProgramSizing(update.sizing)
      : undefined
    // Phase 5 S5：dynamic_grid 专属字段透传
    const anchorLookbackBars = this.hasPositiveFiniteNumber(update.anchorLookbackBars) && Number.isInteger(update.anchorLookbackBars)
      ? update.anchorLookbackBars as number
      : undefined
    const anchorSide = update.anchorSide === 'high' || update.anchorSide === 'low' || update.anchorSide === 'mid'
      ? update.anchorSide
      : undefined
    const anchorDriftPct = this.hasPositiveFiniteNumber(update.anchorDriftPct)
      ? update.anchorDriftPct as number
      : undefined
    const rebuildMinIntervalSec = this.hasPositiveFiniteNumber(update.rebuildMinIntervalSec) && Number.isInteger(update.rebuildMinIntervalSec)
      ? update.rebuildMinIntervalSec as number
      : undefined
    const dynamicGridStep = this.isRecord(update.dynamicGridStep)
      ? this.normalizeDynamicGridStep(update.dynamicGridStep)
      : undefined
    const levelCount = this.hasPositiveFiniteNumber(update.levelCount) && Number.isInteger(update.levelCount)
      ? update.levelCount as number
      : undefined

    // Phase 5 S6 (#984): adaptive_volatility_grid 专属字段透传
    const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
    const atrPeriod = isFiniteNumber(update.atrPeriod) ? update.atrPeriod : undefined
    const atrMultiplier = isFiniteNumber(update.atrMultiplier) ? update.atrMultiplier : undefined
    const rangeMultiplier = isFiniteNumber(update.rangeMultiplier) ? update.rangeMultiplier : undefined
    const atrDriftPct = isFiniteNumber(update.atrDriftPct) ? update.atrDriftPct : undefined
    const rebuildCooldownSec = isFiniteNumber(update.rebuildCooldownSec) ? update.rebuildCooldownSec : undefined
    const minStepPct = isFiniteNumber(update.minStepPct) ? update.minStepPct : undefined
    const maxStepPct = isFiniteNumber(update.maxStepPct) ? update.maxStepPct : undefined

    // Phase 5 S8 (#1119): portfolioRisk symbol/subStrategy cap 专属字段透传
    const notionalCapPct = isFiniteNumber(update.notionalCapPct) && (update.notionalCapPct as number) > 0 && (update.notionalCapPct as number) <= 100
      ? update.notionalCapPct as number
      : undefined
    const effectWhenTriggered = update.effectWhenTriggered === 'block_new_entries'
      || update.effectWhenTriggered === 'reduce_exposure'
      || update.effectWhenTriggered === 'pause_substrategy'
      ? update.effectWhenTriggered
      : undefined
    const boundSymbolScopeRef = this.readTrimmedString(update.boundSymbolScopeRef) ?? undefined
    const boundSubStrategyScopeRef = this.readTrimmedString(update.boundSubStrategyScopeRef) ?? undefined

    // Phase 5 S2 (#1104): scope.symbol 专属字段透传
    const symbolScopeKind = update.symbolScopeKind === 'symbol' ? update.symbolScopeKind : undefined
    const symbols = Array.isArray(update.symbols)
      ? update.symbols.filter((s): s is string => typeof s === 'string' && s.trim() !== '')
      : undefined
    const primarySymbol = this.readTrimmedString(update.primarySymbol) ?? undefined

    // Phase 5 S12 (#1118): event_listener 专属字段透传
    const eventSchemaRef = update.eventSchemaRef === 'webhook_event'
      || update.eventSchemaRef === 'ohlcv'
      || update.eventSchemaRef === 'orderbook'
      || update.eventSchemaRef === 'liquidation'
      ? update.eventSchemaRef
      : undefined
    const sourceRef = this.readTrimmedString(update.sourceRef) ?? undefined
    const permissionScope = this.readTrimmedString(update.permissionScope) ?? undefined
    const idempotencyKey = this.isRecord(update.idempotencyKey)
      && typeof update.idempotencyKey.fieldPath === 'string'
      && update.idempotencyKey.fieldPath.trim().length > 0
      ? { fieldPath: update.idempotencyKey.fieldPath.trim() }
      : undefined
    const dedupWindowMs = isFiniteNumber(update.dedupWindowMs) && Number.isInteger(update.dedupWindowMs)
      ? update.dedupWindowMs
      : undefined
    const expirationTtlMs = isFiniteNumber(update.expirationTtlMs) && Number.isInteger(update.expirationTtlMs)
      ? update.expirationTtlMs
      : undefined
    const expirationPolicy = update.expirationPolicy === 'drop' || update.expirationPolicy === 'escalate'
      ? update.expirationPolicy
      : undefined

    // Phase 5 S11 (#1112): scope.leg 专属字段透传
    const legScopeKind = update.legScopeKind === 'leg' ? update.legScopeKind : undefined
    const legId = this.readTrimmedString(update.legId) ?? undefined
    const direction = update.direction === 'long' || update.direction === 'short' ? update.direction : undefined
    const instrumentRef = this.readTrimmedString(update.instrumentRef) ?? undefined
    const legSizing = this.isRecord(update.legSizing) ? this.normalizeLegSizing(update.legSizing) : undefined
    const syncTriggerRequired = update.syncTriggerRequired === true ? true : undefined

    return {
      id: this.readTrimmedString(update.id) ?? `orchestration-${kind}-${index + 1}`,
      kind,
      ...(key ? { key } : {}),
      params,
      status,
      source: this.readSource(update.source, 'inferred'),
      ...(evidence ? { evidence } : {}),
      openSlots,
      contracts: [],
      ...(target ? { target } : {}),
      ...(activeWhen ? { activeWhen } : {}),
      ...(effectWhenFalse ? { effectWhenFalse } : {}),
      ...(mode ? { mode } : {}),
      ...(scope ? { scope } : {}),
      ...(thresholdPct !== undefined ? { thresholdPct } : {}),
      ...(support ? { support } : {}),
      ...(programKind ? { programKind } : {}),
      ...(activeWhenRef ? { activeWhenRef } : {}),
      ...(onDeactivate ? { onDeactivate } : {}),
      ...(rebuildPolicy ? { rebuildPolicy } : {}),
      ...(gridParams ? { gridParams } : {}),
      ...(sizing ? { sizing } : {}),
      ...(anchorLookbackBars !== undefined ? { anchorLookbackBars } : {}),
      ...(anchorSide ? { anchorSide } : {}),
      ...(anchorDriftPct !== undefined ? { anchorDriftPct } : {}),
      ...(rebuildMinIntervalSec !== undefined ? { rebuildMinIntervalSec } : {}),
      ...(dynamicGridStep ? { dynamicGridStep } : {}),
      ...(atrPeriod !== undefined ? { atrPeriod } : {}),
      ...(atrMultiplier !== undefined ? { atrMultiplier } : {}),
      ...(rangeMultiplier !== undefined ? { rangeMultiplier } : {}),
      ...(atrDriftPct !== undefined ? { atrDriftPct } : {}),
      ...(rebuildCooldownSec !== undefined ? { rebuildCooldownSec } : {}),
      ...(minStepPct !== undefined ? { minStepPct } : {}),
      ...(maxStepPct !== undefined ? { maxStepPct } : {}),
      ...(levelCount !== undefined ? { levelCount } : {}),
      // Phase 5 S12 (#1118): event_listener 字段透传
      ...(eventSchemaRef ? { eventSchemaRef } : {}),
      ...(sourceRef ? { sourceRef } : {}),
      ...(permissionScope ? { permissionScope } : {}),
      ...(idempotencyKey ? { idempotencyKey } : {}),
      ...(dedupWindowMs !== undefined ? { dedupWindowMs } : {}),
      ...(expirationTtlMs !== undefined ? { expirationTtlMs } : {}),
      ...(expirationPolicy ? { expirationPolicy } : {}),
      // Phase 5 S8 (#1119): portfolioRisk symbol/subStrategy cap 字段透传
      ...(notionalCapPct !== undefined ? { notionalCapPct } : {}),
      ...(effectWhenTriggered ? { effectWhenTriggered } : {}),
      ...(boundSymbolScopeRef ? { boundSymbolScopeRef } : {}),
      ...(boundSubStrategyScopeRef ? { boundSubStrategyScopeRef } : {}),
      // Phase 5 S2 (#1104): scope.symbol 字段透传
      ...(symbolScopeKind ? { symbolScopeKind } : {}),
      ...(symbols && symbols.length > 0 ? { symbols } : {}),
      ...(primarySymbol ? { primarySymbol } : {}),
      // Phase 5 S11 (#1112): scope.leg 字段透传
      ...(legScopeKind ? { legScopeKind } : {}),
      ...(legId ? { legId } : {}),
      ...(direction ? { direction } : {}),
      ...(instrumentRef ? { instrumentRef } : {}),
      ...(legSizing ? { legSizing } : {}),
      ...(syncTriggerRequired === true ? { syncTriggerRequired: true } : {}),
    }
  }

  // Phase 5 S11 (#1112): scope.leg sizing 透传
  private normalizeLegSizing(value: SemanticPatchRecord): SemanticOrchestrationNode['legSizing'] | undefined {
    const mode = value.mode
    if (mode !== 'fixed_pct' && mode !== 'fixed_quote' && mode !== 'fixed_ratio') return undefined
    if (typeof value.value !== 'number' || !Number.isFinite(value.value) || value.value <= 0) return undefined
    const pairedLegId = this.readTrimmedString(value.pairedLegId) ?? undefined
    return {
      mode,
      value: value.value,
      ...(pairedLegId ? { pairedLegId } : {}),
    }
  }

  private normalizeDynamicGridStep(value: SemanticPatchRecord): SemanticOrchestrationNode['dynamicGridStep'] | undefined {
    const mode = value.mode === 'pct' || value.mode === 'absolute' ? value.mode : undefined
    if (!mode) return undefined
    if (!this.hasPositiveFiniteNumber(value.value)) return undefined
    return { mode, value: value.value }
  }

  private normalizeGridParams(value: SemanticPatchRecord): SemanticOrchestrationNode['gridParams'] | undefined {
    const anchorPrice = value.anchorPrice
    const levelCount = value.levelCount
    const stepPct = value.stepPct
    if (!this.hasPositiveFiniteNumber(anchorPrice)) return undefined
    if (
      typeof levelCount !== 'number'
      || !Number.isFinite(levelCount)
      || !Number.isInteger(levelCount)
      || levelCount <= 0
    ) {
      return undefined
    }
    if (!this.hasPositiveFiniteNumber(stepPct)) return undefined

    const result: { anchorPrice: number, levelCount: number, stepPct: number, lowerBound?: number, upperBound?: number } = {
      anchorPrice,
      levelCount,
      stepPct,
    }
    if (value.lowerBound !== undefined) {
      if (!this.hasPositiveFiniteNumber(value.lowerBound)) return undefined
      result.lowerBound = value.lowerBound
    }
    if (value.upperBound !== undefined) {
      if (!this.hasPositiveFiniteNumber(value.upperBound)) return undefined
      result.upperBound = value.upperBound
    }
    return result
  }

  private normalizeProgramSizing(value: SemanticPatchRecord): SemanticOrchestrationNode['sizing'] | undefined {
    const mode = value.mode
    if (mode !== 'fixed_quote' && mode !== 'fixed_base' && mode !== 'fixed_pct') {
      return undefined
    }
    if (!this.hasPositiveFiniteNumber(value.value)) return undefined
    return { mode, value: value.value }
  }

  private toTriggerState(update: unknown, index: number): SemanticTriggerState | null {
    if (!this.isRecord(update)) {
      return null
    }

    const key = this.readTrimmedString(update.key)
    const phase = update.phase
    if (!key || (phase !== 'entry' && phase !== 'exit' && phase !== 'risk' && phase !== 'gate')) {
      return null
    }

    const params = this.normalizeTriggerParams(key, this.readParams(update.params))
    const sideScope = update.sideScope === 'long' || update.sideScope === 'short' || update.sideScope === 'both'
      ? update.sideScope
      : null
    let openSlots = this.ensureBollingerConfirmationOpenSlot({
      key,
      phase,
      params,
      openSlots: this.readOpenSlots(update.openSlots),
      triggerIndex: index,
      statusValue: update.status,
    })
    const evidence = this.readEvidence(update.evidence)
    const supersedes = this.readStringArray(update.supersedes)
    const contracts = this.readContracts(update.contracts)
      ?? this.synthesizeTriggerContracts(key, phase, sideScope, params, index)
    openSlots = this.ensureGridLevelSetDensityOpenSlot({
      key,
      openSlots,
      contracts,
      ownerFieldPath: `triggers[${index}]`,
    })
    const contractCoverage = this.resolveContractCoverage({
      contracts,
      openSlots,
      statusValue: update.status,
      fieldPath: `triggers[${index}].contracts`,
      priority: 'core',
      atomKey: key,
    })

    return {
      id: this.readTrimmedString(update.id) ?? `planner-trigger-${index + 1}`,
      key,
      phase,
      params,
      ...(sideScope
        ? { sideScope }
        : {}),
      status: contractCoverage.status,
      source: this.readSource(update.source),
      ...(evidence ? { evidence } : {}),
      openSlots: contractCoverage.openSlots,
      ...(supersedes ? { supersedes } : {}),
      ...(contracts ? { contracts } : {}),
    }
  }

  private toActionState(update: unknown, index: number): SemanticActionState | null {
    if (!this.isRecord(update)) {
      return null
    }

    const rawKey = this.readTrimmedString(update.key)
    if (!rawKey) {
      return null
    }
    // #1354：LLM patch 用 `action.open_long` 全 atom-key，但 SemanticState 对 4 个
    // lifecycle action 用 unprefixed 存储（SYNTHESIZABLE_ACTION_KEYS）以匹配
    // canonical-spec-builder 的 `actionKeys.has('open_long')`；review M1 follow-up：
    // 大小写归一化（`Action.OPEN_LONG` 也要识别），防 LLM 输出漂移。
    const lcKey = rawKey.toLowerCase()
    const strippedKey = lcKey.startsWith('action.') ? lcKey.slice('action.'.length) : lcKey
    const key = SYNTHESIZABLE_ACTION_KEYS.has(strippedKey) ? strippedKey : rawKey

    const evidence = this.readEvidence(update.evidence)
    const supersedes = this.readStringArray(update.supersedes)
    const openSlots = this.readOpenSlots(update.openSlots)
    const params = this.readParams(update.params)
    const contracts = this.readContracts(update.contracts)
      ?? this.synthesizeActionContracts(key, params, index)
    const contractCoverage = this.resolveContractCoverage({
      contracts,
      openSlots,
      statusValue: update.status,
      fieldPath: `actions[${index}].contracts`,
      priority: 'behavior',
      atomKey: key,
    })

    return {
      id: this.readTrimmedString(update.id) ?? `planner-action-${index + 1}`,
      key,
      ...(this.isRecord(update.params) ? { params } : {}),
      status: contractCoverage.status,
      source: this.readSource(update.source),
      ...(evidence ? { evidence } : {}),
      openSlots: contractCoverage.openSlots,
      ...(supersedes ? { supersedes } : {}),
      ...(contracts ? { contracts } : {}),
    }
  }

  private toRiskState(update: unknown, index: number): SemanticRiskState | null {
    if (!this.isRecord(update)) {
      return null
    }

    const key = this.readTrimmedString(update.key)
    if (!key) {
      return null
    }

    const openSlots = this.readOpenSlots(update.openSlots)
    const evidence = this.readEvidence(update.evidence)
    const supersedes = this.readStringArray(update.supersedes)
    const rawParams = this.readParams(update.params)
    const mergedParams = key === ATOM_CONTRACT_REGISTRY['risk.partial_take_profit'].key
      ? this.attachPartialTakeProfitMemoryKey(rawParams)
      : rawParams
    const contracts = this.readContracts(update.contracts)
      ?? this.synthesizeRiskContracts(key, mergedParams, index)
    const contractCoverage = this.resolveContractCoverage({
      contracts,
      openSlots,
      statusValue: update.status,
      fieldPath: `risk[${index}].contracts`,
      priority: 'risk',
      atomKey: key,
    })

    const risk: SemanticRiskState = {
      id: this.readTrimmedString(update.id) ?? `planner-risk-${index + 1}`,
      key,
      params: mergedParams,
      status: contractCoverage.status,
      source: this.readSource(update.source),
      ...(evidence ? { evidence } : {}),
      openSlots: contractCoverage.openSlots,
      ...(supersedes ? { supersedes } : {}),
      ...(contracts ? { contracts } : {}),
    }

    return normalizeRiskSemantic(risk, index)
  }

  private toPositionState(update: unknown): SemanticState['position'] {
    if (!this.isRecord(update)) {
      return null
    }

    const mainMode = this.readTrimmedString(update.mode)
    if (this.isPositionConstraintKey(mainMode)) {
      return this.toPositionStateWithConstraintMode(update, mainMode)
    }

    const sizing = this.readPositionSizing(update.sizing)
    if (
      typeof update.mode !== 'string'
      || typeof update.positionMode !== 'string'
      || typeof update.value !== 'number'
      || !Number.isFinite(update.value)
    ) {
      return null
    }

    const openSlots = this.readOpenSlots(update.openSlots)
    const constraints = Array.isArray(update.constraints)
      ? update.constraints
          .map((item, index) => this.toPositionConstraintState(item, index))
          .filter((item): item is SemanticPositionConstraintState => item !== null)
      : []
    const sizingProvided = this.hasOwnProperty(update, 'sizing')
    const positionMode = this.normalizePositionSideMode(update.positionMode) ?? update.positionMode
    const normalizedMode = this.normalizePositionSizingMode(update.mode)
    const evidence = this.readEvidence(update.evidence)
    if (update.mode === 'constraint_only' && constraints.length > 0) {
      return {
        mode: 'constraint_only',
        value: 0,
        positionMode,
        status: 'locked',
        source: this.readSource(update.source),
        ...(evidence ? { evidence } : {}),
        openSlots: [],
        constraints,
      }
    }

    const contracts = this.readContracts(update.contracts)
      ?? this.synthesizePositionContracts({
        sizing,
        sizingProvided,
        mode: normalizedMode,
        value: update.value,
        positionMode,
      })
    const contractCoverage = this.resolveContractCoverage({
      contracts,
      openSlots,
      statusValue: update.status,
      fieldPath: 'position.contracts',
      priority: 'behavior',
    })

    return {
      ...(sizing ? { sizing } : {}),
      mode: normalizedMode ?? update.mode,
      value: update.value,
      positionMode,
      status: contractCoverage.status,
      source: this.readSource(update.source),
      ...(evidence ? { evidence } : {}),
      openSlots: contractCoverage.openSlots,
      ...(contracts ? { contracts } : {}),
      ...(constraints.length > 0 ? { constraints } : {}),
    }
  }

  private toPositionStateWithConstraintMode(
    update: SemanticPatchRecord,
    key: SemanticPositionConstraintState['key'],
  ): SemanticState['position'] {
    const explicitConstraint = this.toPositionConstraintState({
      id: this.readTrimmedString(update.id) ?? `planner-${this.slugifyContractId(key)}`,
      key,
      params: this.readParams(update.params),
      status: update.status,
      source: update.source,
      evidence: update.evidence,
      openSlots: update.openSlots,
      contracts: update.contracts,
      supersedes: update.supersedes,
    }, 0)
    const nestedConstraints = Array.isArray(update.constraints)
      ? update.constraints
          .map((item, index) => this.toPositionConstraintState(item, index + 1))
          .filter((item): item is SemanticPositionConstraintState => item !== null)
      : []
    const constraints = [
      ...(explicitConstraint ? [explicitConstraint] : []),
      ...nestedConstraints,
    ]
    const positionMode = typeof update.positionMode === 'string'
      ? this.normalizePositionSideMode(update.positionMode) ?? update.positionMode
      : 'long_only'

    return {
      mode: 'constraint_only',
      value: 0,
      positionMode,
      status: constraints.length > 0 ? 'locked' : 'open',
      source: this.readSource(update.source),
      openSlots: [],
      ...(constraints.length > 0 ? { constraints } : {}),
    }
  }

  private toPositionConstraintState(update: unknown, index: number): SemanticPositionConstraintState | null {
    if (!this.isRecord(update)) return null
    const key = this.readTrimmedString(update.key)
    if (!this.isPositionConstraintKey(key)) {
      return null
    }

    const params = this.readParams(update.params)
    if (key === ATOM_CONTRACT_REGISTRY['grid.range_rebalance'].key) {
      // 接受两种合法 grid 形态：显式 range 或 center-offset+levels（runtime 用部署时价格推导 range）
      const hasExplicitRange = this.resolveGridRange(params) !== null
      const hasCenterOffsetMode = this.hasPositiveFiniteNumber(params.centerOffsetPct) && this.hasPositiveInteger(params.levels)
      if (!hasExplicitRange && !hasCenterOffsetMode) {
        return null
      }
    }

    let openSlots = this.readOpenSlots(update.openSlots)
    const evidence = this.readEvidence(update.evidence)
    const supersedes = this.readStringArray(update.supersedes)
    const contracts = this.readContracts(update.contracts)
      ?? this.synthesizePositionConstraintContracts(key, params, index)
    openSlots = this.ensureGridLevelSetDensityOpenSlot({
      key,
      openSlots,
      contracts,
      ownerFieldPath: `position.constraints[${index}]`,
    })
    const contractCoverage = this.resolveContractCoverage({
      contracts,
      openSlots,
      statusValue: update.status,
      fieldPath: `position.constraints[${index}].contracts`,
      priority: 'behavior',
      atomKey: key,
    })

    return {
      id: this.readTrimmedString(update.id) ?? `planner-position-constraint-${index + 1}`,
      key,
      params,
      status: contractCoverage.status,
      source: this.readSource(update.source),
      ...(evidence ? { evidence } : {}),
      openSlots: contractCoverage.openSlots,
      ...(supersedes ? { supersedes } : {}),
      ...(contracts ? { contracts } : {}),
    }
  }

  private readPositionSizing(sizing: unknown): SemanticPositionSizingContract | null {
    if (!this.isRecord(sizing)) {
      return null
    }

    if (typeof sizing.value !== 'number' || !Number.isFinite(sizing.value) || sizing.value <= 0) {
      return null
    }

    if (sizing.kind === 'ratio' && (sizing.unit === 'ratio' || sizing.unit === 'percent')) {
      return { kind: 'ratio', value: sizing.value, unit: sizing.unit }
    }

    if (
      sizing.kind === 'quote'
      && (sizing.asset === 'USDT' || sizing.asset === 'USDC' || sizing.asset === 'USD')
    ) {
      return { kind: 'quote', value: sizing.value, asset: sizing.asset }
    }

    if (
      sizing.kind === 'base'
      && typeof sizing.asset === 'string'
      && /^[A-Z][A-Z0-9]{1,15}$/u.test(sizing.asset)
    ) {
      return { kind: 'base', value: sizing.value, asset: sizing.asset }
    }

    return null
  }

  private normalizePositionSizingMode(mode: string): string | null {
    if (SYNTHESIZABLE_POSITION_MODES.has(mode)) {
      return mode
    }

    return null
  }

  private normalizePositionSideMode(positionMode: string): string | null {
    if (positionMode === 'long' || positionMode === 'long_only') {
      return 'long_only'
    }
    if (positionMode === 'short' || positionMode === 'short_only') {
      return 'short_only'
    }
    if (positionMode === 'both' || positionMode === 'long_short') {
      return 'long_short'
    }
    return null
  }

  private isPositionConstraintKey(value: string | null): value is SemanticPositionConstraintState['key'] {
    /* eslint-disable atom-keys/no-atom-key-literal -- position.max_exposure_pct / position.dca_schedule not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329) */
    return value === ATOM_CONTRACT_REGISTRY['position.pyramiding_limit'].key
      || value === ATOM_CONTRACT_REGISTRY['grid.range_rebalance'].key
      || value === 'position.max_exposure_pct'
      || value === 'position.dca_schedule'
    /* eslint-enable atom-keys/no-atom-key-literal */
  }

  private isSupportedPositionSideMode(positionMode: string): boolean {
    return positionMode === 'long_only' || positionMode === 'short_only' || positionMode === 'long_short'
  }

  private synthesizeTriggerContracts(
    key: string,
    phase: SemanticTriggerState['phase'],
    sideScope: SemanticTriggerState['sideScope'] | null,
    params: Record<string, unknown>,
    index: number,
  ): SemanticAtomContract[] | null {
    if (!this.canSynthesizeTriggerContract(key, params)) {
      return null
    }

    const contract = this.buildAtomContract({
      id: `contract-seed-trigger-${index + 1}-${this.slugifyContractId(key)}`,
      kind: 'trigger',
      capability: this.buildTriggerCapability(key, phase, sideScope, params),
      params,
    })

    return [this.withRegistryContractSubstrate(key, contract)]
  }

  private canSynthesizeTriggerContract(key: string, params: Record<string, unknown>): boolean {
    /* eslint-disable atom-keys/no-atom-key-literal -- trigger-key dispatch allowlist: condition.expression / volume.spike / volume.relative_average / condition.sequence / confirmation.rebound / market.trend / market.range not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329) */
    if (key === 'condition.expression') {
      return this.isRecord(params.expression)
    }

    if (key === ATOM_CONTRACT_REGISTRY['price.percent_change'].key) {
      return this.isFiniteNonZeroNumber(params.valuePct)
    }

    if (key === ATOM_CONTRACT_REGISTRY['indicator.cross_over'].key || key === ATOM_CONTRACT_REGISTRY['indicator.cross_under'].key) {
      return this.hasIndicatorIdentity(params)
        && (this.hasFiniteNumber(params.fastPeriod) || this.hasFiniteNumber(params.slowPeriod))
    }

    if (key === ATOM_CONTRACT_REGISTRY['indicator.above'].key || key === ATOM_CONTRACT_REGISTRY['indicator.below'].key) {
      return this.hasIndicatorIdentity(params) && this.hasIndicatorReference(params)
    }

    if (key === ATOM_CONTRACT_REGISTRY['oscillator.rsi_gte'].key || key === ATOM_CONTRACT_REGISTRY['oscillator.rsi_lte'].key) {
      return this.hasFiniteNumber(params.value)
    }

    if (key === ATOM_CONTRACT_REGISTRY['bollinger.touch_upper'].key || key === ATOM_CONTRACT_REGISTRY['bollinger.touch_lower'].key || key === ATOM_CONTRACT_REGISTRY['bollinger.touch_middle'].key) {
      return this.hasFiniteNumber(params.period) && this.hasFiniteNumber(params.stdDev)
    }

    if (key === ATOM_CONTRACT_REGISTRY['price.detect.indicator_boundary'].key) {
      return this.isSupportedBollingerBoundaryParams(params)
    }

    if (
      key === 'volume.spike'
      || key === ATOM_CONTRACT_REGISTRY['volume.threshold'].key
      || key === 'volume.relative_average'
      || key === ATOM_CONTRACT_REGISTRY['volatility.atr_threshold'].key
      || key === ATOM_CONTRACT_REGISTRY['strategy.time_window'].key
      || key === ATOM_CONTRACT_REGISTRY['position.has_position'].key
      || key === ATOM_CONTRACT_REGISTRY['position.no_position'].key
    ) {
      return true
    }

    if (key === 'condition.sequence') {
      return typeof params.sequenceKind === 'string' && params.sequenceKind.trim().length > 0
    }

    if (key === 'confirmation.rebound') {
      return true
    }

    if (key === ATOM_CONTRACT_REGISTRY['price.breakout_up'].key || key === ATOM_CONTRACT_REGISTRY['price.breakout_down'].key) {
      return this.hasBreakoutReference(params)
    }

    if (key === ATOM_CONTRACT_REGISTRY['price.range_position_lte'].key || key === ATOM_CONTRACT_REGISTRY['price.range_position_gte'].key) {
      return this.hasPositiveInteger(params.lookbackBars) && this.isPercentThreshold(params.thresholdPct)
    }

    if (key === ATOM_CONTRACT_REGISTRY['price.candle_pattern'].key) {
      // pattern 必填，其它 slot 可选；single_bull_bar / single_bear_bar / engulfing / hammer / doji / consecutive_body 都允许
      return Boolean(this.readTrimmedString(params.pattern))
    }

    if (key === ATOM_CONTRACT_REGISTRY['grid.range_rebalance'].key) {
      // 显式 range 或 center-offset+levels 二选一；都缺则确实没法 synthesize 合约
      if (this.resolveGridRange(params) !== null) return true
      return this.hasPositiveFiniteNumber(params.centerOffsetPct) && this.hasPositiveInteger(params.levels)
    }

    if (
      key === ATOM_CONTRACT_REGISTRY['trend.direction'].key
      || key === 'market.trend'
      || key === 'market.range'
      || key === ATOM_CONTRACT_REGISTRY['market.regime'].key
      || key === ATOM_CONTRACT_REGISTRY['volatility.state'].key
    ) {
      return Object.keys(params).length > 0
    }

    return key === ATOM_CONTRACT_REGISTRY['execution.on_start'].key && SYNTHESIZABLE_TRIGGER_KEYS.has(key)
    /* eslint-enable atom-keys/no-atom-key-literal */
  }

  private hasIndicatorIdentity(params: Record<string, unknown>): boolean {
    return Boolean(this.readTrimmedString(params.indicator))
  }

  private hasIndicatorReference(params: Record<string, unknown>): boolean {
    if (
      this.hasFiniteNumber(params.period)
      || this.hasFiniteNumber(params.fastPeriod)
      || this.hasFiniteNumber(params.slowPeriod)
      || this.hasFiniteNumber(params['reference.period'])
    ) {
      return true
    }

    return this.isRecord(params.reference) && this.hasFiniteNumber(params.reference.period)
  }

  private hasBreakoutReference(params: Record<string, unknown>): boolean {
    const reference = this.readTrimmedString(params.reference)
    if (reference && reference !== 'unknown') {
      return true
    }

    return this.hasFiniteNumber(params.lookbackBars)
      || this.hasFiniteNumber(params.windowBars)
      || this.isRecord(params.expression)
  }

  private isSupportedBollingerBoundaryParams(params: Record<string, unknown>): boolean {
    const indicator = params.indicator
    return this.isRecord(indicator)
      && indicator.name === 'bollinger'
      && (params.boundaryRole === 'upper' || params.boundaryRole === 'lower' || params.boundaryRole === 'middle')
  }

  private hasFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value)
  }

  private isFiniteNonZeroNumber(value: unknown): value is number {
    return this.hasFiniteNumber(value) && value !== 0
  }

  private hasPositiveFiniteNumber(value: unknown): value is number {
    return this.hasFiniteNumber(value) && value > 0
  }

  private hasPositiveInteger(value: unknown): value is number {
    return this.hasPositiveFiniteNumber(value) && Number.isInteger(value)
  }

  private isPercentThreshold(value: unknown): value is number {
    return this.hasFiniteNumber(value) && value > 0 && value <= 100
  }

  private resolveGridRange(params: Record<string, unknown>): { lower: number; upper: number } | null {
    const lower = this.readFiniteNumberParam(params, ['rangeLower', 'rangeMin', 'lower'])
    const upper = this.readFiniteNumberParam(params, ['rangeUpper', 'rangeMax', 'upper'])
    if (lower === null || upper === null || lower <= 0 || upper <= lower) {
      return null
    }

    return { lower, upper }
  }

  private resolveGridDensityShape(params: Record<string, unknown>): SemanticCapabilityShape {
    const gridCount = this.readFiniteNumberParam(params, ['gridCount'])
    const gridIntervals = this.readFiniteNumberParam(params, ['gridIntervals'])
    const absoluteSpacing = this.readFiniteNumberParam(params, ['absoluteSpacing'])
    const spacingPct = this.readFiniteNumberParam(params, ['spacingPct', 'stepPct'])

    return this.toCapabilityShape({
      ...(gridCount !== null ? { gridCount } : {}),
      ...(gridIntervals !== null ? { gridIntervals } : {}),
      ...(absoluteSpacing !== null ? { absoluteSpacing } : {}),
      ...(spacingPct !== null ? { spacingPct } : {}),
    })
  }

  private readFiniteNumberParam(params: Record<string, unknown>, keys: readonly string[]): number | null {
    for (const key of keys) {
      const value = this.readFiniteNumber(params[key])
      if (value !== null) {
        return value
      }
    }

    return null
  }

  private readFiniteNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null
  }

  private buildTriggerCapability(
    key: string,
    phase: SemanticTriggerState['phase'],
    sideScope: SemanticTriggerState['sideScope'] | null,
    params: Record<string, unknown>,
  ): SemanticCapability {
    /* eslint-disable atom-keys/no-atom-key-literal -- trigger-capability dispatch: volume.spike / volume.relative_average / condition.sequence / confirmation.rebound not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329) */
    if (key === 'volume.spike' || key === ATOM_CONTRACT_REGISTRY['volume.threshold'].key) {
      return {
        domain: 'market',
        verb: 'detect',
        object: 'volume_condition',
        shape: this.toCapabilityShape({
          key,
          phase,
          sideScope: sideScope ?? null,
          ...params,
        }),
      }
    }

    if (key === 'volume.relative_average') {
      return {
        domain: 'market',
        verb: 'detect',
        object: 'volume_relative_average',
        shape: this.toCapabilityShape({
          key,
          phase,
          sideScope: sideScope ?? null,
          ...params,
        }),
      }
    }

    if (key === ATOM_CONTRACT_REGISTRY['volatility.atr_threshold'].key) {
      return {
        domain: 'market',
        verb: 'detect',
        object: 'volatility_condition',
        shape: this.toCapabilityShape({
          key,
          phase,
          sideScope: sideScope ?? null,
          ...params,
        }),
      }
    }

    if (key === 'condition.sequence') {
      return {
        domain: 'price',
        verb: 'detect',
        object: 'sequence_condition',
        shape: this.toCapabilityShape({
          key,
          phase,
          sideScope: sideScope ?? null,
          ...params,
        }),
      }
    }

    if (key === 'confirmation.rebound') {
      return {
        domain: 'price',
        verb: 'confirm',
        object: 'rebound',
        shape: this.toCapabilityShape({
          key,
          phase,
          sideScope: sideScope ?? null,
          ...params,
        }),
      }
    }
    /* eslint-enable atom-keys/no-atom-key-literal */

    if (key === ATOM_CONTRACT_REGISTRY['execution.on_start'].key) {
      return {
        domain: 'order_program',
        verb: 'schedule',
        object: 'execution_trigger',
        shape: this.toCapabilityShape({
          key,
          phase,
          sideScope: sideScope ?? null,
          ...params,
        }),
      }
    }

    if (key === ATOM_CONTRACT_REGISTRY['grid.range_rebalance'].key) {
      const range = this.resolveGridRange(params)
      // Issue #1391：中心偏移网格（用户表达"以部署时当前价为中心、上下各 N% 共 M 格"）
      //   走 'centered_percent_range' 模式，centerTiming='deployment' 让 runtime 在
      //   onStart 用当前价作为中心、halfRangePct=centerOffsetPct 派生 range、
      //   levels 映射到 gridIntervals/gridCount。canonical-spec-builder 已支持该 mode。
      if (!range) {
        const centerOffsetPct = this.readFiniteNumberParam(params, ['centerOffsetPct'])
        const levels = this.readFiniteNumberParam(params, ['levels'])
        if (centerOffsetPct !== null && centerOffsetPct > 0 && levels !== null && levels >= 2) {
          return {
            domain: 'price',
            verb: 'define',
            object: 'level_set',
            shape: this.toCapabilityShape({
              mode: 'centered_percent_range',
              centerTiming: 'deployment',
              centerSource: 'last_price',
              halfRangePct: centerOffsetPct,
              gridIntervals: levels,
              gridCount: levels,
              spacingMode: 'arithmetic',
              ...this.resolveGridDensityShape(params),
            }),
          }
        }
      }
      return {
        domain: 'price',
        verb: 'define',
        object: 'level_set',
        shape: this.toCapabilityShape({
          mode: 'fixed_range',
          lower: range?.lower ?? null,
          upper: range?.upper ?? null,
          spacingMode: 'arithmetic',
          ...this.resolveGridDensityShape(params),
        }),
      }
    }

    return {
      domain: 'price',
      verb: 'detect',
      object: 'signal_condition',
      shape: this.toCapabilityShape({
        key,
        phase,
        sideScope: sideScope ?? null,
        ...params,
      }),
    }
  }

  private ensureGridLevelSetDensityOpenSlot(input: {
    key: string
    openSlots: SemanticSlotState[]
    contracts: SemanticAtomContract[] | null
    ownerFieldPath: string
  }): SemanticSlotState[] {
    if (input.key !== ATOM_CONTRACT_REGISTRY['grid.range_rebalance'].key || !input.contracts?.length) {
      return input.openSlots
    }

    const target = this.resolveLevelSetContractTarget(input.contracts, input.ownerFieldPath)
    if (!target || this.hasLevelSetDensity(target.capability.shape)) {
      return input.openSlots
    }

    if (input.openSlots.some(slot => slot.slotKey === LEVEL_SET_DENSITY_SLOT_KEY && slot.fieldPath === target.fieldPath)) {
      return input.openSlots
    }

    return [
      ...this.removeContractRequiredSlots(input.openSlots, target.contractFieldPath),
      {
        slotKey: LEVEL_SET_DENSITY_SLOT_KEY,
        fieldPath: target.fieldPath,
        status: 'open',
        priority: 'core',
        questionHint: '请确认网格数量或每格间距，例如 20 格 / 每格 100 USDT / 每格 0.5%。',
        affectsExecution: true,
      },
    ]
  }

  private resolveLevelSetContractTarget(contracts: SemanticAtomContract[], ownerFieldPath: string): {
    capability: SemanticCapability
    contractFieldPath: string
    fieldPath: string
  } | null {
    for (const contract of contracts) {
      const capability = contract.capabilities.find(item =>
        item.domain === 'price'
        && item.verb === 'define'
        && item.object === 'level_set',
      )
      if (!capability) continue

      return {
        capability,
        contractFieldPath: `${ownerFieldPath}.contracts`,
        fieldPath: `${ownerFieldPath}.contracts[${contract.id}].capabilities[price.define.level_set].shape`,
      }
    }

    return null
  }

  private hasLevelSetDensity(shape: SemanticCapabilityShape): boolean {
    return this.hasPositiveFiniteNumber(shape.gridCount)
      || this.hasPositiveFiniteNumber(shape.gridIntervals)
      || this.hasPositiveFiniteNumber(shape.absoluteSpacing)
      || this.hasPositiveFiniteNumber(shape.spacingPct)
  }

  private synthesizeActionContracts(
    key: string,
    params: Record<string, unknown>,
    index: number,
  ): SemanticAtomContract[] | null {
    if (SYNTHESIZABLE_GRID_ACTION_KEYS.has(key)) {
      return [this.withRegistryContractSubstrate(key, this.buildGridActionContract(key, params, index))]
    }

    if (SYNTHESIZABLE_POSITION_LIFECYCLE_ACTION_KEYS.has(key)) {
      return [this.buildPositionLifecycleActionContract(key, params, index)]
    }

    if (!SYNTHESIZABLE_ACTION_KEYS.has(key)) {
      return null
    }

    const contract = this.buildAtomContract({
      id: `contract-seed-action-${index + 1}-${this.slugifyContractId(key)}`,
      kind: 'action',
      capability: {
        domain: 'order_program',
        verb: 'execute',
        object: 'order_action',
        shape: this.toCapabilityShape({
          key,
          side: this.resolveActionSide(key),
          intent: this.resolveActionIntent(key),
          ...params,
        }),
      },
      params,
    })

    return [this.withRegistryContractSubstrate(key, contract)]
  }

  private buildGridActionContract(
    key: string,
    params: Record<string, unknown>,
    index: number,
  ): SemanticAtomContract {
    return this.buildAtomContract({
      id: `contract-seed-action-${index + 1}-${this.slugifyContractId(key)}`,
      kind: 'action',
      capability: {
        domain: 'order_program',
        verb: 'maintain',
        object: 'limit_ladder',
        shape: this.toCapabilityShape({
          key,
          orderType: this.readTrimmedString(params.orderType) ?? 'limit',
          timeInForce: this.readTrimmedString(params.timeInForce) ?? 'gtc',
          recycleOnFill: typeof params.recycleOnFill === 'boolean' ? params.recycleOnFill : true,
          pairingPolicy: this.readTrimmedString(params.pairingPolicy) ?? 'grid_level',
        }),
      },
      params,
    })
  }

  private buildPositionLifecycleActionContract(
    key: string,
    params: Record<string, unknown>,
    index: number,
  ): SemanticAtomContract {
    const intent = this.resolvePositionLifecycleActionIntent(key)
    const contract = this.withRegistryContractSubstrate(key, this.buildAtomContract({
      id: `contract-seed-action-${index + 1}-${this.slugifyContractId(key)}`,
      kind: 'action',
      capability: {
        domain: 'order_program',
        verb: 'execute',
        object: 'order_action',
        shape: this.toCapabilityShape({
          key,
          intent,
          ...params,
        }),
      },
      params,
    }))

    // eslint-disable-next-line atom-keys/no-atom-key-literal -- action.reduce_position not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329)
    if (key === 'action.reduce_position') {
      return {
        ...contract,
        orderRequirements: [
          ...contract.orderRequirements,
          { domain: 'order', verb: 'enforce', object: 'no_exposure_increase' },
        ],
        effects: [
          { domain: 'exposure', verb: 'reduce', object: 'position' },
        ],
      }
    }

    if (key === ATOM_CONTRACT_REGISTRY['action.add_position'].key) {
      return {
        ...contract,
        effects: [
          { domain: 'exposure', verb: 'increase', object: 'position' },
        ],
      }
    }

    return {
      ...contract,
      effects: [
        { domain: 'exposure', verb: 'reduce', object: 'position', shape: this.toCapabilityShape({ phase: 'close_current' }) },
        { domain: 'exposure', verb: 'increase', object: 'position', shape: this.toCapabilityShape({ phase: 'open_opposite' }) },
      ],
    }
  }

  private resolvePositionLifecycleActionIntent(key: string): 'reduce' | 'add' | 'reverse' {
    // eslint-disable-next-line atom-keys/no-atom-key-literal -- action.reduce_position not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329)
    if (key === 'action.reduce_position') {
      return 'reduce'
    }

    if (key === ATOM_CONTRACT_REGISTRY['action.add_position'].key) {
      return 'add'
    }

    return 'reverse'
  }

  private synthesizeRiskContracts(
    key: string,
    params: Record<string, unknown>,
    index: number,
  ): SemanticAtomContract[] | null {
    if (!this.canSynthesizeRiskContract(key, params)) {
      return null
    }

    const object = this.resolveRiskContractObject(key)
    if (!object) {
      return null
    }

    const contract = this.buildAtomContract({
      id: `contract-seed-risk-${index + 1}-${this.slugifyContractId(key)}`,
      kind: 'risk',
      capability: {
        domain: 'guard',
        verb: 'enforce',
        object,
        shape: this.toCapabilityShape({
          key,
          ...params,
        }),
      },
      params,
    })

    if (key === ATOM_CONTRACT_REGISTRY['risk.partial_take_profit'].key && !Array.isArray(params.tiers)) {
      return [contract]
    }

    return [this.withRegistryContractSubstrate(key, contract)]
  }

  private canSynthesizeRiskContract(key: string, params: Record<string, unknown>): boolean {
    /* eslint-disable atom-keys/no-atom-key-literal -- risk.atr_stop / risk.stop_loss_pct / risk.take_profit_pct / risk.trailing_stop_pct / risk.max_drawdown_pct / risk.max_single_loss_pct / risk.condition_expression not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329) */
    if (key === 'risk.atr_stop') {
      return true
    }

    if (key === ATOM_CONTRACT_REGISTRY['risk.partial_take_profit'].key) {
      return true
    }

    if (
      key === 'risk.stop_loss_pct'
      || key === 'risk.take_profit_pct'
      || key === 'risk.trailing_stop_pct'
      || key === 'risk.max_drawdown_pct'
      || key === 'risk.max_single_loss_pct'
    ) {
      return this.hasPositiveFiniteNumber(params.valuePct)
    }

    if (key === 'risk.condition_expression') {
      return validateSemanticRiskContract({
        key,
        params: {
          capabilityStatus: 'recognized_unsupported',
          ...params,
        },
      }).ok
    }
    /* eslint-enable atom-keys/no-atom-key-literal */

    const resolved = this.semanticAtomRegistry.resolve(key)
    return resolved.category === 'risk' && resolved.supportStatus === 'supported_requires_slot'
  }

  private resolveRiskContractObject(key: string): string | null {
    /* eslint-disable atom-keys/no-atom-key-literal -- risk.stop_loss_pct / risk.take_profit_pct / risk.trailing_stop_pct / risk.max_drawdown_pct / risk.max_single_loss_pct / risk.condition_expression / risk.atr_stop / risk.falling_knife_guard not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329) */
    if (key === 'risk.stop_loss_pct') {
      return 'stop_loss'
    }
    if (key === 'risk.take_profit_pct') {
      return 'take_profit'
    }
    if (key === 'risk.trailing_stop_pct') {
      return 'trailing_stop'
    }
    if (key === 'risk.max_drawdown_pct') {
      return 'max_drawdown'
    }
    if (key === 'risk.max_single_loss_pct') {
      return 'max_single_loss'
    }
    if (key === 'risk.condition_expression') {
      return 'risk_condition'
    }
    if (key === 'risk.atr_stop') {
      return 'atr_stop'
    }
    if (key === ATOM_CONTRACT_REGISTRY['risk.partial_take_profit'].key) {
      return 'partial_take_profit'
    }
    if (key === 'risk.falling_knife_guard') {
      return 'falling_knife_guard'
    }
    /* eslint-enable atom-keys/no-atom-key-literal */
    return null
  }

  private attachPartialTakeProfitMemoryKey(params: Record<string, unknown>): Record<string, unknown> {
    const existing = typeof params.memoryKey === 'string' && params.memoryKey.startsWith('partial_tp_')
      ? params.memoryKey
      : null
    const memoryKey = existing ?? this.derivePartialTakeProfitMemoryKey(params)
    return { ...params, memoryKey }
  }

  private derivePartialTakeProfitMemoryKey(params: Record<string, unknown>): string {
    const rawTiers = Array.isArray(params.tiers) ? params.tiers : []
    // Sort by trigger.threshold so equivalent tier sets — regardless of LLM
    // insertion order — produce identical memoryKey and reuse runtime state.
    const sortedTiers = [...rawTiers].sort((a, b) => {
      const ta = typeof (a as { trigger?: { threshold?: unknown } })?.trigger?.threshold === 'number'
        ? (a as { trigger: { threshold: number } }).trigger.threshold
        : 0
      const tb = typeof (b as { trigger?: { threshold?: unknown } })?.trigger?.threshold === 'number'
        ? (b as { trigger: { threshold: number } }).trigger.threshold
        : 0
      return ta - tb
    })
    const tiersJson = JSON.stringify(sortedTiers)
    const sourceText = typeof params.sourceText === 'string' ? params.sourceText : ''
    const hash = createHash('sha256').update(`${tiersJson}|${sourceText}`).digest('hex').slice(0, 16)
    return `partial_tp_${hash}`
  }

  private withRequiredSeedOpenSlots(state: SemanticState): SemanticState {
    const hasExecutableSemantics = readFlatTriggers(state).length > 0
      || readFlatActions(state).length > 0
      || (state.positionConstraint?.length ?? 0) > 0
      || (state.orchestration?.length ?? 0) > 0
    if (!hasExecutableSemantics) {
      return state
    }

    const contextSlots = { ...state.contextSlots }
    let changed = false
    for (const field of ['exchange', 'symbol', 'marketType', 'timeframe'] as const) {
      if (contextSlots[field]) continue
      contextSlots[field] = {
        slotKey: field,
        fieldPath: `contextSlots.${field}`,
        value: null,
        status: 'open',
        priority: 'context',
        questionHint: CONTEXT_QUESTION_HINTS[field],
        affectsExecution: true,
      }
      changed = true
    }

    // PR3.1: use PerTradeSizingResolver instead of hasContractPerOrderBudget
    const anchors = this.sizingResolver.resolve(state)
    const anyExecutionAnchored = [...anchors.values()].some(a => a.executionAnchored)

    // 8a: emit structured warn when sizing falls back to position_constraint_params_fallback
    for (const anchor of anchors.values()) {
      if (anchor.source === 'position_constraint_params_fallback') {
        this.logger.warn({
          event: 'sizing.fallback.position_constraint_params_fallback',
          module: 'SemanticSeedStateBuilderService',
        })
      }
    }

    // critic M1 fix: anchored 时不创建 state.position 占位
    if (!state.position && !anyExecutionAnchored) {
      return {
        ...state,
        contextSlots,
        position: {
          mode: 'fixed_ratio',
          value: 0,
          sizing: null,
          positionMode: this.inferPositionModeFromActions(readFlatActions(state)),
          status: 'open',
          source: 'derived',
          openSlots: [{
            slotKey: 'position.sizing',
            fieldPath: 'position.sizing',
            status: 'open',
            priority: 'risk',
            questionHint: '请确认单笔仓位大小（例如 10% / 10 USDT / 0.001 BTC）。',
            affectsExecution: true,
          }],
        },
      }
    }

    // PR3.7 派生投影：在 anchored 情况下把单一 anchor 投影到 state.position.sizing 供下游消费
    const baseState = changed ? { ...state, contextSlots } : state
    return this.projectSingleAnchorToPosition(baseState, anchors)
  }

  private projectSingleAnchorToPosition(state: SemanticState, anchors: ReadonlyMap<string, SizingAnchor>): SemanticState {
    if (state.position?.sizing) return state  // 主仓 sizing 已有，不覆盖
    const executable = [...anchors.values()].filter(a => a.executionAnchored)
    if (executable.length === 0) return state  // 无证据，守门会问
    if (executable.length > 1) return { ...state, isMultiLeg: true }  // 多锚，标记 multi-leg
    const single = executable[0]
    if (!single.normalized) return state
    const { axis, value, asset } = single.normalized
    // risk_budget 不投影：SemanticPositionSizingContract union 不含 risk_budget kind（PR4+）
    if (axis === 'risk_budget') return state
    // base_qty 仅在 asset 已知时投影，避免 emit asset='' 下游错误
    if (axis === 'base_qty' && !asset) return state
    return {
      ...state,
      position: {
        ...(state.position ?? {}),
        sizing: legacySizingFromNormalized(axis, value, asset),
        mode: legacyModeFromAxis(axis),
        value,
        positionMode: state.position?.positionMode ?? this.inferPositionModeFromActions(readFlatActions(state)),
        status: 'locked',
        source: 'derived',
        openSlots: [],
      },
    }
  }

  private inferPositionModeFromActions(actions: SemanticActionState[]): 'long_only' | 'short_only' | 'long_short' {
    const hasLong = actions.some(action => action.key.includes('long'))
    const hasShort = actions.some(action => action.key.includes('short'))
    if (hasLong && hasShort) return 'long_short'
    if (hasShort) return 'short_only'
    return 'long_only'
  }

  private synthesizePositionContracts(position: {
    sizing: SemanticPositionSizingContract | null
    sizingProvided: boolean
    mode: string | null
    value: number
    positionMode: string
  }): SemanticAtomContract[] | null {
    if (
      !position.mode
      || !this.hasPositiveFiniteNumber(position.value)
      || !this.isSupportedPositionSideMode(position.positionMode)
      || (position.sizingProvided && !position.sizing)
    ) {
      return null
    }

    return [this.buildAtomContract({
      id: 'contract-seed-position-sizing',
      kind: 'position',
      capability: {
        domain: 'capital',
        verb: 'allocate',
        object: 'position_sizing',
        shape: this.toCapabilityShape({
          sizing: position.sizing,
          mode: position.mode,
          value: position.value,
          positionMode: position.positionMode,
        }),
      },
      params: {
        sizing: position.sizing,
        mode: position.mode,
        value: position.value,
        positionMode: position.positionMode,
      },
    })]
  }

  private synthesizePositionConstraintContracts(
    key: SemanticPositionConstraintState['key'],
    params: Record<string, unknown>,
    index: number,
  ): SemanticAtomContract[] | null {
    if (key === ATOM_CONTRACT_REGISTRY['grid.range_rebalance'].key) {
      return [this.synthesizeGridRangeRebalanceContract(key, params, index)]
    }

    // eslint-disable-next-line atom-keys/no-atom-key-literal -- position.dca_schedule not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329)
    if (key === 'position.dca_schedule') {
      return [this.synthesizeDcaScheduleContract(key, params, index)]
    }

    const object = key === ATOM_CONTRACT_REGISTRY['position.pyramiding_limit'].key
      ? 'pyramiding_layers'
      : 'max_exposure_pct'
    const contract = this.withRegistryContractSubstrate(key, this.buildAtomContract({
      id: `contract-seed-position-constraint-${index + 1}-${this.slugifyContractId(key)}`,
      kind: 'position',
      capability: {
        domain: 'exposure',
        verb: 'limit',
        object,
        shape: this.toCapabilityShape({
          key,
          ...params,
        }),
      },
      params,
    }))

    // Issue #1191: pyramiding 原子 emit capital.allocate.per_order_budget capability，
    //   形态对齐 DCA：顶层 kind/value/asset/unit + triggerSource。仅当 layerSizing.value
    //   为有限数字时 emit，避免半成品 capability 触发下游 sizing 守门。
    const layerSizingShape = key === ATOM_CONTRACT_REGISTRY['position.pyramiding_limit'].key
      ? this.readUnknownShape(params.layerSizing)
      : null
    const extraCapabilities: SemanticCapability[] = (layerSizingShape !== null
      && typeof layerSizingShape.value === 'number'
      && Number.isFinite(layerSizingShape.value))
      ? [{
          ...DCA_PER_ORDER_BUDGET_CAPABILITY,
          shape: this.toCapabilityShape({
            kind: typeof layerSizingShape.kind === 'string' ? layerSizingShape.kind : 'ratio',
            value: layerSizingShape.value,
            asset: typeof layerSizingShape.asset === 'string' ? layerSizingShape.asset : undefined,
            unit: typeof layerSizingShape.unit === 'string' ? layerSizingShape.unit : undefined,
            triggerSource: 'position.pyramiding_limit',
          }),
        }]
      : []

    return [{
      ...contract,
      capabilities: [...contract.capabilities, ...extraCapabilities],
      effects: [
        { domain: 'guard', verb: 'block', object: 'exposure_increase' },
      ],
    }]
  }

  private synthesizeGridRangeRebalanceContract(
    key: SemanticPositionConstraintState['key'],
    params: Record<string, unknown>,
    index: number,
  ): SemanticAtomContract {
    const range = this.resolveGridRange(params)
    // Issue #1391：中心偏移模式（"以部署时当前价为中心、上下各 N% 共 M 格"）
    //   走 'centered_percent_range'，centerTiming='deployment' 让 runtime 在 onStart
    //   用当前价做中心、halfRangePct=centerOffsetPct 派生 range；canonical-spec-builder
    //   的 projectLevelSetCapabilityKey 已支持该 mode。
    const centerOffsetPct = this.readFiniteNumberParam(params, ['centerOffsetPct'])
    const levels = this.readFiniteNumberParam(params, ['levels'])
    const useCenteredMode = !range && centerOffsetPct !== null && centerOffsetPct > 0
      && levels !== null && levels >= 2
    const levelSetShape = useCenteredMode
      ? this.toCapabilityShape({
          mode: 'centered_percent_range',
          centerTiming: 'deployment',
          centerSource: 'last_price',
          halfRangePct: centerOffsetPct,
          gridIntervals: levels,
          gridCount: levels,
          spacingMode: 'arithmetic',
          ...this.resolveGridDensityShape(params),
        })
      : this.toCapabilityShape({
          mode: 'fixed_range',
          lower: range?.lower ?? null,
          upper: range?.upper ?? null,
          spacingMode: 'arithmetic',
          ...this.resolveGridDensityShape(params),
        })
    const perGridSizing = this.resolveGridPerOrderSizingShape(params)
    const capabilities: SemanticCapability[] = [
      {
        domain: 'price',
        verb: 'define',
        object: 'level_set',
        shape: levelSetShape,
      },
      {
        domain: 'order_program',
        verb: 'maintain',
        object: 'limit_ladder',
        shape: this.toCapabilityShape({
          key,
          levelSet: levelSetShape,
          sideMode: params.sideMode,
          recycle: params.recycle,
          breakoutAction: params.breakoutAction,
        }),
      },
    ]

    if (perGridSizing !== null) {
      capabilities.push({
        ...DCA_PER_ORDER_BUDGET_CAPABILITY,
        shape: this.toCapabilityShape({
          ...perGridSizing,
          triggerSource: key,
        }),
      })
    }

    return this.withRegistryContractSubstrate(key, {
      id: `contract-seed-position-constraint-${index + 1}-${this.slugifyContractId(key)}`,
      kind: 'position',
      capabilities,
      requires: [],
      params,
      runtimeRequirements: [],
      stateRequirements: [],
      orderRequirements: [],
      openSlots: [],
    })
  }

  private resolveGridPerOrderSizingShape(params: Record<string, unknown>): Record<string, unknown> | null {
    const structuredSizing = this.readGridStructuredSizing(params, [
      'perOrderSizing',
      'perGridSizing',
      'sizing',
      'orderSize',
    ])

    if (structuredSizing !== null
      && typeof structuredSizing.value === 'number'
      && Number.isFinite(structuredSizing.value)
      && structuredSizing.value > 0) {
      return {
        kind: typeof structuredSizing.kind === 'string' ? structuredSizing.kind : 'quote',
        value: structuredSizing.value,
        ...(typeof structuredSizing.asset === 'string' ? { asset: structuredSizing.asset } : {}),
        ...(typeof structuredSizing.unit === 'string' ? { unit: structuredSizing.unit } : {}),
      }
    }

    const numericSizing = this.readFiniteNumberParam(params, ['perGridSizing', 'perOrderSizing', 'sizing', 'orderSize'])
    return numericSizing !== null
      ? { kind: 'ratio', value: numericSizing, unit: 'ratio' }
      : null
  }

  private readGridStructuredSizing(
    params: Record<string, unknown>,
    keys: readonly string[],
  ): Record<string, unknown> | null {
    for (const key of keys) {
      const value = params[key]
      if (!this.isRecord(value)) {
        continue
      }
      const shape = this.readUnknownShape(value)
      if (shape !== null) {
        return shape
      }
    }

    return null
  }

  private synthesizeDcaScheduleContract(
    key: SemanticPositionConstraintState['key'],
    params: Record<string, unknown>,
    index: number,
  ): SemanticAtomContract {
    const exitRuleShape = this.readUnknownShape(params.exitRule)
    const perOrderSizingShape = this.readUnknownShape(params.perOrderSizing)
    const contract = this.withRegistryContractSubstrate(key, {
      id: `contract-seed-position-constraint-${index + 1}-${this.slugifyContractId(key)}`,
      kind: 'position',
      capabilities: [
        {
          domain: 'runtime',
          verb: 'schedule',
          object: 'dca_orders',
          shape: this.toCapabilityShape({
            key,
            maxCount: this.readFiniteNumber(params.maxCount),
            capitalCap: this.readCapitalCapShape(params.capitalCap),
            perOrderSizing: this.readUnknownShape(params.perOrderSizing) ?? params.perOrderSizing,
            triggerMode: params.triggerMode,
            priceIntervalPct: this.readFiniteNumber(params.priceIntervalPct),
            priceIntervalQuote: this.readFiniteNumber(params.priceIntervalQuote),
            timeIntervalBars: this.readFiniteNumber(params.timeIntervalBars),
            timeIntervalMs: this.readFiniteNumber(params.timeIntervalMs),
          }),
        },
        ...(exitRuleShape
          ? [{
              domain: 'guard' as const,
              verb: 'define',
              object: 'dca_exit_rule',
              shape: exitRuleShape,
            }]
          : []),
        // PR4.1 + Issue #1190: emit standard capital.allocate.per_order_budget evidence.
        // 形态对齐 PerTradeSizingResolver.resolveAxisFromShape 要求：顶层 kind/value，
        // 不再嵌在 `sizing` 键下。仅当 value 为有限数字时才 emit，避免半成品 capability。
        ...(perOrderSizingShape !== null
        && typeof perOrderSizingShape.value === 'number'
        && Number.isFinite(perOrderSizingShape.value)
          ? [{
              ...DCA_PER_ORDER_BUDGET_CAPABILITY,
              shape: this.toCapabilityShape({
                kind: typeof perOrderSizingShape.kind === 'string' ? perOrderSizingShape.kind : 'quote',
                value: perOrderSizingShape.value,
                asset: typeof perOrderSizingShape.asset === 'string' ? perOrderSizingShape.asset : undefined,
                unit: typeof perOrderSizingShape.unit === 'string' ? perOrderSizingShape.unit : undefined,
                triggerSource: 'position.dca_schedule',
              }),
            }]
          : []),
      ],
      requires: exitRuleShape
        ? []
        : [{ domain: 'guard', verb: 'define', object: 'dca_exit_rule' }],
      params,
      runtimeRequirements: [],
      stateRequirements: [],
      orderRequirements: [],
      openSlots: [],
    })

    return {
      ...contract,
      openSlots: this.filterSatisfiedDcaContractOpenSlots(contract.openSlots, params),
      effects: [
        { domain: 'exposure', verb: 'increase', object: 'position' },
      ],
    }
  }

  private filterSatisfiedDcaContractOpenSlots(
    openSlots: readonly SemanticSlotState[],
    params: Record<string, unknown>,
  ): SemanticSlotState[] {
    return openSlots.filter((slot) => {
      /* eslint-disable atom-keys/no-atom-key-literal -- position.dca_schedule.* slot keys not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329) */
      if (slot.slotKey === 'position.dca_schedule.max_count') {
        return this.readFiniteNumber(params.maxCount) === null
      }
      if (slot.slotKey === 'position.dca_schedule.capital_cap') {
        return this.readCapitalCapShape(params.capitalCap) === null
      }
      if (slot.slotKey === 'position.dca_schedule.per_order_sizing') {
        return this.readUnknownShape(params.perOrderSizing) === null
      }
      if (slot.slotKey === 'position.dca_schedule.trigger_mode') {
        return typeof params.triggerMode !== 'string' || params.triggerMode.length === 0
      }
      if (slot.slotKey === 'position.dca_schedule.exit_rule') {
        return false
      }

      /* eslint-enable atom-keys/no-atom-key-literal */
      return true
    })
  }

  private readCapitalCapShape(value: unknown): number | SemanticCapabilityShape | null {
    const finiteNumber = this.readFiniteNumber(value)
    if (finiteNumber !== null) {
      return finiteNumber
    }

    return this.readUnknownShape(value)
  }

  private buildAtomContract(input: {
    id: string
    kind: SemanticAtomContract['kind']
    capability: SemanticCapability
    params: Record<string, unknown>
  }): SemanticAtomContract {
    return {
      id: input.id,
      kind: input.kind,
      capabilities: [input.capability],
      requires: [],
      params: input.params,
      runtimeRequirements: [],
      stateRequirements: [],
      orderRequirements: [],
      openSlots: [],
    }
  }

  private withRegistryContractSubstrate(
    atomKey: string,
    contract: SemanticAtomContract,
  ): SemanticAtomContract {
    const resolved = this.semanticAtomRegistry.resolve(
      this.resolveContractSubstrateAtomKey(atomKey, contract.params),
      contract.params,
    )
    if (!('contractSubstrate' in resolved) || !resolved.contractSubstrate) {
      return contract
    }

    return {
      ...contract,
      runtimeRequirements: [...resolved.contractSubstrate.runtimeRequirements],
      stateRequirements: [...resolved.contractSubstrate.stateRequirements],
      orderRequirements: [...resolved.contractSubstrate.orderRequirements],
      openSlots: resolved.contractSubstrate.openSlots.map(slot => toSemanticSupportOpenSlot(slot)),
    }
  }

  private resolveContractSubstrateAtomKey(atomKey: string, params: Record<string, unknown>): string {
    if ((atomKey !== ATOM_CONTRACT_REGISTRY['indicator.above'].key && atomKey !== ATOM_CONTRACT_REGISTRY['indicator.below'].key) || !this.isMovingAverageIndicatorAlias(params)) {
      return atomKey
    }

    return atomKey === ATOM_CONTRACT_REGISTRY['indicator.above'].key ? 'indicator.threshold_gte' : 'indicator.threshold_lte'
  }

  private isMovingAverageIndicatorAlias(params: Record<string, unknown>): boolean {
    const indicator = this.readTrimmedString(params.indicator)?.toLowerCase()
    return indicator === 'ma' || indicator === 'sma' || indicator === 'ema'
  }

  private readContracts(value: unknown): SemanticAtomContract[] | null {
    if (!Array.isArray(value)) {
      return null
    }

    const contracts = value
      .map(item => this.toContract(item))
      .filter((item): item is SemanticAtomContract => item !== null)
    return contracts.length > 0 ? contracts : null
  }

  private toContract(value: unknown): SemanticAtomContract | null {
    if (!this.isRecord(value)) {
      return null
    }

    const id = this.readTrimmedString(value.id)
    const capabilities = this.readCapabilities(value.capabilities)
    const requires = this.readRequirements(value.requires)
    const runtimeRequirements = this.readRuntimeRequirements(value.runtimeRequirements)
    const stateRequirements = this.readStateRequirements(value.stateRequirements)
    const orderRequirements = this.readOrderRequirements(value.orderRequirements)
    if (
      !id
      || !this.isContractKind(value.kind)
      || !capabilities
      || !requires
      || !runtimeRequirements
      || !stateRequirements
      || !orderRequirements
    ) {
      return null
    }

    const effects = this.readEffects(value.effects)

    return {
      id,
      kind: value.kind,
      capabilities,
      requires,
      params: this.readParams(value.params),
      runtimeRequirements,
      stateRequirements,
      orderRequirements,
      openSlots: this.readOpenSlots(value.openSlots),
      ...(effects ? { effects } : {}),
    }
  }

  private readCapabilities(value: unknown): SemanticCapability[] | null {
    if (!Array.isArray(value)) {
      return null
    }

    const capabilities: SemanticCapability[] = []
    for (const item of value) {
      const capability = this.toCapability(item)
      if (!capability) {
        return null
      }
      capabilities.push(capability)
    }

    return capabilities.length > 0 ? capabilities : null
  }

  private toCapability(value: unknown): SemanticCapability | null {
    if (!this.isRecord(value) || !this.isCapabilityDomain(value.domain)) {
      return null
    }

    const verb = this.readTrimmedString(value.verb)
    const object = this.readTrimmedString(value.object)
    if (!verb || !object || !this.isCapabilityShape(value.shape)) {
      return null
    }

    return {
      domain: value.domain,
      verb,
      object,
      shape: value.shape,
    }
  }

  private readRequirements(value: unknown): SemanticRequirement[] | null {
    if (!Array.isArray(value)) {
      return null
    }

    const requirements: SemanticRequirement[] = []
    for (const item of value) {
      const requirement = this.toRequirement(item)
      if (!requirement) {
        return null
      }
      requirements.push(requirement)
    }

    return requirements
  }

  private toRequirement(value: unknown): SemanticRequirement | null {
    if (!this.isRecord(value) || !this.isCapabilityDomain(value.domain)) {
      return null
    }

    const verb = this.readTrimmedString(value.verb)
    const object = this.readTrimmedString(value.object)
    if (!verb || !object) {
      return null
    }

    return {
      domain: value.domain,
      verb,
      object,
    }
  }

  private readRuntimeRequirements(value: unknown): SemanticRuntimeRequirement[] | null {
    if (value === undefined) {
      return []
    }

    if (!Array.isArray(value)) {
      return null
    }

    const requirements: SemanticRuntimeRequirement[] = []
    for (const item of value) {
      const requirement = this.toRuntimeRequirement(item)
      if (!requirement) {
        return null
      }
      requirements.push(requirement)
    }

    return requirements
  }

  private toRuntimeRequirement(value: unknown): SemanticRuntimeRequirement | null {
    const requirement = this.toRequirementWithOptionalShape(value)
    if (!requirement || requirement.domain !== 'runtime') {
      return null
    }

    return {
      domain: 'runtime',
      verb: requirement.verb,
      object: requirement.object,
      ...(requirement.shape === undefined ? {} : { shape: requirement.shape }),
    }
  }

  private readStateRequirements(value: unknown): SemanticStateRequirement[] | null {
    if (value === undefined) {
      return []
    }

    if (!Array.isArray(value)) {
      return null
    }

    const requirements: SemanticStateRequirement[] = []
    for (const item of value) {
      const requirement = this.toStateRequirement(item)
      if (!requirement) {
        return null
      }
      requirements.push(requirement)
    }

    return requirements
  }

  private toStateRequirement(value: unknown): SemanticStateRequirement | null {
    const requirement = this.toRequirementWithOptionalShape(value)
    if (!requirement || requirement.domain !== 'state') {
      return null
    }

    return {
      domain: 'state',
      verb: requirement.verb,
      object: requirement.object,
      ...(requirement.shape === undefined ? {} : { shape: requirement.shape }),
    }
  }

  private readOrderRequirements(value: unknown): SemanticOrderRequirement[] | null {
    if (value === undefined) {
      return []
    }

    if (!Array.isArray(value)) {
      return null
    }

    const requirements: SemanticOrderRequirement[] = []
    for (const item of value) {
      const requirement = this.toOrderRequirement(item)
      if (!requirement) {
        return null
      }
      requirements.push(requirement)
    }

    return requirements
  }

  private toOrderRequirement(value: unknown): SemanticOrderRequirement | null {
    const requirement = this.toRequirementWithOptionalShape(value)
    if (!requirement || requirement.domain !== 'order') {
      return null
    }

    return {
      domain: 'order',
      verb: requirement.verb,
      object: requirement.object,
      ...(requirement.shape === undefined ? {} : { shape: requirement.shape }),
    }
  }

  private toRequirementWithOptionalShape(value: unknown): (SemanticRequirement & { shape?: SemanticCapabilityShape }) | null {
    const requirement = this.toRequirement(value)
    if (!requirement || !this.isRecord(value)) {
      return null
    }

    if (value.shape === undefined) {
      return requirement
    }

    if (!this.isCapabilityShape(value.shape)) {
      return null
    }

    return {
      ...requirement,
      shape: value.shape,
    }
  }

  private readEffects(value: unknown): SemanticEffect[] | null {
    if (!Array.isArray(value)) {
      return null
    }

    const effects: SemanticEffect[] = []
    for (const item of value) {
      const effect = this.toEffect(item)
      if (!effect) {
        return null
      }
      effects.push(effect)
    }

    return effects.length > 0 ? effects : null
  }

  private toEffect(value: unknown): SemanticEffect | null {
    if (!this.isRecord(value) || !this.isCapabilityDomain(value.domain)) {
      return null
    }

    const verb = this.readTrimmedString(value.verb)
    const object = this.readTrimmedString(value.object)
    const shape = value.shape
    if (!verb || !object) {
      return null
    }

    const effect: SemanticEffect = {
      domain: value.domain,
      verb,
      object,
    }

    if (shape === undefined) {
      return effect
    }

    if (!this.isCapabilityShape(shape)) {
      return null
    }

    return {
      ...effect,
      shape,
    }
  }

  private toContextSlots(update: unknown): SemanticState['contextSlots'] {
    if (!this.isRecord(update)) {
      return {
        exchange: null,
        symbol: null,
        marketType: null,
        timeframe: null,
      }
    }

    return {
      exchange: this.toContextSlot('exchange', update.exchange),
      symbol: this.toContextSlot('symbol', update.symbol),
      marketType: this.toContextSlot('marketType', update.marketType),
      timeframe: this.toContextSlot('timeframe', update.timeframe),
    }
  }

  private toContextSlot(
    field: ContextField,
    value: unknown,
  ): SemanticState['contextSlots'][typeof field] {
    if (field === 'symbol') {
      return this.toSymbolContextSlot(value)
    }

    if (this.isRecord(value)) {
      const slot = this.toSlotState(value, {
        slotKey: field,
        fieldPath: `contextSlots.${field}`,
        priority: 'context',
        questionHint: CONTEXT_QUESTION_HINTS[field],
      })
      return slot
    }

    const trimmedValue = this.readTrimmedString(value)
    if (!trimmedValue) {
      return null
    }

    return {
      slotKey: field,
      fieldPath: `contextSlots.${field}`,
      value: trimmedValue,
      status: 'locked',
      priority: 'context',
      questionHint: CONTEXT_QUESTION_HINTS[field],
      affectsExecution: true,
    }
  }

  private toSymbolContextSlot(value: unknown): SemanticState['contextSlots']['symbol'] {
    const resolution = this.resolveSymbolContextSlotValue(value)
    if (resolution) {
      return this.toResolvedSymbolSlot(resolution)
    }

    if (this.isRecord(value)) {
      return this.toSlotState(value, {
        slotKey: 'symbol',
        fieldPath: 'contextSlots.symbol',
        priority: 'context',
        questionHint: CONTEXT_QUESTION_HINTS.symbol,
      })
    }

    return null
  }

  private resolveSymbolContextSlotValue(value: unknown): MarketInstrumentSymbolResolution | null {
    const text = this.readTrimmedString(value)
    if (text) {
      return this.symbolResolver.resolve(text)
    }

    if (!this.isRecord(value)) {
      return null
    }

    return this.readSymbolResolution(value)
      ?? this.resolveSymbolContextSlotValue(value.value)
  }

  private readSymbolResolution(value: SemanticPatchRecord): MarketInstrumentSymbolResolution | null {
    const base = this.readTrimmedString(value.base)?.toUpperCase()
    const quote = this.readMarketInstrumentQuote(value.quote)
    const source = this.readMarketInstrumentSymbolSource(value.source)
    const evidenceText = this.readTrimmedString(value.evidenceText)
    const quoteSource = this.readMarketInstrumentQuoteSource(value.quoteSource)
    if (!base || !quote || !source || !evidenceText || !quoteSource) {
      return null
    }

    const venueSymbolHint = this.readTrimmedString(value.venueSymbolHint)
    const marketTypeHint = this.readMarketInstrumentMarketTypeHint(value.marketTypeHint)

    return {
      value: `${base}${quote}`,
      source,
      evidenceText,
      base,
      quote,
      quoteSource,
      ...(venueSymbolHint ? { venueSymbolHint } : {}),
      ...(marketTypeHint ? { marketTypeHint } : {}),
    }
  }

  private toResolvedSymbolSlot(resolution: MarketInstrumentSymbolResolution): SemanticSlotState {
    return {
      slotKey: 'symbol',
      fieldPath: 'contextSlots.symbol',
      value: resolution.value,
      status: 'locked',
      priority: 'context',
      questionHint: CONTEXT_QUESTION_HINTS.symbol,
      affectsExecution: true,
      evidence: {
        text: resolution.evidenceText,
        source: resolution.source,
      },
      contracts: [this.symbolResolver.buildContextContract(resolution)],
    }
  }

  private readParams(value: unknown): Record<string, unknown> {
    if (!this.isRecord(value)) {
      return {}
    }

    return { ...value }
  }

  private shouldSynthesizeMissingContracts(update: SemanticPatchRecord): boolean {
    if (!this.hasOwnProperty(update, 'contracts')) {
      return true
    }

    return update.contracts === null
      || (Array.isArray(update.contracts) && update.contracts.length === 0)
  }

  private normalizeTriggerParams(
    key: string,
    params: Record<string, unknown>,
  ): Record<string, unknown> {
    if (
      (key === ATOM_CONTRACT_REGISTRY['indicator.cross_over'].key || key === ATOM_CONTRACT_REGISTRY['indicator.cross_under'].key)
      && this.readTrimmedString(params.indicator)?.toLowerCase() === 'macd'
    ) {
      return {
        ...params,
        fastPeriod: this.hasFiniteNumber(params.fastPeriod) ? params.fastPeriod : 12,
        slowPeriod: this.hasFiniteNumber(params.slowPeriod) ? params.slowPeriod : 26,
        signalPeriod: this.hasFiniteNumber(params.signalPeriod) ? params.signalPeriod : 9,
      }
    }

    if (key !== ATOM_CONTRACT_REGISTRY['price.percent_change'].key || typeof params.valuePct !== 'number' || !Number.isFinite(params.valuePct)) {
      return params
    }

    if (params.direction === 'down' || params.direction === '跌' || params.direction === '下跌') {
      return {
        ...params,
        valuePct: -Math.abs(params.valuePct),
      }
    }

    if (params.direction === 'up' || params.direction === '涨' || params.direction === '上涨') {
      return {
        ...params,
        valuePct: Math.abs(params.valuePct),
      }
    }

    return params
  }

  private readOpenSlots(value: unknown): SemanticSlotState[] {
    if (!Array.isArray(value)) {
      return []
    }

    return value
      .map(item => this.toSlotState(item))
      .filter((item): item is SemanticSlotState => item !== null)
  }

  private ensureBollingerConfirmationOpenSlot(input: {
    key: string
    phase: SemanticTriggerState['phase']
    params: Record<string, unknown>
    openSlots: SemanticSlotState[]
    triggerIndex: number
    statusValue: unknown
  }): SemanticSlotState[] {
    if (
      input.statusValue === 'superseded'
      || !this.requiresBollingerConfirmationMode(input.key, input.params)
      || typeof input.params.confirmationMode === 'string'
    ) {
      return input.openSlots
    }

    const slotKey = `confirmationMode.${input.phase}`
    const fieldPath = `triggers[${input.triggerIndex}].params.confirmationMode`
    if (input.openSlots.some(slot => slot.slotKey === slotKey && slot.fieldPath === fieldPath)) {
      return input.openSlots
    }

    return [
      ...input.openSlots,
      {
        slotKey,
        fieldPath,
        status: 'open',
        priority: 'core',
        questionHint: '该触发条件是触碰即触发，还是收盘确认后触发？',
        affectsExecution: true,
      },
    ]
  }

  private requiresBollingerConfirmationMode(
    key: string,
    params: Record<string, unknown>,
  ): boolean {
    if (key.startsWith('bollinger.touch_')) {
      return true
    }

    if (key !== ATOM_CONTRACT_REGISTRY['price.detect.indicator_boundary'].key) {
      return false
    }

    const indicator = params.indicator
    return this.isRecord(indicator) && indicator.name === 'bollinger'
  }

  private resolveContractCoverage(options: {
    contracts: SemanticAtomContract[] | null
    openSlots: SemanticSlotState[]
    statusValue: unknown
    fieldPath: string
    priority: SemanticPriority
    atomKey?: string
  }): { status: SemanticNodeStatus, openSlots: SemanticSlotState[] } {
    if (options.statusValue === 'superseded') {
      return {
        status: 'superseded',
        openSlots: this.removeContractRequiredSlots(options.openSlots, options.fieldPath),
      }
    }

    if (options.contracts) {
      const openSlots = this.mergeOpenSlots(
        this.removeContractRequiredSlots(options.openSlots, options.fieldPath),
        options.contracts.flatMap(contract => contract.openSlots ?? []),
      )
      return {
        status: this.resolveNodeStatus(options.statusValue, openSlots),
        openSlots,
      }
    }

    // Issue #1395 follow-up：unsupported_atom_emit_pending atoms（atom 已注册但 IR
    // emit 路径暂未兑现）由 registry 显式声明 readinessCheck = UNSUPPORTED_SKIP，
    // 下游 IR codegen 会走 unsupported fallback。这类 atom 不应再向用户追问
    // "contract.required"——用户没法补，补了也没意义。保留 status='open' 让上游
    // 清洗逻辑识别，但不挂 blocking contract.required slot。
    if (options.atomKey && this.isContractRequirementBypassedAtom(options.atomKey)) {
      return {
        status: 'open',
        openSlots: this.removeContractRequiredSlots(options.openSlots, options.fieldPath),
      }
    }

    return {
      status: 'open',
      openSlots: this.appendContractRequiredSlot(options.openSlots, options.fieldPath, options.priority),
    }
  }

  private isContractRequirementBypassedAtom(atomKey: string): boolean {
    const entry = (ATOM_CONTRACT_REGISTRY as Record<string, { readinessCheck?: unknown }>)[atomKey]
    return entry?.readinessCheck === UNSUPPORTED_SKIP
  }

  private appendContractRequiredSlot(
    openSlots: SemanticSlotState[],
    fieldPath: string,
    priority: SemanticPriority,
  ): SemanticSlotState[] {
    if (openSlots.some(slot => slot.slotKey === 'contract.required' && slot.fieldPath === fieldPath)) {
      return openSlots
    }

    return [
      ...openSlots,
      {
        slotKey: 'contract.required',
        fieldPath,
        status: 'open',
        priority,
        questionHint: '请补充该原子的执行合约。',
        affectsExecution: true,
      },
    ]
  }

  private mergeOpenSlots(
    baseSlots: SemanticSlotState[],
    additionalSlots: SemanticSlotState[],
  ): SemanticSlotState[] {
    const seen = new Set(baseSlots.map(slot => `${slot.slotKey}:${slot.fieldPath}`))
    const merged = [...baseSlots]
    for (const slot of additionalSlots) {
      const id = `${slot.slotKey}:${slot.fieldPath}`
      if (seen.has(id)) continue
      seen.add(id)
      merged.push(slot)
    }
    return merged
  }

  private removeContractRequiredSlots(openSlots: SemanticSlotState[], fieldPath: string): SemanticSlotState[] {
    return openSlots.filter(slot => slot.slotKey !== 'contract.required' || slot.fieldPath !== fieldPath)
  }

  private resolveActionSide(key: string): 'long' | 'short' | 'unknown' {
    if (key.includes('long')) {
      return 'long'
    }
    if (key.includes('short')) {
      return 'short'
    }
    return 'unknown'
  }

  private resolveActionIntent(key: string): 'open' | 'close' | 'unknown' {
    if (key.startsWith('open_')) {
      return 'open'
    }
    if (key.startsWith('close_')) {
      return 'close'
    }
    return 'unknown'
  }

  private toCapabilityShape(input: Record<string, unknown>): SemanticCapabilityShape {
    const shape: SemanticCapabilityShape = {}
    for (const [key, value] of Object.entries(input)) {
      const normalizedValue = this.toCapabilityShapeValue(value)
      if (normalizedValue !== undefined) {
        shape[key] = normalizedValue
      }
    }
    return shape
  }

  private readUnknownShape(value: unknown): SemanticCapabilityShape | null {
    const normalizedValue = this.toCapabilityShapeValue(value)
    if (normalizedValue === undefined) {
      return null
    }

    if (
      normalizedValue === null
      || typeof normalizedValue === 'string'
      || typeof normalizedValue === 'number'
      || typeof normalizedValue === 'boolean'
    ) {
      return { value: normalizedValue }
    }

    if (Array.isArray(normalizedValue)) {
      return { items: normalizedValue }
    }

    return normalizedValue
  }

  private toCapabilityShapeValue(
    value: unknown,
  ): string | number | boolean | null | SemanticCapabilityShape | SemanticCapabilityShape[] | undefined {
    if (value === null) {
      return null
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return Number.isNaN(value) ? undefined : value
    }
    if (Array.isArray(value)) {
      return value
        .map(item => this.toCapabilityArrayItem(item))
        .filter((item): item is SemanticCapabilityShape => item !== undefined)
    }
    if (this.isRecord(value)) {
      return this.toCapabilityShape(value)
    }
    return undefined
  }

  private toCapabilityArrayItem(value: unknown): SemanticCapabilityShape | undefined {
    const normalizedValue = this.toCapabilityShapeValue(value)
    if (normalizedValue === undefined) {
      return undefined
    }
    if (
      normalizedValue === null
      || typeof normalizedValue === 'string'
      || typeof normalizedValue === 'number'
      || typeof normalizedValue === 'boolean'
    ) {
      return { value: normalizedValue }
    }
    if (Array.isArray(normalizedValue)) {
      return { items: normalizedValue }
    }
    return normalizedValue
  }

  private slugifyContractId(value: string): string {
    return value.replace(/[^a-z0-9]+/giu, '-').replace(/^-|-$/gu, '').toLowerCase() || 'atom'
  }

  private toSlotState(
    value: unknown,
    defaults?: {
      slotKey: string
      fieldPath: string
      priority: SemanticPriority
      questionHint: string
    },
  ): SemanticSlotState | null {
    if (!this.isRecord(value)) {
      return null
    }

    const slotKey = this.readTrimmedString(value.slotKey) ?? defaults?.slotKey
    const fieldPath = this.readTrimmedString(value.fieldPath) ?? defaults?.fieldPath
    const status = this.readStatus(value.status) ?? 'open'
    const priority = this.readPriority(value.priority) ?? defaults?.priority
    const questionHint = this.readTrimmedString(value.questionHint) ?? defaults?.questionHint
    const evidence = this.readEvidence(value.evidence)
    const supersedes = this.readStringArray(value.supersedes)
    const contracts = this.readContracts(value.contracts)

    if (!slotKey || !fieldPath || !priority || !questionHint || typeof value.affectsExecution !== 'boolean') {
      return null
    }

    const slotValue = this.readSlotValue(value.value)

    return {
      slotKey,
      fieldPath,
      ...(slotValue.present ? { value: slotValue.value } : {}),
      status,
      priority,
      questionHint,
      affectsExecution: value.affectsExecution,
      ...(evidence ? { evidence } : {}),
      ...(supersedes ? { supersedes } : {}),
      ...(contracts ? { contracts } : {}),
    }
  }

  private resolveNodeStatus(statusValue: unknown, openSlots: SemanticSlotState[]): SemanticNodeStatus {
    const status = this.readStatus(statusValue) ?? 'locked'
    if (status === 'superseded') {
      return status
    }
    return openSlots.some(slot => slot.status === 'open') ? 'open' : status
  }

  private readEvidence(value: unknown): SemanticEvidence | null {
    if (!this.isRecord(value)) {
      return null
    }

    const text = this.readTrimmedString(value.text)
    const source = this.readSource(value.source, null)
    if (!text || !source) {
      return null
    }

    return {
      text,
      ...(typeof value.messageIndex === 'number' && Number.isInteger(value.messageIndex)
        ? { messageIndex: value.messageIndex }
        : {}),
      source,
    }
  }

  private readSource(value: unknown): SemanticSource
  private readSource(value: unknown, fallback: SemanticSource): SemanticSource
  private readSource(value: unknown, fallback: null): SemanticSource | null
  private readSource(value: unknown, fallback: SemanticSource | null = 'user_explicit'): SemanticSource | null {
    if (value === 'user_explicit' || value === 'inferred' || value === 'derived') {
      return value
    }
    return fallback
  }

  private readStatus(value: unknown): SemanticNodeStatus | null {
    if (value === 'open' || value === 'locked' || value === 'superseded') {
      return value
    }
    return null
  }

  private readPriority(value: unknown): SemanticPriority | null {
    if (value === 'core' || value === 'behavior' || value === 'risk' || value === 'context') {
      return value
    }
    return null
  }

  private isContractKind(value: unknown): value is SemanticAtomContract['kind'] {
    return value === 'trigger'
      || value === 'action'
      || value === 'risk'
      || value === 'position'
      || value === 'context'
  }

  private readMarketInstrumentSymbolSource(value: unknown): MarketInstrumentSymbolSource | null {
    if (value === 'user_explicit' || value === 'inferred') {
      return value
    }

    return null
  }

  private readMarketInstrumentQuote(value: unknown): MarketInstrumentQuote | null {
    if (typeof value === 'string' && MARKET_INSTRUMENT_QUOTES.includes(value as MarketInstrumentQuote)) {
      return value as MarketInstrumentQuote
    }

    return null
  }

  private readMarketInstrumentQuoteSource(value: unknown): MarketInstrumentQuoteSource | null {
    if (value === 'explicit' || value === 'default_usdt') {
      return value
    }

    return null
  }

  private readMarketInstrumentMarketTypeHint(value: unknown): MarketInstrumentSymbolResolution['marketTypeHint'] | null {
    if (value === 'perp' || value === 'spot') {
      return value
    }

    return null
  }

  private isCapabilityDomain(value: unknown): value is SemanticCapabilityDomain {
    return value === 'market'
      || value === 'price'
      || value === 'order_program'
      || value === 'capital'
      || value === 'exposure'
      || value === 'margin'
      || value === 'guard'
      || value === 'runtime'
      || value === 'state'
      || value === 'order'
      || value === 'portfolio'
      || value === 'orchestration'
  }

  private isCapabilityShape(value: unknown): value is SemanticCapabilityShape {
    if (!this.isRecord(value)) {
      return false
    }

    return Object.values(value).every(item =>
      item === null
      || typeof item === 'string'
      || typeof item === 'number'
      || typeof item === 'boolean'
      || this.isCapabilityShape(item)
      || (Array.isArray(item) && item.every(nested => this.isCapabilityShape(nested))),
    )
  }

  private readStringArray(value: unknown): string[] | null {
    if (!Array.isArray(value)) {
      return null
    }

    const items = value
      .map(item => this.readTrimmedString(item))
      .filter((item): item is string => Boolean(item))
    return items.length > 0 ? items : null
  }

  private readSlotValue(value: unknown): SlotValueRead {
    if (value === null) {
      return { present: true, value: null }
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return { present: true, value }
    }

    return { present: false }
  }

  private readTrimmedString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null
    }

    const trimmed = value.trim()
    return trimmed ? trimmed : null
  }

  private isRecord(value: unknown): value is SemanticPatchRecord {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value))
  }

  /**
   * Issue #1395 (mute-spider) Stage I.C: 把 codegen-conversation 写到
   *   semanticPatch.__zodQuarantine 的 graceful-parse 诊断信息透传到 state.diagnostics.zodQuarantine。
   *   纯数据透传，下游 reader 默认忽略；用于上游观测被剪枝/拒收的 rule 索引。
   */
  private extractZodQuarantine(semanticPatch: SemanticPatchRecord):
    ReadonlyArray<{ index: number, errorPath: string, rawSnippet: string }> | null {
    const raw = (semanticPatch as Record<string, unknown>).__zodQuarantine
    if (!Array.isArray(raw) || raw.length === 0) return null
    const out: Array<{ index: number, errorPath: string, rawSnippet: string }> = []
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue
      const obj = item as Record<string, unknown>
      const index = typeof obj.index === 'number' ? obj.index : -1
      const errorPath = typeof obj.errorPath === 'string' ? obj.errorPath : ''
      const rawSnippet = typeof obj.rawSnippet === 'string' ? obj.rawSnippet : ''
      out.push({ index, errorPath, rawSnippet })
    }
    return out.length > 0 ? out : null
  }

  private hasOwnProperty(value: SemanticPatchRecord, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(value, key)
  }
}
