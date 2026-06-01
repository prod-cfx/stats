import { Injectable } from '@nestjs/common'

import { ATOM_CONTRACT_REGISTRY } from '../atom-contracts/atom-contract-registry'
import type {
  SemanticAtomContract,
  SemanticContextSlotState,
  SemanticOrchestrationContract,
  SemanticPositionState,
  SemanticSlotState,
  SemanticState,
} from '../types/semantic-state'
import {
  collectAtomLeaves,
  isRuleEffectsByRole,
  listRuleEffects,
  type AtomExpr,
  type RuleEffects,
  type RuleEffectsByRole,
  type SemanticRule,
} from '../types/atom-expr'

// #1383 Lane B：所有 atom bucket entry 必须实现的最小 identity shape，
// 供 dedupeByAtomIdentity 用 (key, phase, stableParamsHash, openSlots signature) 折叠重复条目。
interface AtomLikeEntry {
  key?: string
  phase?: string
  params?: Record<string, unknown>
  status: 'open' | 'locked' | 'superseded'
  source?: 'user_explicit' | 'inferred' | 'derived'
  value?: unknown
  // openSlots 用于 identity slot-key signature — 同 (key, phase, params) 但 openSlots
  // 不同的「合法 sibling atoms」（典型场景：用户先后分两轮设定两条同 key 的 MA 上穿条件，
  // 各自带独立 reference.period openSlot）不能被 dedup 折叠。
  openSlots?: readonly { slotKey: string }[]
}

@Injectable()
export class SemanticStateMergeService {
  merge(input: { persisted: SemanticState | null, derived: SemanticState }): SemanticState {
    if (!input.persisted) {
      return this.reprojectWhenRulesPresent(input.derived)
    }

    // Issue #1395 Wave 4 + Issue #1403 子故障 D：rules[] 表达式树合并策略
    //   - derived 未给或空 → 保留 persisted.rules（避免 ...derived 把 rules 抹掉）
    //   - derived 显式给 rules → 按 identity（id 优先；否则 phase+sideScope+condition shape）
    //     与 persisted union 合并，同 identity 取 derived 覆盖
    //
    // 历史回归（#1403 子故障 D）：早期实现 derived 非空就整体覆盖 persisted，导致
    //   多轮 clarification 最后一轮（如 risk 槽位 LLM 只回 risk rule）把 entry/exit
    //   rules 抹光，UI 仅渲染最后一条 → 用户看到「只剩止损」的伪强终态。
    //   修复后：用户「确认 risk 阈值」单独一轮的 planner patch 仍能把之前的 entry/exit
    //   rules 留住，buildRulesSummary 一次性渲染齐全。
    const persistedRules = (input.persisted as { rules?: unknown }).rules
    const derivedRules = (input.derived as { rules?: unknown }).rules
    const persistedRulesArr = Array.isArray(persistedRules) ? persistedRules as SemanticState['rules'] : undefined
    const derivedRulesArr = Array.isArray(derivedRules) ? derivedRules as SemanticState['rules'] : undefined
    const mergedRules = this.mergeRulesByIdentity(persistedRulesArr, derivedRulesArr)

    const mergedState = {
      ...input.derived,
      families: [...new Set([...input.persisted.families, ...input.derived.families])],
      position: this.mergePosition(input.persisted.position, input.derived.position),
      contextSlots: this.mergeContextSlots(input.persisted.contextSlots, input.derived.contextSlots),
      normalizationNotes: [...new Set([...input.persisted.normalizationNotes, ...input.derived.normalizationNotes])],
      orchestrationContracts: this.mergeOrchestrationContracts(
        input.persisted.orchestrationContracts,
        input.derived.orchestrationContracts,
      ),
      updatedAt: new Date().toISOString(),
      ...(mergedRules !== undefined ? { rules: mergedRules as SemanticState['rules'] } : {}),
    } as unknown as SemanticState
    return this.reprojectWhenRulesPresent(mergedState)
  }

  private reprojectWhenRulesPresent(state: SemanticState): SemanticState {
    if (state.rules?.length) {
      const rulesWithContext = this.ensureRuleTimeframeScopeFromContext(state.rules, state)
      const finalizedRules = this.finalizeLifecycleRules(rulesWithContext) as SemanticState['rules']
      return {
        ...state,
        position: this.repairPositionFromRuleSizing(state.position, finalizedRules),
        rules: finalizedRules,
      }
    }
    return state
  }

  private ensureRuleTimeframeScopeFromContext(
    rules: readonly SemanticRule[],
    state: SemanticState,
  ): readonly SemanticRule[] {
    const timeframe = this.readContextSlotString(state.contextSlots.timeframe)
    if (!timeframe) return rules
    const hasScope = rules.some(rule => listRuleEffects(rule.effects).some(effect =>
      collectAtomLeaves(effect).some(leaf => leaf.key === 'scope.timeframe'),
    ))
    if (hasScope) return rules

    const scopeAtom: AtomExpr = {
      kind: 'atom',
      key: 'scope.timeframe',
      params: {
        timeframeScopeKind: 'timeframe',
        primaryTimeframe: timeframe,
        requiredTimeframes: [timeframe],
        alignmentPolicy: 'tolerant',
      },
    }
    return rules.map((rule) => {
      if (rule.phase !== 'entry' && rule.phase !== 'exit' && rule.phase !== 'gate') return rule
      const typed = this.normalizeRuleEffectsToTyped(rule.effects)
      return {
        ...rule,
        effects: {
          ...typed,
          orchestration: this.mergeRuleEffectRole(typed.orchestration, [scopeAtom]),
        },
      }
    })
  }

  private readContextSlotString(slot: SemanticSlotState | null | undefined): string | null {
    const value = slot?.value
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
  }

  private repairPositionFromRuleSizing(
    position: SemanticPositionState | null,
    rules: readonly SemanticRule[],
  ): SemanticPositionState | null {
    const sizing = this.readPreferredRuleSizing(rules)
    if (!sizing || sizing.kind !== 'ratio') return position
    const value = typeof sizing.value === 'number' && Number.isFinite(sizing.value) ? sizing.value : null
    if (value === null || value <= 0) return position
    const normalizedValue = value <= 1 ? value : value / 100
    const inferredPositionMode = this.inferPositionModeFromRules(rules) ?? position?.positionMode ?? 'long_only'
    if (
      position?.sizing?.kind === 'ratio'
      && Math.abs(position.sizing.value - normalizedValue) <= 1e-9
      && position.positionMode === inferredPositionMode
    ) return position
    return {
      ...(position ?? {
        mode: 'fixed_ratio' as const,
        source: 'derived' as const,
        status: 'locked' as const,
        openSlots: [],
        positionMode: 'long_only' as const,
      }),
      mode: 'fixed_ratio',
      value: normalizedValue,
      sizing: { kind: 'ratio', unit: 'ratio', value: normalizedValue },
      positionMode: inferredPositionMode,
    }
  }

  private inferPositionModeFromRules(rules: readonly SemanticRule[]): string | null {
    const actionKeys = rules.flatMap(rule => listRuleEffects(rule.effects).flatMap(effect => collectAtomLeaves(effect).map(leaf => leaf.key)))
    const reverseLeaves = rules.flatMap(rule => listRuleEffects(rule.effects).flatMap(effect => collectAtomLeaves(effect))).filter(leaf => leaf.key === 'action.reverse_position')
    if (reverseLeaves.length > 0) return 'long_short'
    const hasLong = actionKeys.some(key => key === 'action.open_long' || key === 'action.close_long')
    const hasShort = actionKeys.some(key => key === 'action.open_short' || key === 'action.close_short')
    if (hasLong && hasShort) return 'long_short'
    if (hasShort) return 'short_only'
    if (hasLong) return 'long_only'
    return null
  }

  private readPreferredRuleSizing(rules: readonly SemanticRule[]): { kind?: unknown, value?: unknown } | null {
    const candidates = rules.flatMap(rule => listRuleEffects(rule.effects)
      .flatMap(effect => collectAtomLeaves(effect))
      .filter(leaf => leaf.key === 'position.sizing')
      .map(leaf => leaf.params?.sizing)
      .filter((value): value is { kind?: unknown, value?: unknown } => Boolean(value) && typeof value === 'object' && !Array.isArray(value)))
    return candidates.find(candidate => candidate.kind === 'ratio') ?? candidates[0] ?? null
  }

  private mergePosition(
    persisted: SemanticPositionState | null,
    derived: SemanticPositionState | null,
  ): SemanticPositionState | null {
    if (!persisted) {
      return derived
    }

    if (!derived) {
      return persisted
    }

    const preferPersisted = this.compareNodeStrength(persisted, derived) > 0
    const stronger = preferPersisted ? persisted : derived
    const weaker = preferPersisted ? derived : persisted

    return {
      ...weaker,
      ...stronger,
      value: stronger.value ?? weaker.value,
      // H1 修复：同函数顶层 `{...weaker, ...stronger}` 对 sizing 也有同样的整段覆盖
      // 问题。如果 derived 是更强源但显式回 sizing: null/undefined（典型场景：planner
      // LLM 不输出 sizing 字段，或 reducer 清空），会把 persisted 的 locked sizing 抹掉。
      // 与 value/evidence 一致用 nullish fallback：stronger 真正给出新 sizing 才用，
      // 否则保留 weaker 的非空 sizing。
      sizing: stronger.sizing ?? weaker.sizing,
      contracts: this.mergeContracts(persisted.contracts, derived.contracts),
      // #DCA-bug-fix：spread 后 stronger.constraints 会以整体形式覆盖 weaker.constraints；
      // 如果 derived 是更强源但 constraints 缺/为空（典型场景：conversation planner LLM
      // 只回 position.sizing 不回 position.dca_schedule constraint），就会把 seed 抽出的
      // locked dca_schedule / pyramiding_limit 抹掉。按 key union 合并，每个 key 内部按
      // strength 取强，保证 locked 持久态不被 derived 弱化。
      // DEPRECATED Task 6: position.constraints moved to top-level positionConstraint[]
      evidence: stronger.evidence ?? weaker.evidence,
    }
  }

  private cloneOrchestrationContract(
    contract: SemanticOrchestrationContract,
  ): SemanticOrchestrationContract {
    return {
      ...contract,
      capabilities: contract.capabilities.map(capability => ({
        ...capability,
        shape: capability.shape ? { ...capability.shape } : undefined,
      })),
      requires: contract.requires.map(requirement => ({ ...requirement })),
      params: { ...contract.params },
      runtimeRequirements: contract.runtimeRequirements.map(requirement => ({ ...requirement })),
      stateRequirements: contract.stateRequirements.map(requirement => ({ ...requirement })),
      orderRequirements: contract.orderRequirements.map(requirement => ({ ...requirement })),
      openSlots: contract.openSlots.map(slot => ({ ...slot })),
      effects: contract.effects?.map(effect => ({
        ...effect,
        shape: effect.shape ? { ...effect.shape } : undefined,
      })),
      target: contract.target ? { ...contract.target } : undefined,
    }
  }

