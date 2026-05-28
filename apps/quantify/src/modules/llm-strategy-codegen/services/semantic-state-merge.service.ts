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
    return state
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
    return `${atom.key}|${this.stableParamsHash(cleaned)}|${atom.sideScope ?? ''}`
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
    const persistedEventSigs = this.collectEventClassLeafSigs(persisted.condition)
    const persistedHasSeq = this.hasSequenceNode(persisted.condition)
    if (persistedEventSigs.size === 0 && !persistedHasSeq) return derived

    const derivedEventSigs = this.collectEventClassLeafSigs(derived.condition)
    const derivedHasSeq = this.hasSequenceNode(derived.condition)

    const missingLeaves: Array<AtomExpr & { kind: 'atom' }> = []
    if (derivedEventSigs.size === 0) {
      for (const leaf of persistedEventSigs.values()) missingLeaves.push(leaf)
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
    if (riskOrder.length === 0) return afterShapePass
    return [...nonRiskRules, ...riskOrder.map(s => byRiskSig.get(s)!)]
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

  private mergeRuleEffectRole(
    persisted: ReadonlyArray<AtomExpr>,
    derived: ReadonlyArray<AtomExpr>,
  ): AtomExpr[] {
    if (derived.length === 0) return persisted.map(effect => this.cloneAtomExpr(effect))
    if (persisted.length === 0) return derived.map(effect => this.cloneAtomExpr(effect))

    const byShape = new Map<string, AtomExpr>()
    const order: string[] = []
    for (const effect of [...persisted, ...derived]) {
      const shape = this.stableParamsHash(effect as unknown as Record<string, unknown>)
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
