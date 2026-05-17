import { Injectable } from '@nestjs/common'
import type { StrategyRuleBasis } from '../types/strategy-logic-snapshot'
import type { SemanticCapability, SemanticExpression, SemanticExpressionOperand, SemanticExpressionOperator, SemanticOrchestrationNode, SemanticSlotState, SemanticState } from '../types/semantic-state'
import type { AtomExpr, SemanticRule, SemanticRulePhase, SemanticRuleSideScope } from '../types/atom-expr'
import { isEntryPredicateTriggerKey, isExitPredicateTriggerKey, isTimeframeGroupableTriggerKey } from '../atom-contracts/trigger-display-contract'
import { ATOM_CONTRACT_REGISTRY } from '../atom-contracts/atom-contract-registry'
import { CapabilityEvidenceIndex } from './capability-evidence-index.service'
import { SemanticAtomRegistryService } from './semantic-atom-registry.service'
import { SemanticExecutableSemanticsService } from './semantic-executable-semantics.service'
import {
  getLegacyEntry,
  hasExplicitLegacyDisplayRenderer,
  renderLegacyClarification,
  renderLegacyDisplay,
} from './legacy-presentation-data'
import { normalizeLegacyPositionSizing, validateSemanticPositionContract } from './strategy-semantic-contracts'
// Issue #1443：always-on runtime gate atom 集合——这类 atom 在 rule.condition 位置
//   表达「策略启动后始终激活」语义（runtime gate），是技术性运行时门控，对 user-facing
//   UI 无价值。新增 always-on atom 只需扩此集合。
const ALWAYS_ON_ATOM_KEYS: ReadonlySet<string> = new Set([
  'execution.on_start',
])

/**
 * Issue #1443 D 方案：通用 enum value → 人话标签内置表。
 *
 * enrichSummaryFromParamSlots 在渲染 kind=enum 类型 slot 时查此表；表内有则用 user
 * 可读标签，无则**跳过**（避免显示原始 enum value 如 'down'/'current_price'——技术化文案）。
 *
 * 设计原则：
 *   - 只覆盖**用户真关心**的常见 enum slot（如 direction/basis/side/orderType/mode）
 *   - 不覆盖技术性 enum（如 timing/occurrence/scope_kind/programKind 等——这些是运行时
 *     配置标签，用户没明确说，不应该自动渲染）
 *   - 表按 slotKey 索引；同名 slotKey 在不同 atom 共享含义（如所有 atom 的 direction
 *     都是 up/down，basis 都是 prev_close/entry_avg_price/current_price）
 *   - 新增 enum 文案只需扩此表（一处改动，所有 atom 受益）
 */
const PROJECTION_PARAM_VALUE_LABELS: Readonly<Record<string, Readonly<Record<string, { zh: string, en: string }>>>> = {
  direction: {
    up: { zh: '上涨', en: 'rises' },
    down: { zh: '下跌', en: 'falls' },
  },
  basis: {
    prev_close: { zh: '相对上一根收盘价', en: 'vs prev close' },
    entry_avg_price: { zh: '相对入场均价', en: 'vs entry avg' },
    current_price: { zh: '相对当前价', en: 'vs current price' },
  },
  side: {
    long: { zh: '做多', en: 'long' },
    short: { zh: '做空', en: 'short' },
    both: { zh: '双向', en: 'both' },
  },
  band: {
    upper: { zh: '上轨', en: 'upper band' },
    middle: { zh: '中轨', en: 'middle band' },
    lower: { zh: '下轨', en: 'lower band' },
  },
  orderType: {
    market: { zh: '市价', en: 'market' },
    limit: { zh: '限价', en: 'limit' },
  },
  confirmationMode: {
    touch: { zh: '触碰即触发', en: 'on touch' },
    breakout: { zh: '突破后触发', en: 'on breakout' },
    close: { zh: '收盘确认后触发', en: 'on close' },
  },
} as const

import { readFlatActions, readFlatRisks, readFlatTriggers } from '../types/semantic-state-flat-readers'

export interface SemanticConversationView {
  summary: string
  triggerSummary: string
  riskSummary: string
  positionSummary: string
  executionContext: {
    exchange: string | null
    symbol: string | null
    marketType: string | null
    timeframe: string | null
  }
  hasDeterministicSemantics: boolean
  recommendationSignals: {
    hasShortIntent: boolean
    hasLongIntent: boolean
    hasBidirectionalIntent: boolean
    hasGridIntent: boolean
  }
  inferredDefaults: {
    inferredKeys: Array<'risk.stopLossBasis' | 'risk.takeProfitBasis'>
    stopLossBasis: StrategyRuleBasis['kind'] | null
    takeProfitBasis: StrategyRuleBasis['kind'] | null
  }
}

export type SemanticDisplayBlockType = 'IF' | 'AND_AT_THEN' | 'OR_THEN' | 'EXECUTE' | 'ORCHESTRATION'

export interface SemanticDisplayGraphBaseItem {
  id: string
  text: string
}

export interface SemanticDisplayConditionItem extends SemanticDisplayGraphBaseItem {
  kind: 'condition'
}

export interface SemanticDisplayActionItem extends SemanticDisplayGraphBaseItem {
  kind: 'action'
}

export interface SemanticDisplayExecuteItem extends SemanticDisplayGraphBaseItem {
  kind: 'execute'
  key: string
  value?: string
}

export interface SemanticDisplayGateItem extends SemanticDisplayGraphBaseItem {
  kind: 'gate'
  publicName: string
}

export interface SemanticDisplayPortfolioRiskItem extends SemanticDisplayGraphBaseItem {
  kind: 'portfolioRisk'
  publicName: string
}

export interface SemanticDisplayProgramItem extends SemanticDisplayGraphBaseItem {
  kind: 'program'
  publicName: string
}

export type SemanticDisplayLogicGraphItem =
  | SemanticDisplayConditionItem
  | SemanticDisplayActionItem
  | SemanticDisplayExecuteItem
  | SemanticDisplayGateItem
  | SemanticDisplayPortfolioRiskItem
  | SemanticDisplayProgramItem

export interface SemanticDisplayLogicGraphBlock {
  type: SemanticDisplayBlockType
  items: SemanticDisplayLogicGraphItem[]
}

export interface SemanticDisplayLogicGraph {
  blocks: SemanticDisplayLogicGraphBlock[]
}

type SemanticDisplaySideScope = 'long' | 'short' | 'both'

const UNSAFE_DISPLAY_FALLBACK_PLACEHOLDER = '已识别条件，等待展示文案完善'
const INTERNAL_SEMANTIC_DISPLAY_KEY_PATTERN
  = /(?:^|[^\w.])(?:generic_boundary|[a-z]\w*(?:\.[a-z]\w*)+)(?=$|\W)/u

@Injectable()
export class SemanticStateProjectionService {
  constructor(
    // Issue #1403 子故障 A：注入 SemanticExecutableSemanticsService 用 registry-driven
    //   anyAtomFulfillsPhase(state, 'sizing') 替代旧 GRID_DOMAIN_ATOM_KEYS 字面量集合，
    //   与 codegen-conversation 服务共用同一判定。
    private readonly executableSemantics: SemanticExecutableSemanticsService = new SemanticExecutableSemanticsService(),
  ) {}

  buildConversationView(state: SemanticState): SemanticConversationView {
    const deterministicTriggers = this.filterDeterministicTriggers(readFlatTriggers(state))
    const deterministicRisk = this.filterDeterministicRisk(readFlatRisks(state))
    const deterministicActions = this.filterDeterministicActions(readFlatActions(state))
    const deterministicSignals = this.buildRecommendationSignals({
      actions: deterministicActions,
      triggers: deterministicTriggers,
      families: state.families,
    })
    const triggerSummary = this.buildTriggerSummary(deterministicTriggers, false)
    const actionSummary = this.buildActionSummary(deterministicActions, state)
    const riskSummary = this.buildRiskSummary(deterministicRisk)
    const positionSummary = this.buildPositionSummary(state.position, state.positionConstraint)
    const executionContext = this.buildExecutionContext(state.contextSlots)
    const inferredDefaults = this.buildInferredDefaults(deterministicRisk)
    // #1152 contract parity：orchestration locked 节点必须计入 deterministic 判定与 summary，
    // 否则纯 orchestration-only utterance（如纯账户回撤）会被视作"空状态"通过 projection_gate
    const lockedOrchestrationNodes = (state.orchestration ?? [])
      .filter(node => node.status === 'locked')
    // Issue #1391 后续：phase0.unsupported 是"部署期"门槛而非"识别期"——
    //   atom 已被 dispatcher 完整抽出（key + params），只是 runtime 暂不支持部署。
    //   summary 渲染层面仍应展示给用户"已识别"，避免类似 portfolioRisk.drawdown_block
    //   被静默吞掉、用户以为系统没识别。`hasDeterministicSemantics` 判定仍走严格 locked 集。
    const recognizedOrchestrationNodes = (state.orchestration ?? [])
      .filter(node =>
        node.status === 'locked'
        || (node.status === 'open'
          && node.openSlots.length > 0
          && node.openSlots.every(slot => slot.slotKey === 'orchestration.phase0.unsupported')),
      )
    const orchestrationSummary = this.buildOrchestrationSummary(recognizedOrchestrationNodes)
    const hasDeterministicSemantics = this.hasDeterministicSemantics({
      triggers: deterministicTriggers,
      actions: deterministicActions,
      risk: deterministicRisk,
      position: state.position,
      hasGridIntent: deterministicSignals.hasGridIntent,
      lockedOrchestrationCount: lockedOrchestrationNodes.length,
    })
    const summaryItems = [triggerSummary, actionSummary, riskSummary, positionSummary, orchestrationSummary]
      .filter(item => item.length > 0)

    // Issue #1395 — 优先消费 state.rules 表达式树渲染 summary，保留 sequence/AND/OR/NOT 语义；
    //   rules 为空时落回旧扁平桶渲染路径，不破坏既有 reader（向后兼容）。
    const rulesSummary = state.rules && state.rules.length > 0 ? this.buildRulesSummary(state.rules) : ''

    // Issue #1403 子故障 D 真根因（补丁）—— rules-first summary 不能完全替代桶维度摘要。
    //   `grid.range_rebalance` 在 positionConstraint 桶、`program.*_grid` 在 orchestration 桶，
    //   不会出现在 state.rules 表达式树（rules 仅承载条件 + effects，不承载 program 节点
    //   或 positionConstraint atom）。若 state.rules 非空（如止损 rule 被加入 rules），
    //   原实现整段抛弃 positionSummary + orchestrationSummary，导致 grid 信号从摘要里消失。
    //   通用解：rules 非空时仍**附加** positionSummary + orchestrationSummary 这两段桶专属内容，
    //   保证只能由桶状态承载的 atom（grid program / DCA schedule / pyramiding 等）不丢失。
    //   triggerSummary / actionSummary / riskSummary 与 rules.condition/effects 高度重叠，
    //   仍让位给 rulesSummary 避免双重渲染。
    const bucketOnlySummary = [positionSummary, orchestrationSummary].filter(item => item.length > 0)

    return {
      summary: rulesSummary.length > 0
        ? [rulesSummary, ...bucketOnlySummary].join('；')
        : (summaryItems.length > 0 ? summaryItems.join('；') : '已识别部分条件，但仍未完整。'),
      triggerSummary,
      riskSummary,
      positionSummary,
      executionContext,
      hasDeterministicSemantics,
      recommendationSignals: {
        hasShortIntent: deterministicSignals.hasShortIntent,
        hasLongIntent: deterministicSignals.hasLongIntent,
        hasBidirectionalIntent: deterministicSignals.hasBidirectionalIntent,
        hasGridIntent: deterministicSignals.hasGridIntent,
      },
      inferredDefaults,
    }
  }

  buildDisplayLogicGraph(state: SemanticState): SemanticDisplayLogicGraph {
    // Issue #1403 子故障 B — rules-first display graph 渲染。
    //   旧路径只读 state.trigger flat-lift（lift 出来的扁平桶可能含 LLM 幻觉参数，
    //   如 S2 输入「连续跌三根」却被 lift 成 `price.candle_pattern.minBars=15`），
    //   导致 UI 显示「连续实体形态（≥15 根）时双向开仓」与用户描述背离。
    //   state.rules 表达式树是 planner 输出的真源（sequence/AND/OR 语义完整），
    //   优先从 rules 渲染条件文本，flat 路径只在 rules 为空时兜底（向后兼容）。
    const rulesBlocks = this.buildDisplayRuleBlocksFromRules(state)
    const ruleBlocks: SemanticDisplayLogicGraphBlock[] = rulesBlocks.length > 0
      ? rulesBlocks
      : this.buildDisplayRuleBlocksFromFlatTriggers(state)

    const orchestrationBlock = this.buildDisplayOrchestrationBlock(state)

    return {
      blocks: [
        ...(orchestrationBlock ? [orchestrationBlock] : []),
        ...ruleBlocks,
        this.buildDisplayExecuteBlock(state),
      ],
    }
  }

  // Issue #1403 子故障 B + Issue #1443 升级：rules-first display graph。
  //   - 一条 rule → 一个独立 IF block（旧实现错用 AND_AT_THEN 连接多条独立 rule
  //     → UI 显示"IF / AND AT THEN / AND AT THEN"误导用户）
  //   - block.items 同时含 condition + action items（旧实现只 push condition →
  //     THEN 段空显示"等待策略规则补充"）
  //   - UI 层 always-on + action effects 噪音 rule 兜底过滤（防 merge 阶段 filter
  //     未生效或下游路径写入 state.rules 绕过 merge）
  //   - rules 为空 / 无 entry|exit rules → 返回 []，调用方走旧 flat 路径兜底
  private buildDisplayRuleBlocksFromRules(state: SemanticState): SemanticDisplayLogicGraphBlock[] {
    const rules = state.rules ?? []
    const eligible = rules
      .filter(r => r.phase === 'entry' || r.phase === 'exit')
      // Issue #1443 防御性兜底：过滤 always-on + action effects 噪音 rule
      //   （与 PlannerDispatcherMergeService.filterAlwaysOnActionNoiseRules 同规则）
      .filter(r => !this.isAlwaysOnActionNoiseRule(r))
    if (eligible.length === 0) return []

    const blocks: SemanticDisplayLogicGraphBlock[] = []
    for (const rule of eligible) {
      const conditionBody = this.renderAtomExpr(rule.condition)
      if (!conditionBody || conditionBody.length === 0) {
        console.warn(`[semantic-state-projection] skipped rule ${rule.id}: empty condition render`)
        continue
      }

      const actionSuffix = this.buildRuleActionSuffix(rule.phase, rule.sideScope)
      const conditionText = actionSuffix.length > 0 ? `${conditionBody}${actionSuffix}` : conditionBody

      // Issue #1443：渲染 rule.effects 作为 THEN action items（旧实现遗漏 → THEN 段空）
      const actionItems: SemanticDisplayActionItem[] = []
      let effectIndex = 0
      for (const eff of rule.effects ?? []) {
        const text = this.renderAtomExpr(eff)
        if (text && text.length > 0) {
          actionItems.push({
            kind: 'action',
            id: `action-rule-${rule.id}-${effectIndex}`,
            text,
          })
          effectIndex += 1
        }
      }

      blocks.push({
        // Issue #1443：每条 rule 独立 IF block；不再用 AND_AT_THEN 连接独立 rule
        //   （UI 层多条 rule 之间是"任一满足都触发"的 OR 语义，不是 AND）
        type: 'IF',
        items: [
          {
            kind: 'condition',
            id: `condition-rule-${rule.id}`,
            text: conditionText,
          },
          ...actionItems,
        ],
      })
    }
    return blocks
  }

  /**
   * Issue #1443：UI 层 always-on + action effects 噪音 rule 兜底过滤。
   *   与 PlannerDispatcherMergeService.filterAlwaysOnActionNoiseRules 同规则，
   *   防 merge 阶段 filter 未生效或下游写入绕过。
   */
  private isAlwaysOnActionNoiseRule(rule: SemanticRule): boolean {
    if (rule.condition.kind !== 'atom') return false
    if (!ALWAYS_ON_ATOM_KEYS.has(rule.condition.key)) return false
    type ContractShape = { bucket?: string }
    for (const eff of rule.effects ?? []) {
      const stack: AtomExpr[] = [eff]
      while (stack.length > 0) {
        const node = stack.pop()
        if (!node) continue
        if (node.kind === 'atom') {
          const bucket = (ATOM_CONTRACT_REGISTRY as Record<string, ContractShape | undefined>)[node.key]?.bucket
          if (bucket === 'action') return true
        }
        else if (node.kind === 'and' || node.kind === 'or') {
          stack.push(...node.children)
        }
        else if (node.kind === 'not') {
          stack.push(node.child)
        }
        else if (node.kind === 'sequence') {
          stack.push(...node.steps)
        }
      }
    }
    return false
  }

  // 审查 Minor 2 共享 side label：buildRuleActionSuffix（display graph）与
  //   formatRuleSideLabel（rules summary）共用同一份 sideScope 标签源，未来
  //   加新 side 只需改一处。
  private static readonly RULE_SIDE_OPEN_VERB: Record<SemanticRuleSideScope, string> = {
    long: '做多开仓',
    short: '做空开仓',
    both: '双向开仓',
  }