  private mergeOrchestrationContracts(
    persisted: readonly SemanticOrchestrationContract[],
    derived: readonly SemanticOrchestrationContract[],
  ): SemanticOrchestrationContract[] {
    const next = derived.map(contract => this.cloneOrchestrationContract(contract))

    for (const persistedContract of persisted) {
      const matchIndex = next.findIndex(candidate => this.isSameOrchestrationContractIdentity(persistedContract, candidate))
      if (matchIndex < 0) {
        next.push(this.cloneOrchestrationContract(persistedContract))
        continue
      }

      const derivedContract = next[matchIndex]!
      next[matchIndex] = {
        ...this.cloneOrchestrationContract(persistedContract),
        ...this.cloneOrchestrationContract(derivedContract),
        id: persistedContract.id,
        params: { ...persistedContract.params, ...derivedContract.params },
        capabilities: [...persistedContract.capabilities, ...derivedContract.capabilities].map(capability => ({
          ...capability,
          shape: capability.shape ? { ...capability.shape } : undefined,
        })),
        requires: [...persistedContract.requires, ...derivedContract.requires].map(requirement => ({ ...requirement })),
        runtimeRequirements: [...persistedContract.runtimeRequirements, ...derivedContract.runtimeRequirements].map(requirement => ({ ...requirement })),
        stateRequirements: [...persistedContract.stateRequirements, ...derivedContract.stateRequirements].map(requirement => ({ ...requirement })),
        orderRequirements: [...persistedContract.orderRequirements, ...derivedContract.orderRequirements].map(requirement => ({ ...requirement })),
        openSlots: this.mergeOpenSlots([...persistedContract.openSlots], [...derivedContract.openSlots]),
      }
    }

    return next
  }

  private isSameOrchestrationContractIdentity(
    left: SemanticOrchestrationContract,
    right: SemanticOrchestrationContract,
  ): boolean {
    if (left.id === right.id) {
      return true
    }
    if (left.kind !== right.kind) {
      return false
    }

    const leftKeys = this.collectOrchestrationContractSemanticKeys(left)
    const rightKeys = this.collectOrchestrationContractSemanticKeys(right)
    return [...leftKeys].some(key => rightKeys.has(key))
  }

  private collectOrchestrationContractSemanticKeys(contract: SemanticOrchestrationContract): Set<string> {
    return new Set([
      ...contract.capabilities.map(capability => this.semanticTupleKey(capability)),
      ...contract.requires.map(requirement => this.semanticTupleKey(requirement)),
      ...(contract.effects ?? []).map(effect => this.semanticTupleKey(effect)),
    ])
  }

  private mergeContracts(
    persisted: SemanticAtomContract[] | undefined,
    derived: SemanticAtomContract[] | undefined,
  ): SemanticAtomContract[] | undefined {
    const next: SemanticAtomContract[] = []
    for (const contract of [...(persisted ?? []), ...(derived ?? [])]) {
      const matchIndex = next.findIndex(candidate => this.isSameContractIdentity(candidate, contract))
      if (matchIndex < 0) {
        next.push(this.cloneContract(contract))
        continue
      }

      next[matchIndex] = this.mergeContract(next[matchIndex]!, contract)
    }

    return next.length > 0 ? next : undefined
  }

  private isSameContractIdentity(
    left: SemanticAtomContract,
    right: SemanticAtomContract,
  ): boolean {
    if (left.id === right.id) {
      return true
    }
    if (left.kind !== right.kind) {
      return false
    }

    const leftSemanticKeys = this.collectContractSemanticKeys(left)
    const rightSemanticKeys = this.collectContractSemanticKeys(right)
    return [...leftSemanticKeys].some(key => rightSemanticKeys.has(key))
  }

  private mergeContract(
    left: SemanticAtomContract,
    right: SemanticAtomContract,
  ): SemanticAtomContract {
    return {
      ...left,
      ...right,
      capabilities: this.mergeContractCapabilities(left.capabilities, right.capabilities),
      requires: this.mergeContractRequirements(left.requires, right.requires),
      effects: this.mergeContractEffects(left.effects, right.effects),
      params: {
        ...left.params,
        ...right.params,
      },
    }
  }

  private collectContractSemanticKeys(contract: SemanticAtomContract): Set<string> {
    return new Set([
      ...contract.capabilities.map(capability => this.semanticTupleKey(capability)),
      ...contract.requires.map(requirement => this.semanticTupleKey(requirement)),
      ...(contract.effects ?? []).map(effect => this.semanticTupleKey(effect)),
    ])
  }

  private semanticTupleKey(tuple: { domain: string, verb: string, object: string }): string {
    return `${tuple.domain}:${tuple.verb}:${tuple.object}`
  }

  private mergeContractCapabilities(
    left: SemanticAtomContract['capabilities'],
    right: SemanticAtomContract['capabilities'],
  ): SemanticAtomContract['capabilities'] {
    const next: Array<SemanticAtomContract['capabilities'][number]> = []
    for (const capability of [...left, ...right]) {
      const matchIndex = next.findIndex(candidate =>
        candidate.domain === capability.domain
        && candidate.verb === capability.verb
        && candidate.object === capability.object,
      )
      if (matchIndex < 0) {
        next.push({
          ...capability,
          shape: { ...capability.shape },
        })
        continue
      }

      next[matchIndex] = {
        ...next[matchIndex]!,
        ...capability,
        shape: {
          ...next[matchIndex]!.shape,
          ...capability.shape,
        },
      }
    }
    return next
  }

  private mergeContractRequirements(
    left: SemanticAtomContract['requires'],
    right: SemanticAtomContract['requires'],
  ): SemanticAtomContract['requires'] {
    const next: Array<SemanticAtomContract['requires'][number]> = []
    for (const requirement of [...left, ...right]) {
      if (next.some(candidate =>
        candidate.domain === requirement.domain
        && candidate.verb === requirement.verb
        && candidate.object === requirement.object,
      )) {
        continue
      }
      next.push({ ...requirement })
    }
    return next
  }

  private mergeContractEffects(
    left: SemanticAtomContract['effects'],
    right: SemanticAtomContract['effects'],
  ): SemanticAtomContract['effects'] {
    const next: Array<NonNullable<SemanticAtomContract['effects']>[number]> = []
    for (const effect of [...(left ?? []), ...(right ?? [])]) {
      const matchIndex = next.findIndex(candidate =>
        candidate.domain === effect.domain
        && candidate.verb === effect.verb
        && candidate.object === effect.object,
      )
      if (matchIndex < 0) {
        next.push({
          ...effect,
          shape: effect.shape ? { ...effect.shape } : undefined,
        })
        continue
      }

      next[matchIndex] = {
        ...next[matchIndex]!,
        ...effect,
        shape: {
          ...next[matchIndex]!.shape,
          ...effect.shape,
        },
      }
    }
    return next.length > 0 ? next : undefined
  }

  private cloneContract(contract: SemanticAtomContract): SemanticAtomContract {
    return {
      ...contract,
      capabilities: contract.capabilities.map(capability => ({
        ...capability,
        shape: capability.shape ? { ...capability.shape } : undefined,
      })),
      requires: contract.requires.map(requirement => ({ ...requirement })),
      effects: contract.effects?.map(effect => ({
        ...effect,
        shape: effect.shape ? { ...effect.shape } : undefined,
      })),
      params: { ...contract.params },
    }
  }

  private mergeContextSlots(
    persisted: SemanticContextSlotState,
    derived: SemanticContextSlotState,
  ): SemanticContextSlotState {
    return {
      exchange: this.mergeSlotState(persisted.exchange, derived.exchange),
      symbol: this.mergeSlotState(persisted.symbol, derived.symbol),
      marketType: this.mergeSlotState(persisted.marketType, derived.marketType),
      timeframe: this.mergeSlotState(persisted.timeframe, derived.timeframe),
    }
  }

  private haveCompatibleParamValues(
    left: Record<string, unknown>,
    right: Record<string, unknown>,
    keys?: readonly string[],
  ): boolean {
    const identityKeys = keys ?? [...new Set([...Object.keys(left), ...Object.keys(right)])]

    return identityKeys.every((key) => {
      const leftValue = left[key]
      const rightValue = right[key]
      if (leftValue === undefined || rightValue === undefined) {
        return true
      }
      return leftValue === rightValue
    })
  }

  private mergeOpenSlots(
    persisted: readonly SemanticSlotState[],
    derived: readonly SemanticSlotState[],
  ): SemanticSlotState[] {
    const next = derived.map(slot => ({ ...slot }))

    for (const persistedSlot of persisted) {
      const matchIndex = next.findIndex(slot =>
        slot.slotKey === persistedSlot.slotKey && slot.fieldPath === persistedSlot.fieldPath)
      if (matchIndex < 0) {
        next.push({ ...persistedSlot })
        continue
      }

      next[matchIndex] = this.mergeSlotState(persistedSlot, next[matchIndex])!
    }

    return next
  }

  private mergeSlotState<T extends SemanticContextSlotState[keyof SemanticContextSlotState]>(
    persisted: T,
    derived: T,
  ): T {
    if (!persisted) {
      return derived
    }

    if (!derived) {
      return persisted
    }

    const preferPersisted = this.compareNodeStrength(persisted, derived) > 0
    const stronger = preferPersisted ? persisted : derived
    const weaker = preferPersisted ? derived : persisted

    return {
      ...weaker,
      ...stronger,
      value: 'value' in stronger && stronger.value !== undefined
        ? stronger.value
        : 'value' in weaker
          ? weaker.value
          : undefined,
      evidence: stronger.evidence ?? weaker.evidence,
    } as T
  }

  private compareNodeStrength(
    left: { status: 'open' | 'locked' | 'superseded', source?: 'user_explicit' | 'inferred' | 'derived', value?: unknown, evidence?: { source?: 'user_explicit' | 'inferred' | 'derived' } },
    right: { status: 'open' | 'locked' | 'superseded', source?: 'user_explicit' | 'inferred' | 'derived', value?: unknown, evidence?: { source?: 'user_explicit' | 'inferred' | 'derived' } },
  ): number {
    const statusDiff = this.getStatusRank(left.status) - this.getStatusRank(right.status)
    if (statusDiff !== 0) {
      return statusDiff
    }

    // contextSlots 的 SemanticSlotState 没有顶层 `source` 字段，源信息只在 `evidence.source`。
    // 早期实现只看 `node.source` 导致 (locked,user_explicit) vs (locked,inferred) 比较退化为
    // 平局 → 走 value 比较再平 → preferPersisted=false → 用 derived 覆盖 persisted。
    // 典型回归：BTCUSDT(user_explicit, locked) 被 dispatcher 二次 NL 解析出的 PARAMSUSDT(inferred)
    // 覆盖。fallback 到 evidence.source，保留 user_explicit 优先级。
    const leftSource = left.source ?? left.evidence?.source
    const rightSource = right.source ?? right.evidence?.source
    const sourceDiff = this.getSourceRank(leftSource) - this.getSourceRank(rightSource)
    if (sourceDiff !== 0) {
      return sourceDiff
    }

    return Number(left.value !== undefined) - Number(right.value !== undefined)
  }

  private getStatusRank(status: 'open' | 'locked' | 'superseded'): number {
    switch (status) {
      case 'locked':
        return 2
      case 'open':
        return 1
      case 'superseded':
      default:
        return 0
    }
  }

  private getSourceRank(source?: 'user_explicit' | 'inferred' | 'derived'): number {
    switch (source) {
      case 'user_explicit':
        return 2
      case 'inferred':
        return 1
      case 'derived':
      default:
        return 0
    }
  }