  private static readonly RULE_SIDE_CLOSE_VERB: Record<SemanticRuleSideScope, string> = {
    long: '平多',
    short: '平空',
    both: '双向平仓',
  }

  private buildRuleActionSuffix(
    phase: SemanticRulePhase,
    sideScope: SemanticRuleSideScope,
  ): string {
    if (phase === 'entry') {
      return ` 时${SemanticStateProjectionService.RULE_SIDE_OPEN_VERB[sideScope]}`
    }
    if (phase === 'exit') {
      return ` 时${SemanticStateProjectionService.RULE_SIDE_CLOSE_VERB[sideScope]}`
    }
    // 审查 m-R2-3：gate phase 当前不可达——buildDisplayRuleBlocksFromRules 在调用
    //   前已 filter(phase === 'entry' || 'exit')。若未来放开 gate rule 渲染（如展示
    //   BLOCK_NEW_ENTRY 规则），必须在此处显式实现 gate 语义后缀（如「时阻止开仓」）
    //   而非依赖空串 fallback——空串会让 conditionText = body + ''，UI 视觉正常但
    //   缺动作语义。当前 fallback 设计为故意 dead branch，下游回归保护。
    return ''
  }

  private buildDisplayRuleBlocksFromFlatTriggers(state: SemanticState): SemanticDisplayLogicGraphBlock[] {
    const triggers = this.filterDeterministicTriggers(readFlatTriggers(state))
    const actions = this.filterDeterministicActions(readFlatActions(state))
    const ruleGroups = this.groupDisplayRuleTriggers(
      triggers.filter(trigger => trigger.phase === 'entry' || trigger.phase === 'exit'),
    )
    const ruleBlocks: SemanticDisplayLogicGraphBlock[] = []
    for (const group of ruleGroups) {
      const block = this.buildDisplayRuleBlock({
        triggers: group,
        blockType: this.resolveDisplayRuleBlockType(group, ruleBlocks.length),
        gateText: group[0]?.phase === 'entry' && group[0] ? this.buildDisplayGateText(triggers, group[0]) : null,
        actions,
        position: state.position,
      })
      if (block) {
        ruleBlocks.push(block)
      }
    }
    return ruleBlocks
  }

  private buildDisplayOrchestrationBlock(state: SemanticState): SemanticDisplayLogicGraphBlock | null {
    const nodes = state.orchestration ?? []
    const items: SemanticDisplayLogicGraphItem[] = []
    for (const node of nodes) {
      if (node.status !== 'locked') {
        continue
      }
      // #1329 follow-up Phase 1-3: gate.regime 已迁入 ATOM_CONTRACT_REGISTRY.display
      // #1331 C2: summaryTemplate throw → continue（token 缺失 graceful skip，与旧 getLegacyEntry catch 等价；防 projection 端点 500）
      if (node.kind === 'gate' && node.key === 'gate.regime') {
        const registryEntry = ATOM_CONTRACT_REGISTRY['gate.regime']
        let text: string
        try {
          text = registryEntry.display.summaryTemplate(node.params, 'zh')
        }
        catch {
          continue
        }
        if (!text) {
          continue
        }
        items.push({
          kind: 'gate',
          id: `orchestration-gate-${node.id}`,
          publicName: registryEntry.display.publicName.zh,
          text,
        })
        continue
      }
      if (node.kind === 'portfolioRisk' && node.key === 'portfolioRisk.drawdown_block') {
        // #1329 follow-up Phase 3d: drawdown_block 已迁入 ATOM_CONTRACT_REGISTRY.display，走 REGISTRY-first 路径
        // #1331 C2: summaryTemplate throw → continue
        const registryEntry = ATOM_CONTRACT_REGISTRY['portfolioRisk.drawdown_block']
        let text: string
        try {
          text = registryEntry.display.summaryTemplate(node.params, 'zh')
        }
        catch {
          continue
        }
        if (!text) {
          continue
        }
        items.push({
          kind: 'portfolioRisk',
          id: `orchestration-portfolio-risk-${node.id}`,
          publicName: registryEntry.display.publicName.zh,
          text,
        })
        continue
      }
      // #1329 follow-up Phase 1-3：以下 6 个 orchestration atom 已迁入 ATOM_CONTRACT_REGISTRY.display
      //   portfolioRisk.{symbol,substrategy}_exposure_cap
      //   program.{fixed_grid_gated,dynamic_grid,adaptive_volatility_grid,event_listener}
      // #1329 follow-up Phase 3e: scope.subStrategy / gate.subStrategy 亦已迁入 ATOM_CONTRACT_REGISTRY.display
      // #1331 C2: summaryTemplate throw → continue（token 缺失 graceful skip）
      if (
        (node.kind === 'portfolioRisk' && (node.key === 'portfolioRisk.symbol_exposure_cap' || node.key === 'portfolioRisk.substrategy_exposure_cap'))
        || (node.kind === 'program' && (node.key === 'program.fixed_grid_gated' || node.key === 'program.dynamic_grid' || node.key === 'program.adaptive_volatility_grid' || node.key === 'program.event_listener'))
        || (node.kind === 'scope' && node.key === 'scope.subStrategy')
        || (node.kind === 'gate' && node.key === 'gate.subStrategy')
      ) {
        const registryEntry = ATOM_CONTRACT_REGISTRY[node.key]
        let text: string
        try {
          text = registryEntry.display.summaryTemplate(node.params, 'zh')
        }
        catch {
          continue
        }
        if (!text) {
          continue
        }
        // #1331 M4：scope.subStrategy 概念上等价于 gate.subStrategy（UI 渲染时归 gate，
        //   是 gate-level 限定符的 alias），映射到 SemanticDisplayGateItem 联合；
        //   id 也对齐 'orchestration-gate-*' 与 kind 'gate' 一致，避免 UI 端 group key 漂移。
        const itemKind = node.kind === 'scope' ? 'gate' : node.kind
        items.push({
          kind: itemKind,
          id: node.kind === 'portfolioRisk'
            ? `orchestration-portfolio-risk-${node.id}`
            : node.kind === 'program'
              ? `orchestration-program-${node.id}`
              : `orchestration-gate-${node.id}`,
          publicName: registryEntry.display.publicName.zh,
          text,
        })
        continue
      }
    }
    if (items.length === 0) {
      return null
    }
    return {
      type: 'ORCHESTRATION',
      items,
    }
  }

  buildClarificationView(state: SemanticState): {
    summary: string
    nextQuestion: string | null
  } {
    const triggerSummary = this.buildTriggerSummary(readFlatTriggers(state), true)
    const riskSummary = this.buildRiskSummary(readFlatRisks(state))
    // #1238：clarification 路径下"我当前理解的策略是"这条提示长期只渲染
    // trigger + risk，遗漏 position 段（含 sizing、dca_schedule / pyramiding_limit
    // 等 constraint 显示），导致用户给出 DCA / 加仓配置时即使 state.position.constraints
    // 里已 locked，UI 也不会回显，看起来像"DCA 没识别"（#1217 误判为 merge 层 bug，
    // 实际根因在此处 summary 渲染函数）。与 buildConversationView 对齐让 clarification
    // summary 也包含 position 段。
    // 未并入项 follow-up：
    //   - actionSummary / orchestrationSummary 与 buildTriggerSummary 的 deterministic
    //     过滤未与 conversation 路径完全对齐 → #1243（抽 shared summary helper）
    //   - position locked 时 nextQuestion 仍可能追问已被 summary 覆盖的 position open slot
    //     → #1244（dedupe nextQuestion vs summary）
    //   - buildPositionSummary 内 presentationRegistry try/catch 吞错变沉默失败 → #1245
    const positionSummary = this.buildPositionSummary(state.position, state.positionConstraint)
    const summaryItems = [triggerSummary, riskSummary, positionSummary].filter(item => item.length > 0)

    // Issue #1395 — clarification 视图同样优先消费 rules 树
    const rulesSummary = state.rules && state.rules.length > 0 ? this.buildRulesSummary(state.rules) : ''

    const nextSlot = this.findNextOpenSlot(state)

    return {
      summary: rulesSummary.length > 0
        ? rulesSummary
        : (summaryItems.length > 0 ? summaryItems.join('；') : '已识别部分条件，但仍未完整。'),
      nextQuestion: nextSlot?.questionHint ?? null,
    }
  }

  private buildDisplayRuleBlock(input: {
    triggers: SemanticState['trigger']
    blockType: SemanticDisplayBlockType
    gateText: string | null
    actions: SemanticState['action']
    position: SemanticState['position']
  }): SemanticDisplayLogicGraphBlock | null {
    const [firstTrigger] = input.triggers
    if (!firstTrigger) {
      return null
    }

    const conditionItems = this.shouldRenderDisplayGroupAsSingleCondition(input.triggers)
      ? [
          {
            kind: 'condition' as const,
            id: `condition-${firstTrigger.id}`,
            text: this.buildDisplayConditionText(firstTrigger, input.gateText, input.triggers),
          },
        ].filter((item): item is SemanticDisplayConditionItem => item.text.length > 0)
      : input.triggers
        .map((trigger, index): SemanticDisplayConditionItem | null => {
          const conditionText = this.buildDisplayConditionText(trigger, index === 0 ? input.gateText : null)
          if (!conditionText) {
            return null
          }

          return {
            kind: 'condition',
            id: `condition-${trigger.id}`,
            text: conditionText,
          }
        })
        .filter((item): item is SemanticDisplayConditionItem => Boolean(item))
    if (conditionItems.length === 0) {
      return null
    }

    return {
      type: input.blockType,
      items: [
        ...conditionItems,
        ...this.buildDisplayActionItems(firstTrigger, input.actions, input.position),
      ],
    }
  }

  private groupDisplayRuleTriggers(triggers: SemanticState['trigger']): SemanticState['trigger'][] {
    const groups: SemanticState['trigger'][] = []
    const consumedTriggerIds = new Set<string>()

    for (const trigger of triggers) {
      if (consumedTriggerIds.has(trigger.id)) {
        continue
      }

      const groupedTriggers = this.findGroupedDisplayTriggers(triggers, trigger)
      if (groupedTriggers.length > 1) {
        groupedTriggers.forEach(groupedTrigger => consumedTriggerIds.add(groupedTrigger.id))
        groups.push(groupedTriggers)
        continue
      }

      const previousGroup = groups.at(-1)
      const previousTrigger = previousGroup?.[0]
      if (
        previousGroup
        && previousTrigger
        && this.canMergeDisplayRuleTriggers(previousTrigger, trigger)
      ) {
        previousGroup.push(trigger)
        consumedTriggerIds.add(trigger.id)
        continue
      }

      consumedTriggerIds.add(trigger.id)
      groups.push([trigger])
    }

    return groups
  }

  private shouldRenderDisplayGroupAsSingleCondition(group: SemanticState['trigger']): boolean {
    if (group.length <= 1) return false
    if (group.every(trigger => this.isGroupableIndicatorCompareTrigger(trigger))) return true

    // marker-grouped 路径：所有 trigger 共享 displayGroupId/contract.groupId 时合并为单条
    const firstMarker = this.readDisplayRuleGroupMarker(group[0]!)
    if (firstMarker === null) return false
    const allShareMarker = group.every(trigger => this.readDisplayRuleGroupMarker(trigger) === firstMarker)
    if (!allShareMarker) return false

    // 原 timeframeGroupable 同 indicator/period fan-out 路径
    if (group.every(trigger => this.isGroupableIndicatorCompareTriggerByMarker(trigger))) return true

    // 新增异质 entryPredicate/exitPredicate marker 路径：所有成员都是 predicate 且共享 marker
    //   → 进入单 condition 渲染，下游 formatGroupedDisplayTriggerCondition 的异质 fallback
    //   负责将各 trigger 独立渲染后用"，且"拼接为单条文案
    // 防御性 phase 一致性守卫：当前 canMergeDisplayRuleTriggers 已保证 group 内 phase 一致，
    //   但 grouping 链路若未来变更，避免 entry+exit 误混入同 group 被当成 AND 单条渲染
    if (!group.every(trigger => trigger.phase === group[0]!.phase)) return false
    return group.every(trigger =>
      (trigger.phase === 'entry' && isEntryPredicateTriggerKey(trigger.key))
      || (trigger.phase === 'exit' && isExitPredicateTriggerKey(trigger.key)),
    )
  }

  private canMergeDisplayRuleTriggers(
    previous: SemanticState['trigger'][number],
    next: SemanticState['trigger'][number],
  ): boolean {
    if (
      previous.phase !== next.phase
      || (previous.phase !== 'entry' && previous.phase !== 'exit')
      /* eslint-disable atom-keys/no-atom-key-literal -- logical.any_of not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329) */
      || previous.key === 'logical.any_of'
      || next.key === 'logical.any_of'
      /* eslint-enable atom-keys/no-atom-key-literal */
      || (previous.sideScope ?? 'long') !== (next.sideScope ?? 'long')
    ) {
      return false
    }

    return this.shareDisplayRuleGroupMarker(previous, next)
      || this.isKnownAtomicEntryCombination(previous, next)
  }

  private resolveDisplayRuleBlockType(
    group: SemanticState['trigger'],
    index: number,
  ): SemanticDisplayBlockType {
    if (index === 0) {
      return 'IF'
    }
    // eslint-disable-next-line atom-keys/no-atom-key-literal -- logical.any_of not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329)
    if (group.some(trigger => trigger.key === 'logical.any_of')) {
      return 'OR_THEN'
    }
    return 'AND_AT_THEN'
  }

  private shareDisplayRuleGroupMarker(
    previous: SemanticState['trigger'][number],
    next: SemanticState['trigger'][number],
  ): boolean {
    const previousMarker = this.readDisplayRuleGroupMarker(previous)
    const nextMarker = this.readDisplayRuleGroupMarker(next)
    return previousMarker !== null && previousMarker === nextMarker
  }

  private readDisplayRuleGroupMarker(trigger: SemanticState['trigger'][number]): string | null {
    const markerKeys = [
      'displayGroupId',
      'groupId',
      'logicalGroupId',
      'logicalParentId',
      'parentTriggerId',
      'combinationId',
      'comboId',
    ]
    for (const key of markerKeys) {
      const value = this.readString(trigger.params[key])
      if (value) {
        return `${key}:${value}`
      }
    }

    const contracts = trigger.contracts ?? []
    for (const contract of contracts) {
      const marker = this.readString(contract.params.displayGroupId)
        ?? this.readString(contract.params.groupId)
        ?? this.readString(contract.params.combinationId)
      if (marker) {
        return `contract:${marker}`
      }
    }

    return null
  }

  private isKnownAtomicEntryCombination(
    previous: SemanticState['trigger'][number],
    next: SemanticState['trigger'][number],
  ): boolean {
    const keys = new Set([previous.key, next.key])
    return keys.has('price.detect.indicator_boundary')
      && keys.has('volume.relative_average')
      && (
        this.isBollingerBoundaryTrigger(previous)
        || this.isBollingerBoundaryTrigger(next)
      )
  }

  private isBollingerBoundaryTrigger(trigger: SemanticState['trigger'][number]): boolean {
    return trigger.key === ATOM_CONTRACT_REGISTRY['price.detect.indicator_boundary'].key
      && this.readIndicatorBoundaryIndicator(trigger.params)?.name === 'bollinger'
  }

  private buildDisplayConditionText(
    trigger: SemanticState['trigger'][number],
    gateText: string | null,
    groupedTriggers?: Array<SemanticState['trigger'][number]>,
  ): string {
    const conditionText = groupedTriggers && groupedTriggers.length > 1
      ? this.formatGroupedDisplayTriggerCondition(trigger, groupedTriggers)
      // eslint-disable-next-line atom-keys/no-atom-key-literal -- condition.expression not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329)
      : trigger.key === 'condition.expression'
      ? this.formatSemanticExpression(trigger.params.expression)
      : this.formatDisplayTriggerCondition(trigger)
    if (!conditionText) {
      return ''
    }

    return gateText ? `${conditionText}，且${gateText}` : conditionText
  }

  private formatDisplayTriggerCondition(trigger: SemanticState['trigger'][number]): string {
    const atomicCondition = this.formatDisplayAtomicTriggerCondition(trigger)
    if (atomicCondition) {
      return atomicCondition
    }

    const summary = this.buildTriggerSummary([trigger], true)
    return this.sanitizeDisplayFallbackText(summary)
      .replace(/^(入场|出场|条件)：/u, '')
      .replace(/时(?:做多开仓|做空开仓|双向开仓|买入|平多|平空|双向平仓|卖出平仓)$/u, '')
      .trim()
  }

  private formatDisplayAtomicTriggerCondition(trigger: SemanticState['trigger'][number]): string {
    // Issue #1179：只有显式声明 displayRenderer 的 atom 才被视为有"条件文案"。
    //   默认 fallback（publicName via atom.${key}.name token）不构成条件 inline，调用方应走
    //   sanitizeDisplayFallbackText / placeholder 路径，否则 UI 会看到"指标高于阈值"这类
    //   名称误用作条件文本。
    if (!hasExplicitLegacyDisplayRenderer(trigger.key)) {
      return ''
    }
    try {
      return renderLegacyDisplay(trigger.key, trigger.params) ?? ''
    }
    catch {
      return ''
    }
  }