  // #1633：跨轮 dedup 用的语义签名 noise / alias 规则（与 planner-dispatcher-merge 对齐）。
  //   NOISE_PARAM_KEYS：纯展示/溯源字段，不参与语义身份。
  //   ALIAS_PARAM_KEYS：planner 别名 → dispatcher canonical key，签名前归一。
  private static readonly NOISE_PARAM_KEYS: ReadonlySet<string> = new Set([
    'phase',
    'source',
    'basisSource',
    'evidence',
    'semantic',
  ])

  private static readonly ALIAS_PARAM_KEYS: Readonly<Record<string, string>> = {
    feedId: 'dataSourceFeedId',
    role: 'dataSourceRole',
    schemaRef: 'dataSourceSchemaRef',
  }

  /**
   * #1633：AtomExpr 树语义签名。递归 atom/and/or/not/sequence；and/or 子签名排序
   * 保证顺序无关，sequence 保序。叶子按 atom.key + 清洗后 params + sideScope 签名。
   */
  private atomExprSemanticSignature(expr: AtomExpr): string {
    switch (expr.kind) {
      case 'atom':
        return this.atomLeafSemanticSignature(expr)
      case 'and':
      case 'or':
        return `${expr.kind}(${expr.children.map(child => this.atomExprSemanticSignature(child)).sort().join('&')})`
      case 'not':
        return `not(${this.atomExprSemanticSignature(expr.child)})`
      case 'sequence':
        return `sequence(${expr.steps.map(step => this.atomExprSemanticSignature(step)).join('>')})`
    }
  }

  /**
   * #1633：叶子 atom 语义签名 = key + 清洗后 params hash + sideScope。
   * 清洗 = 剥离 noise key（递归各层）+ 归一 alias key（顶层 atom param）。
   */
  private atomLeafSemanticSignature(atom: AtomExpr & { kind: 'atom' }): string {
    const cleaned = this.cleanParamsForSignature(atom.params ?? {})
    return `${atom.key}|${this.stableParamsHash(cleaned)}`
  }

  /**
   * Issue #1633 C2：event-class atom key pattern
   * cross_over / cross_under / *touch_* / *breakout_* / condition.sequence /
   * price.candle_pattern 这些「事件触发」语义在跨轮 clarification 里 LLM 容易省略；
   * Pass 1 id-fold 需做单调性保护避免丢失。
   */
  private static readonly EVENT_ATOM_KEY_RE = /^(?:indicator\.cross_over|indicator\.cross_under|.*\.touch_[a-z_]+|.*\.breakout_[a-z_]+|condition\.sequence|price\.candle_pattern)$/

  private isEventClassAtomKey(key: string): boolean {
    return SemanticStateMergeService.EVENT_ATOM_KEY_RE.test(key)
  }

  private collectEventClassLeafSigs(expr: AtomExpr): Map<string, AtomExpr & { kind: 'atom' }> {
    const out = new Map<string, AtomExpr & { kind: 'atom' }>()
    for (const leaf of collectAtomLeaves(expr)) {
      if (this.isEventClassAtomKey(leaf.key)) {
        out.set(this.atomLeafSemanticSignature(leaf), leaf)
      }
    }
    return out
  }

  private collectTopLevelSequenceNodes(expr: AtomExpr): AtomExpr[] {
    const out: AtomExpr[] = []
    const walk = (node: AtomExpr): void => {
      switch (node.kind) {
        case 'sequence':
          out.push(node)
          return
        case 'and':
        case 'or':
          node.children.forEach(walk)
          return
        case 'not':
          walk(node.child)
          return
        case 'atom':
          return
      }
    }
    walk(expr)
    return out
  }

  private hasSequenceNode(expr: AtomExpr): boolean {
    return this.collectTopLevelSequenceNodes(expr).length > 0
  }

  /**
   * Issue #1633 C2：跨轮 clarification 单调性守门。
   *   背景：staging s19 复测 (sessionId cmpouer4u01wv842ny6r64y3u)，turn 0 planner
   *   产 `and(indicator.above, condition.sequence)` 类 rule；turn 1 用户只补 contextSlot
   *   (marketType/timeframe)，LLM 把 rule.condition "简化" 只剩 `indicator.above` →
   *   运行时 flag semantic_drift。
   *
   *   守门（仅 Pass 1 同 id+phase ingest）：
   *   - persisted 含 event-class 叶子 / sequence 节点
   *   - derived 完全不含 event-class 叶子（= 纯丢失，非替换；derived 有任一 event
   *     叶子即视为用户主动改 cross_over → cross_under，不恢复）
   *   - sequence 同样：persisted 有 / derived 无 → 恢复
   *
   *   恢复方式：derived.condition 为 and → 追加；否则包一层 and。
   */
  private restoreLostEventAtoms(persisted: SemanticRule, derived: SemanticRule): SemanticRule {
    const persistedLeaves = collectAtomLeaves(persisted.condition)
    const derivedLeaves = collectAtomLeaves(derived.condition)
    const derivedIsPersistedSubset = derivedLeaves.length > 0
      && persistedLeaves.length > derivedLeaves.length
      && derivedLeaves.every(derivedLeaf =>
        persistedLeaves.some(persistedLeaf => this.conditionLeafCovers(persistedLeaf, derivedLeaf)),
      )
    const monotonicMissingLeaves: Array<AtomExpr & { kind: 'atom' }> = derivedIsPersistedSubset
      ? persistedLeaves.filter(persistedLeaf =>
          !derivedLeaves.some(derivedLeaf => this.conditionLeafCovers(derivedLeaf, persistedLeaf)),
        )
      : []

    const persistedEventSigs = this.collectEventClassLeafSigs(persisted.condition)
    const persistedHasSeq = this.hasSequenceNode(persisted.condition)
    if (persistedEventSigs.size === 0 && !persistedHasSeq && monotonicMissingLeaves.length === 0) return derived

    const derivedEventSigs = this.collectEventClassLeafSigs(derived.condition)
    const derivedHasSeq = this.hasSequenceNode(derived.condition)

    const missingLeaves: Array<AtomExpr & { kind: 'atom' }> = [...monotonicMissingLeaves]
    if (derivedEventSigs.size === 0) {
      for (const leaf of persistedEventSigs.values()) {
        if (!missingLeaves.some(existing => this.atomLeafSemanticSignature(existing) === this.atomLeafSemanticSignature(leaf))) {
          missingLeaves.push(leaf)
        }
      }
    }

    const missingSeqNodes: AtomExpr[] = []
    if (persistedHasSeq && !derivedHasSeq) {
      missingSeqNodes.push(...this.collectTopLevelSequenceNodes(persisted.condition))
    }

    if (missingLeaves.length === 0 && missingSeqNodes.length === 0) return derived

    const toAdd: AtomExpr[] = [
      ...missingLeaves.map(leaf => structuredClone(leaf) as AtomExpr),
      ...missingSeqNodes.map(node => structuredClone(node)),
    ]
    const newCondition: AtomExpr = derived.condition.kind === 'and'
      ? { kind: 'and', children: [...derived.condition.children, ...toAdd] }
      : { kind: 'and', children: [derived.condition, ...toAdd] }
    return { ...derived, condition: newCondition }
  }

  /**
   * #1633：effects 语义签名 = 全部 effect 叶子签名的有序集合（排序后保证顺序无关）。
   * 镜像 planner-dispatcher-merge.effectSignatureSet。
   */
  private ruleEffectsSemanticSignature(effects: RuleEffects | undefined): string {
    const leafSigs = listRuleEffects(effects)
      .flatMap(effect => collectAtomLeaves(effect))
      .map(leaf => this.atomLeafSemanticSignature(leaf))
      .sort()
    return JSON.stringify(leafSigs)
  }