  private formatDisplayIndicatorBoundaryCondition(trigger: SemanticState['trigger'][number]): string {
    const indicator = this.readIndicatorBoundaryIndicator(trigger.params)
    const boundaryRole = this.readBoundaryRole(trigger.params.boundaryRole)
    if (!indicator || !boundaryRole) {
      return ''
    }

    return renderLegacyDisplay('price.detect.indicator_boundary', {
      indicator,
      boundaryRole,
      confirmationMode: trigger.params.confirmationMode,
    })
  }

  private sanitizeDisplayFallbackText(text: string): string {
    if (INTERNAL_SEMANTIC_DISPLAY_KEY_PATTERN.test(text)) {
      return UNSAFE_DISPLAY_FALLBACK_PLACEHOLDER
    }
    return text
  }

  private formatDisplayRelativeVolumeCondition(trigger: SemanticState['trigger'][number]): string {
    const lookbackBars = this.readFiniteNumber(trigger.params.lookbackBars)
    const multiplier = this.readFiniteNumber(trigger.params.multiplier)
    if (lookbackBars === null || multiplier === null) {
      const event = this.readString(trigger.params.event)
      return event === 'spike' ? '成交量放大' : ''
    }

    const comparator = this.readString(trigger.params.comparator)
    const direction = comparator === 'lt' || comparator === 'lte' ? '低于' : '高于'
    const inclusive = comparator === 'gte' || comparator === 'lte' ? '或等于' : ''
    return `成交量${direction}${inclusive}过去 ${this.formatNumber(lookbackBars)} 根均量的 ${this.formatNumber(multiplier)} 倍`
  }

  private formatDisplayReboundConfirmationCondition(trigger: SemanticState['trigger'][number]): string {
    const definition = this.readString(trigger.params.definition)
    if (definition) {
      return `反弹确认（${definition}）`
    }

    const windowBars = this.readFiniteNumber(trigger.params.windowBars) ?? this.readFiniteNumber(trigger.params.nextBars)
    if (windowBars !== null) {
      return `${this.formatNumber(windowBars)} 根 K 线内反弹确认`
    }

    return '反弹确认'
  }

  private formatDisplaySequenceCondition(trigger: SemanticState['trigger'][number]): string {
    const sequenceKind = this.readString(trigger.params.sequenceKind)
    if (!sequenceKind) {
      return ''
    }

    const windowText = this.formatDisplaySequenceWindow(trigger.params)
    const memoryKey = this.readString(trigger.params.memoryKey)
    const memoryText = memoryKey ? `，记录位 ${memoryKey}` : ''
    if (sequenceKind === 'breakout_retest') {
      return `突破后回踩确认${windowText}${memoryText}`
    }
    if (sequenceKind === 'pullback_reclaim') {
      return `回踩${this.formatDisplaySequenceReference(trigger.params)}后重新站上${windowText}${memoryText}`
    }
    if (sequenceKind === 'rsi_reclaim') {
      const threshold = this.readFiniteNumber(trigger.params.threshold)
      return `RSI 回落后重新站上${threshold === null ? '阈值' : ` ${this.formatNumber(threshold)}`}${windowText}${memoryText}`
    }
    if (sequenceKind === 'consecutive_candles') {
      const count = this.readFiniteNumber(trigger.params.count)
      const direction = this.readString(trigger.params.direction) === 'down' ? '收跌' : '收涨'
      return `连续 ${count === null ? '多' : this.formatNumber(count)} 根 K 线${direction}${windowText}${memoryText}`
    }

    return `序列条件 ${sequenceKind}${windowText}${memoryText}`
  }

  private formatDisplayRollingExtremaBreakoutCondition(trigger: SemanticState['trigger'][number]): string {
    const extrema = this.readString(trigger.params.extrema) === 'low' ? 'low' : 'high'
    const lookbackBars = this.readFiniteNumber(trigger.params.lookbackBars)
    const lookbackText = lookbackBars === null
      ? '过去若干根 K 线'
      : `过去 ${this.formatNumber(lookbackBars)} 根 K 线`
    const timeframe = this.readString(trigger.params.timeframe)
    const prefix = timeframe ? `${timeframe} ` : ''
    return extrema === 'low'
      ? `${prefix}跌破${lookbackText}最低价`
      : `${prefix}突破${lookbackText}最高价`
  }

  private formatDisplayLogicalAnyOfCondition(trigger: SemanticState['trigger'][number]): string {
    const items = Array.isArray(trigger.params.items) ? trigger.params.items : []
    const childTexts = items
      .map((item, index) => this.formatDisplayLogicalAnyOfItem(trigger, item, index))
      .filter(text => text.length > 0)

    return childTexts.length > 0 ? `任一条件：${childTexts.join(' 或 ')}` : ''
  }

  private formatDisplayLogicalAnyOfItem(
    parentTrigger: SemanticState['trigger'][number],
    item: unknown,
    index: number,
  ): string {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return ''
    }
    const record = item as Record<string, unknown>
    const key = this.readString(record.key)
    // eslint-disable-next-line atom-keys/no-atom-key-literal -- logical.any_of not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329)
    if (!key || key === 'logical.any_of') {
      return ''
    }

    const params = record.params && typeof record.params === 'object' && !Array.isArray(record.params)
      ? record.params as Record<string, unknown>
      : {}
    return this.formatDisplayTriggerCondition({
      ...parentTrigger,
      id: `${parentTrigger.id}-any-of-${index}`,
      key,
      params,
    })
  }

  private formatDisplaySequenceWindow(params: Record<string, unknown>): string {
    const lookbackWindow = this.readString(params.lookbackWindow)
    if (lookbackWindow) {
      return `（${lookbackWindow} 内）`
    }

    const lookbackBars = this.readFiniteNumber(params.lookbackBars)
    return lookbackBars === null ? '' : `（${this.formatNumber(lookbackBars)} 根 K 线内）`
  }

  private formatDisplaySequenceReference(params: Record<string, unknown>): string {
    const reference = params.reference
    if (!reference || typeof reference !== 'object' || Array.isArray(reference)) {
      return '关键位'
    }

    const record = reference as Record<string, unknown>
    const indicator = this.readString(record.indicator)
    const period = this.readFiniteNumber(record.period)
    if (indicator) {
      return `${indicator.toUpperCase()}${period === null ? '' : this.formatNumber(period)}`
    }

    return '关键位'
  }

  private buildDisplayGateText(
    triggers: SemanticState['trigger'],
    entryTrigger: SemanticState['trigger'][number],
  ): string | null {
    // 入场卡片本身已经渲染 EMA stack 语义时（marker-grouped indicator.above/below），
    //   不再追加同 sideScope 的 condition.expression gate 文本，避免重复表达
    const entrySuppressesIndicatorGate = this.isGroupableIndicatorCompareTriggerByMarker(entryTrigger)
      && this.readDisplayRuleGroupMarker(entryTrigger) !== null

    const gateTexts = triggers
      .filter(trigger => trigger.phase === 'gate')
      .filter(trigger => this.isDisplayGateCompatibleWithEntry(entryTrigger, trigger))
      .filter(trigger => !(
        entrySuppressesIndicatorGate
        // eslint-disable-next-line atom-keys/no-atom-key-literal -- condition.expression not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329)
        && trigger.key === 'condition.expression'
        && (trigger.sideScope ?? '') === (entryTrigger.sideScope ?? '')
      ))
      .map(trigger => this.buildDisplayConditionText(trigger, null))
      .filter(text => text.length > 0)
    return gateTexts.length > 0 ? gateTexts.join('，且') : null
  }

  private findGroupedDisplayTriggers(
    triggers: SemanticState['trigger'],
    trigger: SemanticState['trigger'][number],
  ): Array<SemanticState['trigger'][number]> {
    const triggerMarker = this.readDisplayRuleGroupMarker(trigger)
    const isMarkerEligible = triggerMarker !== null
      && this.isGroupableIndicatorCompareTriggerByMarker(trigger)

    if (!this.isGroupableIndicatorCompareTrigger(trigger) && !isMarkerEligible) {
      return [trigger]
    }

    // M1 (PR #1147 review)：避免对每个 candidate 重复解析 displayGroupId / contract.groupId，
    //   将 marker 缓存到 Map，将 O(N²) marker 读取降为 O(N)。
    const markerCache = new Map<SemanticState['trigger'][number], string | null>()
    const readMarker = (candidate: SemanticState['trigger'][number]): string | null => {
      const cached = markerCache.get(candidate)
      if (cached !== undefined) return cached
      const resolved = this.readDisplayRuleGroupMarker(candidate)
      markerCache.set(candidate, resolved)
      return resolved
    }

    // 多 EMA AND 合取 (#NLU-fix)：同一 displayGroupId/contract.groupId 标记的 indicator.above/below
    //   triggers 即使 reference.period 不同（或缺失 per-trigger timeframe）也应合并为单卡片
    return triggers.filter(candidate =>
      candidate.id === trigger.id
      || (
        candidate.phase === trigger.phase
        && candidate.key === trigger.key
        && (candidate.sideScope ?? '') === (trigger.sideScope ?? '')
        && String(candidate.params.indicator ?? 'ma').toLowerCase() === String(trigger.params.indicator ?? 'ma').toLowerCase()
        && (
          (
            this.isGroupableIndicatorCompareTrigger(candidate)
            && this.isGroupableIndicatorCompareTrigger(trigger)
            && candidate.params['reference.period'] === trigger.params['reference.period']
          )
          || (
            triggerMarker !== null
            && readMarker(candidate) === triggerMarker
            && this.isGroupableIndicatorCompareTriggerByMarker(candidate)
            // M3 (PR #1147 review)：marker 分支合并前增加 timeframe 一致性守卫——
            //   两侧均缺失视为一致（marker 已隐含同分组）；任一存在则必须相等，
            //   避免同 marker 下不同 timeframe 被错误并入同一卡片抹掉差异。
            && (this.readString(candidate.params.timeframe) ?? '')
              === (this.readString(trigger.params.timeframe) ?? '')
          )
        )
      ),
    )
  }

  // marker-grouping 路径下的最小条件校验：
  //   key 为 timeframeGroupable（indicator.above/below）或其他 entryPredicate/exitPredicate（异质 AND marker 组合）
  //   phase 必须为 entry/exit；不要求 reference.period（marker 已隐含同分组语义）
  //   注：此函数在 findGroupedDisplayTriggers 与 shouldRenderDisplayGroupAsSingleCondition 中
  //       均用于"判断能否参与 indicator compare marker 合并渲染"，只有 timeframeGroupable key
  //       才走 formatGroupedIndicatorCompareCondition；其余异质组合由 canMergeDisplayRuleTriggers
  //       + shouldRenderDisplayGroupAsSingleCondition 联合判定
  private isGroupableIndicatorCompareTriggerByMarker(
    trigger: SemanticState['trigger'][number],
  ): boolean {
    return isTimeframeGroupableTriggerKey(trigger.key)
      && (trigger.phase === 'entry' || trigger.phase === 'exit')
  }

  private formatGroupedDisplayTriggerCondition(
    trigger: SemanticState['trigger'][number],
    groupedTriggers: Array<SemanticState['trigger'][number]>,
  ): string {
    // 同类 indicator.above/below 合并渲染（如"15m/30m MA20 上方"）
    const grouped = this.formatGroupedIndicatorCompareCondition(groupedTriggers)
    if (grouped) {
      return grouped
    }
    // 异质 key 组合（如 indicator.cross_over + indicator.below）：
    //   各 trigger 独立渲染后用"，且"连接，产生完整 AND 条件文本
    if (groupedTriggers.length > 1) {
      const parts = groupedTriggers
        .map(t => this.formatDisplayTriggerCondition(t))
        .filter(text => text.length > 0)
      if (parts.length > 1) {
        return parts.join('，且')
      }
    }
    return this.formatDisplayTriggerCondition(trigger)
  }

  private isDisplayGateCompatibleWithEntry(
    entryTrigger: SemanticState['trigger'][number],
    gateTrigger: SemanticState['trigger'][number],
  ): boolean {
    const gateSide = this.resolveDisplayGateSideScope(gateTrigger)
    if (!gateSide || gateSide === 'both') {
      return true
    }

    if (entryTrigger.sideScope === 'both') {
      return true
    }

    const entrySide = entryTrigger.sideScope ?? 'long'
    return entrySide === gateSide
  }

  private resolveDisplayGateSideScope(
    gateTrigger: SemanticState['trigger'][number],
  ): SemanticDisplaySideScope | null {
    if (gateTrigger.sideScope) {
      return gateTrigger.sideScope
    }

    const expression = gateTrigger.params.expression
    if (!this.isSemanticExpression(expression)) {
      return null
    }

    const sides = this.collectDisplayExpressionPositionSides(expression)
    if (sides.has('both') || (sides.has('long') && sides.has('short'))) {
      return 'both'
    }
    if (sides.has('short')) {
      return 'short'
    }
    if (sides.has('long')) {
      return 'long'
    }
    return null
  }

  private collectDisplayExpressionPositionSides(expression: SemanticExpression): Set<SemanticDisplaySideScope> {
    const sides = new Set<SemanticDisplaySideScope>()
    if (expression.kind === 'predicate') {
      this.addDisplayOperandPositionSide(sides, expression.left)
      this.addDisplayOperandPositionSide(sides, expression.right)
      return sides
    }

    expression.children.forEach((child) => {
      this.collectDisplayExpressionPositionSides(child).forEach(side => sides.add(side))
    })
    return sides
  }

  private addDisplayOperandPositionSide(
    sides: Set<SemanticDisplaySideScope>,
    operand: SemanticExpressionOperand,
  ): void {
    if (operand.kind === 'position' && operand.field === 'has_position' && operand.side) {
      sides.add(operand.side)
    }
  }

  private buildDisplayActionItems(
    trigger: SemanticState['trigger'][number],
    actions: SemanticState['action'],
    position: SemanticState['position'],
  ): SemanticDisplayActionItem[] {
    const actionKey = this.pickDisplayActionKey(trigger, actions)
    if (!actionKey) {
      return []
    }

    const text = this.formatDisplayActionText(actionKey, position)
    return text
      ? [{
          kind: 'action',
          id: `action-${trigger.id}-${actionKey}`,
          text,
        }]
      : []
  }

  private pickDisplayActionKey(
    trigger: SemanticState['trigger'][number],
    actions: SemanticState['action'],
  ): string | null {
    const hasAction = (key: string) => actions.some(action => action.key === key)
    const pickFirstExisting = (keys: string[]): string | null => keys.find(hasAction) ?? null

    if (trigger.phase === 'entry') {
      if (trigger.sideScope === 'short') return hasAction('open_short') ? 'open_short' : null
      if (trigger.sideScope === 'both') return pickFirstExisting(['open_long', 'open_short']) ? 'open_both' : null
      return hasAction('open_long') ? 'open_long' : null
    }

    if (trigger.phase === 'exit') {
      if (trigger.sideScope === 'short') return pickFirstExisting(['close_short', 'reduce_short'])
      if (trigger.sideScope === 'both') return pickFirstExisting(['close_long', 'close_short', 'reduce_long', 'reduce_short']) ? 'close_both' : null
      return pickFirstExisting(['close_long', 'reduce_long'])
    }

    return null
  }

  private formatDisplayActionText(
    actionKey: string,
    position: SemanticState['position'],
  ): string {
    const sizingText = this.buildDisplayPositionSizingValue(position)

    if (actionKey === 'open_long') return sizingText ? `开多 ${sizingText}` : '开多'
    if (actionKey === 'open_short') return sizingText ? `开空 ${sizingText}` : '开空'
    if (actionKey === 'open_both') return sizingText ? `开仓 ${sizingText}` : '开仓'
    if (actionKey === 'close_long' || actionKey === 'reduce_long') return '平多'
    if (actionKey === 'close_short' || actionKey === 'reduce_short') return '平空'
    if (actionKey === 'close_both') return '平仓'
    return ''
  }

  private buildDisplayExecuteBlock(state: SemanticState): SemanticDisplayLogicGraphBlock {
    const executionContext = this.buildExecutionContext(state.contextSlots)
    const positionSizing = this.buildDisplayPositionSizingValue(state.position)
    const marketType = this.formatDisplayMarketType(executionContext.marketType)
    const riskTexts = this.buildRiskSummary(this.filterDeterministicRisk(readFlatRisks(state)))
      .split('；')
      .filter(text => text.length > 0)
    const items: SemanticDisplayExecuteItem[] = []

    if (executionContext.exchange) {
      items.push({
        kind: 'execute',
        id: 'execute-exchange',
        key: 'exchange',
        value: executionContext.exchange,
        text: `交易所: ${executionContext.exchange.toUpperCase()}`,
      })
    }

    if (executionContext.symbol) {
      items.push({
        kind: 'execute',
        id: 'execute-symbol',
        key: 'symbol',
        value: executionContext.symbol,
        text: `标的: ${executionContext.symbol}`,
      })
    }

    if (executionContext.timeframe) {
      items.push({
        kind: 'execute',
        id: 'execute-timeframe',
        key: 'timeframe',
        value: executionContext.timeframe,
        text: `周期: ${executionContext.timeframe}`,
      })
    }

    if (positionSizing) {
      items.push({
        kind: 'execute',
        id: 'execute-position',
        key: 'positionSizing',
        value: positionSizing,
        text: `仓位: ${positionSizing}`,
      })
    }

    if (marketType) {
      items.push({
        kind: 'execute',
        id: 'execute-market-type',
        key: 'marketType',
        value: marketType,
        text: `市场: ${marketType}`,
      })
    }

    riskTexts.forEach((riskText, index) => {
      const text = `风控: ${riskText} -> 平仓`
      items.push({
        kind: 'execute',
        id: `execute-risk-${index}`,
        key: 'risk',
        value: riskText,
        text,
      })
    })

    return {
      type: 'EXECUTE',
      items,
    }
  }

  private buildDisplayPositionSizingValue(position: SemanticState['position']): string | null {
    const summary = this.buildPositionSummary(position)
    return summary ? summary.replace(/^仓位：/u, '') : null
  }

  private formatDisplayMarketType(marketType: string | null): string | null {
    if (!marketType) {
      return null
    }

    const normalized = marketType.toLowerCase()
    if (normalized === 'perp' || normalized === 'perpetual' || normalized === 'swap') {
      return '永续'
    }
    if (normalized === 'spot') {
      return '现货'
    }
    if (normalized === 'futures' || normalized === 'future') {
      return '交割'
    }
    return marketType
  }

  private buildExecutionContext(slots: {
    exchange: SemanticSlotState | null
    symbol: SemanticSlotState | null
    marketType: SemanticSlotState | null
    timeframe: SemanticSlotState | null
  }): {
    exchange: string | null
    symbol: string | null
    marketType: string | null
    timeframe: string | null
  } {
    return {
      exchange: this.readExecutionContextValue(slots.exchange),
      symbol: this.readExecutionContextValue(slots.symbol),
      marketType: this.readExecutionContextValue(slots.marketType),
      timeframe: this.readExecutionContextValue(slots.timeframe),
    }
  }

  private readExecutionContextValue(slot: SemanticSlotState | null): string | null {
    if (!slot || slot.status !== 'locked') {
      return null
    }

    const value = typeof slot.value === 'string' ? slot.value.trim() : ''
    return value ? value : null
  }

  // 注：以下 trigger.key 字面比较均为"文案分支"——能力判定已在 isXxxTriggerKey 上游 registry 守门，
  //   此处用 key 选择中文措辞（"上穿"/"下穿"/"上方"/"低于"等），属于展示层渲染逻辑，非能力白名单。
  private buildTriggerSummary(triggers: SemanticState['trigger'], includeSuperseded: boolean): string {
    const sourceTriggers = includeSuperseded
      ? [...triggers]
      : triggers.filter(trigger => trigger.status === 'locked')
    const orderedTriggers = sourceTriggers.sort((left, right) => this.compareTriggers(left, right))
    const groupedIndicatorCompareSummaries = this.buildGroupedIndicatorCompareSummaries(orderedTriggers)
    const groupedAtomicSummaries = this.buildGroupedAtomicTriggerSummaries(orderedTriggers)
    // Issue #1222：按 contract.params.groupId 折叠同 (phase, sideScope) 下 ≥2 个 trigger
    //   为单行「A 且 B 且 C 时做多开仓」（连词由 contract.params.join 决定）。
    //   仅作用于尚未被 marker grouping / atomic grouping 接管的桶。
    const contractGroupFoldedSummaries = this.buildContractGroupFoldedSummaries(
      orderedTriggers,
      groupedIndicatorCompareSummaries,
      groupedAtomicSummaries,
    )

    const rendered = orderedTriggers
      .map((trigger) => {
        const folded = contractGroupFoldedSummaries.get(trigger.id)
        if (folded !== undefined) {
          return folded
        }

        const groupedAtomicSummary = groupedAtomicSummaries.get(trigger.id)
        if (groupedAtomicSummary !== undefined) {
          return groupedAtomicSummary
        }

        const groupedSummary = groupedIndicatorCompareSummaries.get(trigger.id)
        if (groupedSummary !== undefined) {
          return groupedSummary
        }

        if (trigger.key === ATOM_CONTRACT_REGISTRY['grid.range_rebalance'].key) {
          const lower = this.readGridRangeValue(trigger.params, 'lower')
          const upper = this.readGridRangeValue(trigger.params, 'upper')
          const stepPct = trigger.params.stepPct
          const contractSummary = this.buildContractLevelSetSummary(trigger)
          if (contractSummary) {
            return contractSummary
          }

          return [
            '入场：区间网格',
            typeof lower === 'number' && typeof upper === 'number' ? `${lower}-${upper}` : '区间待补充',
            typeof stepPct === 'number' ? `步长 ${this.formatPercent(stepPct)}%` : '步长待补充',
          ].join(' ')
        }

        if (trigger.key === ATOM_CONTRACT_REGISTRY['execution.on_start'].key) {
          return trigger.phase === 'entry'
            ? '入场：立即开始时市价执行一次'
            : '出场：立即开始时市价执行一次'
        }

        // eslint-disable-next-line atom-keys/no-atom-key-literal -- condition.expression not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329)
        if (trigger.key === 'condition.expression') {
          const condition = this.formatSemanticExpression(trigger.params.expression)
          if (!condition) return ''
          const phase = trigger.phase === 'entry'
            ? '入场'
            : trigger.phase === 'exit'
              ? '出场'
              : '条件'
          return `${phase}：${condition}${this.formatActionSuffix(trigger, condition)}`
        }

        if (trigger.key === ATOM_CONTRACT_REGISTRY['price.percent_change'].key) {
          const basis = typeof trigger.params.basis === 'string' ? trigger.params.basis : 'prev_close'
          const basisLabel = basis === 'entry_avg_price' || basis === 'position_pnl'
            ? '开仓均价'
            : '前收盘'
          const direction = typeof trigger.params.valuePct === 'number' && trigger.params.valuePct > 0 ? '上涨' : '下跌'
          const pctText = typeof trigger.params.valuePct === 'number' ? `${this.formatPercent(Math.abs(trigger.params.valuePct))}%` : '阈值待补充'
          return `${trigger.phase === 'entry' ? '入场' : '出场'}：价格相对${basisLabel}${direction}${pctText}`
        }

        if (trigger.key === ATOM_CONTRACT_REGISTRY['indicator.above'].key && trigger.params['reference.period']) {
          return this.formatIndicatorCompareTriggerSummary(trigger)
        }

        if (trigger.key === ATOM_CONTRACT_REGISTRY['indicator.below'].key && trigger.params['reference.period']) {
          return this.formatIndicatorCompareTriggerSummary(trigger)
        }

        if (trigger.key === ATOM_CONTRACT_REGISTRY['price.range_position_lte'].key || trigger.key === ATOM_CONTRACT_REGISTRY['price.range_position_gte'].key) {
          const lookbackBars = typeof trigger.params.lookbackBars === 'number' ? trigger.params.lookbackBars : null
          const thresholdPct = typeof trigger.params.thresholdPct === 'number' ? trigger.params.thresholdPct : null
          const side = trigger.key === ATOM_CONTRACT_REGISTRY['price.range_position_lte'].key ? '下' : '上'
          const phase = trigger.phase === 'entry' ? '入场' : '出场'
          const rangeText = lookbackBars === null ? '最近区间' : `最近 ${lookbackBars} 根 K 线区间`
          const thresholdText = thresholdPct === null ? '阈值待补充' : `${this.formatPercent(thresholdPct)}%`
          const condition = `价格位于${rangeText}${side} ${thresholdText}`
          return `${phase}：${condition}${this.formatActionSuffix(trigger, condition)}`
        }

        if (trigger.key === ATOM_CONTRACT_REGISTRY['price.breakout_up'].key || trigger.key === ATOM_CONTRACT_REGISTRY['price.breakout_down'].key) {
          const period = typeof trigger.params.period === 'number' ? trigger.params.period : null
          const bufferPct = typeof trigger.params.bufferPct === 'number' ? trigger.params.bufferPct : null
          const phase = trigger.phase === 'entry' ? '入场' : '出场'
          const direction = trigger.key === ATOM_CONTRACT_REGISTRY['price.breakout_up'].key ? '突破' : '跌回'
          const target = trigger.key === ATOM_CONTRACT_REGISTRY['price.breakout_up'].key ? '高点' : '低点'
          const periodText = period === null ? `近期${target}` : `最近 ${period} 根 K 线${target}`
          const bufferText = bufferPct === null ? '' : `，突破缓冲 ${this.formatNumber(bufferPct)}%`
          const condition = `价格${direction}${periodText}${bufferText}`
          return `${phase}：${condition}${this.formatActionSuffix(trigger, condition)}`
        }

        // price.detect.indicator_boundary 在 conversation summary 视图保留长描述形态
        //   （"触及布林带 X 周期 Y 倍标准差<band>"），与 clarification view / display graph 走
        //   presentationRegistry 的 "触及 BOLL <band>（X, Y）" 短形态并存——两路文案承载不同 UI 上下文
        if (trigger.key === ATOM_CONTRACT_REGISTRY['price.detect.indicator_boundary'].key) {
          return this.formatIndicatorBoundaryTriggerSummary(trigger)
        }

        const atomicCondition = this.formatDisplayAtomicTriggerCondition(trigger)
        if (atomicCondition) {
          const phase = trigger.phase === 'entry'
            ? '入场'
            : trigger.phase === 'exit'
              ? '出场'
              : '条件'
          return `${phase}：${atomicCondition}${this.formatActionSuffix(trigger, atomicCondition)}`
        }

        // 兜底：返回内部 key，让上游 sanitizeDisplayFallbackText 检测到内部 key 泄漏
        //   并替换为 UNSAFE_DISPLAY_FALLBACK_PLACEHOLDER（"已识别条件，等待展示文案完善"）。
        //   不要替换成空字符串——空串会让 condition item 被过滤掉，整条 rule block 丢失。
        return trigger.key
      })
      .filter(item => item.length > 0)
    // Issue #1391：summary 渲染层 dedupe ——
    //   state 桶按 (key, phase, sideScope, paramsHash) 去重后，仍可能有不同 atom 实例
    //   渲染出完全相同的文本（如 indicator.above 的 referenceRole=mid_term/short_term
    //   渲染均为"价格在 MA20 上方"；price.breakout_up 的 period=20/undefined 渲染均为
    //   "价格突破近期高点"）。用户视角是重复，按渲染文本最终折叠一遍。
    return this.dedupeRenderedItems(rendered).join('；')
  }

  /**
   * 通用渲染层 dedupe：保留首次出现位置，丢弃后续完全相同的文本条目。
   * 适用于 trigger/risk/action 等任何按行 join 的 summary 集合。
   */
  private dedupeRenderedItems(items: readonly string[]): string[] {
    const seen = new Set<string>()
    const out: string[] = []
    for (const item of items) {
      if (!item) continue
      if (seen.has(item)) continue
      seen.add(item)
      out.push(item)
    }
    return out
  }

  /**
   * Issue #1222：按 (phase, sideScope, contract.params.groupId) 折叠同组 trigger。
   *
   * - 桶大小 >= 2 且 groupId 存在：渲染为单行「{条件1} {且|或} {条件2} ... 时做多开仓」，
   *   连词由 contract.params.join 决定（'AND' → '且'，'OR' → '或'）。
   * - 第一个成员落定 folded 行；其余成员落 ''（被 .filter(item => item.length > 0) 剔除）。
   * - 已被 marker grouping / atomic grouping 接管的桶直接跳过（避免双重折叠）。
   * - 桶大小 = 1 / groupId 缺失：不落入本 map，走原 singleton 渲染路径。
   */
  private buildContractGroupFoldedSummaries(
    triggers: SemanticState['trigger'],
    groupedIndicatorCompareSummaries: Map<string, string>,
    groupedAtomicSummaries: Map<string, string>,
  ): Map<string, string> {
    const result = new Map<string, string>()
    const buckets = new Map<string, Array<SemanticState['trigger'][number]>>()

    for (const trigger of triggers) {
      if (groupedIndicatorCompareSummaries.has(trigger.id)) continue
      if (groupedAtomicSummaries.has(trigger.id)) continue
      if (trigger.phase !== 'entry' && trigger.phase !== 'exit') continue
      const groupId = this.readTriggerContractGroupId(trigger)
      if (!groupId) continue
      // 使用 NUL 字节分隔，避免 groupId 本身含 '|' 时产生键碰撞
      const bucketKey = [trigger.phase, trigger.sideScope ?? '', groupId].join('\x00')
      const bucket = buckets.get(bucketKey) ?? []
      bucket.push(trigger)
      buckets.set(bucketKey, bucket)
    }

    for (const bucket of buckets.values()) {
      if (bucket.length < 2) continue
      const first = bucket[0]!
      const join = this.readTriggerContractJoin(first) ?? 'AND'
      const connector = join === 'OR' ? '或' : '且'
      const conditions: string[] = []
      for (const trigger of bucket) {
        const condition = this.renderTriggerCondition(trigger)
        if (!condition) {
          // 任一成员无法渲染条件 → 放弃折叠，保留原 singleton 路径
          conditions.length = 0
          break
        }
        conditions.push(condition)
      }
      if (conditions.length < 2) continue

      const innerJoined = conditions.join(` ${connector} `)
      const phaseLabel = this.formatTriggerPhaseLabel(first.phase)
      const rawSuffix = this.formatActionSuffix(first, innerJoined)
      // 折叠场景：在多条件合并行内强制 condition 与 action 间加一个空格，
      //   避免「...上方时做多开仓」这种贴合（issue #1222 期望可读）
      const suffix = rawSuffix && !rawSuffix.startsWith(' ') ? ` ${rawSuffix}` : rawSuffix
      result.set(first.id, `${phaseLabel}：${innerJoined}${suffix}`)
      for (let i = 1; i < bucket.length; i += 1) {
        result.set(bucket[i]!.id, '')
      }
    }

    return result
  }

  private readTriggerContractGroupId(trigger: SemanticState['trigger'][number]): string | null {
    for (const contract of trigger.contracts ?? []) {
      const value = this.readString(contract.params?.groupId)
      if (value) return value
    }
    return null
  }

  private readTriggerContractJoin(trigger: SemanticState['trigger'][number]): 'AND' | 'OR' | null {
    // 同一 trigger 的所有 contracts 共享同一 join；取第一个有值的即可。
    for (const contract of trigger.contracts ?? []) {
      const value = this.readString(contract.params?.join)
      if (value === 'AND' || value === 'OR') return value
    }
    return null
  }

  /**
   * 渲染单个 trigger 的条件文本（不含 phase 前缀与 action 后缀），供 #1222 折叠拼接使用。
   * 复用 buildTriggerSummary 的渲染结果再剥离前后缀，比内联完整渲染规则更稳健。
   */
  private renderTriggerCondition(trigger: SemanticState['trigger'][number]): string {
    const line = this.buildTriggerSummary([trigger], true)
    if (!line) return ''
    const phaseLabel = this.formatTriggerPhaseLabel(trigger.phase)
    const head = line.startsWith(`${phaseLabel}：`)
      ? line.slice(phaseLabel.length + 1)
      : line
    // 行内可能附加 action 后缀（如 "时做多开仓"），剥离得到纯条件
    // NOTE: 此 regex 必须与 formatActionSuffix 的所有返回词保持同步。
    // 新增 action 词时请同步更新此处。
    return head
      .replace(/\s?时(?:做多开仓|做空开仓|双向开仓|买入|平多|平空|双向平仓|卖出平仓)$/u, '')
      .trim()
  }

  private buildGroupedIndicatorCompareSummaries(
    triggers: SemanticState['trigger'],
  ): Map<string, string> {
    const result = new Map<string, string>()
    const contractGroups = new Map<string, Array<SemanticState['trigger'][number]>>()
    const groups = new Map<string, Array<SemanticState['trigger'][number]>>()

    for (const trigger of triggers) {
      if (!this.isGroupableIndicatorCompareTrigger(trigger)) {
        continue
      }

      const marker = this.readDisplayRuleGroupMarker(trigger)
      if (marker) {
        const groupKey = [
          marker,
          trigger.phase,
          trigger.key,
          trigger.sideScope ?? '',
        ].join('|')
        contractGroups.set(groupKey, [...(contractGroups.get(groupKey) ?? []), trigger])
      }

      const groupKey = [
        trigger.phase,
        trigger.key,
        trigger.sideScope ?? '',
        String(trigger.params.indicator ?? 'ma').toLowerCase(),
        String(trigger.params['reference.period']),
      ].join('|')
      groups.set(groupKey, [...(groups.get(groupKey) ?? []), trigger])
    }

    for (const group of contractGroups.values()) {
      if (group.length <= 1) {
        continue
      }

      const condition = this.formatGroupedIndicatorCompareCondition(group)
      if (!condition) {
        continue
      }

      const sortedGroup = this.sortIndicatorCompareGroup(group)
      const [first, ...rest] = sortedGroup
      if (!first) continue
      result.set(first.id, `${this.formatTriggerPhaseLabel(first.phase)}：${condition}${this.formatActionSuffix(first, condition)}`)
      for (const trigger of rest) {
        result.set(trigger.id, '')
      }
    }

    for (const group of groups.values()) {
      const timeframes = this.uniqueSortedTimeframes(group)
      if (timeframes.length <= 1) {
        continue
      }

      const sortedGroup = this.sortIndicatorCompareGroup(group)
      const [first, ...rest] = sortedGroup
      if (!first) continue
      if (result.has(first.id)) {
        continue
      }
      result.set(first.id, this.formatGroupedIndicatorCompareTriggerSummary(first, timeframes))
      for (const trigger of rest) {
        result.set(trigger.id, '')
      }
    }

    return result
  }

  private formatGroupedIndicatorCompareCondition(
    group: Array<SemanticState['trigger'][number]>,
  ): string | null {
    if (group.length <= 1) {
      return null
    }
    const allGroupable = group.every(trigger => this.isGroupableIndicatorCompareTrigger(trigger))
    const firstMarker = this.readDisplayRuleGroupMarker(group[0]!)
    const allMarkerGroupable = firstMarker !== null
      && group.every(trigger =>
        this.isGroupableIndicatorCompareTriggerByMarker(trigger)
        && this.readDisplayRuleGroupMarker(trigger) === firstMarker)
    if (!allGroupable && !allMarkerGroupable) {
      return null
    }

    const [first] = group
    if (!first) return null
    const sameShape = group.every(trigger =>
      trigger.phase === first.phase
      && trigger.key === first.key
      && (trigger.sideScope ?? '') === (first.sideScope ?? '')
      && String(trigger.params.indicator ?? 'ma').toLowerCase() === String(first.params.indicator ?? 'ma').toLowerCase(),
    )
    if (!sameShape) {
      return null
    }

    const timeframes = this.uniqueSortedTimeframes(group)
    const periods = this.uniqueSortedIndicatorPeriods(group)
    if (timeframes.length === 1 && periods.length > 1) {
      return this.renderMultiPeriodIndicatorCompareCondition(
        first.key === ATOM_CONTRACT_REGISTRY['indicator.above'].key ? 'above' : 'below',
        this.formatIndicatorName(first),
        periods,
        timeframes[0],
      )
    }
    // marker-grouped 且 per-trigger timeframe 缺失（context 层级已声明）：去掉 timeframe 前缀
    if (timeframes.length === 0 && periods.length > 1 && allMarkerGroupable) {
      return this.renderMultiPeriodIndicatorCompareCondition(
        first.key === ATOM_CONTRACT_REGISTRY['indicator.above'].key ? 'above' : 'below',
        this.formatIndicatorName(first),
        periods,
      )
    }

    if (timeframes.length > 1 && periods.length === 1) {
      return `${timeframes.join(' / ')} ${this.formatIndicatorCompareCondition(first)}`
    }

    return null
  }

  // #region multi-period indicator compare merge (PR #1147)
  //   将「价格在 EMA20/EMA60/EMA144 上方/下方」类多周期指标比较语句的合并 renderer 与
  //   AST 层合并判定集中归组，便于后续维护。runtime / canonical / IR / AST / invariant 零改动。

  /**
   * 多 period 指标比较合并渲染原语：两条路径（trigger 合并 + expression AST 合并）共享同一输出格式
   *   - operator: 'above' => 「价格在 X/Y/Z 上方」
   *   - operator: 'below' => 「价格低于 X/Y/Z」
   *   - 当 timeframe 提供时前缀「<timeframe> 」
   */
  private renderMultiPeriodIndicatorCompareCondition(
    operator: 'above' | 'below',
    indicatorName: string,
    periods: number[],
    timeframe?: string,
  ): string {
    const references = periods.map(period => `${indicatorName}${this.formatNumber(period)}`).join(' / ')
    const prefix = timeframe ? `${timeframe} ` : ''
    return operator === 'above'
      ? `${prefix}价格在 ${references} 上方`
      : `${prefix}价格低于 ${references}`
  }

  /**
   * 表达式 AST 层合并判定（BOLL 入场卡 gate 文本渲染路径）：
   *   命中条件：AND 表达式 + ≥2 个 children 全部为 predicate；每个 predicate 主语相同（bar.close）、
   *   indicator 同名（ema/sma/ma 大小写不敏感）、operator 一致（GT/GTE 视为 above；LT/LTE 视为 below）、
   *   period 数量 >=2 且互异。
   *   命中 → 返回合并文案（与 trigger 路径共享 renderer）；否则返回 null 由调用方回退原平铺逻辑。
   */
  private tryFormatMultiPeriodIndicatorCompareExpression(expression: SemanticExpression): string | null {
    // M2 (PR #1147 review)：在入口加廉价早退守卫——O(1) 检查放最前，
    //   避免深嵌套表达式每层都重复进入下方循环。
    if (expression.kind !== 'AND') return null
    if (expression.children.length < 2) return null
    if (!expression.children.every(child => child.kind === 'predicate')) return null

    let direction: 'above' | 'below' | null = null
    let indicatorName: string | null = null
    const periods = new Set<number>()

    for (const child of expression.children) {
      if (child.kind !== 'predicate') return null
      const left = child.left
      const right = child.right

      // 主语 = bar.close
      if (!(left.kind === 'series' && left.source === 'bar' && left.field === 'close')) return null
      // 客体 = indicator(name ∈ {ema, sma, ma})
      if (right.kind !== 'indicator') return null
      const name = right.name.toLowerCase()
      if (name !== 'ema' && name !== 'sma' && name !== 'ma') return null

      // m3 (PR #1147 review)：SemanticExpressionOperand.indicator.params 已经是 Record<string, unknown>，
      //   直接读取即可，无需 unchecked cast。
      const period = right.params.period
      if (typeof period !== 'number' || !Number.isFinite(period)) return null

      // operator 归一化为 above / below；同一表达式必须方向一致
      let childDirection: 'above' | 'below'
      if (child.op === 'GT' || child.op === 'GTE') childDirection = 'above'
      else if (child.op === 'LT' || child.op === 'LTE') childDirection = 'below'
      else return null

      if (direction === null) direction = childDirection
      else if (direction !== childDirection) return null

      if (indicatorName === null) indicatorName = name.toUpperCase()
      else if (indicatorName !== name.toUpperCase()) return null

      periods.add(period)
    }

    if (direction === null || indicatorName === null) return null
    if (periods.size < 2) return null
    // M4 (PR #1147 review)：period 必须互异——
    //   去重前后数量不一致（如 close > ema20 AND close > ema20 AND close > ema60）应回退原平铺路径，
    //   避免把重复 period 折叠为「价格在 EMA20/EMA60」抹掉重复表达。
    if (periods.size !== expression.children.length) return null

    const sortedPeriods = Array.from(periods).sort((a, b) => a - b)
    return this.renderMultiPeriodIndicatorCompareCondition(direction, indicatorName, sortedPeriods)
  }

  // #endregion multi-period indicator compare merge

  private buildGroupedAtomicTriggerSummaries(
    triggers: SemanticState['trigger'],
  ): Map<string, string> {
    const result = new Map<string, string>()
    const groups = new Map<string, Array<SemanticState['trigger'][number]>>()

    for (const trigger of triggers) {
      // eslint-disable-next-line atom-keys/no-atom-key-literal -- logical.any_of not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329)
      if (trigger.key === 'logical.any_of') {
        continue
      }

      const marker = this.readDisplayRuleGroupMarker(trigger)
      if (!marker) {
        continue
      }

      const groupKey = [
        marker,
        trigger.phase,
        trigger.sideScope ?? '',
      ].join('|')
      groups.set(groupKey, [...(groups.get(groupKey) ?? []), trigger])
    }

    for (const group of groups.values()) {
      if (group.length <= 1) {
        continue
      }

      const conditions = group
        .map(trigger => this.formatDisplayAtomicTriggerCondition(trigger))
        .filter(text => text.length > 0)
      if (conditions.length <= 1) {
        continue
      }

      const [first, ...rest] = group
      if (!first) continue

      const phase = first.phase === 'entry'
        ? '入场'
        : first.phase === 'exit'
          ? '出场'
          : '条件'
      const condition = conditions.join('，且')
      result.set(first.id, `${phase}：${condition}${this.formatActionSuffix(first, condition)}`)
      for (const trigger of rest) {
        result.set(trigger.id, '')
      }
    }

    return result
  }

  // 无 marker 路径：trigger 需自证身份，要求 key 支持 timeframe 维度分组合并（indicator.above/below）
  //   且有完整的 reference.period + timeframe params
  private isGroupableIndicatorCompareTrigger(trigger: SemanticState['trigger'][number]): boolean {
    return isTimeframeGroupableTriggerKey(trigger.key)
      && (trigger.phase === 'entry' || trigger.phase === 'exit')
      && typeof trigger.params['reference.period'] === 'number'
      && typeof trigger.params.timeframe === 'string'
      && trigger.params.timeframe.trim().length > 0
  }

  private formatGroupedIndicatorCompareTriggerSummary(
    trigger: SemanticState['trigger'][number],
    timeframes: string[],
  ): string {
    const condition = `${timeframes.join(' / ')} ${this.formatIndicatorCompareCondition(trigger)}`
    return `${this.formatTriggerPhaseLabel(trigger.phase)}：${condition}${this.formatActionSuffix(trigger, condition)}`
  }

  private formatIndicatorCompareTriggerSummary(trigger: SemanticState['trigger'][number]): string {
    const timeframe = typeof trigger.params.timeframe === 'string' && trigger.params.timeframe.trim().length > 0
      ? `${trigger.params.timeframe.trim()} `
      : ''
    const condition = `${timeframe}${this.formatIndicatorCompareCondition(trigger)}`
    return `${this.formatTriggerPhaseLabel(trigger.phase)}：${condition}${this.formatActionSuffix(trigger, condition)}`
  }

  private formatTriggerPhaseLabel(phase: SemanticState['trigger'][number]['phase']): string {
    if (phase === 'entry') return '入场'
    if (phase === 'exit') return '出场'
    return '条件'
  }

  // 注：以下 trigger.key 字面比较均为"文案分支"——能力判定已在 isXxxTriggerKey 上游 registry 守门，
  //   此处用 key 选择中文措辞（"上方"/"低于"），属于展示层渲染逻辑，非能力白名单。
  private formatIndicatorCompareCondition(trigger: SemanticState['trigger'][number]): string {
    const period = typeof trigger.params['reference.period'] === 'number'
      ? this.formatNumber(trigger.params['reference.period'])
      : String(trigger.params['reference.period'] ?? '')
    const indicator = this.formatIndicatorName(trigger)
    const reference = `${indicator}${period}`
    return trigger.key === ATOM_CONTRACT_REGISTRY['indicator.above'].key
      ? `价格在 ${reference} 上方`
      : `价格低于 ${reference}`
  }

  private formatIndicatorName(trigger: SemanticState['trigger'][number]): string {
    return typeof trigger.params.indicator === 'string' && trigger.params.indicator.trim().length > 0
      ? trigger.params.indicator.trim().toUpperCase()
      : 'MA'
  }

  private uniqueSortedIndicatorPeriods(triggers: Array<SemanticState['trigger'][number]>): number[] {
    const periods = new Set<number>()
    for (const trigger of triggers) {
      if (typeof trigger.params['reference.period'] === 'number') {
        periods.add(trigger.params['reference.period'])
      }
    }

    return Array.from(periods).sort((left, right) => left - right)
  }

  private sortIndicatorCompareGroup(
    triggers: Array<SemanticState['trigger'][number]>,
  ): Array<SemanticState['trigger'][number]> {
    return [...triggers].sort((left, right) => {
      const timeframeDelta = String(left.params.timeframe ?? '').localeCompare(String(right.params.timeframe ?? ''))
      if (timeframeDelta !== 0) return timeframeDelta
      const leftPeriod = typeof left.params['reference.period'] === 'number' ? left.params['reference.period'] : Number.MAX_SAFE_INTEGER
      const rightPeriod = typeof right.params['reference.period'] === 'number' ? right.params['reference.period'] : Number.MAX_SAFE_INTEGER
      if (leftPeriod !== rightPeriod) return leftPeriod - rightPeriod
      return left.id.localeCompare(right.id)
    })
  }

  private uniqueSortedTimeframes(triggers: Array<SemanticState['trigger'][number]>): string[] {
    const timeframes = new Set<string>()
    for (const trigger of triggers) {
      if (typeof trigger.params.timeframe === 'string' && trigger.params.timeframe.trim().length > 0) {
        timeframes.add(trigger.params.timeframe.trim())
      }
    }

    return [...timeframes].sort((left, right) =>
      this.timeframeToMinutes(left) - this.timeframeToMinutes(right) || left.localeCompare(right),
    )
  }

  private buildContractLevelSetSummary(trigger: SemanticState['trigger'][number]): string {
    const capability = this.findCapability(trigger.contracts, 'price', 'define', 'level_set')
    if (!capability) {
      return ''
    }

    const mode = this.readShapeString(capability.shape, 'mode')
    if (mode === 'centered_percent_range') {
      const centerTiming = this.readShapeString(capability.shape, 'centerTiming')
      const centerSource = this.readShapeString(capability.shape, 'centerSource')
      const halfRangePct = this.readShapeNumber(capability.shape, 'halfRangePct')
      const gridCount = this.readShapeNumber(capability.shape, 'gridCount')
      const gridIntervals = this.readShapeNumber(capability.shape, 'gridIntervals')
      const absoluteSpacing = this.readShapeNumber(capability.shape, 'absoluteSpacing')
      const centerText = `${centerTiming === 'deployment' ? '部署时' : '运行时'}${this.describeCenterSource(centerSource)}`
      const rangeText = halfRangePct !== null ? `上下各 ${this.formatPercent(halfRangePct)}%` : '上下区间待补充'
      const gridText = this.formatLevelSetDensityText(gridIntervals, gridCount)
      const spacingText = absoluteSpacing !== null ? `，每格 ${this.formatNumber(absoluteSpacing)}` : ''
      return `入场：区间网格，以${centerText}为中心${rangeText}${gridText}${spacingText}`
    }

    const lower = this.readShapeNumber(capability.shape, 'lower')
    const upper = this.readShapeNumber(capability.shape, 'upper')
    const gridCount = this.readShapeNumber(capability.shape, 'gridCount')
    const gridIntervals = this.readShapeNumber(capability.shape, 'gridIntervals')
    const absoluteSpacing = this.readShapeNumber(capability.shape, 'absoluteSpacing')
    const spacingPct = this.readShapeNumber(capability.shape, 'spacingPct')
    if (lower !== null && upper !== null) {
      const gridText = this.formatLevelSetDensityText(gridIntervals, gridCount)
      const spacingText = absoluteSpacing !== null
        ? `，每格 ${this.formatNumber(absoluteSpacing)}`
        : spacingPct !== null
          ? `，步长 ${this.formatPercent(spacingPct)}%`
          : ''
      return `入场：区间网格，固定区间 ${this.formatNumber(lower)}-${this.formatNumber(upper)}${gridText}${spacingText}`
    }

    return ''
  }

  private formatLevelSetDensityText(gridIntervals: number | null, gridCount: number | null): string {
    if (gridIntervals !== null) {
      return `，共 ${this.formatNumber(gridIntervals)} 格`
    }

    if (gridCount !== null) {
      return `，共 ${this.formatNumber(gridCount)} 档`
    }

    return ''
  }

  private describeCenterSource(source: string | null): string {
    if (source === 'last_trade') return '最新成交价'
    if (source === 'trade_vwap') return '成交均价'
    if (source === 'mark_price') return '标记价'
    if (source === 'last_price') return '当前价'
    return '当前价'
  }

  private readGridRangeValue(
    params: Record<string, unknown>,
    side: 'lower' | 'upper',
  ): number | null {
    const flatKeys = side === 'lower'
      ? ['rangeMin', 'rangeLower']
      : ['rangeMax', 'rangeUpper']
    for (const key of flatKeys) {
      const value = params[key]
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value
      }
    }

    const range = params.range
    if (range && typeof range === 'object' && !Array.isArray(range)) {
      const nested = (range as Record<string, unknown>)[side]
      if (typeof nested === 'number' && Number.isFinite(nested)) {
        return nested
      }
    }

    return null
  }

  private formatCrossTriggerSummary(trigger: SemanticState['trigger'][number]): string {
    const indicator = typeof trigger.params.indicator === 'string'
      ? trigger.params.indicator.trim().toLowerCase()
      : ''
    const phase = trigger.phase === 'entry' ? '入场' : '出场'
    const direction = trigger.key === ATOM_CONTRACT_REGISTRY['indicator.cross_over'].key ? '上穿' : '下穿'

    if (indicator === 'macd') {
      const fast = typeof trigger.params.fastPeriod === 'number' ? trigger.params.fastPeriod : 12
      const slow = typeof trigger.params.slowPeriod === 'number' ? trigger.params.slowPeriod : 26
      const signal = typeof trigger.params.signalPeriod === 'number' ? trigger.params.signalPeriod : 9
      const condition = `MACD ${fast}/${slow}/${signal} ${direction === '上穿' ? '金叉' : '死叉'}`
      return `${phase}：${condition}${this.formatActionSuffix(trigger, condition)}`
    }

    if (indicator === 'rsi') {
      const period = typeof trigger.params.period === 'number' ? trigger.params.period : 14
      const value = typeof trigger.params.value === 'number' ? trigger.params.value : null
      const condition = value === null ? `RSI${period} ${direction}阈值` : `RSI${period} ${direction} ${value}`
      return `${phase}：${condition}${this.formatActionSuffix(trigger, condition)}`
    }

    const label = indicator === 'ema'
      ? 'EMA'
      : 'MA'
    const fast = typeof trigger.params.fastPeriod === 'number' ? trigger.params.fastPeriod : null
    const slow = typeof trigger.params.slowPeriod === 'number' ? trigger.params.slowPeriod : null
    const fastLabel = fast === null ? `${label}短周期` : `${label}${fast}`
    const slowLabel = slow === null ? `${label}长周期` : `${label}${slow}`
    const condition = `${fastLabel} ${direction} ${slowLabel}`
    return `${phase}：${condition}${this.formatActionSuffix(trigger, condition)}`
  }

  private formatIndicatorBoundaryTriggerSummary(trigger: SemanticState['trigger'][number]): string {
    const indicator = this.readIndicatorBoundaryIndicator(trigger.params)
    const boundaryRole = this.readBoundaryRole(trigger.params.boundaryRole)
    if (!indicator || !boundaryRole) {
      return trigger.key
    }

    const phase = trigger.phase === 'entry' ? '入场' : '出场'
    const boundaryText = this.formatBoundaryRole(boundaryRole)
    const actionText = this.formatIndicatorBoundaryActionText(trigger.params.confirmationMode)
    const condition = indicator.name === 'bollinger'
      ? `${actionText}布林带 ${this.formatIndicatorPeriodStdDev(indicator)}${boundaryText}`
      : `${actionText}${indicator.name}${boundaryText}`
    return `${phase}：${condition}${this.formatActionSuffix(trigger, condition)}`
  }

  private readIndicatorBoundaryIndicator(params: Record<string, unknown>): {
    name: string
    period?: number
    stdDev?: number
  } | null {
    const indicator = params.indicator
    if (!indicator || typeof indicator !== 'object' || Array.isArray(indicator)) {
      return null
    }

    const record = indicator as Record<string, unknown>
    const name = typeof record.name === 'string' ? record.name.trim().toLowerCase() : ''
    if (!name) {
      return null
    }

    return {
      name,
      ...(typeof record.period === 'number' && Number.isFinite(record.period) ? { period: record.period } : {}),
      ...(typeof record.stdDev === 'number' && Number.isFinite(record.stdDev) ? { stdDev: record.stdDev } : {}),
    }
  }

  private readBoundaryRole(value: unknown): 'upper' | 'lower' | 'middle' | null {
    return value === 'upper' || value === 'lower' || value === 'middle' ? value : null
  }

  private formatBoundaryRole(role: 'upper' | 'lower' | 'middle'): string {
    if (role === 'upper') return '上轨'
    if (role === 'lower') return '下轨'
    return '中轨'
  }

  private formatIndicatorBoundaryActionText(confirmationMode: unknown): string {
    if (confirmationMode === 'close_confirm') {
      return '收盘确认突破'
    }
    return '触及'
  }

  private formatIndicatorPeriodStdDev(indicator: { period?: number, stdDev?: number }): string {
    if (indicator.period !== undefined && indicator.stdDev !== undefined) {
      return `${this.formatNumber(indicator.period)} 周期 ${this.formatNumber(indicator.stdDev)} 倍标准差`
    }

    if (indicator.period !== undefined) {
      return `${this.formatNumber(indicator.period)} 周期`
    }

    return ''
  }

  private formatActionSuffix(trigger: SemanticState['trigger'][number], conditionText: string): string {
    const evidenceText = typeof trigger.evidence?.text === 'string' ? trigger.evidence.text : ''
    const separator = /[A-Za-z0-9%]$/u.test(conditionText) ? ' ' : ''
    if (trigger.phase === 'entry') {
      if (/买入|买进/u.test(evidenceText) && !/做多|开多/u.test(evidenceText)) {
        return `${separator}时买入`
      }
      if (trigger.sideScope === 'short') return `${separator}时做空开仓`
      if (trigger.sideScope === 'both') return `${separator}时双向开仓`
      return `${separator}时做多开仓`
    }

    if (trigger.phase === 'exit') {
      if (/卖出/u.test(evidenceText) && !/平多|平空/u.test(evidenceText)) {
        return `${separator}时卖出平仓`
      }
      if (trigger.sideScope === 'short') return `${separator}时平空`
      if (trigger.sideScope === 'both') return `${separator}时双向平仓`
      return `${separator}时平多`
    }

    return ''
  }

  private formatSemanticExpression(expression: unknown, depth: number = 0): string {
    // M2 (PR #1147 review)：递归深度上限——避免恶意/异常 AST 形成指数放大或栈溢出，
    //   超过阈值返回 truncated 占位符，由上层 join 自然降级。
    if (depth >= 16) {
      return '…'
    }
    if (!this.isSemanticExpression(expression)) {
      return ''
    }

    if (expression.kind === 'predicate') {
      const left = this.formatSemanticExpressionOperand(expression.left)
      const right = this.formatSemanticExpressionOperand(expression.right)
      const operator = this.formatSemanticExpressionOperator(expression.op)
      if (!left || !right || !operator) {
        return ''
      }
      return `${left}${operator}${right}`
    }

    // AND 多 period 指标比较合并（与 trigger 路径共享 renderer）：
    //   "且收盘价高于 EMA20 且收盘价高于 EMA60 且收盘价高于 EMA144" → "价格在 EMA20/EMA60/EMA144 上方"
    if (expression.kind === 'AND') {
      const merged = this.tryFormatMultiPeriodIndicatorCompareExpression(expression)
      if (merged) {
        return merged
      }
    }

    const children = expression.children
      .map(child => this.formatSemanticExpression(child, depth + 1))
      .filter(item => item.length > 0)
    if (children.length === 0) {
      return ''
    }
    if (expression.kind === 'NOT') {
      return `非（${children[0]}）`
    }
    return children.join(expression.kind === 'AND' ? '且' : '或')
  }

  private formatSemanticExpressionOperand(operand: SemanticExpressionOperand): string {
    if (operand.kind === 'series' && operand.source === 'bar') {
      const fieldLabels: Record<typeof operand.field, string> = {
        open: '开盘价',
        high: '最高价',
        low: '最低价',
        close: '收盘价',
      }
      const offset = typeof operand.offsetBars === 'number' && operand.offsetBars > 0
        ? `前 ${operand.offsetBars} 根`
        : ''
      return `${offset}${fieldLabels[operand.field]}`
    }

    if (operand.kind === 'indicator') {
      const name = operand.name.toUpperCase()
      const period = typeof operand.params.period === 'number' ? `${operand.params.period}` : ''
      const output = operand.output && operand.output !== 'value' ? ` ${operand.output}` : ''
      return `${name}${period}${output}`
    }

    if (operand.kind === 'position') {
      const fieldLabels: Record<typeof operand.field, string> = {
        avg_price: '持仓均价',
        pnl_pct: '持仓收益率',
        bars_held: '持仓 K 线数',
        has_position: operand.side === 'short' ? '持有空仓' : operand.side === 'both' ? '持有仓位' : '持有多仓',
      }
      return fieldLabels[operand.field]
    }

    if (operand.kind === 'account') {
      const fieldLabels: Record<typeof operand.field, string> = {
        drawdown_pct: '账户最大回撤',
      }
      return fieldLabels[operand.field]
    }

    if (operand.kind === 'constant') {
      if (operand.unit === 'percent') return `${operand.value}%`
      return String(operand.value)
    }

    return ''
  }

  private formatSemanticExpressionOperator(op: SemanticExpressionOperator): string {
    switch (op) {
      case 'GT':
        return '高于'
      case 'GTE':
        return '高于或等于'
      case 'LT':
        return '低于'
      case 'LTE':
        return '低于或等于'
      case 'EQ':
        return '等于'
      case 'CROSS_OVER':
        return '上穿'
      case 'CROSS_UNDER':
        return '下穿'
      default:
        return ''
    }
  }

  private isSemanticExpression(expression: unknown): expression is SemanticExpression {
    if (!expression || typeof expression !== 'object') {
      return false
    }
    const kind = (expression as { kind?: unknown }).kind
    if (kind === 'predicate') {
      const predicate = expression as { op?: unknown; left?: unknown; right?: unknown }
      return typeof predicate.op === 'string'
        && this.isSemanticExpressionOperand(predicate.left)
        && this.isSemanticExpressionOperand(predicate.right)
    }
    if (kind === 'AND' || kind === 'OR' || kind === 'NOT') {
      return Array.isArray((expression as { children?: unknown }).children)
        && (expression as { children: unknown[] }).children.every(child => this.isSemanticExpression(child))
    }
    return false
  }

  private isSemanticExpressionOperand(operand: unknown): operand is SemanticExpressionOperand {
    if (!operand || typeof operand !== 'object') {
      return false
    }

    const candidate = operand as Record<string, unknown>
    if (candidate.kind === 'series') {
      return candidate.source === 'bar'
        && (candidate.field === 'open'
          || candidate.field === 'high'
          || candidate.field === 'low'
          || candidate.field === 'close')
        && (candidate.offsetBars === undefined || typeof candidate.offsetBars === 'number')
    }

    if (candidate.kind === 'indicator') {
      return typeof candidate.name === 'string'
        && !!candidate.params
        && typeof candidate.params === 'object'
        && (candidate.output === undefined || typeof candidate.output === 'string')
    }

    if (candidate.kind === 'position') {
      return (candidate.field === 'avg_price'
          || candidate.field === 'pnl_pct'
          || candidate.field === 'bars_held'
          || candidate.field === 'has_position')
        && (candidate.side === undefined
          || candidate.side === 'long'
          || candidate.side === 'short'
          || candidate.side === 'both')
    }

    if (candidate.kind === 'account') {
      return candidate.field === 'drawdown_pct'
    }

    if (candidate.kind === 'constant') {
      return (typeof candidate.value === 'number' || typeof candidate.value === 'string' || typeof candidate.value === 'boolean')
        && (candidate.unit === undefined || typeof candidate.unit === 'string')
    }

    return false
  }

  private buildRiskSummary(riskItems: SemanticState['risk']): string {
    const renderedRisk = riskItems
      .filter(risk => risk.status === 'locked')
      .sort((left, right) => this.compareRiskAtoms(left, right))
      .map((risk) => {
        const contractSummary = this.buildContractGuardSummary(risk)
        if (contractSummary) {
          return contractSummary
        }

        // Issue #1383 后续：5 桶真相源 — 任何在 ATOM_CONTRACT_REGISTRY 注册且声明
        //   display.summaryTemplate 的 atom，统一由 contract 渲染；projection 不再写
        //   per-atom-key 硬编码分支。legacy field-key（risk.stop_loss_pct / take_profit_pct /
        //   max_drawdown_pct / max_single_loss_pct / atr_multiple_* / condition_expression /
        //   remembered_level_stop）暂未挂 registry，仍走下方专项分支兜底。
        const registrySummary = this.tryAtomContractSummary(risk.key, risk.params)
        if (registrySummary !== null) {
          return registrySummary
        }

        /* eslint-disable atom-keys/no-atom-key-literal -- risk.condition_expression / risk.atr_multiple_stop / risk.atr_multiple_take_profit / risk.remembered_level_stop not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329) */
        if (risk.key === 'risk.condition_expression') {
          const condition = this.formatSemanticExpression(risk.params.condition)
          if (!condition) {
            return this.buildRiskFallbackSummary(risk)
          }
          return `风控：当${condition}时${this.describeRiskExpressionEffect(risk.params.effect)}`
        }

        if (risk.key === 'risk.atr_multiple_stop') {
          const multiple = this.readFiniteNumber(risk.params.multiple)
          return multiple === null ? this.buildRiskFallbackSummary(risk) : `${this.formatNumber(multiple)} 倍 ATR 止损`
        }

        if (risk.key === 'risk.atr_multiple_take_profit') {
          const multiple = this.readFiniteNumber(risk.params.multiple)
          return multiple === null ? this.buildRiskFallbackSummary(risk) : `${this.formatNumber(multiple)} 倍 ATR 止盈`
        }

        if (risk.key === 'risk.remembered_level_stop') {
          const levelKey = this.readString(risk.params.levelKey)
          return levelKey ? `跌破记录位 ${levelKey} 止损` : this.buildRiskFallbackSummary(risk)
        }
        /* eslint-enable atom-keys/no-atom-key-literal */

        // risk.partial_take_profit 已迁回 atom contract 的 display.summaryTemplate
        //   （上方 tryAtomContractSummary 路径承接两种参数形状：tiers[] 数组 + dispatcher
        //   抽出的 {profitPct, ratio}）

        const valuePct = risk.params.valuePct
        if (typeof valuePct !== 'number' || !Number.isFinite(valuePct) || valuePct <= 0) {
          return this.buildRiskFallbackSummary(risk)
        }

        /* eslint-disable atom-keys/no-atom-key-literal -- risk.stop_loss_pct / risk.take_profit_pct / risk.max_drawdown_pct / risk.max_single_loss_pct not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329) */
        if (risk.key === 'risk.stop_loss_pct') {
          const basis = this.describeRiskBasis(risk.params.basis)
          return `止损：价格相对${basis}下跌${this.formatPercent(valuePct)}% 强制平仓`
        }

        if (risk.key === 'risk.take_profit_pct') {
          const basis = this.describeRiskBasis(risk.params.basis)
          return `止盈：价格相对${basis}上涨${this.formatPercent(valuePct)}% 平仓`
        }

        if (risk.key === 'risk.max_drawdown_pct') {
          return `回撤：下跌${this.formatPercent(valuePct)}% 平仓`
        }

        if (risk.key === 'risk.max_single_loss_pct') {
          return `单笔止损：下跌${this.formatPercent(valuePct)}%`
        }
        /* eslint-enable atom-keys/no-atom-key-literal */

        return this.buildRiskFallbackSummary(risk)
      })
      .filter(item => item.length > 0)
    // Issue #1391：risk summary 渲染层 dedupe，与 trigger summary 同一原则
    return this.dedupeRenderedItems(renderedRisk).join('；')
  }

  private buildRiskFallbackSummary(_risk: SemanticState['risk'][number]): string {
    return '已识别风控，参数待补充'
  }

  /**
   * Issue #1383 后续：通用 atom contract summary 入口。
   *
   * 任何 atom 在 ATOM_CONTRACT_REGISTRY 注册且声明了 display.summaryTemplate 都走此处；
   * projection / clarification / 其它视图统一通过 contract 渲染，避免在视图层维护 per-atom-key 分支。
   *
   * 返回 null 表示 atom 未注册或没有有效 summary，调用方按各自兜底处理。
   */
  private tryAtomContractSummary(
    atomKey: string,
    params: Record<string, unknown>,
    locale: 'zh' | 'en' = 'zh',
  ): string | null {
    type ParamRendererFn = (value: unknown, locale: 'zh' | 'en') => string
    type DisplayShape = {
      publicName?: { zh?: string, en?: string }
      summaryTemplate?: (p: Record<string, unknown>, l: 'zh' | 'en') => string
      paramRenderers?: Record<string, ParamRendererFn>
    }
    const contract = (ATOM_CONTRACT_REGISTRY as Record<string, { display?: DisplayShape } | undefined>)[atomKey]
    const display = contract?.display
    const summaryTemplate = display?.summaryTemplate
    if (typeof summaryTemplate !== 'function') {
      return null
    }
    let baseSummary: string
    try {
      const rendered = summaryTemplate(params, locale)
      if (typeof rendered !== 'string') return null
      const trimmed = rendered.trim()
      if (trimmed.length === 0) return null
      baseSummary = trimmed
    }
    catch (error) {
      // Issue #1391 review m5：summaryTemplate 抛错不再静默吞——打 warn 保留排查线索。
      //   生产环境 atom contract 改坏后 specDesc 静默退兜底文案，没日志极难定位。
      const reason = error instanceof Error ? error.message : String(error)
      console.warn(`[atom-contract-summary] template threw for atomKey=${atomKey}: ${reason}`)
      return null
    }

    // Issue #1443 通用增强（D 方案）：检测 atom 的 summaryTemplate 是否「未消费 params」
    //   （输出等于 publicName → fallback 到 atom 类型名）。命中后从 `paramSlots` 元数据
    //   派生人话标签拼接在 summary 后，**不依赖** atom 自己的 paramRenderers（contract
    //   注释自承 paramRenderers 是 debug 字段，非 user-facing）。
    //
    //   通用机制：
    //     - paramSlots[slotKey].kind=percent → `${abs(value)}%`
    //     - paramSlots[slotKey].kind=number → `${value}`
    //     - paramSlots[slotKey].kind=duration → `${value}`（"3m" / "15m"）
    //     - paramSlots[slotKey].kind=enum → 查内置 PROJECTION_PARAM_VALUE_LABELS
    //       常用标签表；表内有则用人话标签，无则**跳过**（避免显示原始 enum value 如 "down"/
    //       "current_price"——技术化文案）
    //     - 值等于 paramSlots[slotKey].default → 跳过（避免渲染技术兜底）
    return this.enrichSummaryFromParamSlots({
      atomKey,
      baseSummary,
      publicName: display?.publicName,
      params,
      locale,
    })
  }

  /**
   * Issue #1443 D 方案：基于 `paramSlots` 元数据的通用 summary 增强。
   *
   * 触发：base summary === publicName[locale]（"summaryTemplate 未消费 params" 通用信号）
   *
   * 行为：遍历 paramSlots 元数据，按 kind 派生 user 可读文本：
   *   - 数值类（percent/number/duration）→ 直接渲染数值
   *   - enum 类 → 查 PROJECTION_PARAM_VALUE_LABELS 内置标签表（covers 用户真关心的
   *     direction/basis 等少数 enum），表内有则用，无则跳过（不显示原始 enum value）
   *   - 跳过 undefined/null/'' 和 值 === default 的 slot
   *
   * 输出 format: `${publicName}（${labels.join('，')}）`（zh）/ `${publicName} (...)` (en)
   *
   * 不动任何 atom contract。新 atom 自动通用走此路径；要扩 enum 标签覆盖只需扩
   *   PROJECTION_PARAM_VALUE_LABELS 表（一处改动，所有 atom 受益）。
   */
  private enrichSummaryFromParamSlots(input: {
    atomKey: string
    baseSummary: string
    publicName: { zh?: string, en?: string } | undefined
    params: Record<string, unknown>
    locale: 'zh' | 'en'
  }): string {
    const { atomKey, baseSummary, publicName, params, locale } = input

    // 「summaryTemplate 未消费 params」信号：base summary 与 publicName 一字不差
    const publicNameForLocale = publicName?.[locale]?.trim()
    if (!publicNameForLocale || baseSummary !== publicNameForLocale) return baseSummary

    type ParamSlot = { kind?: string, default?: unknown, enum?: readonly string[] }
    type SurfaceShape = { paramSlots?: Record<string, ParamSlot> }
    const entry = (ATOM_CONTRACT_REGISTRY as Record<string, { surface?: SurfaceShape } | undefined>)[atomKey]
    const paramSlots = entry?.surface?.paramSlots
    if (!paramSlots) return baseSummary

    const rendered: string[] = []
    for (const [slotKey, slot] of Object.entries(paramSlots)) {
      const v = (params as Record<string, unknown>)[slotKey]
      if (v === undefined || v === null || v === '') continue
      // 值 === default → 跳过（技术兜底，无价值）
      if (slot && 'default' in slot && slot.default !== undefined && slot.default === v) continue
      const label = this.renderParamValueLabel(slotKey, slot.kind, v, locale)
      if (label && label.length > 0) rendered.push(label)
    }
    if (rendered.length === 0) return baseSummary
    const joiner = locale === 'zh' ? '，' : ', '
    const open = locale === 'zh' ? '（' : ' ('
    const close = locale === 'zh' ? '）' : ')'
    return `${baseSummary}${open}${rendered.join(joiner)}${close}`
  }

  /**
   * Issue #1443：按 paramSlot.kind + 内置标签表派生 user 可读文本。
   *   - percent：`${abs(value)}%`（方向已在 direction enum 里）
   *   - number：`${value}`
   *   - duration：`${value}`（如 "3m"/"15m"）
   *   - enum：查 PROJECTION_PARAM_VALUE_LABELS[slotKey][value][locale]，无则跳过
   *   - 其它 kind / 值无法渲染 → 返空（跳过）
   */
  private renderParamValueLabel(
    slotKey: string,
    kind: string | undefined,
    value: unknown,
    locale: 'zh' | 'en',
  ): string {
    if (kind === 'percent' && typeof value === 'number' && Number.isFinite(value)) {
      return `${Math.abs(value)}%`
    }
    if (kind === 'number' && typeof value === 'number' && Number.isFinite(value)) {
      return `${value}`
    }
    if (kind === 'duration' && typeof value === 'string' && value.length > 0) {
      return value
    }
    if (kind === 'enum' && typeof value === 'string') {
      const table = (PROJECTION_PARAM_VALUE_LABELS as Record<string, Record<string, { zh?: string, en?: string } | undefined> | undefined>)[slotKey]
      const labelMap = table?.[value]
      const label = labelMap?.[locale]
      if (typeof label === 'string' && label.trim().length > 0) return label.trim()
      // enum value 不在表内 → 跳过（避免显示原始 enum 如 'down'/'current_price'）
      return ''
    }
    return ''
  }

  /**
   * @deprecated Issue #1443：被 enrichSummaryFromParamSlots 内联消费 default 取代；
   *   保留以兼容潜在外部引用，下个 PR 删。
   */
  private readSlotDefaultsForAtom(atomKey: string): Record<string, unknown> | null {
    type ParamSlot = { default?: unknown }
    type SurfaceShape = { paramSlots?: Record<string, ParamSlot> }
    const entry = (ATOM_CONTRACT_REGISTRY as Record<string, { surface?: SurfaceShape } | undefined>)[atomKey]
    const paramSlots = entry?.surface?.paramSlots
    if (!paramSlots) return null
    const out: Record<string, unknown> = {}
    let hasAny = false
    for (const [slotKey, slot] of Object.entries(paramSlots)) {
      if (slot && 'default' in slot && slot.default !== undefined) {
        out[slotKey] = slot.default
        hasAny = true
      }
    }
    return hasAny ? out : null
  }

  private buildActionSummary(actions: SemanticState['action'], state: SemanticState): string {
    // sub-fix 4: hoist index build once per call, not once per action
    const index = CapabilityEvidenceIndex.build(state)
    return actions
      .filter(action => action.status === 'locked')
      .sort((left, right) => this.compareActionAtoms(left, right))
      .map(action => this.buildAddPositionSummary(action) || this.buildContractOrderProgramSummary(action, state, index))
      .filter(item => item.length > 0)
      .join('；')
  }

  private buildAddPositionSummary(action: SemanticState['action'][number]): string {
    if (action.key !== ATOM_CONTRACT_REGISTRY['action.add_position'].key) {
      return ''
    }
    const addMode = this.readString(action.params?.addMode as unknown)
    const addRatio = this.readFiniteNumber(action.params?.addRatio as unknown)
    const addRatioPct = addRatio !== null ? this.formatPercent(addRatio * 100) : null

    // #1158：profitThreshold / drawdownThreshold 单位为 percent（如 2 表示 2%），不需要 * 100
    if (addMode === 'profit_pct') {
      const profitThreshold = this.readFiniteNumber((action.params as Record<string, unknown>)?.profitThreshold as unknown)
      const triggerText = profitThreshold !== null && profitThreshold > 0
        ? `盈利${this.formatPercent(profitThreshold)}%后`
        : '盈利后'
      return addRatioPct !== null
        ? `加仓：${triggerText}加仓，每次${addRatioPct}%`
        : `加仓：${triggerText}加仓`
    }

    if (addMode === 'drawdown_pct') {
      const drawdownThreshold = this.readFiniteNumber((action.params as Record<string, unknown>)?.drawdownThreshold as unknown)
      const triggerText = drawdownThreshold !== null && drawdownThreshold > 0
        ? `回撤${this.formatPercent(drawdownThreshold)}%后`
        : '回撤后'
      return addRatioPct !== null
        ? `加仓：${triggerText}加仓，每次${addRatioPct}%`
        : `加仓：${triggerText}加仓`
    }

    if (addMode === 'signal_confirm') {
      return addRatioPct !== null
        ? `加仓：信号确认后加仓，每次${addRatioPct}%`
        : '加仓：信号确认后加仓'
    }

    if (addRatioPct !== null) {
      return `加仓：每次${addRatioPct}%`
    }

    return '加仓'
  }

  private buildContractOrderProgramSummary(action: SemanticState['action'][number], state: SemanticState, index?: CapabilityEvidenceIndex): string {
    const orderProgram = this.findCapability(action.contracts, 'order_program', 'maintain', 'limit_ladder')
    if (!orderProgram) {
      return ''
    }

    // PR3.5: use CapabilityEvidenceIndex to read per_order_budget, scoped to this action
    // sub-fix 4: accept pre-built index from caller to avoid per-action rebuild
    const budgetEvidences = (index ?? CapabilityEvidenceIndex.build(state)).byKey('capital', 'allocate', 'per_order_budget')
      .filter(e => e.mount === 'action' && e.ownerId === action.id)
    const budget = budgetEvidences[0]?.capability ?? null
    const orderType = this.readShapeString(orderProgram.shape, 'orderType') === 'limit' ? '限价' : '网格'
    const recycleText = this.readShapeBoolean(orderProgram.shape, 'recycleOnFill') === true
      ? '，成交后相邻网格反向挂单'
      : ''
    const budgetValue = budget ? this.readShapeNumber(budget.shape, 'value') : null
    const budgetAsset = budget ? this.readShapeString(budget.shape, 'asset') : null
    const budgetText = budgetValue !== null && budgetAsset !== null
      ? `，每格 ${this.formatNumber(budgetValue)} ${budgetAsset}`
      : ''

    return `挂单：${orderType}网格${recycleText}${budgetText}`
  }

  private buildContractGuardSummary(risk: SemanticState['risk'][number]): string {
    const guard = (risk.contracts ?? [])
      .flatMap(contract => contract.capabilities)
      .find(capability => capability.domain === 'guard' && capability.verb === 'enforce')
    if (!guard) {
      return ''
    }

    const trigger = this.readShapeString(guard.shape, 'trigger')
    const onBreach = this.readShapeString(guard.shape, 'onBreach')
    const cancelOrders = this.readShapeBoolean(guard.shape, 'cancelOrders')
    if (!this.isBoundaryGuardCapability(guard.object, trigger)) {
      return ''
    }

    const actionText = onBreach === 'HALT_STRATEGY' ? '停止策略' : '执行风控'
    const cancelScope = this.describeCancelScope(this.readShapeString(guard.shape, 'cancelScope'))
    const cancelText = cancelOrders === true ? `并撤销${cancelScope}` : ''
    const regridText = this.readShapeBoolean(guard.shape, 'regrid') === false ? '，不再重新部署网格' : ''
    return `风控：突破上下边界时${actionText}${cancelText}${regridText}`
  }

  private isBoundaryGuardCapability(object: string, trigger: string | null): boolean {
    return trigger === 'boundary_breach'
      || object === 'boundary_cancel'
      || /boundary|range|grid/u.test(object)
  }

  private describeCancelScope(scope: string | null): string {
    if (scope === 'unfilled_grid_limit_orders') return '未成交网格限价单'
    if (scope === 'unfilled_grid_orders') return '未成交网格订单'
    if (scope === 'unfilled_limit_orders') return '未成交限价单'
    if (scope === 'unfilled_orders') return '未成交订单'
    if (scope === 'grid_orders') return '网格订单'
    if (scope === 'program_orders') return '策略订单'
    return '未成交订单'
  }

  private findCapability(
    contracts: SemanticState['trigger'][number]['contracts'] | SemanticState['action'][number]['contracts'] | SemanticState['risk'][number]['contracts'],
    domain: SemanticCapability['domain'],
    verb: string,
    object: string,
  ): SemanticCapability | null {
    return (contracts ?? [])
      .flatMap(contract => contract.capabilities)
      .find(capability =>
        capability.domain === domain
        && capability.verb === verb
        && capability.object === object,
      ) ?? null
  }

  private readShapeString(shape: SemanticCapability['shape'], key: string): string | null {
    const value = shape[key]
    return typeof value === 'string' && value.trim() ? value : null
  }

  private readShapeNumber(shape: SemanticCapability['shape'], key: string): number | null {
    const value = shape[key]
    return typeof value === 'number' && Number.isFinite(value) ? value : null
  }

  private readShapeBoolean(shape: SemanticCapability['shape'], key: string): boolean | null {
    const value = shape[key]
    return typeof value === 'boolean' ? value : null
  }

  private readString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
  }

  private readFiniteNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null
  }

  private describeRiskExpressionEffect(rawEffect: unknown): string {
    if (!rawEffect || typeof rawEffect !== 'object') {
      return '执行风控'
    }

    const effectType = (rawEffect as { type?: unknown }).type
    if (effectType === 'pause_strategy') {
      return '暂停策略'
    }
    if (effectType === 'reduce_position') {
      const reducePct = (rawEffect as { reducePct?: unknown }).reducePct
      return typeof reducePct === 'number' && Number.isFinite(reducePct)
        ? `减仓${this.formatPercent(reducePct)}%`
        : '减仓'
    }
    if (effectType === 'notify_only') {
      return '提醒'
    }
    return '平仓'
  }

  private describeRiskBasis(rawBasis: unknown): string {
    if (rawBasis === 'entry_avg_price') {
      return '入场均价'
    }

    if (rawBasis === 'position_pnl') {
      return '持仓收益率'
    }

    if (rawBasis === 'peak_position_pnl' || rawBasis === 'peak_equity') {
      return '持仓收益高点'
    }

    if (rawBasis === 'upper_band') {
      return '布林带上轨'
    }

    if (rawBasis === 'lower_band') {
      return '布林带下轨'
    }

    if (rawBasis === 'middle_band') {
      return '布林带中轨'
    }

    return '前收盘'
  }

  private buildPositionSummary(position: SemanticState['position'], constraints: SemanticState['positionConstraint'] = []): string {
    // #1169：position.status==='locked' 即可进入；validateSemanticPositionContract 对
    //   constraint_only 模式（sizing=null）会判 invalid 导致早退，而 constraints 路径仍可渲染。
    //   只对"有 sizing 时"再做合约校验；纯 constraint_only 路径直接走 constraints 渲染。
    if (position?.status !== 'locked') {
      return ''
    }
    const hasSizingContract = validateSemanticPositionContract(position).ok

    // #1169：sizing 在 position.mode='constraint_only'（如纯 DCA 入场）时为 null，
    //   但 locked constraints 仍可能渲染（如 dca_schedule）。先算 sizingText / constraintParts
    //   再决定如何拼接 / 早退；不再因 sizing=null 直接返回空串
    let sizingText = ''
    if (hasSizingContract) {
      const sizing = position.sizing ?? normalizeLegacyPositionSizing(position)
      if (sizing) {
        if (sizing.kind === 'ratio') {
          const ratioValue = sizing.unit === 'percent' ? sizing.value : sizing.value * 100
          sizingText = `仓位：${this.formatPercent(ratioValue)}%`
        }
        else if (sizing.kind === 'quote' || sizing.kind === 'base') {
          sizingText = `仓位：${this.formatNumber(sizing.value)} ${sizing.asset}`
        }
      }
    }

    // 有 sizing 时优先走 pyramiding_limit 简化输出
    if (sizingText) {
      const pyramidingLimit = (constraints ?? [])
        // #1238 follow-up：open status 也接受，避免 readiness 因软性 requirement 缺失
        //   把用户已显式给出的 constraint 降级后整段不显示。superseded 仍跳过。
        .find(c => c.status !== 'superseded' && c.key === ATOM_CONTRACT_REGISTRY['position.pyramiding_limit'].key)
      if (pyramidingLimit) {
        const maxLayers = this.readFiniteNumber((pyramidingLimit.params as Record<string, unknown>)?.maxLayers as unknown)
        if (maxLayers !== null) {
          const suffix = pyramidingLimit.status === 'open' ? '（待补充）' : ''
          return `${sizingText}，最多${maxLayers}次加仓${suffix}`
        }
      }
    }

    // Task 4 (#1162)：扫 constraints 用 presentationRegistry 渲染（dca_schedule 等）
    // #1238 follow-up：原来只渲染 locked，但 readiness 会把"用户已显式给出但软性
    //   requirement（如 dca_exit_rule）未填"的 constraint 降级到 open，结果用户
    //   说了 DCA UI 完全看不到。改为渲染 locked + open，open 加"（待补充）"提示，
    //   既给用户回显"我识别了你的 DCA 配置"，又保留后续 nextQuestion 追问 exit rule 的空间。
    //   superseded 仍跳过。
    const constraintParts: string[] = []
    for (const constraint of constraints ?? []) {
      if (constraint.status === 'superseded') continue
      try {
        const entry = getLegacyEntry(constraint.key)
        const renderer = entry?.displayRenderer
        if (typeof renderer === 'function') {
          const rendered = renderer({ params: (constraint.params ?? {}) as Record<string, unknown> })
          if (rendered) {
            const suffix = constraint.status === 'open' ? '（待补充）' : ''
            constraintParts.push(`${rendered}${suffix}`)
          }
        }
      }
      catch {
        // presentationRegistry 未注册该 constraint key → skip
      }
    }

    if (sizingText && constraintParts.length > 0) {
      return `${sizingText}；${constraintParts.join('；')}`
    }
    if (sizingText) {
      return sizingText
    }
    if (constraintParts.length > 0) {
      // constraint_only 模式：无 sizing 时也要渲染 constraint
      return constraintParts.join('；')
    }
    return ''
  }

  private hasValidLockedPosition(position: SemanticState['position']): position is SemanticState['position'] & { status: 'locked' } {
    return position?.status === 'locked'
      && validateSemanticPositionContract(position).ok
  }

  private buildRecommendationSignals(input: {
    actions: SemanticState['action']
    triggers: SemanticState['trigger']
    families: SemanticState['families']
  }): {
    hasShortIntent: boolean
    hasLongIntent: boolean
    hasBidirectionalIntent: boolean
    hasGridIntent: boolean
  } {
    const hasGridFamily = input.families.includes('grid.range_rebalance')
      || input.families.some(family => family.includes('grid'))
    const hasGridTrigger = input.triggers.some(trigger =>
      trigger.key.includes('grid')
    )
    const hasGridIntent = hasGridTrigger
      || (hasGridFamily && (input.actions.length > 0 || input.triggers.length > 0))

    const hasLongIntentFromActions = input.actions
      .some(action => action.key === 'open_long' || action.key === 'close_long' || action.key === 'reduce_long')

    const hasShortIntentFromActions = input.actions
      .some(action => action.key === 'open_short' || action.key === 'close_short' || action.key === 'reduce_short')

    const hasLongIntentFromTrigger = input.triggers
      .some(trigger => trigger.sideScope === 'long')

    const hasShortIntentFromTrigger = input.triggers
      .some(trigger => trigger.sideScope === 'short')

    const hasBidirectionalFromSideScope = input.triggers
      .some(trigger => trigger.sideScope === 'both')

    const hasBidirectionalGridSideMode = input.triggers
      .some(trigger => trigger.key === ATOM_CONTRACT_REGISTRY['grid.range_rebalance'].key && trigger.params.sideMode === 'bidirectional')

    const hasLongIntent = hasLongIntentFromActions || hasLongIntentFromTrigger
    const hasShortIntent = hasShortIntentFromActions || hasShortIntentFromTrigger
    const hasBidirectionalIntent = (hasLongIntent && hasShortIntent)
      || hasBidirectionalFromSideScope
      || hasBidirectionalGridSideMode

    return {
      hasShortIntent,
      hasLongIntent,
      hasBidirectionalIntent,
      hasGridIntent,
    }
  }

  private hasDeterministicSemantics(
    input: {
      triggers: SemanticState['trigger']
      actions: SemanticState['action']
      risk: SemanticState['risk']
      position: SemanticState['position']
      hasGridIntent: boolean
      lockedOrchestrationCount: number
    },
  ): boolean {
    return input.triggers.length > 0
      || input.actions.length > 0
      || input.risk.length > 0
      || this.hasValidLockedPosition(input.position)
      || input.hasGridIntent
      || input.lockedOrchestrationCount > 0
  }

  // #1152：orchestration locked 节点摘要。优先 presentationRegistry.displayRenderer 输出完整人话；
  //   displayRenderer 不可用时 fallback 到 publicName；publicName 不可用时 fallback 到 node.key。
  //   #1162 Task 6：去掉 "orchestration：" 裸前缀（内部技术词），改用自然语言拼接。
  private buildOrchestrationSummary(nodes: readonly SemanticOrchestrationNode[]): string {
    if (nodes.length === 0) {
      return ''
    }
    const parts: string[] = []
    for (const node of nodes) {
      if (!node.key) {
        continue
      }
      let text: string | undefined
      try {
        // #1329 follow-up Phase 3d/3e: 已迁入 REGISTRY 的 atom 走 renderLegacyDisplay REGISTRY-first 路径
        const rendered = renderLegacyDisplay(node.key, (node.params ?? {}) as Record<string, unknown>)
        text = rendered || getLegacyEntry(node.key)?.publicName || node.key
      }
      catch {
        text = getLegacyEntry(node.key)?.publicName ?? node.key
      }
      parts.push(text)
    }
    return parts.join('；')
  }

  private compareTriggers(left: SemanticState['trigger'][number], right: SemanticState['trigger'][number]): number {
    const phaseOrder: Record<'entry' | 'exit' | 'risk' | 'gate', number> = {
      entry: 0,
      exit: 1,
      risk: 2,
      gate: 3,
    }
    if (left.phase !== right.phase) {
      return phaseOrder[left.phase] - phaseOrder[right.phase]
    }

    if (left.key !== right.key) {
      return left.key.localeCompare(right.key)
    }

    return left.id.localeCompare(right.id)
  }

  private compareRiskAtoms(
    left: SemanticState['risk'][number],
    right: SemanticState['risk'][number],
  ): number {
    if (left.key !== right.key) {
      return left.key.localeCompare(right.key)
    }

    return left.id.localeCompare(right.id)
  }

  private filterDeterministicAtoms<T extends {
    id: string
    status: 'open' | 'locked' | 'superseded'
    supersedes?: string[]
  }>(atoms: T[]): T[] {
    const supersededIds = new Set(
      atoms
        .flatMap(atom => atom.supersedes ?? [])
        .filter(supersededId => typeof supersededId === 'string'),
    )

    return atoms
      .filter(atom => atom.status === 'locked')
      .filter(atom => !supersededIds.has(atom.id))
      .sort((left, right) => this.compareDeterministicAtoms(left, right))
  }

  private filterDeterministicRisk(riskItems: SemanticState['risk']): SemanticState['risk'] {
    return this.filterDeterministicAtoms(riskItems)
  }

  private filterDeterministicTriggers(triggers: SemanticState['trigger']): SemanticState['trigger'] {
    return this.filterDeterministicAtoms(triggers)
      .sort((left, right) => this.compareTriggers(left, right))
  }

  private filterDeterministicActions(actions: SemanticState['action']): SemanticState['action'] {
    return this.filterDeterministicAtoms(actions)
      .sort((left, right) => this.compareActionAtoms(left, right))
  }

  private formatPercent(value: number): string {
    const normalized = Number.parseFloat(Number(value).toFixed(6))
    return `${normalized}`
  }

  private formatNumber(value: number): string {
    const normalized = Number.parseFloat(Number(value).toFixed(6))
    return `${normalized}`
  }

  private buildInferredDefaults(riskItems: SemanticState['risk']): {
    inferredKeys: Array<'risk.stopLossBasis' | 'risk.takeProfitBasis'>
    stopLossBasis: StrategyRuleBasis['kind'] | null
    takeProfitBasis: StrategyRuleBasis['kind'] | null
  } {
    const inferred: {
      inferredKeys: Array<'risk.stopLossBasis' | 'risk.takeProfitBasis'>
      stopLossBasis: StrategyRuleBasis['kind'] | null
      takeProfitBasis: StrategyRuleBasis['kind'] | null
    } = {
      inferredKeys: [],
      stopLossBasis: null,
      takeProfitBasis: null,
    }

    for (const risk of riskItems) {
      const basis = this.readStrategyRuleBasisKind(risk.params.basis)
      if (!basis || risk.params.basisSource !== 'system_default') {
        continue
      }

      // eslint-disable-next-line atom-keys/no-atom-key-literal -- risk.stop_loss_pct not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329)
      if (risk.key === 'risk.stop_loss_pct' && !inferred.inferredKeys.includes('risk.stopLossBasis')) {
        inferred.inferredKeys.push('risk.stopLossBasis')
        inferred.stopLossBasis = basis
      }

      // eslint-disable-next-line atom-keys/no-atom-key-literal -- risk.take_profit_pct not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329)
      if (risk.key === 'risk.take_profit_pct' && !inferred.inferredKeys.includes('risk.takeProfitBasis')) {
        inferred.inferredKeys.push('risk.takeProfitBasis')
        inferred.takeProfitBasis = basis
      }
    }

    return inferred
  }

  private readStrategyRuleBasisKind(value: unknown): StrategyRuleBasis['kind'] | null {
    if (
      value === 'prev_close'
      || value === 'entry_avg_price'
      || value === 'position_pnl'
      || value === 'peak_equity'
      || value === 'peak_position_pnl'
      || value === 'upper_band'
      || value === 'lower_band'
      || value === 'middle_band'
      || value === 'last_high'
      || value === 'last_low'
    ) {
      return value
    }
    return null
  }

  private findNextOpenSlot(state: SemanticState): SemanticSlotState | null {
    const triggerPhaseOrder: Array<'entry' | 'exit' | 'risk' | 'gate'> = ['entry', 'exit', 'risk', 'gate']
    const openTriggerSlots = triggerPhaseOrder.flatMap(phase =>
      readFlatTriggers(state)
        .filter(trigger => trigger.phase === phase && trigger.status !== 'superseded')
        .flatMap(trigger => trigger.openSlots)
        .filter(slot => slot.status === 'open'),
    )
    const behaviorTriggerSlot = openTriggerSlots.find(slot =>
      slot.priority === 'behavior' || slot.slotKey === 'regimeDefinition',
    )
    if (behaviorTriggerSlot) {
      return behaviorTriggerSlot
    }

    const firstBlockingTriggerSlot = openTriggerSlots[0] ?? null
    if (firstBlockingTriggerSlot) {
      return firstBlockingTriggerSlot
    }

    // Issue #1403 子故障 A — atom 自声明 'sizing'（grid.range_rebalance / DCA /
    //   pyramiding / program.*_grid 等"持续 sizing 源"）即旁路单笔仓位追问。
    //   evaluateRulesReadiness 同步走 hasPosition=true；本路径在 nextQuestion 维度
    //   跳过 state.position.openSlots，与 codegen-conversation 服务共用 registry
    //   单一真相源 ATOM_FULFILLS_STRATEGY_PHASE。
    const hasContinuousSizing = this.executableSemantics.anyAtomFulfillsPhase(state, 'sizing')
    const positionSlot = hasContinuousSizing
      ? null
      : (state.position?.openSlots?.find(slot => slot.status === 'open') ?? null)
    if (positionSlot) {
      return positionSlot
    }

    const actionSlot = readFlatActions(state)
      .flatMap(action => action.openSlots ?? [])
      .find(slot => slot.status === 'open')
    if (actionSlot) {
      return actionSlot
    }

    const riskSlot = readFlatRisks(state)
      .flatMap(risk => risk.openSlots)
      .find(slot => slot.status === 'open')
    if (riskSlot) {
      return riskSlot
    }

    return Object.values(state.contextSlots).find(slot => slot?.status === 'open') ?? null
  }

  private compareActionAtoms(left: SemanticState['action'][number], right: SemanticState['action'][number]): number {
    if (left.key !== right.key) {
      return left.key.localeCompare(right.key)
    }

    return left.id.localeCompare(right.id)
  }

  private compareDeterministicAtoms(
    left: {
      id: string
      status: 'open' | 'locked' | 'superseded'
      supersedes?: string[]
    },
    right: {
      id: string
      status: 'open' | 'locked' | 'superseded'
      supersedes?: string[]
    },
  ): number {
    return left.id.localeCompare(right.id)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Issue #1395 — AtomExpr 树渲染（rules-first 路径）
  //
  // 目的：state.rules 是表达式树主体；扁平桶（trigger/action/risk/...）是派生快照，
  //   被 lift 之后 sequence/AND/OR/NOT 语义已丢。summary 必须从 rules 树渲染才能保留
  //   "先 X 后 Y"/"X 且 Y"/"X 或 Y"/"非 X" 等组合关系。
  //
  // 设计：
  //   - 叶子 atom：复用 ATOM_CONTRACT_REGISTRY[key].display.summaryTemplate（已有中文模板）；
  //     缺模板时退化到 publicName.zh，不要在视图层维护 per-atom 中文（违反 #1383）。
  //   - 组合节点：纯递归字符串拼装，零特殊代码。
  //   - sequence.nextBarOnly → "（下一根）"，withinBars=N → "（N 根内）"。
  //   - rule.phase + rule.sideScope 决定外层包装：入场/出场/前置 + 做多/做空/双向。
  //   - 同 phase 多 rule：以 "；" 分隔，与既有 summary 风格一致。
  // ───────────────────────────────────────────────────────────────────────────

  private renderAtomExpr(expr: AtomExpr): string {
    switch (expr.kind) {
      case 'atom': {
        const summary = this.tryAtomContractSummary(expr.key, expr.params, 'zh')
        if (summary && summary.length > 0) return summary
        // 退化：未注册 summaryTemplate 时取 publicName.zh
        const contract = (ATOM_CONTRACT_REGISTRY as Record<string, { display?: { publicName?: { zh?: string } } } | undefined>)[expr.key]
        const publicName = contract?.display?.publicName?.zh
        if (publicName && publicName.length > 0) return publicName
        // 审查 M3 修复：未注册 / 缺失 zh 名时不把内部 atom key 泄漏到 UI；
        //   warn 到日志便于排查（与 tryAtomContractSummary 的 warn 风格一致）。
        console.warn(`[semantic-state-projection] missing display.publicName.zh for atom key: ${expr.key}`)
        return '已识别条件，参数待补充'
      }
      case 'and': {
        // 审查 R2-2 修复：≥2 个子节点 fallback 到相同 "已识别条件，参数待补充" 时
        //   会拼成「已识别条件，参数待补充 同时 已识别条件，参数待补充」乘积量噪声。
        //   parts 去重保持顺序（首次保留），保证一句兜底文案对用户只显示一次。
        const parts = this.dedupeKeepOrder(expr.children.map(child => this.renderAtomExpr(child)).filter(s => s.length > 0))
        return parts.join(' 同时 ')
      }
      case 'or': {
        const parts = this.dedupeKeepOrder(expr.children.map(child => this.renderAtomExpr(child)).filter(s => s.length > 0))
        return parts.join(' 或 ')
      }
      case 'not': {
        return `非 ${this.renderAtomExpr(expr.child)}`
      }
      case 'sequence': {
        const parts = this.dedupeKeepOrder(expr.steps.map(step => this.renderAtomExpr(step)).filter(s => s.length > 0))
        if (parts.length === 0) return ''
        // 第 0 步 "先 X"；后续步骤 "然后 Y"；保持自然中文顺序
        const head = `先 ${parts[0]}`
        const tail = parts.slice(1).map(p => `然后 ${p}`).join('，')
        const body = tail.length > 0 ? `${head}，${tail}` : head
        const modifiers: string[] = []
        if (expr.nextBarOnly === true) modifiers.push('下一根')
        if (typeof expr.withinBars === 'number' && expr.withinBars > 0) modifiers.push(`${expr.withinBars} 根内`)
        return modifiers.length > 0 ? `${body}（${modifiers.join('，')}）` : body
      }
    }
  }

  private formatRulePhaseLabel(phase: SemanticRulePhase): string {
    if (phase === 'entry') return '入场'
    if (phase === 'exit') return '出场'
    return '前置'
  }

  private formatRuleSideLabel(side: SemanticRuleSideScope): string {
    if (side === 'long') return '做多'
    if (side === 'short') return '做空'
    return '双向'
  }

  private renderRule(rule: SemanticRule): string {
    const phaseLabel = this.formatRulePhaseLabel(rule.phase)
    // effects 通常是 action / risk 副作用，渲染后用 "→" 衔接条件，保留可读性
    const effectParts = (rule.effects ?? [])
      .map(effect => this.renderAtomExpr(effect))
      .filter(s => s.length > 0)

    // Issue #1443 通用 UI 简化：condition 是 always-on runtime gate atom（如
    //   execution.on_start，语义为「策略启动后始终激活」）时，不作为 user-visible
    //   condition 渲染——这类 atom 是技术性运行时门控，用户不关心。直接输出
    //   "${phaseLabel}：${effects}"。
    //
    //   触发条件：rule.condition 是 single-leaf atom 且 key 在 ALWAYS_ON_ATOM_KEYS。
    //   通用机制：通过 atom-key 白名单识别，不针对单策略；新增 always-on atom 只需
    //   扩此常量集。
    const isAlwaysOnCondition = rule.condition.kind === 'atom'
      && ALWAYS_ON_ATOM_KEYS.has(rule.condition.key)

    let bodyText: string
    if (isAlwaysOnCondition) {
      // 跳过 always-on condition；只输出 effects（如 "止损 5% 强制平仓"）
      bodyText = effectParts.length > 0 ? effectParts.join('，') : ''
    }
    else {
      const condition = this.renderAtomExpr(rule.condition)
      if (!condition || condition.length === 0) return ''
      const effectSuffix = effectParts.length > 0 ? ` → ${effectParts.join('，')}` : ''
      bodyText = `${condition}${effectSuffix}`
    }

    if (bodyText.length === 0) return ''

    // Issue #1443 通用 UI 简化：去掉 phaseLabel 后的「（做多/做空/双向）」sideScope 括号。
    //   方向信息已在 effects（open_long/close_long/open_short/close_short）或 condition
    //   atom 文本中体现，括号重复冗余、视觉噪音。
    //   通用机制：所有 rule 一律不带 sideScope 括号；若未来需保留（如纯 condition 无
    //   方向暗示的场景），按 condition+effects 内是否含方向词智能判定再加。
    return `${phaseLabel}：${bodyText}`
  }

  // 审查 R2-2 修复支持：去重保持首次出现顺序。renderAtomExpr 的组合节点用这个
  //   helper 避免相同兜底文案在 and/or/sequence 内被乘积量重复输出。
  private dedupeKeepOrder(parts: ReadonlyArray<string>): string[] {
    const seen = new Set<string>()
    const out: string[] = []
    for (const p of parts) {
      if (seen.has(p)) continue
      seen.add(p)
      out.push(p)
    }
    return out
  }

  private buildRulesSummary(rules: readonly SemanticRule[]): string {
    const lines: string[] = []
    for (const rule of rules) {
      const line = this.renderRule(rule)
      if (line.length > 0) lines.push(line)
    }
    return lines.join('；')
  }


  private timeframeToMinutes(timeframe: string): number {
    const match = /^(\d+)\s*([mhdw])$/iu.exec(timeframe.trim())
    if (!match?.[1] || !match[2]) {
      return Number.MAX_SAFE_INTEGER
    }

    const value = Number(match[1])
    if (!Number.isFinite(value)) {
      return Number.MAX_SAFE_INTEGER
    }

    const unit = match[2].toLowerCase()
    if (unit === 'm') return value
    if (unit === 'h') return value * 60
    if (unit === 'd') return value * 1440
    return value * 10080
  }
}