  /**
   * #1633：递归剥离 noise key；顶层归一 alias key（canonical 覆盖、丢弃别名）。
   * alias key 只出现在顶层 atom params，嵌套层只需剥 noise。
   */
  private cleanParamsForSignature(params: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(params)) {
      if (SemanticStateMergeService.NOISE_PARAM_KEYS.has(key)) continue
      if (key === 'bufferPct' && value === 0) continue
      if (key === 'signalPeriod' && value === 0) continue
      if (key === 'activationPct' && value === 0) continue
      const canonicalKey = SemanticStateMergeService.ALIAS_PARAM_KEYS[key] ?? key
      // canonical 已存在（atom 同时带 canonical + alias）→ 保留 canonical，跳过 alias
      if (canonicalKey !== key && canonicalKey in out) continue
      out[canonicalKey] = this.cleanValueForSignature(value)
    }
    return out
  }

  private cleanValueForSignature(value: unknown): unknown {
    if (value === null || typeof value !== 'object') return value
    if (Array.isArray(value)) return value.map(item => this.cleanValueForSignature(item))
    return this.cleanParamsForSignature(value as Record<string, unknown>)
  }

  /**
   * #1162 Task 7 — 真重复检测：key + sideScope + 参数字典深度稳定序列化
   * 用于 mergeActions / mergeRisk fallback push 路径：仅当完全相同才丢弃新副本；
   * params 不同（合法多档 add_position 等）则仍 push。
   */
  private stableParamsHash(params: Record<string, unknown> | undefined): string {
    if (!params) return 'null'
    // critic Major #1：递归稳定序列化，避免嵌套对象（如 tiers 数组、sizing 子对象）
    //   因 key 顺序差异被误判为"不同"，导致真重复漏判
    return JSON.stringify(this.stableValue(params))
  }

  private stableValue(value: unknown): unknown {
    if (value === null || typeof value !== 'object') return value
    if (Array.isArray(value)) return value.map(v => this.stableValue(v))
    const obj = value as Record<string, unknown>
    return Object.keys(obj).sort().reduce<Record<string, unknown>>((acc, k) => {
      acc[k] = this.stableValue(obj[k])
      return acc
    }, {})
  }

  /**
   * #1383 Lane B：所有 bucket merge 收尾统一过此 helper。
   * identity = (key, phase, stableParamsHash, openSlots slotKey signature)；
   * 同 identity 多条折叠为一条，保留 compareNodeStrength 最强的（locked > superseded > open；
   * user_explicit > inferred > derived）。修复"止损/止盈渲染两次"等回归 — persisted/derived
   * 各自走过 identity match 后仍残留同 atom 多份的边界场景。
   *
   * openSlots slotKey 列入 identity 是为了保留合法 sibling atom：同 (key, phase, params) 但
   * 持有不同 open slot 的两条 atom（例如两条 indicator.above 各自带 reference.period.entry.a/b）
   * 不能被折叠为一条。
   */
  private dedupeByAtomIdentity<T extends AtomLikeEntry>(entries: T[]): T[] {
    const keptByIdentity = new Map<string, T>()
    const result: T[] = []
    const placeholderByIdentity = new Map<string, number>()

    for (const entry of entries) {
      const identity = this.computeAtomIdentityKey(entry)
      const existingIndex = placeholderByIdentity.get(identity)
      if (existingIndex === undefined) {
        placeholderByIdentity.set(identity, result.length)
        keptByIdentity.set(identity, entry)
        result.push(entry)
        continue
      }

      const incumbent = keptByIdentity.get(identity)!
      // strict greater：等强保留先到（与现有 tie-break 一致：等强偏 derived，
      // 但 dedupe 是 post-pass，"先到"已是 mergeXxx 决出的赢家）。
      if (this.compareNodeStrength(entry, incumbent) > 0) {
        result[existingIndex] = entry
        keptByIdentity.set(identity, entry)
      }
    }

    return result
  }

  // Issue #1403 子故障 D + Issue #1443 升级：rules[] 按 content shape 合并而非 rule.id。
  //
  //   旧实现优先用 rule.id 作 identity——LLM 每轮新 rule 用不同 id（如
  //   `rule-entry-1` vs `rule-r1-entry` vs `dispatcher-lift-N-xxx`），即便 condition/
  //   effects shape 完全相同也不去重，导致**多轮对话 rules 累加**：
  //     - 用户首轮 "3 分钟跌 1% 买入" → planner 产 entry rule#1
  //     - 用户答 "合约" → planner 重新产 entry rule#2 含相同语义但新 id
  //     - state.rules 累加 2 条相同 entry → UI 重复显示
  //
  //   通用修复：identity 完全基于 content shape（phase + sideScope + conditionHash +
  //   effectsHash），忽略 rule.id（id 是构造时序号，不该作去重依据）。
  //
  //   同 identity 走 "derived 覆盖 persisted"（最新轮次 LLM 描述权重更高）；
  //   持久态独有的 rule（如更早轮次定下的 entry/exit）保留，避免被风控轮次抹平。
  private mergeRulesByIdentity(
    persisted: readonly SemanticRule[] | undefined,
    derived: readonly SemanticRule[] | undefined,
  ): readonly SemanticRule[] | undefined {
    if (!persisted && !derived) return undefined
    const persistedArr = persisted ?? []
    const derivedArr = derived ?? []
    if (persistedArr.length === 0) return derivedArr.length > 0 ? derivedArr : undefined
    if (derivedArr.length === 0) return persistedArr

    // Issue #1443 + #1633：双重 dedup 兼顾旧 id 契约 + 跨轮 shape 累加防护
    //   Pass 1：按 rule.id 折叠（保旧契约——同 id 表"LLM 修正同一条"，derived 覆盖）
    //   Pass 2：按语义 shape 折叠（解决新问题——不同 id 但同语义多轮累加）
    //
    //   旧实现用 stableParamsHash 对整棵 condition/effects 原始树取 hash，导致
    //   两条语义相同、仅 cosmetic params（evidence.text / semantic 标签）或 alias
    //   param key（feedId vs dataSourceFeedId）不同的 rule 签名不同 → 跨轮累加。
    //   改为 noise-stripped + alias-canonicalized + atom-key 语义签名（镜像
    //   planner-dispatcher-merge.service 的 atomExprSignature / effectSignatureSet）。
    const shapeOf = (rule: SemanticRule): string => {
      const condSig = this.atomExprSemanticSignature(rule.condition)
      const effSig = this.ruleEffectsSemanticSignature(rule.effects)
      return `shape:${rule.phase}|${rule.sideScope}|cond=${condSig}|eff=${effSig}`
    }

    // ── Pass 1：按 id+phase 折叠 ──
    // phase 是生命周期身份，不能把 program rule 与 exit rule 因同 id 合成一条。
    const byId = new Map<string, SemanticRule>()
    const idOrder: string[] = []
    const noIdRules: SemanticRule[] = []
    const ingest = (rule: SemanticRule): void => {
      if (rule.id && rule.id.length > 0) {
        const idKey = `${rule.id}|${rule.phase}`
        if (!byId.has(idKey)) idOrder.push(idKey)
        // 审查 M2 + Task 6：同 id 折叠时 effects 若 derived 缺省/空数组 → 保留 persisted；
        // typed RuleEffects 逐 role 合并，避免 risks patch 清空 programs。
        const existing = byId.get(idKey)
        // Issue #1633 C2：跨轮 clarification 通常只回答 contextSlots（exchange/marketType/
        // timeframe）；同 id 的 entry/exit rule derived 不应当因 LLM 没重述 event-class
        // 叶子（cross_over / cross_under / *touch_* / *breakout_* / condition.sequence /
        // candle_pattern）就把已识别的 event 语义抹掉。
        // 守门：只在 derived 没引入「另一条同类 event-class 叶子」时（= 纯丢失，非替换）
        // 把 persisted 的 event 叶子 / sequence 节点重新注入 derived.condition。
        const nextRule = existing ? this.restoreLostEventAtoms(existing, rule) : rule
        const mergedEffects = this.mergeRuleEffects(existing?.effects, nextRule.effects)
        byId.set(idKey, { ...nextRule, effects: mergedEffects })
      }
      else {
        noIdRules.push(rule)
      }
    }
    persistedArr.forEach(ingest)
    derivedArr.forEach(ingest)
    const afterIdPass: SemanticRule[] = [...idOrder.map(k => byId.get(k)!), ...noIdRules]

    // ── Pass 2：按 content shape 折叠（不同 id 同 shape → 留后入者，去重累加） ──
    const byShape = new Map<string, SemanticRule>()
    const shapeOrder: string[] = []
    for (const rule of afterIdPass) {
      const sig = shapeOf(rule)
      if (!byShape.has(sig)) shapeOrder.push(sig)
      // 后入者（derived）覆盖前入者（persisted）
      byShape.set(sig, rule)
    }
    const afterShapePass = shapeOrder.map(s => byShape.get(s)!)

    // ── Pass 3：风控类 rule 归一化折叠（Issue #1443 多轮 SL/TP 翻倍真因） ──
    //   用户复测：turn 1（现货）planner 产 risk rule { sideScope:'long', effects:[close_long] }；
    //   turn 2（选「合约 perp」）planner 重产同语义 risk rule 但 { sideScope:'both',
    //   effects:[close_long, close_short] } —— Pass 2 的 shape 含 sideScope 与 effects，
    //   两者签名不同 → 两条都留 → UI「止损×2 / 止盈×2」。
    //
    //   通用判定：风控类 rule = condition 所有 leaf 的 contract.bucket === 'risk'
    //   （`risk.stop_loss_pct` / `risk.take_profit_pct` / `risk.trailing_stop` 等）。
    //   这类 rule 的"用户意图身份"完全由 condition（阈值 + basis）决定，与 sideScope
    //   或具体 close action 无关——SL/TP 触发后的平仓动作是市场类型派生的，不该让
    //   语义上同一条 SL 因为派生侧 close action 多寡而分裂成两条。
    //
    //   归一化 sig = `risk:${phase}|${condHash}`，同 sig 留后入者（derived 覆盖 persisted），
    //   与 Pass 2 derived-prevails 语义一致。
    //
    //   守门：
    //   - condition 含任何非 risk-bucket leaf（如 AND(price.above, risk.stop_loss)）→ 不归一化
    //     （混合 condition 语义复杂，保守保留 Pass 2 行为）
    //   - condition leaf bucket 在 registry 缺失 →  不归一化（避免新 atom 未注册时
    //     被错合并）
    const conditionAllRiskBucket = (rule: SemanticRule): boolean => {
      const leaves = collectAtomLeaves(rule.condition)
      if (leaves.length === 0) return false
      for (const leaf of leaves) {
        const contract = (ATOM_CONTRACT_REGISTRY as Record<string, { bucket?: string } | undefined>)[leaf.key]
        if (!contract || contract.bucket !== 'risk') return false
      }
      return true
    }
    const byRiskSig = new Map<string, SemanticRule>()
    const riskOrder: string[] = []
    const nonRiskRules: SemanticRule[] = []
    for (const rule of afterShapePass) {
      if (!conditionAllRiskBucket(rule)) {
        nonRiskRules.push(rule)
        continue
      }
      const condHash = this.stableParamsHash(rule.condition as unknown as Record<string, unknown>)
      const sig = `risk:${rule.phase}|${condHash}`
      if (!byRiskSig.has(sig)) riskOrder.push(sig)
      byRiskSig.set(sig, rule)
    }
    // 保持原顺序：风控 rule 在出现位置插入归一化后的代表（按 riskOrder 一致取首次出现位置）。
    // 实际渲染顺序对 UI 影响有限（rules 层会按 phase 重排），这里简化为「先非风控，
    // 后归一化风控」——既往 Pass 2 输出顺序也不保证严格稳定。
    if (riskOrder.length === 0) return this.finalizeLifecycleRules(afterShapePass)
    return this.finalizeLifecycleRules([...nonRiskRules, ...riskOrder.map(s => byRiskSig.get(s)!)] )
  }

  private finalizeLifecycleRules(rules: readonly SemanticRule[]): readonly SemanticRule[] {
    const repaired = rules.map(rule => this.normalizeRuleEffectsForRule({
      ...this.repairLifecycleActionsForRuleSide(this.repairLifecyclePhaseFromEvidence(rule)),
      condition: this.dropRedundantPriceChangeWhenRiskGuardExists(rule.condition),
    }))
    const withPositionOnlyMerged = this.mergePositionOnlyEntryRulesIntoActionEntries(repaired)
    const folded = this.foldDuplicateLifecycleRules(withPositionOnlyMerged)
    const foldedSubsets = this.foldCoveredLifecycleSubsetRules(folded)
    const withoutCoveredTakeProfitExits = this.dropTakeProfitExitRulesCoveredByEntryRisk(foldedSubsets)
    const withoutRiskOpenNoise = this.dropRiskOnlyOpenEntryRules(withoutCoveredTakeProfitExits)
    const withoutPositionOpenNoise = this.dropPositionPresenceOpenEntryRules(withoutRiskOpenNoise)
    const withoutAlwaysOnOpenNoise = this.dropAlwaysOnOpenEntryRules(withoutPositionOpenNoise)
    const withoutOrphans = this.dropCoveredActionlessLifecycleRules(withoutAlwaysOnOpenNoise)
    const withoutFallbackEntries = this.dropFallbackNoPositionEntries(withoutOrphans)
    return this.dropEntriesDuplicatingSameSideExitConditions(withoutFallbackEntries)
  }

  private dropRedundantPriceChangeWhenRiskGuardExists(condition: AtomExpr): AtomExpr {
    if (condition.kind !== 'and') return condition
    const leaves = condition.children.flatMap(child => collectAtomLeaves(child))
    const hasRiskStop = leaves.some(leaf => leaf.key === 'risk.stop_loss_pct')
    if (!hasRiskStop) return condition
    const children = condition.children.filter(child =>
      !collectAtomLeaves(child).some(leaf => leaf.key === 'price.percent_change'),
    )
    if (children.length === condition.children.length) return condition
    if (children.length === 1) return children[0]!
    return { ...condition, children }
  }

  private mergePositionOnlyEntryRulesIntoActionEntries(rules: readonly SemanticRule[]): readonly SemanticRule[] {
    const next = [...rules]
    const drop = new Set<number>()
    for (let i = 0; i < next.length; i++) {
      const rule = next[i]!
      if (rule.phase !== 'entry' || this.lifecycleActionSignature(rule)) continue
      const typed = this.normalizeRuleEffectsToTyped(rule.effects)
      const hasOnlyPositions = typed.positions.length > 0
        && typed.actions.length === 0
        && typed.risks.length === 0
        && typed.orchestration.length === 0
        && typed.programs.length === 0
      if (!hasOnlyPositions) continue
      const targetIndex = next.findIndex((candidate, index) =>
        index !== i
        && candidate.phase === 'entry'
        && Boolean(this.lifecycleActionSignature(candidate))
        && this.sideScopesCompatibleForLifecycle(candidate.sideScope, rule.sideScope),
      )
      if (targetIndex < 0) continue
      const target = next[targetIndex]!
      next[targetIndex] = {
        ...target,
        effects: this.normalizeRuleEffectsSizingPriority(this.mergeRuleEffects(target.effects, rule.effects)),
      }
      drop.add(i)
    }
    return next.filter((_, index) => !drop.has(index))
  }

  private dropTakeProfitExitRulesCoveredByEntryRisk(rules: readonly SemanticRule[]): readonly SemanticRule[] {
    const entryTakeProfitKeys = new Set<string>()
    for (const rule of rules) {
      if (rule.phase !== 'entry') continue
      const typed = this.normalizeRuleEffectsToTyped(rule.effects)
      for (const risk of typed.risks) {
        for (const leaf of collectAtomLeaves(risk)) {
          if (leaf.key === 'risk.take_profit_pct' || leaf.key === 'risk.partial_take_profit') {
            entryTakeProfitKeys.add(leaf.key)
          }
        }
      }
    }
    if (entryTakeProfitKeys.size === 0) return rules

    return rules.filter((rule) => {
      if (rule.phase !== 'exit') return true
      const conditionKeys = collectAtomLeaves(rule.condition).map(leaf => leaf.key)
      if (!conditionKeys.every(key => key === 'risk.take_profit_pct' || key === 'risk.partial_take_profit')) return true
      return !this.closeActionKeys(rule).size
    })
  }

  private normalizeRuleEffectsForRule(rule: SemanticRule): SemanticRule {
    return {
      ...rule,
      effects: this.normalizeRuleEffectsSizingPriority(this.normalizeRiskEffectValues(rule.effects)),
    }
  }

  private normalizeRiskEffectValues(effects: RuleEffects): RuleEffects {
    const normalize = (expr: AtomExpr): AtomExpr => {
      if (expr.kind === 'atom') {
        if ((expr.key === 'risk.max_drawdown_pct' || expr.key === 'portfolioRisk.drawdown_block') && typeof (expr.params?.valuePct ?? expr.params?.thresholdPct) === 'number') {
          const valueKey = typeof expr.params?.valuePct === 'number' ? 'valuePct' : 'thresholdPct'
          const raw = expr.params?.[valueKey]
          const value = typeof raw === 'number' ? Math.abs(raw) : raw
          return { ...expr, params: { ...(expr.params ?? {}), [valueKey]: value } }
        }
        return expr
      }
      if (expr.kind === 'and') return { ...expr, children: expr.children.map(normalize) }
      if (expr.kind === 'or') return { ...expr, children: expr.children.map(normalize) }
      if (expr.kind === 'not') return { ...expr, child: normalize(expr.child) }
      if (expr.kind === 'sequence') return { ...expr, steps: expr.steps.map(normalize) }
      return expr
    }
    if (!isRuleEffectsByRole(effects)) return effects.map(normalize)
    return {
      actions: effects.actions.map(normalize),
      risks: effects.risks.map(normalize).filter(effect => !this.isZeroRiskEffect(effect)),
      positions: effects.positions.map(normalize),
      orchestration: effects.orchestration.map(normalize).filter(effect => !this.isZeroRiskEffect(effect)),
      programs: effects.programs.map(normalize),
    }
  }

  private isZeroRiskEffect(effect: AtomExpr): boolean {
    return effect.kind === 'atom'
      && (effect.key === 'risk.max_drawdown_pct' || effect.key === 'portfolioRisk.drawdown_block')
      && (effect.params?.valuePct === 0 || effect.params?.thresholdPct === 0)
  }

  private foldDuplicateLifecycleRules(rules: readonly SemanticRule[]): readonly SemanticRule[] {
    const bySignature = new Map<string, SemanticRule>()
    const order: string[] = []
    const passthrough: SemanticRule[] = []

    for (const rule of rules) {
      const actionSig = this.lifecycleActionSignature(rule)
      if (!actionSig) {
        passthrough.push(rule)
        continue
      }
      const sig = `${rule.phase}|${rule.sideScope}|${this.atomExprSemanticSignature(rule.condition)}|${actionSig}`
      const existing = bySignature.get(sig)
      if (!existing) {
        order.push(sig)
        bySignature.set(sig, rule)
        continue
      }
      bySignature.set(sig, {
        ...existing,
        effects: this.normalizeRuleEffectsSizingPriority(this.mergeRuleEffects(existing.effects, rule.effects)),
      })
    }

    return [...order.map(sig => bySignature.get(sig)!), ...passthrough]
  }

  private foldCoveredLifecycleSubsetRules(rules: readonly SemanticRule[]): readonly SemanticRule[] {
    const out: SemanticRule[] = []
    for (const rule of rules) {
      const actionSig = this.lifecycleActionSignature(rule)
      if (!actionSig) {
        out.push(rule)
        continue
      }
      const existingIndex = out.findIndex(existing => this.lifecycleRuleCovers(existing, rule, actionSig))
      if (existingIndex >= 0) {
        const existing = out[existingIndex]!
        out[existingIndex] = {
          ...this.preferRicherConditionRule(existing, rule),
          effects: this.normalizeRuleEffectsSizingPriority(this.mergeRuleEffects(existing.effects, rule.effects)),
        }
        continue
      }
      const coveredIndex = out.findIndex(existing => this.lifecycleRuleCovers(rule, existing, this.lifecycleActionSignature(existing)))
      if (coveredIndex >= 0) {
        const existing = out[coveredIndex]!
        out[coveredIndex] = {
          ...this.preferRicherConditionRule(rule, existing),
          effects: this.normalizeRuleEffectsSizingPriority(this.mergeRuleEffects(existing.effects, rule.effects)),
        }
        continue
      }
      out.push(rule)
    }
    return out
  }

  private lifecycleRuleCovers(candidate: SemanticRule, covered: SemanticRule, actionSig: string | null): boolean {
    if (!actionSig) return false
    if (candidate.phase !== covered.phase) return false
    if (candidate.sideScope !== covered.sideScope && (this.hasMixedRiskCondition(candidate.condition) || this.hasMixedRiskCondition(covered.condition))) return false
    if (!this.sideScopesCompatibleForLifecycle(candidate.sideScope, covered.sideScope)) return false
    if (this.lifecycleActionSignature(candidate) !== actionSig) return false
    const candidateLeaves = collectAtomLeaves(candidate.condition)
    const coveredLeaves = collectAtomLeaves(covered.condition)
    if (candidateLeaves.length === 0 || coveredLeaves.length === 0) return false
    return coveredLeaves.every(leaf => candidateLeaves.some(candidateLeaf => this.conditionLeafCovers(candidateLeaf, leaf)))
  }

  private preferRicherConditionRule(left: SemanticRule, right: SemanticRule): SemanticRule {
    const leftScore = this.conditionRichnessScore(left.condition)
    const rightScore = this.conditionRichnessScore(right.condition)
    return rightScore > leftScore ? right : left
  }

  private hasMixedRiskCondition(condition: AtomExpr): boolean {
    const leaves = collectAtomLeaves(condition)
    if (leaves.length < 2) return false
    const hasRisk = leaves.some(leaf => this.resolveAtomBucket(leaf.key) === 'risk' || leaf.key.startsWith('risk.'))
    const hasNonRisk = leaves.some(leaf => !(this.resolveAtomBucket(leaf.key) === 'risk' || leaf.key.startsWith('risk.')))
    return hasRisk && hasNonRisk
  }

  private conditionRichnessScore(condition: AtomExpr): number {
    return collectAtomLeaves(condition).reduce((sum, leaf) => sum + 10 + Object.keys(this.cleanParamsForSignature(leaf.params ?? {})).length, 0)
  }

  private conditionLeafCovers(candidate: AtomExpr & { kind: 'atom' }, covered: AtomExpr & { kind: 'atom' }): boolean {
    if (this.sameMovingAverageCrossConditionKey(candidate, covered)) return true
    if (candidate.key === covered.key) {
      if (this.sameMovingAverageThresholdCondition(candidate, covered)) return true
      return this.paramsCover(candidate.params, covered.params) || this.paramsCover(covered.params, candidate.params)
    }
    if (this.movingAverageExitLeavesEquivalent(candidate, covered)) return true
    return false
  }

  private sameMovingAverageCrossConditionKey(left: AtomExpr & { kind: 'atom' }, right: AtomExpr & { kind: 'atom' }): boolean {
    if (left.key !== right.key) return false
    if (left.key !== 'indicator.cross_over' && left.key !== 'indicator.cross_under') return false
    const leftIndicator = typeof left.params?.indicator === 'string' ? left.params.indicator : null
    const rightIndicator = typeof right.params?.indicator === 'string' ? right.params.indicator : null
    return Boolean(
      leftIndicator
      && rightIndicator
      && this.isMovingAverageIndicatorName(leftIndicator)
      && this.isMovingAverageIndicatorName(rightIndicator),
    )
  }

  private sameMovingAverageThresholdCondition(left: AtomExpr & { kind: 'atom' }, right: AtomExpr & { kind: 'atom' }): boolean {
    if (left.key !== right.key) return false
    if (left.key !== 'indicator.above' && left.key !== 'indicator.below') return false
    const leftIndicator = typeof left.params?.indicator === 'string' ? left.params.indicator : null
    const rightIndicator = typeof right.params?.indicator === 'string' ? right.params.indicator : null
    if (leftIndicator && rightIndicator && (!this.isMovingAverageIndicatorName(leftIndicator) || !this.isMovingAverageIndicatorName(rightIndicator))) return false
    if (leftIndicator && rightIndicator && leftIndicator !== rightIndicator && !this.isMovingAverageIndicatorName(leftIndicator) && !this.isMovingAverageIndicatorName(rightIndicator)) return false
    const leftPeriod = this.readIndicatorPeriod(left.params)
    const rightPeriod = this.readIndicatorPeriod(right.params)
    return leftPeriod !== null && rightPeriod !== null && Math.abs(leftPeriod - rightPeriod) <= 1e-9
  }

  private isMovingAverageIndicatorName(value: string): boolean {
    return /^(?:ma|sma|ema|wma|hma|moving_average)$/iu.test(value.trim())
  }

  private movingAverageParamsCompatible(
    candidate: Record<string, unknown> | undefined,
    covered: Record<string, unknown> | undefined,
  ): boolean {
    const candidateIndicator = typeof candidate?.indicator === 'string' ? candidate.indicator : null
    const coveredIndicator = typeof covered?.indicator === 'string' ? covered.indicator : null
    if (candidateIndicator && coveredIndicator && candidateIndicator !== coveredIndicator) return false

    const candidateFast = this.readNumberParam(candidate, 'fastPeriod')
    const coveredFast = this.readNumberParam(covered, 'fastPeriod')
    const candidateSlow = this.readNumberParam(candidate, 'slowPeriod')
    const coveredSlow = this.readNumberParam(covered, 'slowPeriod')

    return this.numberParamsCompatible(candidateFast, coveredFast)
      && this.numberParamsCompatible(candidateSlow, coveredSlow)
  }

  private readNumberParam(params: Record<string, unknown> | undefined, key: string): number | null {
    const value = params?.[key]
    return typeof value === 'number' && Number.isFinite(value) ? value : null
  }

  private numberParamsCompatible(left: number | null, right: number | null): boolean {
    if (left === null || left === 0 || right === null || right === 0) return true
    return Math.abs(left - right) <= 1e-9
  }

  private paramsCover(candidate: Record<string, unknown> | undefined, covered: Record<string, unknown> | undefined): boolean {
    const left = this.cleanParamsForSignature(candidate ?? {})
    const right = this.cleanParamsForSignature(covered ?? {})
    return Object.entries(right).every(([key, value]) => JSON.stringify(this.stableValue(left[key])) === JSON.stringify(this.stableValue(value)))
  }

  private movingAverageExitLeavesEquivalent(left: AtomExpr & { kind: 'atom' }, right: AtomExpr & { kind: 'atom' }): boolean {
    const keys = new Set([left.key, right.key])
    if (!keys.has('indicator.cross_under') || !keys.has('indicator.below')) return false
    const leftIndicator = typeof left.params?.indicator === 'string' ? left.params.indicator : null
    const rightIndicator = typeof right.params?.indicator === 'string' ? right.params.indicator : null
    if (leftIndicator && rightIndicator && leftIndicator !== rightIndicator) return false
    const leftPeriod = this.readIndicatorPeriod(left.params)
    const rightPeriod = this.readIndicatorPeriod(right.params)
    return leftPeriod !== null && rightPeriod !== null && Math.abs(leftPeriod - rightPeriod) <= 1e-9
  }

  private readIndicatorPeriod(params: Record<string, unknown> | undefined): number | null {
    const direct = params?.['reference.period'] ?? (params?.reference && typeof params.reference === 'object' && !Array.isArray(params.reference) ? (params.reference as { period?: unknown }).period : undefined) ?? params?.period ?? params?.fastPeriod
    return typeof direct === 'number' && Number.isFinite(direct) ? direct : null
  }

  private lifecycleActionSignature(rule: SemanticRule): string | null {
    const keys = rule.phase === 'entry' ? this.openActionKeys(rule) : rule.phase === 'exit' ? this.closeActionKeys(rule) : new Set<string>()
    if (keys.size === 0) return null
    return [...keys].sort().join('|')
  }

  private repairLifecyclePhaseFromEvidence(rule: SemanticRule): SemanticRule {
    if (rule.phase !== 'entry' && rule.phase !== 'exit') return rule
    const evidenceText = this.collectLifecycleEvidenceText(rule)
    if (!evidenceText) return rule

    const desired = this.inferLifecycleIntentFromEvidence(evidenceText, rule.condition)
      ?? this.inferMissingEntryLifecycleIntent(rule, evidenceText)
    if (!desired) return rule
    if (!this.sideScopesCompatibleForLifecycle(rule.sideScope, desired.sideScope)) return rule

    const typed = this.normalizeRuleEffectsToTyped(rule.effects)
    const hasOppositeClose = desired.phase === 'entry'
      && typed.actions.some(effect => collectAtomLeaves(effect).some(leaf => leaf.key === (desired.sideScope === 'short' ? 'action.close_short' : 'action.close_long')))
    const hasOppositeOpen = desired.phase === 'exit'
      && typed.actions.some(effect => collectAtomLeaves(effect).some(leaf => leaf.key === (desired.sideScope === 'short' ? 'action.open_short' : 'action.open_long')))
    if (!hasOppositeClose && !hasOppositeOpen && rule.phase === desired.phase) return rule

    return {
      ...rule,
      phase: desired.phase,
      sideScope: desired.sideScope,
      effects: {
        ...typed,
        actions: [{ kind: 'atom', key: desired.actionKey, params: {} }],
      },
    }
  }

  private collectLifecycleEvidenceText(rule: SemanticRule): string {
    const parts: string[] = []
    const pushEvidence = (value: unknown): void => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return
      const text = (value as { text?: unknown }).text
      if (typeof text === 'string' && text.trim().length > 0) parts.push(text)
    }
    pushEvidence((rule as { evidence?: unknown }).evidence)
    for (const leaf of collectAtomLeaves(rule.condition)) pushEvidence(leaf.evidence)
    for (const effect of listRuleEffects(rule.effects)) {
      for (const leaf of collectAtomLeaves(effect)) pushEvidence(leaf.evidence)
    }
    return parts.join(' ')
  }

  private inferLifecycleIntentFromEvidence(text: string, condition: AtomExpr): { phase: 'entry' | 'exit', sideScope: 'long' | 'short', actionKey: string } | null {
    const normalized = text.trim()
    if (!normalized) return null
    const scoped = this.inferLifecycleIntentFromScopedEvidence(normalized, condition)
    if (scoped) return scoped

    const hasOpenLong = this.hasOpenLongIntent(normalized)
    const hasOpenShort = this.hasOpenShortIntent(normalized)
    const hasCloseLong = this.hasCloseLongIntent(normalized)
    const hasCloseShort = this.hasCloseShortIntent(normalized)
    const hasOpen = hasOpenLong || hasOpenShort
    const hasClose = hasCloseLong || hasCloseShort
    if (hasOpen && hasClose) return null
    if (hasOpenLong) {
      return { phase: 'entry', sideScope: 'long', actionKey: 'action.open_long' }
    }
    if (hasOpenShort) {
      return { phase: 'entry', sideScope: 'short', actionKey: 'action.open_short' }
    }
    if (hasCloseLong) {
      return { phase: 'exit', sideScope: 'long', actionKey: 'action.close_long' }
    }
    if (hasCloseShort) {
      return { phase: 'exit', sideScope: 'short', actionKey: 'action.close_short' }
    }
    return null
  }

  private inferLifecycleIntentFromScopedEvidence(text: string, condition: AtomExpr): { phase: 'entry' | 'exit', sideScope: 'long' | 'short', actionKey: string } | null {
    const clauses = this.extractLifecycleEvidenceClauses(text)
    if (clauses.length === 0) return null
    const scored = clauses.map(clause => ({
      clause,
      intent: this.inferLifecycleIntentFromClause(clause.phase, clause.text),
      score: this.scoreLifecycleClauseAgainstCondition(clause.text, condition),
    })).filter(item => item.intent !== null)
    const bestScore = Math.max(0, ...scored.map(item => item.score))
    const best = scored.filter(item => item.score === bestScore)
    if (bestScore > 0 && best.length === 1) return best[0]!.intent!

    const intents = scored
      .map(item => item.intent)
      .filter((intent): intent is { phase: 'entry' | 'exit', sideScope: 'long' | 'short', actionKey: string } => intent !== null)
    const unique = new Map(intents.map(intent => [`${intent.phase}:${intent.sideScope}:${intent.actionKey}`, intent]))
    return unique.size === 1 ? [...unique.values()][0]! : null
  }

  private extractLifecycleEvidenceClauses(text: string): Array<{ phase: 'entry' | 'exit', text: string }> {
    const clauses: Array<{ phase: 'entry' | 'exit', text: string }> = []
    const pattern = /(入场规则|出场规则|entry\s+rules?|exit\s+rules?)\s*[：:]\s*/giu
    const matches = [...text.matchAll(pattern)]
    for (let index = 0; index < matches.length; index += 1) {
      const match = matches[index]!
      const start = (match.index ?? 0) + match[0].length
      const end = index + 1 < matches.length ? matches[index + 1]!.index ?? text.length : text.length
      const clauseText = text.slice(start, end).replace(/[；;。.]\s*$/u, '').trim()
      if (!clauseText) continue
      clauses.push({
        phase: /^(?:入场规则|entry)/iu.test(match[1]!) ? 'entry' : 'exit',
        text: clauseText,
      })
    }
    return clauses
  }

  private inferLifecycleIntentFromClause(
    phase: 'entry' | 'exit',
    text: string,
  ): { phase: 'entry' | 'exit', sideScope: 'long' | 'short', actionKey: string } | null {
    if (phase === 'entry') {
      if (this.hasOpenLongIntent(text)) return { phase: 'entry', sideScope: 'long', actionKey: 'action.open_long' }
      if (this.hasOpenShortIntent(text)) return { phase: 'entry', sideScope: 'short', actionKey: 'action.open_short' }
      return null
    }
    if (this.hasCloseLongIntent(text)) return { phase: 'exit', sideScope: 'long', actionKey: 'action.close_long' }
    if (this.hasCloseShortIntent(text)) return { phase: 'exit', sideScope: 'short', actionKey: 'action.close_short' }
    return null
  }

  private scoreLifecycleClauseAgainstCondition(text: string, condition: AtomExpr): number {
    const normalized = text.replace(/\s+/gu, '')
    let score = 0
    for (const leaf of collectAtomLeaves(condition)) {
      score += this.scoreLifecycleClauseDirection(text, leaf)
      for (const value of this.collectNumericConditionParams(leaf.params)) {
        if (normalized.includes(this.formatConditionNumber(value))) score += 1
      }
    }
    return score
  }

  private scoreLifecycleClauseDirection(text: string, leaf: AtomExpr & { kind: 'atom' }): number {
    if (leaf.key === 'indicator.above') {
      return /(?:上方|之上|高于|站上|突破|above)/iu.test(text) ? 2 : 0
    }
    if (leaf.key === 'indicator.below') {
      return /(?:下方|之下|低于|跌破|below)/iu.test(text) ? 2 : 0
    }
    if (leaf.key === 'indicator.cross_over') {
      return /(?:上穿|金叉|cross(?:es)?\s+over|cross\s+above)/iu.test(text) ? 2 : 0
    }
    if (leaf.key === 'indicator.cross_under') {
      return /(?:下穿|死叉|cross(?:es)?\s+under|cross\s+below)/iu.test(text) ? 2 : 0
    }
    if (leaf.key === 'bollinger.touch_lower') {
      return /(?:下轨|lower\s+band|touch(?:es)?\s+lower|retest\s+lower)/iu.test(text) ? 2 : 0
    }
    if (leaf.key === 'bollinger.touch_upper') {
      return /(?:上轨|upper\s+band|touch(?:es)?\s+upper|retest\s+upper)/iu.test(text) ? 2 : 0
    }
    if (leaf.key === 'bollinger.touch_middle') {
      return /(?:中轨|中线|middle\s+band|touch(?:es)?\s+middle|retest\s+middle)/iu.test(text) ? 2 : 0
    }
    return 0
  }

  private collectNumericConditionParams(value: unknown): number[] {
    if (typeof value === 'number' && Number.isFinite(value)) return [value]
    if (!value || typeof value !== 'object') return []
    if (Array.isArray(value)) return value.flatMap(item => this.collectNumericConditionParams(item))
    return Object.values(value).flatMap(item => this.collectNumericConditionParams(item))
  }

  private formatConditionNumber(value: number): string {
    return Number.isInteger(value) ? String(value) : String(value).replace(/0+$/u, '').replace(/\.$/u, '')
  }

  private hasOpenLongIntent(text: string): boolean {
    return /(?:开多|做多|买入(?:开多|开仓)?|\bbuy\b|open\s+long)/iu.test(text)
      && !/(?:买入平空|buy\s+to\s+cover|close\s+short)/iu.test(text)
  }

  private hasOpenShortIntent(text: string): boolean {
    return /(?:开空|做空|卖出开空|open\s+short)/iu.test(text)
  }

  private hasCloseLongIntent(text: string): boolean {
    return /(?:平多|卖出(?!\s*(?:开空|做空))|卖出平多|卖出平仓|平仓|平一半|平剩余|止盈|止损|close\s+long|sell\s+to\s+close)/iu.test(text)
  }

  private hasCloseShortIntent(text: string): boolean {
    return /(?:平空|买入平空|平仓|平一半|平剩余|止盈|止损|close\s+short|buy\s+to\s+cover)/iu.test(text)
  }

  private inferMissingEntryLifecycleIntent(
    rule: SemanticRule,
    text: string,
  ): { phase: 'entry', sideScope: 'long' | 'short', actionKey: string } | null {
    if (rule.phase !== 'exit') return null
    if (!/rulesMainflow\.missing_entry_rules/iu.test(text)) return null
    if (this.conditionAllRiskBucket(rule.condition) || this.conditionOnlyHasPositionPresence(rule.condition)) return null
    if (this.hasOpenLongIntent(text)) {
      return { phase: 'entry', sideScope: 'long', actionKey: 'action.open_long' }
    }
    if (this.hasOpenShortIntent(text)) {
      return { phase: 'entry', sideScope: 'short', actionKey: 'action.open_short' }
    }
    return null
  }

  private repairLifecycleActionsForRuleSide(rule: SemanticRule): SemanticRule {
    if (rule.phase !== 'entry' && rule.phase !== 'exit') return rule
    if (rule.sideScope === 'both') return rule

    const typed = this.normalizeRuleEffectsToTyped(rule.effects)
    const lifecycleKeys = rule.phase === 'entry'
      ? new Set(['action.open_long', 'action.open_short'])
      : new Set(['action.close_long', 'action.close_short'])
    const expectedKey = rule.phase === 'entry'
      ? (rule.sideScope === 'short' ? 'action.open_short' : 'action.open_long')
      : (rule.sideScope === 'short' ? 'action.close_short' : 'action.close_long')
    const hasLifecycleAction = typed.actions.some(effect => collectAtomLeaves(effect).some(leaf => lifecycleKeys.has(leaf.key)))
    const hasPyramidingAdd = rule.phase === 'entry'
      && typed.actions.some(effect => collectAtomLeaves(effect).some(leaf => leaf.key === 'action.add_position'))
      && typed.positions.some(effect => collectAtomLeaves(effect).some(leaf => leaf.key === 'position.pyramiding_limit'))
    if (!hasLifecycleAction && !hasPyramidingAdd) return { ...rule, effects: typed }

    const nonLifecycleActions = typed.actions.filter(effect =>
      !collectAtomLeaves(effect).some(leaf => lifecycleKeys.has(leaf.key)),
    ).map(effect => this.repairStructuralActionSide(effect, rule.sideScope))
    return {
      ...rule,
      effects: {
        ...typed,
        actions: [
          ...nonLifecycleActions,
          { kind: 'atom', key: expectedKey, params: {} },
        ],
      },
    }
  }

  private repairStructuralActionSide(effect: AtomExpr, sideScope: SemanticRule['sideScope']): AtomExpr {
    if (sideScope === 'both') return effect
    if (effect.kind === 'atom') {
      if (effect.key !== 'action.add_position') return effect
      return {
        ...effect,
        sideScope,
        params: {
          ...(effect.params ?? {}),
          sideScope,
        },
      }
    }
    if (effect.kind === 'and') return { ...effect, children: effect.children.map(child => this.repairStructuralActionSide(child, sideScope)) }
    if (effect.kind === 'or') return { ...effect, children: effect.children.map(child => this.repairStructuralActionSide(child, sideScope)) }
    if (effect.kind === 'not') return { ...effect, child: this.repairStructuralActionSide(effect.child, sideScope) }
    if (effect.kind === 'sequence') return { ...effect, steps: effect.steps.map(step => this.repairStructuralActionSide(step, sideScope)) }
    return effect
  }

  private dropCoveredActionlessLifecycleRules(rules: readonly SemanticRule[]): readonly SemanticRule[] {
    const coveredEffectKeys = new Set<string>()
    for (const rule of rules) {
      if (this.lifecycleActionSignature(rule)) {
        for (const effect of listRuleEffects(rule.effects)) {
          for (const leaf of collectAtomLeaves(effect)) coveredEffectKeys.add(leaf.key)
        }
      }
    }
    if (coveredEffectKeys.size === 0) return rules
    return rules.filter((rule) => {
      if (rule.phase !== 'entry' && rule.phase !== 'exit') return true
      if (this.lifecycleActionSignature(rule)) return true
      const effectLeaves = listRuleEffects(rule.effects).flatMap(effect => collectAtomLeaves(effect))
      if (effectLeaves.length === 0) return false
      return !effectLeaves.every(leaf => coveredEffectKeys.has(leaf.key))
    })
  }

  private dropRiskOnlyOpenEntryRules(rules: readonly SemanticRule[]): readonly SemanticRule[] {
    const realEntryRules = rules.filter(rule =>
      rule.phase === 'entry'
      && this.openActionKeys(rule).size > 0
      && !this.conditionAllRiskBucket(rule.condition),
    )
    if (realEntryRules.length === 0) return rules
    const entryRiskKeys = new Set(realEntryRules.flatMap(rule =>
      this.normalizeRuleEffectsToTyped(rule.effects).risks.flatMap(effect => collectAtomLeaves(effect).map(leaf => leaf.key)),
    ))
    return rules.filter((rule) => {
      if (rule.phase !== 'entry' || this.openActionKeys(rule).size === 0) return true
      const conditionLeaves = collectAtomLeaves(rule.condition)
      if (conditionLeaves.length === 0 || !this.conditionAllRiskBucket(rule.condition)) return true
      if (entryRiskKeys.size === 0) return false
      return !conditionLeaves.every(leaf => entryRiskKeys.has(leaf.key))
    })
  }

  private dropPositionPresenceOpenEntryRules(rules: readonly SemanticRule[]): readonly SemanticRule[] {
    const hasRealEntry = rules.some(rule =>
      rule.phase === 'entry'
      && this.openActionKeys(rule).size > 0
      && !this.conditionOnlyHasPositionPresence(rule.condition),
    )
    if (!hasRealEntry) return rules
    return rules.filter(rule =>
      rule.phase !== 'entry'
      || this.openActionKeys(rule).size === 0
      || !this.conditionOnlyHasPositionPresence(rule.condition),
    )
  }

  private dropAlwaysOnOpenEntryRules(rules: readonly SemanticRule[]): readonly SemanticRule[] {
    const hasRealEntry = rules.some(rule =>
      rule.phase === 'entry'
      && this.openActionKeys(rule).size > 0
      && !this.conditionOnlyHasAlwaysOn(rule.condition),
    )
    if (!hasRealEntry) return rules
    return rules.filter(rule =>
      rule.phase !== 'entry'
      || this.openActionKeys(rule).size === 0
      || !this.conditionOnlyHasAlwaysOn(rule.condition),
    )
  }

  private conditionOnlyHasAlwaysOn(condition: AtomExpr): boolean {
    const leaves = collectAtomLeaves(condition)
    return leaves.length > 0 && leaves.every(leaf => leaf.key === 'execution.on_start')
  }

  private conditionOnlyHasPositionPresence(condition: AtomExpr): boolean {
    const leaves = collectAtomLeaves(condition)
    return leaves.length > 0 && leaves.every(leaf => leaf.key === 'position.has_position')
  }

  private conditionAllRiskBucket(condition: AtomExpr): boolean {
    const leaves = collectAtomLeaves(condition)
    return leaves.length > 0 && leaves.every(leaf => this.resolveAtomBucket(leaf.key) === 'risk' || leaf.key.startsWith('risk.'))
  }

  private dropEntriesDuplicatingSameSideExitConditions(rules: readonly SemanticRule[]): readonly SemanticRule[] {
    const exitRules = rules.filter(rule => rule.phase === 'exit' && this.closeActionKeys(rule).size > 0)
    if (exitRules.length === 0) return rules
    return rules.filter((rule) => {
      if (rule.phase !== 'entry') return true
      const openActions = this.openActionKeys(rule)
      if (openActions.size === 0) return true
      return !exitRules.some(exitRule =>
        this.sideScopesCompatibleForLifecycle(rule.sideScope, exitRule.sideScope)
        && this.sameSideOpenCloseActions(openActions, this.closeActionKeys(exitRule))
        && (
          this.atomExprSemanticSignature(rule.condition) === this.atomExprSemanticSignature(exitRule.condition)
          || this.conditionLeavesCover(exitRule.condition, rule.condition)
        ),
      )
    })
  }

  private conditionLeavesCover(covering: AtomExpr, covered: AtomExpr): boolean {
    const coveringLeaves = collectAtomLeaves(covering)
    const coveredLeaves = collectAtomLeaves(covered)
    if (coveringLeaves.length === 0 || coveredLeaves.length === 0) return false
    return coveredLeaves.every(leaf => coveringLeaves.some(candidate => this.conditionLeafCovers(candidate, leaf)))
  }

  private dropFallbackNoPositionEntries(rules: readonly SemanticRule[]): readonly SemanticRule[] {
    const hasSpecificEntryBySide = new Set<SemanticRule['sideScope']>()
    for (const rule of rules) {
      if (rule.phase !== 'entry' || this.openActionKeys(rule).size === 0) continue
      const leaves = collectAtomLeaves(rule.condition)
      if (leaves.length === 1 && leaves[0]?.key === 'position.no_position') continue
      hasSpecificEntryBySide.add(rule.sideScope)
    }
    if (hasSpecificEntryBySide.size === 0) return rules
    return rules.filter((rule) => {
      if (rule.phase !== 'entry' || this.openActionKeys(rule).size === 0) return true
      const leaves = collectAtomLeaves(rule.condition)
      if (!(leaves.length === 1 && leaves[0]?.key === 'position.no_position')) return true
      return !hasSpecificEntryBySide.has(rule.sideScope)
    })
  }

  private openActionKeys(rule: SemanticRule): Set<string> {
    return this.lifecycleActionKeys(rule, new Set(['action.open_long', 'action.open_short']))
  }

  private closeActionKeys(rule: SemanticRule): Set<string> {
    return this.lifecycleActionKeys(rule, new Set(['action.close_long', 'action.close_short']))
  }

  private lifecycleActionKeys(rule: SemanticRule, allowed: ReadonlySet<string>): Set<string> {
    return new Set(listRuleEffects(rule.effects)
      .flatMap(effect => collectAtomLeaves(effect))
      .map(leaf => leaf.key)
      .filter(key => allowed.has(key)))
  }

  private sideScopesCompatibleForLifecycle(left: SemanticRule['sideScope'], right: SemanticRule['sideScope']): boolean {
    return left === right || left === 'both' || right === 'both'
  }

  private sameSideOpenCloseActions(openActions: ReadonlySet<string>, closeActions: ReadonlySet<string>): boolean {
    return (openActions.has('action.open_long') && closeActions.has('action.close_long'))
      || (openActions.has('action.open_short') && closeActions.has('action.close_short'))
  }

  private mergeRuleEffects(
    persisted: RuleEffects | undefined,
    derived: RuleEffects,
  ): RuleEffects {
    if (!persisted) return this.cloneRuleEffectsAsTyped(derived)
    if (listRuleEffects(derived).length === 0) return this.cloneRuleEffects(persisted)
    if (listRuleEffects(persisted).length === 0) return this.cloneRuleEffectsAsTyped(derived)

    const persistedTyped = this.normalizeRuleEffectsToTyped(persisted)
    const derivedTyped = this.normalizeRuleEffectsToTyped(derived)
    return {
      actions: this.mergeRuleEffectRole(persistedTyped.actions, derivedTyped.actions),
      risks: this.mergeRuleEffectRole(persistedTyped.risks, derivedTyped.risks),
      positions: this.mergeRuleEffectRole(persistedTyped.positions, derivedTyped.positions),
      orchestration: this.mergeRuleEffectRole(persistedTyped.orchestration, derivedTyped.orchestration),
      programs: this.mergeRuleEffectRole(persistedTyped.programs, derivedTyped.programs),
    } satisfies RuleEffectsByRole
  }

  private normalizeRuleEffectsSizingPriority(effects: RuleEffects): RuleEffectsByRole {
    const typed = this.normalizeRuleEffectsToTyped(effects)
    return {
      actions: this.dedupeActionEffectsBySemanticSignature(typed.actions),
      risks: this.dedupeRuleEffectRoleBySemanticSignature(typed.risks),
      positions: this.dedupeSizingEffectsByPriority(typed.positions),
      orchestration: this.dedupeRuleEffectRoleBySemanticSignature(typed.orchestration),
      programs: this.dedupeRuleEffectRoleBySemanticSignature(typed.programs),
    }
  }

  private dedupeRuleEffectRoleBySemanticSignature(effects: ReadonlyArray<AtomExpr>): AtomExpr[] {
    const bySignature = new Map<string, AtomExpr>()
    const order: string[] = []
    for (const effect of effects) {
      const signature = this.atomExprSemanticSignature(effect)
      if (!bySignature.has(signature)) order.push(signature)
      bySignature.set(signature, effect)
    }
    return order.map(signature => this.cloneAtomExpr(bySignature.get(signature)!))
  }

  private dedupeActionEffectsBySemanticSignature(effects: ReadonlyArray<AtomExpr>): AtomExpr[] {
    const withoutReverse = effects.filter(effect => !collectAtomLeaves(effect).some(leaf => leaf.key === 'action.reverse_position'))
    const reverseEffects = effects.filter(effect => collectAtomLeaves(effect).some(leaf => leaf.key === 'action.reverse_position'))
    if (reverseEffects.length === 0) return this.dedupeRuleEffectRoleBySemanticSignature(effects)
    const bestReverse = [...reverseEffects]
      .sort((left, right) => this.reversePositionEffectScore(right) - this.reversePositionEffectScore(left))[0]!
    return this.dedupeRuleEffectRoleBySemanticSignature([...withoutReverse, bestReverse])
  }

  private reversePositionEffectScore(effect: AtomExpr): number {
    const leaf = collectAtomLeaves(effect).find(item => item.key === 'action.reverse_position')
    if (!leaf) return 0
    return [leaf.params?.fromSide, leaf.params?.toSide, leaf.params?.sameBarPolicy, leaf.params?.sizingSource]
      .filter(value => typeof value === 'string' && value.trim() !== '')
      .length
  }

  private dedupeSizingEffectsByPriority(effects: ReadonlyArray<AtomExpr>): AtomExpr[] {
    const sizingEffects = effects.filter(effect =>
      collectAtomLeaves(effect).some(leaf => leaf.key === 'position.sizing'),
    )
    if (sizingEffects.length <= 1) return effects.map(effect => this.cloneAtomExpr(effect))

    const nonSizing = effects.filter(effect =>
      !collectAtomLeaves(effect).some(leaf => leaf.key === 'position.sizing'),
    )
    const best = [...sizingEffects].sort((left, right) => this.sizingEffectPriority(right) - this.sizingEffectPriority(left))[0]!
    return [...nonSizing.map(effect => this.cloneAtomExpr(effect)), this.cloneAtomExpr(best)]
  }

  private sizingEffectPriority(effect: AtomExpr): number {
    const leaf = collectAtomLeaves(effect).find(item => item.key === 'position.sizing')
    const sizing = leaf?.params?.sizing
    if (sizing && typeof sizing === 'object' && !Array.isArray(sizing)) {
      const kind = (sizing as { kind?: unknown }).kind
      if (kind === 'ratio') return 3
      if (kind === 'quote') return 2
    }
    return 1
  }

  private mergeRuleEffectRole(
    persisted: ReadonlyArray<AtomExpr>,
    derived: ReadonlyArray<AtomExpr>,
  ): AtomExpr[] {
    if (derived.length === 0) return persisted.map(effect => this.cloneAtomExpr(effect))
    if (persisted.length === 0) return derived.map(effect => this.cloneAtomExpr(effect))

    const byShape = new Map<string, AtomExpr>()
    const order: string[] = []
    for (const effect of [...persisted, ...derived]) {
      const shape = this.atomExprSemanticSignature(effect)
      if (!byShape.has(shape)) order.push(shape)
      byShape.set(shape, effect)
    }
    return order.map(shape => this.cloneAtomExpr(byShape.get(shape)!))
  }

  private cloneRuleEffects(effects: RuleEffects): RuleEffects {
    if (Array.isArray(effects)) {
      return effects.map(effect => this.cloneAtomExpr(effect))
    }
    const typedEffects = effects as RuleEffectsByRole
    return {
      actions: typedEffects.actions.map(effect => this.cloneAtomExpr(effect)),
      risks: typedEffects.risks.map(effect => this.cloneAtomExpr(effect)),
      positions: typedEffects.positions.map(effect => this.cloneAtomExpr(effect)),
      orchestration: typedEffects.orchestration.map(effect => this.cloneAtomExpr(effect)),
      programs: typedEffects.programs.map(effect => this.cloneAtomExpr(effect)),
    } satisfies RuleEffectsByRole
  }

  private cloneRuleEffectsAsTyped(effects: RuleEffects): RuleEffectsByRole {
    return this.normalizeRuleEffectsToTyped(effects)
  }

  private normalizeRuleEffectsToTyped(effects: RuleEffects): RuleEffectsByRole {
    // #1633 rules-only generic bucket normalization：无论输入是 typed 还是 legacy，
    //   每个 effect leaf 必须落到与 ATOM_CONTRACT_REGISTRY[key].bucket 匹配的 role 桶。
    //   防止 planner/dispatcher 误把 positionConstraint atom（如 grid.range_rebalance）
    //   塞进 effects.programs，导致 canonical-spec builder 抛
    //   UnsupportedSemanticRuleProgramEffect。规则按 bucket 通用化，禁止 atom-key 特例。
    const typed: Record<keyof RuleEffectsByRole, AtomExpr[]> = {
      actions: [],
      risks: [],
      positions: [],
      orchestration: [],
      programs: [],
    }
    const pushByRole = (role: keyof RuleEffectsByRole, effect: AtomExpr): void => {
      typed[role].push(this.cloneAtomExpr(effect))
    }
    if (isRuleEffectsByRole(effects)) {
      for (const role of ['actions', 'risks', 'positions', 'orchestration', 'programs'] as const) {
        for (const effect of effects[role]) {
          pushByRole(this.resolveTypedRuleEffectRole(effect, role), effect)
        }
      }
      return typed
    }
    for (const effect of effects) {
      pushByRole(this.resolveLegacyRuleEffectRole(effect), effect)
    }
    return typed
  }

  /**
   * #1633：typed RuleEffectsByRole 输入下，每个 effect 仍按 registry bucket 重派 role。
   *   - 若所有 leaf 的 bucket 都唯一映射到某 role，使用 mapped role；
   *   - 否则保留输入 role（fail-open：未注册 / 混合 expr / 桶不明确的情形不动）。
   * 与 resolveLegacyRuleEffectRole 共享 `program.* / risk.* / position.*` 启发式。
   */
  private resolveTypedRuleEffectRole(
    effect: AtomExpr,
    fallbackRole: keyof RuleEffectsByRole,
  ): keyof RuleEffectsByRole {
    const mapped = this.resolveLegacyRuleEffectRole(effect)
    // resolveLegacyRuleEffectRole 默认回退 'actions'；只有当至少一个 leaf 命中
    // program/risk/position/orchestration 启发式时才信任结果，否则保留输入 role
    // 以避免把无明确 bucket 的 expr 强制改桶。
    const leaves = collectAtomLeaves(effect)
    const hasClassifiableLeaf = leaves.some((leaf) => {
      if (leaf.key.startsWith('program.')) return true
      const bucket = this.resolveAtomBucket(leaf.key)
      return bucket === 'risk' || bucket === 'positionConstraint' || bucket === 'orchestration' || bucket === 'action'
    })
    return hasClassifiableLeaf ? mapped : fallbackRole
  }

  private emptyRuleEffects(): RuleEffectsByRole {
    return {
      actions: [],
      risks: [],
      positions: [],
      orchestration: [],
      programs: [],
    } satisfies RuleEffectsByRole
  }

  private resolveLegacyRuleEffectRole(effect: AtomExpr): keyof RuleEffectsByRole {
    const leaves = collectAtomLeaves(effect)
    if (leaves.some(leaf => leaf.key.startsWith('program.'))) return 'programs'
    if (leaves.some(leaf => this.resolveAtomBucket(leaf.key) === 'risk' || leaf.key.startsWith('risk.'))) return 'risks'
    if (leaves.some(leaf => this.resolveAtomBucket(leaf.key) === 'positionConstraint' || leaf.key.startsWith('position.'))) return 'positions'
    if (leaves.some(leaf => this.resolveAtomBucket(leaf.key) === 'orchestration' || leaf.key.startsWith('orchestration.'))) return 'orchestration'
    return 'actions'
  }

  private resolveAtomBucket(key: string): string | undefined {
    return (ATOM_CONTRACT_REGISTRY as Record<string, { bucket?: string } | undefined>)[key]?.bucket
  }

  private cloneAtomExpr(effect: AtomExpr): AtomExpr {
    return structuredClone(effect) as AtomExpr
  }

  private computeAtomIdentityKey(entry: AtomLikeEntry): string {
    const key = entry.key ?? '__nokey__'
    const phase = entry.phase ?? '__nophase__'
    const paramsHash = this.stableParamsHash(entry.params)
    // openSlots signature 把"同 atom 不同 open slot"sibling 区分出去；
    // Issue #1383 Round 1 M6：含 slotKey + fieldPath，避免两条 sibling atom
    //   (例如 EMA20 / EMA60 各自 reference.period.entry.a / .b) 因 slotKey 同名
    //   被错合并。排序保证顺序无关。
    const slotSignatures = (entry.openSlots ?? [])
      .map((slot) => {
        const slotKey = slot.slotKey ?? ''
        const fieldPath = (slot as { fieldPath?: string }).fieldPath ?? ''
        return `${slotKey}@${fieldPath}`
      })
      .sort()
      .join(',')
    return `${key}|${phase}|${paramsHash}|${slotSignatures}`
  }
}
