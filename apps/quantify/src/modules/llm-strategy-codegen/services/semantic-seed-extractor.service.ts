import { Injectable } from '@nestjs/common'
import type { CodegenSemanticPatch } from '../types/codegen-semantic-patch'
import type {
  SemanticAtomContract,
  SemanticCapability,
  SemanticCapabilityShape,
  SemanticContractKind,
  SemanticExpression,
  SemanticExpressionOperator,
  SemanticExpressionOperand,
  SemanticPositionSizingContract,
  SemanticRiskBasis,
  SemanticRiskBasisSource,
} from '../types/semantic-state'
import { canonicalizeStrategySymbolInput } from './market-scope-equivalence'
import { PositionSizingContractService } from './position-sizing-contract.service'

type SeedTrigger = NonNullable<CodegenSemanticPatch['triggers']>[number]
type SeedAction = NonNullable<CodegenSemanticPatch['actions']>[number]
type SeedRisk = NonNullable<CodegenSemanticPatch['risk']>[number]
type SemanticAliasContext = {
  bollingerBandParams?: {
    period?: number
    stdDev?: number
  }
  movingAverage?: {
    indicator: 'ma' | 'ema'
    period: number
  }
  rsi?: {
    period: number
  }
}

@Injectable()
export class SemanticSeedExtractorService {
  constructor(
    private readonly positionSizingContracts: PositionSizingContractService = new PositionSizingContractService(),
  ) {}

  extract(message?: string): CodegenSemanticPatch {
    const text = this.normalizeText(message)
    if (!text) {
      return {}
    }

    const contextSlots = this.extractContextSlots(text)
    const aliasContext = this.extractAliasContext(text)
    const triggers = this.atomizeTriggers(this.extractTriggers(text, aliasContext))
    const actions = this.atomizeActions(this.extractActions(text, triggers))
    const risk = this.atomizeRisk(this.extractRisk(text))
    const position = this.atomizePosition(this.extractPosition(text, triggers))

    const patch: CodegenSemanticPatch = {}

    if (Object.keys(contextSlots).length > 0) {
      patch.contextSlots = contextSlots
    }
    if (triggers.length > 0) {
      patch.triggers = triggers
    }
    if (actions.length > 0) {
      patch.actions = actions
    }
    if (risk.length > 0) {
      patch.risk = risk
    }
    if (position) {
      patch.position = position
    }

    return patch
  }

  private atomizeTriggers(triggers: SeedTrigger[]): SeedTrigger[] {
    return triggers.map((trigger, index) => (
      this.hasContracts(trigger)
        ? trigger
        : {
            ...trigger,
            contracts: [this.buildAtomContract({
              id: `contract-seed-trigger-${index + 1}-${this.slugifyContractId(trigger.key)}`,
              kind: 'trigger',
              capability: this.buildTriggerCapability(trigger),
              params: trigger.params ?? {},
            })],
          }
    ))
  }

  private atomizeActions(actions: SeedAction[]): SeedAction[] {
    return actions.map((action, index) => (
      this.hasContracts(action)
        ? action
        : {
            ...action,
            contracts: [this.buildAtomContract({
              id: `contract-seed-action-${index + 1}-${this.slugifyContractId(action.key)}`,
              kind: 'action',
              capability: this.buildActionCapability(action),
              params: action.params ?? {},
            })],
          }
    ))
  }

  private atomizeRisk(risk: SeedRisk[]): SeedRisk[] {
    return risk.map((riskItem, index) => (
      this.hasContracts(riskItem)
        ? riskItem
        : {
            ...riskItem,
            contracts: [this.buildAtomContract({
              id: `contract-seed-risk-${index + 1}-${this.slugifyContractId(riskItem.key)}`,
              kind: 'risk',
              capability: this.buildRiskCapability(riskItem),
              params: riskItem.params,
            })],
          }
    ))
  }

  private atomizePosition(
    position: NonNullable<CodegenSemanticPatch['position']> | null,
  ): NonNullable<CodegenSemanticPatch['position']> | null {
    if (!position || this.hasContracts(position)) {
      return position
    }

    return {
      ...position,
      contracts: [this.buildAtomContract({
        id: 'contract-seed-position-sizing',
        kind: 'position',
        capability: this.buildPositionCapability(position),
        params: {
          sizing: position.sizing ?? null,
          mode: position.mode,
          value: position.value,
          positionMode: position.positionMode,
        },
      })],
    }
  }

  private hasContracts(node: { contracts?: SemanticAtomContract[] }): boolean {
    return Array.isArray(node.contracts) && node.contracts.length > 0
  }

  private buildAtomContract(input: {
    id: string
    kind: SemanticContractKind
    capability: SemanticCapability
    params: Record<string, unknown>
  }): SemanticAtomContract {
    return {
      id: input.id,
      kind: input.kind,
      capabilities: [input.capability],
      requires: [],
      params: input.params,
    }
  }

  private buildTriggerCapability(trigger: SeedTrigger): SemanticCapability {
    if (trigger.key === 'grid.range_rebalance') {
      return {
        domain: 'price',
        verb: 'define',
        object: 'level_set',
        shape: this.toCapabilityShape({
          key: trigger.key,
          phase: trigger.phase,
          sideScope: trigger.sideScope ?? null,
          ...(trigger.params ?? {}),
        }),
      }
    }

    if (trigger.key === 'execution.on_start') {
      return {
        domain: 'order_program',
        verb: 'schedule',
        object: 'execution_trigger',
        shape: this.toCapabilityShape({
          key: trigger.key,
          phase: trigger.phase,
          sideScope: trigger.sideScope ?? null,
          ...(trigger.params ?? {}),
        }),
      }
    }

    return {
      domain: 'price',
      verb: 'detect',
      object: 'signal_condition',
      shape: this.toCapabilityShape({
        key: trigger.key,
        phase: trigger.phase,
        sideScope: trigger.sideScope ?? null,
        ...(trigger.params ?? {}),
      }),
    }
  }

  private buildActionCapability(action: SeedAction): SemanticCapability {
    return {
      domain: 'order_program',
      verb: 'execute',
      object: 'order_action',
      shape: this.toCapabilityShape({
        key: action.key,
        side: this.resolveActionSide(action.key),
        intent: this.resolveActionIntent(action.key),
        ...(action.params ?? {}),
      }),
    }
  }

  private buildRiskCapability(risk: SeedRisk): SemanticCapability {
    if (risk.key === 'risk.stop_loss_pct') {
      return {
        domain: 'guard',
        verb: 'enforce',
        object: 'stop_loss',
        shape: this.toCapabilityShape({
          key: risk.key,
          ...risk.params,
        }),
      }
    }

    if (risk.key === 'risk.take_profit_pct') {
      return {
        domain: 'guard',
        verb: 'enforce',
        object: 'take_profit',
        shape: this.toCapabilityShape({
          key: risk.key,
          ...risk.params,
        }),
      }
    }

    return {
      domain: 'guard',
      verb: 'enforce',
      object: 'risk_condition',
      shape: this.toCapabilityShape({
        key: risk.key,
        ...risk.params,
      }),
    }
  }

  private buildPositionCapability(
    position: NonNullable<CodegenSemanticPatch['position']>,
  ): SemanticCapability {
    return {
      domain: 'capital',
      verb: 'allocate',
      object: 'position_sizing',
      shape: this.toCapabilityShape({
        sizing: position.sizing ?? null,
        mode: position.mode,
        value: position.value,
        positionMode: position.positionMode,
      }),
    }
  }

  private resolveActionSide(key: string): 'long' | 'short' | 'unknown' {
    if (key.includes('long')) return 'long'
    if (key.includes('short')) return 'short'
    return 'unknown'
  }

  private resolveActionIntent(key: string): 'open' | 'close' | 'unknown' {
    if (key.startsWith('open_')) return 'open'
    if (key.startsWith('close_')) return 'close'
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

  private toCapabilityShapeValue(
    value: unknown,
  ): string | number | boolean | null | SemanticCapabilityShape | SemanticCapabilityShape[] | undefined {
    if (value === null) return null
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return Number.isNaN(value) ? undefined : value
    }
    if (Array.isArray(value)) {
      return value
        .map(item => this.toCapabilityArrayItem(item))
        .filter((item): item is SemanticCapabilityShape => item !== undefined)
    }
    if (this.isPlainObject(value)) {
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

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }

  private slugifyContractId(value: string): string {
    return value.replace(/[^a-z0-9]+/giu, '-').replace(/^-|-$/gu, '').toLowerCase() || 'atom'
  }

  private extractContextSlots(text: string): NonNullable<CodegenSemanticPatch['contextSlots']> {
    const contextSlots: NonNullable<CodegenSemanticPatch['contextSlots']> = {}

    const exchange = this.extractExchange(text)
    if (exchange) {
      contextSlots.exchange = exchange
    }

    const marketType = this.extractMarketType(text)
    if (marketType) {
      contextSlots.marketType = marketType
    }

    const symbol = this.extractSymbol(text)
    if (symbol) {
      contextSlots.symbol = symbol
    }

    const timeframe = this.extractFirstTimeframe(text)
    if (timeframe) {
      contextSlots.timeframe = timeframe
    }

    return contextSlots
  }

  private extractTriggers(text: string, aliasContext: SemanticAliasContext): SeedTrigger[] {
    const triggers: SeedTrigger[] = []
    const seen = new Set<string>()
    const segments = this.splitSegments(text)

    for (const segment of segments) {
      this.pushCandleExpressionTriggers(segment, triggers, seen)
      this.pushNoPositionGateTriggers(segment, triggers, seen, text)
      this.pushPreviousBarExtremaExpressionTriggers(segment, triggers, seen)
      this.pushMovingAverageCrossTrigger(segment, triggers, seen)
      this.pushMovingAverageTrigger(segment, triggers, seen, aliasContext)
      this.pushBollingerTriggers(segment, triggers, seen, aliasContext)
      this.pushRsiTriggers(segment, triggers, seen, aliasContext)
      this.pushMacdTriggers(segment, triggers, seen, text)
      this.pushPartialBreakoutTriggers(segment, triggers, seen)
      this.pushBreakoutTriggers(segment, triggers, seen)
      this.pushRangePositionTriggers(segment, triggers, seen, text)
      this.pushGridTrigger(segment, triggers, seen)
      this.pushExecutionTrigger(segment, triggers, seen)
      this.pushPercentChangeTrigger(segment, triggers, seen, text)
    }

    return this.harmonizeBollingerTriggers(triggers)
  }

  private extractActions(text: string, triggers: SeedTrigger[]): NonNullable<CodegenSemanticPatch['actions']> {
    const actions: SeedAction[] = []
    const seen = new Set<string>()
    const push = (key: string, params?: Record<string, unknown>, extra?: Omit<SeedAction, 'key' | 'params'>) => {
      const action: SeedAction = {
        key,
        ...(params ? { params } : {}),
        ...(extra ?? {}),
      }
      const signature = JSON.stringify(action)
      if (seen.has(signature)) return
      seen.add(signature)
      actions.push(action)
    }
    const hasShortTrigger = triggers.some(trigger => trigger.sideScope === 'short')
    const hasLongTrigger = triggers.some(trigger => trigger.sideScope === 'long')

    for (const trigger of triggers) {
      if (trigger.key === 'grid.range_rebalance') {
        if (trigger.sideScope === 'short') {
          push('open_short', undefined, this.buildGridOrderProgramActionContracts(text))
          push('close_short')
        } else if (trigger.sideScope === 'both') {
          push('open_long', undefined, this.buildGridOrderProgramActionContracts(text))
          push('close_long')
          push('open_short')
          push('close_short')
        } else {
          push('open_long', undefined, this.buildGridOrderProgramActionContracts(text))
          push('close_long')
        }
        continue
      }

      if (trigger.phase === 'entry') {
        if (trigger.sideScope === 'short') {
          push('open_short')
        } else if (trigger.sideScope === 'long') {
          push('open_long')
        } else if (trigger.sideScope === 'both') {
          push('open_long')
          push('open_short')
        }
        continue
      }

      if (trigger.phase === 'exit') {
        if (trigger.sideScope === 'short') {
          push('close_short')
        } else if (trigger.sideScope === 'long') {
          push('close_long')
        } else if (trigger.sideScope === 'both') {
          push('close_long')
          push('close_short')
        }
      }
    }

    if (actions.length === 0 && (hasShortTrigger || hasLongTrigger)) {
      push('open_long')
    }

    return actions
  }

  private buildGridOrderProgramActionContracts(text: string): Omit<SeedAction, 'key' | 'params'> | undefined {
    if (!/网格/u.test(text)) {
      return undefined
    }

    const perOrderBudget = this.extractPerGridBudget(text)
    return {
      contracts: [{
        id: 'contract-grid-limit-ladder',
        kind: 'action',
        capabilities: [
          {
            domain: 'order_program',
            verb: 'maintain',
            object: 'limit_ladder',
            shape: {
              orderType: 'limit',
              timeInForce: 'gtc',
              recycleOnFill: /反向挂单|反向单|相邻网格|成交后/u.test(text),
              pairingPolicy: /相邻/u.test(text) ? 'adjacent_level' : 'grid_level',
            },
          },
          ...(perOrderBudget
            ? [{
                domain: 'capital' as const,
                verb: 'allocate',
                object: 'per_order_budget',
                shape: {
                  value: perOrderBudget.value,
                  asset: perOrderBudget.asset,
                },
              }]
            : []),
        ],
        requires: [],
        params: {},
      }],
    }
  }

  private extractPerGridBudget(text: string): { value: number; asset: 'USDT' | 'USDC' | 'USD' } | null {
    const match = text.match(/每格(?:资金|金额|预算)?\s*(\d+(?:\.\d+)?)\s*(USDT|USDC|USD|U|u|刀)/u)
      ?? text.match(/(?:每一格|单格)(?:资金|金额|预算)?\s*(\d+(?:\.\d+)?)\s*(USDT|USDC|USD|U|u|刀)/u)
    if (!match?.[1] || !match[2]) {
      return null
    }

    const value = Number(match[1])
    if (!Number.isFinite(value) || value <= 0) {
      return null
    }

    const rawAsset = match[2].toUpperCase()
    const asset = rawAsset === 'USDC' ? 'USDC' : (rawAsset === 'USD' ? 'USD' : 'USDT')
    return { value, asset }
  }

  private extractRisk(text: string): NonNullable<CodegenSemanticPatch['risk']> {
    const risk: NonNullable<CodegenSemanticPatch['risk']> = []

    const stopLossPatterns = [
      /亏损\s*(\d+(?:\.\d+)?)\s*%/u,
      /亏损\s*百分之?\s*(\d+(?:\.\d+)?)/u,
      /止损\s*(\d+(?:\.\d+)?)\s*%/u,
      /止损\s*百分之?\s*(\d+(?:\.\d+)?)/u,
      /(\d+(?:\.\d+)?)\s*%\s*(?:止损|亏损)/u,
      /百分之?\s*(\d+(?:\.\d+)?)\s*(?:止损|亏损)/u,
    ]
    const stopLossClause = this.splitRiskClauses(text)
      .find(clause => !this.isHaltOnlyRiskContext(clause) && this.extractPercent(clause, stopLossPatterns) !== null)
    const stopLoss = stopLossClause ? this.extractPercent(stopLossClause, stopLossPatterns) : null
    if (stopLoss !== null && stopLossClause) {
      const riskContext = this.resolveRiskClauseContext(stopLossClause, 'stop_loss')
      const basis = this.resolveRiskBasis(riskContext)
      const basisSource = this.resolveRiskBasisSource(riskContext, basis)
      risk.push({
        key: 'risk.stop_loss_pct',
        params: {
          valuePct: stopLoss,
          direction: 'loss',
          basis,
          basisSource,
          effect: 'close_position',
          scope: 'current_position',
        },
      })
    }

    const takeProfit = this.extractPercent(text, [
      /盈利\s*(\d+(?:\.\d+)?)\s*%/u,
      /盈利(?:达到|达|到)\s*(\d+(?:\.\d+)?)\s*%/u,
      /盈利\s*百分之?\s*(\d+(?:\.\d+)?)/u,
      /止盈\s*(\d+(?:\.\d+)?)\s*%/u,
      /止盈\s*百分之?\s*(\d+(?:\.\d+)?)/u,
      /(\d+(?:\.\d+)?)\s*%\s*(?:止盈|盈利)/u,
      /百分之?\s*(\d+(?:\.\d+)?)\s*(?:止盈|盈利)/u,
    ])
    if (takeProfit !== null) {
      const riskContext = this.resolveRiskClauseContext(text, 'take_profit')
      const basis = this.resolveRiskBasis(riskContext)
      const basisSource = this.resolveRiskBasisSource(riskContext, basis)
      risk.push({
        key: 'risk.take_profit_pct',
        params: {
          valuePct: takeProfit,
          direction: 'profit',
          basis,
          basisSource,
          effect: 'close_position',
          scope: 'current_position',
        },
      })
    }

    const strategyHaltLoss = this.extractPercent(text, [
      /持仓亏损(?:超过|达到|达|到)\s*(\d+(?:\.\d+)?)\s*%.*(?:暂停策略|停止策略)/u,
      /亏损(?:超过|达到|达|到)\s*(\d+(?:\.\d+)?)\s*%.*(?:暂停策略|停止策略)/u,
      /亏损\s*(\d+(?:\.\d+)?)\s*%.*(?:暂停策略|停止策略)/u,
      /(\d+(?:\.\d+)?)\s*%\s*亏损.*(?:暂停策略|停止策略)/u,
    ])
    if (strategyHaltLoss !== null) {
      const condition: SemanticExpression = {
        kind: 'predicate',
        left: { kind: 'position', field: 'pnl_pct' },
        op: 'LTE',
        right: { kind: 'constant', value: -strategyHaltLoss, unit: 'percent' },
      }
      risk.push({
        key: 'risk.condition_expression',
        params: {
          condition,
          effect: { type: 'pause_strategy' },
          scope: 'strategy',
          capabilityStatus: 'recognized_unsupported',
          unsupportedReason: 'risk_expression_compiler_not_available',
        },
      })
    }

    const boundaryGuard = this.extractBoundaryGuardRisk(text)
    if (boundaryGuard) {
      risk.push(boundaryGuard)
    }

    return risk
  }

  private extractBoundaryGuardRisk(text: string): SeedRisk | null {
    if (!/网格/u.test(text) || !/(?:突破|超出|越过|越界|离开).{0,12}(?:上下边界|上下界|边界|区间)/u.test(text)) {
      return null
    }
    if (!/(?:停止|暂停|停用|立即停止|halt|stop)/iu.test(text) || !/(?:撤销|撤单|取消).{0,12}(?:未成交|挂单|订单)/u.test(text)) {
      return null
    }

    const cancelScope = /网格.{0,8}限价|限价.{0,8}网格/u.test(text)
      ? 'unfilled_grid_limit_orders'
      : 'unfilled_grid_orders'

    return {
      key: 'risk.boundary_guard',
      params: {},
      status: 'locked',
      source: 'user_explicit',
      contracts: [{
        id: 'contract-boundary-stop',
        kind: 'risk',
        capabilities: [{
          domain: 'guard',
          verb: 'enforce',
          object: 'boundary_cancel',
          shape: {
            trigger: 'boundary_breach',
            onBreach: 'HALT_STRATEGY',
            cancelOrders: true,
            cancelScope,
            regrid: false,
          },
        }],
        requires: [],
        params: {},
      }],
    }
  }

  private extractPosition(
    text: string,
    triggers: SeedTrigger[],
  ): NonNullable<CodegenSemanticPatch['position']> | null {
    const parsed = this.positionSizingContracts.parse(text)
    if (parsed) {
      return {
        sizing: parsed.sizing,
        mode: this.resolveLegacySizingMode(parsed.sizing),
        value: parsed.sizing.value,
        positionMode: this.resolvePositionMode(text, triggers),
      }
    }

    const availableBalancePercent = this.extractPercent(text, [
      /(?:使用|用|投入)?\s*(?:可用余额|账户余额|余额)(?:的)?\s*(\d+(?:\.\d+)?)\s*%/u,
      /(?:可用余额|账户余额|余额)(?:的)?\s*百分之?\s*(\d+(?:\.\d+)?)/u,
    ])
    if (availableBalancePercent === null || availableBalancePercent <= 0 || availableBalancePercent > 100) {
      return null
    }

    const value = availableBalancePercent / 100
    return {
      sizing: { kind: 'ratio', value, unit: 'ratio' },
      mode: 'fixed_ratio',
      value,
      positionMode: this.resolvePositionMode(text, triggers),
    }
  }

  private resolveLegacySizingMode(sizing: SemanticPositionSizingContract): 'fixed_ratio' | 'fixed_quote' | 'fixed_qty' {
    if (sizing.kind === 'quote') return 'fixed_quote'
    if (sizing.kind === 'base') return 'fixed_qty'
    return 'fixed_ratio'
  }

  private pushCandleExpressionTriggers(segment: string, triggers: SeedTrigger[], seen: Set<string>): void {
    for (const clause of this.splitLogicClauses(segment)) {
      const expression = this.extractCloseOpenCandleExpression(clause)
      if (!expression) continue

      const intent = this.resolveTradeIntent(clause) ?? this.resolveTradeIntent(segment)
      if (!intent) continue

      this.pushTrigger(triggers, seen, {
        key: 'condition.expression',
        phase: intent.phase,
        sideScope: intent.sideScope,
        params: { expression },
      })
    }
  }

  private pushNoPositionGateTriggers(
    segment: string,
    triggers: SeedTrigger[],
    seen: Set<string>,
    contextText: string,
  ): void {
    const hasExistingPositionOpenBlock = this.hasExistingPositionContext(segment)
      && /(?:不再|不要|不可|不能|禁止|避免|则不再).*(?:开仓|开多|开空)|(?:不开仓|不加仓)/u.test(segment)
    const hasNoPositionEntryGate = this.hasNoPositionContext(segment)
      && /(?:开仓|开多|开空|买入|做多|做空|入场)/u.test(segment)
    const hasInheritedNoPositionEntryGate = !hasNoPositionEntryGate
      && !this.hasExistingPositionContext(segment)
      && this.hasNoPositionContext(contextText)
      && /(?:开仓|开多|开空|买入|做多|做空|入场)/u.test(segment)
    if (!hasExistingPositionOpenBlock && !hasNoPositionEntryGate && !hasInheritedNoPositionEntryGate) return

    const sideScope = this.resolveNoPositionGateSideScope(segment, contextText)
    const expression: SemanticExpression = {
      kind: 'predicate',
      op: 'EQ',
      left: { kind: 'position', field: 'has_position', side: sideScope },
      right: { kind: 'constant', value: false },
    }

    this.pushTrigger(triggers, seen, {
      key: 'condition.expression',
      phase: 'gate',
      sideScope,
      params: { expression },
    })
  }

  private pushPreviousBarExtremaExpressionTriggers(
    segment: string,
    triggers: SeedTrigger[],
    seen: Set<string>,
  ): void {
    for (const clause of this.splitLogicClauses(segment)) {
      const expression = this.extractPreviousBarExtremaExpression(clause)
      if (!expression) continue

      const intent = this.resolveTradeIntent(clause) ?? this.resolveTradeIntent(segment)
      if (!intent) continue

      this.pushTrigger(triggers, seen, {
        key: 'condition.expression',
        phase: intent.phase,
        sideScope: intent.sideScope,
        params: { expression },
      })
    }
  }

  private extractPreviousBarExtremaExpression(clause: string): SemanticExpression | null {
    const compact = clause.replace(/\s+/gu, '')
    const closeLatest = /(?:最新|当前)?(?:K线)?收盘价|close/iu
    const previousHigh = /(?:上一根|前一根|上根)(?:K线)?(?:最高价|最高|高点|high)/iu
    const previousLow = /(?:上一根|前一根|上根)(?:K线)?(?:最低价|最低|低点|low)/iu

    if (closeLatest.test(compact) && previousHigh.test(compact) && /突破|升破|上破|高于|大于|超过|站上|>/u.test(compact)) {
      return {
        kind: 'predicate',
        op: 'GT',
        left: { kind: 'series', source: 'bar', field: 'close', offsetBars: 0 },
        right: { kind: 'series', source: 'bar', field: 'high', offsetBars: 1 },
      }
    }

    if (closeLatest.test(compact) && previousLow.test(compact) && /跌破|下破|跌穿|低于|小于|失守|</u.test(compact)) {
      return {
        kind: 'predicate',
        op: 'LT',
        left: { kind: 'series', source: 'bar', field: 'close', offsetBars: 0 },
        right: { kind: 'series', source: 'bar', field: 'low', offsetBars: 1 },
      }
    }

    return null
  }

  private extractCloseOpenCandleExpression(clause: string): SemanticExpression | null {
    const compact = clause.replace(/\s+/gu, '')
    const relation = this.extractCloseOpenRelation(compact)
    if (!relation) return null

    const op = relation.leftField === 'close' ? relation.operator : this.invertExpressionOperator(relation.operator)
    const left: SemanticExpressionOperand = { kind: 'series', source: 'bar', field: 'close', offsetBars: 0 }
    const right: SemanticExpressionOperand = { kind: 'series', source: 'bar', field: 'open', offsetBars: 0 }

    return {
      kind: 'predicate',
      op,
      left,
      right,
    }
  }

  private extractCloseOpenRelation(compact: string): {
    leftField: 'open' | 'close'
    operator: SemanticExpressionOperator
  } | null {
    const closeOpenMatch = compact.match(/(?:收盘价|close)(不低于|大于等于|至少|>=|不高于|小于等于|至多|<=|高于|大于|超过|>|站上|低于|小于|跌破|<|失守|等于|=|相等)(?:开盘价|open)/iu)
    if (closeOpenMatch?.[1]) {
      const operator = this.resolveExpressionOperatorToken(closeOpenMatch[1])
      return operator ? { leftField: 'close', operator } : null
    }

    const openCloseMatch = compact.match(/(?:开盘价|open)(不低于|大于等于|至少|>=|不高于|小于等于|至多|<=|高于|大于|超过|>|站上|低于|小于|跌破|<|失守|等于|=|相等)(?:收盘价|close)/iu)
    if (openCloseMatch?.[1]) {
      const operator = this.resolveExpressionOperatorToken(openCloseMatch[1])
      return operator ? { leftField: 'open', operator } : null
    }

    return null
  }

  private resolveExpressionOperatorToken(token: string): SemanticExpressionOperator | null {
    if (/不低于|大于等于|至少|>=/u.test(token)) return 'GTE'
    if (/不高于|小于等于|至多|<=/u.test(token)) return 'LTE'
    if (/高于|大于|超过|>|站上/u.test(token)) return 'GT'
    if (/低于|小于|跌破|<|失守/u.test(token)) return 'LT'
    if (/等于|=|相等/u.test(token)) return 'EQ'
    return null
  }

  private invertExpressionOperator(operator: SemanticExpressionOperator): SemanticExpressionOperator {
    switch (operator) {
      case 'GT':
        return 'LT'
      case 'GTE':
        return 'LTE'
      case 'LT':
        return 'GT'
      case 'LTE':
        return 'GTE'
      default:
        return operator
    }
  }

  private resolveNoPositionGateSideScope(segment: string, contextText: string): 'long' | 'short' | 'both' {
    if (/做空|开空|空单|short/u.test(segment)) return 'short'
    if (/做多|开多|多单|买入|long/u.test(segment)) return 'long'
    if (/做空|开空|空单|short/u.test(contextText) && /做多|开多|多单|买入|long/u.test(contextText)) return 'both'
    if (/做空|开空|空单|short/u.test(contextText)) return 'short'
    return 'long'
  }

  private hasExistingPositionContext(segment: string): boolean {
    return /(?:已有|已经有|当前有|现在有|目前有|现有|持有)(?:持仓|仓位)|(?:^|[^没无未])有(?:持仓|仓位)|(?:持仓|仓位)(?:已存在|存在|不为空)/u.test(segment)
  }

  private hasNoPositionContext(segment: string): boolean {
    return /(?:当前|现在|目前)?(?:没有|无|未持有)(?:持仓|仓位)|(?:空仓|无仓位)/u.test(segment)
  }

  private pushMovingAverageTrigger(
    segment: string,
    triggers: SeedTrigger[],
    seen: Set<string>,
    aliasContext: SemanticAliasContext,
  ): void {
    const clauses = this.splitCommaClauses(segment)

    for (const clause of clauses) {
      const subClauses = clause.includes('且') || clause.includes('并且') || clause.includes('同时') || clause.includes('并')
        ? clause.split(/(?:且|并且|同时|并)/u).map(part => part.trim()).filter(Boolean)
        : [clause]

      for (const subClause of subClauses) {
        if (/布林|bollinger|上轨|下轨|中轨/iu.test(subClause)) continue
        if (!/(?:MA|EMA)\s*\d+|均线/u.test(subClause)) continue
        if (this.isTrueMovingAverageCrossClause(subClause)?.isCross) continue
        const referencePeriods = Array.from(subClause.matchAll(/(?:MA|EMA)\s*(\d{1,4})/giu))
          .map(match => Number(match[1]))
          .filter(value => Number.isFinite(value))
        if (referencePeriods.length === 0) {
          const fallbackPeriod = this.extractNumber(subClause, [/均线\s*(\d{1,4})/u])
          if (fallbackPeriod !== null) {
            referencePeriods.push(fallbackPeriod)
          } else if (aliasContext.movingAverage && /(?:该均线|均线)/u.test(subClause)) {
            referencePeriods.push(aliasContext.movingAverage.period)
          } else {
            continue
          }
        }

        const intent = this.resolveTradeIntent(subClause) ?? this.resolveTradeIntent(clause)
        if (!intent) continue

        const confirmationMode = this.extractConfirmationMode(subClause)
        const hasExplicitEma = /\bEMA\s*\d+/iu.test(subClause)
        const hasExplicitMa = /\bMA\s*\d+/iu.test(subClause)
        const indicator = hasExplicitEma
          ? 'ema'
          : (hasExplicitMa ? 'ma' : (aliasContext.movingAverage?.indicator ?? 'ma'))
        const key = /突破|上穿|站上|高于/u.test(subClause)
          ? 'indicator.above'
          : (/跌破|下穿|失守|低于/u.test(subClause) ? 'indicator.below' : null)
        if (!key) continue

        for (const referencePeriod of referencePeriods) {
          this.pushTrigger(triggers, seen, {
            key,
            phase: intent.phase,
            sideScope: intent.sideScope,
            params: {
              indicator,
              referenceRole: referencePeriod >= 20 ? 'long_term' : 'short_term',
              'reference.period': referencePeriod,
              ...(confirmationMode ? { confirmationMode } : {}),
            },
          })
        }
      }
    }
  }

  private pushBollingerTriggers(
    segment: string,
    triggers: SeedTrigger[],
    seen: Set<string>,
    aliasContext: SemanticAliasContext,
  ): void {
    const hasExplicitBollinger = /布林带/u.test(segment)
    if (!hasExplicitBollinger && !aliasContext.bollingerBandParams) return

    const clauses = this.splitCommaClauses(segment)
    const segmentBandParams = this.extractBollingerBandParams(segment) ?? aliasContext.bollingerBandParams

    for (const clause of clauses) {
      const isAliasClause = !/布林带/u.test(clause)
      if (isAliasClause && !this.hasBollingerBandAction(clause)) continue
      const bandParams = this.extractBollingerBandParams(clause) ?? segmentBandParams
      const confirmationMode = this.extractConfirmationMode(clause) ?? this.extractConfirmationMode(segment)
      const intent = this.resolveTradeIntent(clause)

      if (/上轨/u.test(clause)) {
        if (isAliasClause && !intent) continue
        this.pushTrigger(triggers, seen, {
          key: 'bollinger.touch_upper',
          phase: intent?.phase ?? 'entry',
          sideScope: intent?.sideScope ?? 'short',
          params: {
            band: 'upper',
            ...(bandParams?.period !== undefined ? { period: bandParams.period } : {}),
            ...(bandParams?.stdDev !== undefined ? { stdDev: bandParams.stdDev } : {}),
            ...(confirmationMode ? { confirmationMode } : {}),
          },
        })
      }

      if (/下轨/u.test(clause)) {
        if (isAliasClause && !intent) continue
        this.pushTrigger(triggers, seen, {
          key: 'bollinger.touch_lower',
          phase: intent?.phase ?? 'entry',
          sideScope: intent?.sideScope ?? 'long',
          params: {
            band: 'lower',
            ...(bandParams?.period !== undefined ? { period: bandParams.period } : {}),
            ...(bandParams?.stdDev !== undefined ? { stdDev: bandParams.stdDev } : {}),
            ...(confirmationMode ? { confirmationMode } : {}),
          },
        })
      }

      if (/中轨/u.test(clause)) {
        if (isAliasClause && !intent) continue
        this.pushTrigger(triggers, seen, {
          key: 'bollinger.touch_middle',
          phase: 'exit',
          sideScope: this.resolveBollingerMiddleSideScope(clause),
          params: {
            band: 'middle',
            ...(bandParams?.period !== undefined ? { period: bandParams.period } : {}),
            ...(bandParams?.stdDev !== undefined ? { stdDev: bandParams.stdDev } : {}),
            ...(confirmationMode ? { confirmationMode } : {}),
          },
        })
      }
    }
  }

  private resolveBollingerMiddleSideScope(clause: string): 'long' | 'short' | 'both' {
    if (/平空|买回空单|买回平空|做空.*平仓|空单.*平仓/u.test(clause)) return 'short'
    if (/平多|卖出多单|卖出平多|做多.*平仓|多单.*平仓/u.test(clause)) return 'long'
    return 'both'
  }

  private pushMovingAverageCrossTrigger(segment: string, triggers: SeedTrigger[], seen: Set<string>): void {
    const clauses = segment.includes('，') || segment.includes(',')
      ? segment.split(/[，,]/u).map(clause => clause.trim()).filter(Boolean)
      : [segment]

    for (const clause of clauses) {
      const cross = this.parseMovingAverageCrossClause(clause)
      if (!cross) continue

      const intent = this.resolveTradeIntent(clause) ?? this.resolveTradeIntent(segment)
      if (!intent) continue

      if (cross.direction === 'up') {
        this.pushTrigger(triggers, seen, {
          key: 'indicator.cross_over',
          phase: intent.phase,
          sideScope: intent.sideScope,
          params: {
            indicator: cross.indicator,
            ...(cross.fastPeriod !== undefined ? { fastPeriod: cross.fastPeriod } : {}),
            ...(cross.slowPeriod !== undefined ? { slowPeriod: cross.slowPeriod } : {}),
          },
        })
      }

      if (cross.direction === 'down') {
        this.pushTrigger(triggers, seen, {
          key: 'indicator.cross_under',
          phase: intent.phase,
          sideScope: intent.sideScope,
          params: {
            indicator: cross.indicator,
            ...(cross.fastPeriod !== undefined ? { fastPeriod: cross.fastPeriod } : {}),
            ...(cross.slowPeriod !== undefined ? { slowPeriod: cross.slowPeriod } : {}),
          },
        })
      }
    }
  }

  private pushGridTrigger(segment: string, triggers: SeedTrigger[], seen: Set<string>): void {
    if (!/网格/u.test(segment)) return

    const centeredRange = this.extractCenteredGridRange(segment)
    if (centeredRange) {
      const sideScope = this.resolveGridSideScope(segment)
      this.pushTrigger(triggers, seen, {
        key: 'grid.range_rebalance',
        phase: 'entry',
        sideScope,
        params: {
          sideMode: sideScope === 'short'
            ? 'short_only'
            : (sideScope === 'both' ? 'bidirectional' : 'long_only'),
          recycle: /反向挂单|反向单|自动挂/u.test(segment),
          breakoutAction: /停|暂停|停止/u.test(segment) ? 'pause' : 'continue',
        },
        contracts: [{
          id: 'contract-grid-centered-levels',
          kind: 'trigger',
          capabilities: [{
            domain: 'price',
            verb: 'define',
            object: 'level_set',
            shape: {
              mode: 'centered_percent_range',
              centerTiming: centeredRange.centerTiming,
              centerSource: centeredRange.centerSource,
              halfRangePct: centeredRange.halfRangePct,
              gridCount: centeredRange.gridCount,
              spacingMode: 'arithmetic',
            },
          }],
          requires: [],
          params: {},
        }],
      })
      return
    }

    const range = segment.match(/(\d+(?:\.\d+)?)\s*[-~到至]\s*(\d+(?:\.\d+)?)/u)
    const stepPct = this.extractPercent(segment, [
      /步长\s*(\d+(?:\.\d+)?)\s*%/u,
      /间距\s*(\d+(?:\.\d+)?)\s*%/u,
      /每一格\s*(?:间距|距离)?\s*(\d+(?:\.\d+)?)\s*%/u,
      /每格\s*(?:间距|距离)?\s*(\d+(?:\.\d+)?)\s*%/u,
      /千分之\s*(\d+(?:\.\d+)?)/u,
    ])

    if (!range?.[1] || !range[2] || stepPct === null) return

    this.pushTrigger(triggers, seen, {
      key: 'grid.range_rebalance',
      phase: 'entry',
      sideScope: this.resolveGridSideScope(segment),
      params: {
        rangeLower: Number(range[1]),
        rangeUpper: Number(range[2]),
        stepPct,
        sideMode: /做空/u.test(segment)
          ? 'short_only'
          : (/(?:双向|多空|both|bidirectional)/iu.test(segment) ? 'bidirectional' : 'long_only'),
        recycle: true,
        breakoutAction: /停|暂停|停止/u.test(segment) ? 'pause' : 'continue',
      },
    })
  }

  private extractCenteredGridRange(segment: string): {
    centerTiming: 'deployment' | 'runtime'
    centerSource: 'last_trade' | 'last_price' | 'mark_price'
    halfRangePct: number
    gridCount: number
  } | null {
    if (!/(?:当前价|当前价格|最新价|最新成交价|last|标记价|mark).{0,16}(?:中心|为中心)|(?:中心|为中心).{0,16}(?:当前价|当前价格|最新价|最新成交价|last|标记价|mark)/iu.test(segment)) {
      return null
    }

    const halfRangePct = this.extractPercent(segment, [
      /上下\s*各\s*(\d+(?:\.\d+)?)\s*%/u,
      /上下\s*各\s*百分之?\s*(\d+(?:\.\d+)?)/u,
      /上(?:下)?\s*各\s*(\d+(?:\.\d+)?)\s*%/u,
    ])
    const gridCount = this.extractNumber(segment, [
      /共\s*(\d{1,4})\s*格/u,
      /网格(?:数量|数)?\s*(\d{1,4})\s*格?/u,
      /(\d{1,4})\s*格/u,
    ])
    if (halfRangePct === null || halfRangePct <= 0 || gridCount === null || gridCount <= 0) {
      return null
    }

    return {
      centerTiming: /部署|下单|启动|创建/u.test(segment) ? 'deployment' : 'runtime',
      centerSource: /最新成交价|last/iu.test(segment)
        ? 'last_trade'
        : (/标记价|mark/iu.test(segment) ? 'mark_price' : 'last_price'),
      halfRangePct,
      gridCount,
    }
  }

  private resolveGridSideScope(segment: string): 'long' | 'short' | 'both' {
    if (/做空|开空|卖空/u.test(segment) && !/做多|开多|买入/u.test(segment)) {
      return 'short'
    }
    if (/(?:双向|多空|both|bidirectional)/iu.test(segment)) {
      return 'both'
    }
    return 'long'
  }

  private pushRsiTriggers(
    segment: string,
    triggers: SeedTrigger[],
    seen: Set<string>,
    aliasContext: SemanticAliasContext,
  ): void {
    if (!/RSI/iu.test(segment)) return

    const clauses = this.splitLogicClauses(segment)
    const segmentPeriod = this.extractLastRsiPeriod(segment) ?? aliasContext.rsi?.period ?? 14

    for (const clause of clauses) {
      if (!/RSI/iu.test(clause)) continue
      const intent = this.resolveTradeIntent(clause) ?? this.resolveTradeIntent(segment)
      if (!intent) continue

      const period = this.extractLastRsiPeriod(clause) ?? segmentPeriod
      const threshold = this.extractRsiThreshold(clause, period)
      if (threshold === null) continue

      if (/上穿|穿回|向上/u.test(clause)) {
        this.pushTrigger(triggers, seen, {
          key: 'indicator.cross_over',
          phase: intent.phase,
          sideScope: intent.sideScope,
          params: {
            indicator: 'rsi',
            period,
            value: threshold,
          },
        })
        continue
      }

      if (/下穿|跌破|向下/u.test(clause)) {
        this.pushTrigger(triggers, seen, {
          key: 'indicator.cross_under',
          phase: intent.phase,
          sideScope: intent.sideScope,
          params: {
            indicator: 'rsi',
            period,
            value: threshold,
          },
        })
        continue
      }

      if (/高于|大于|超过|上方/u.test(clause)) {
        this.pushTrigger(triggers, seen, {
          key: 'oscillator.rsi_gte',
          phase: intent.phase,
          sideScope: intent.sideScope,
          params: {
            period,
            value: threshold,
          },
        })
        continue
      }

      if (/低于|小于|下方/u.test(clause)) {
        this.pushTrigger(triggers, seen, {
          key: 'oscillator.rsi_lte',
          phase: intent.phase,
          sideScope: intent.sideScope,
          params: {
            period,
            value: threshold,
          },
        })
      }
    }
  }

  private pushMacdTriggers(
    segment: string,
    triggers: SeedTrigger[],
    seen: Set<string>,
    contextText: string,
  ): void {
    if (!/MACD|DIF|DEA/iu.test(segment)) return

    const clauses = this.splitLogicClauses(segment)
    const params = this.extractMacdParams(segment) ?? this.extractMacdParams(contextText)

    for (const clause of clauses) {
      if (!/MACD|DIF|DEA/iu.test(clause)) continue
      const intent = this.resolveTradeIntent(clause) ?? this.resolveTradeIntent(segment)
      if (!intent) continue

      const direction = /上穿|金叉/iu.test(clause)
        ? 'over'
        : (/下穿|死叉/iu.test(clause) ? 'under' : null)
      if (!direction) continue

      this.pushTrigger(triggers, seen, {
        key: direction === 'over' ? 'indicator.cross_over' : 'indicator.cross_under',
        phase: intent.phase,
        sideScope: intent.sideScope,
        params: {
          indicator: 'macd',
          ...(params ? {
            fastPeriod: params.fastPeriod,
            slowPeriod: params.slowPeriod,
            signalPeriod: params.signalPeriod,
          } : {}),
        },
      })
    }
  }

  private pushBreakoutTriggers(segment: string, triggers: SeedTrigger[], seen: Set<string>): void {
    if (!/最近\s*\d{1,4}\s*根\s*K\s*线/u.test(segment)) return
    if (!/突破|跌回|跌破|高点|低点/u.test(segment)) return

    for (const clause of this.splitLogicClauses(segment)) {
      const intent = this.resolveTradeIntent(clause) ?? this.resolveTradeIntent(segment)
      if (!intent) continue

      const highPeriod = this.extractNumber(clause, [
        /(?:突破|升破|上破)\s*最近\s*(\d{1,4})\s*根\s*K\s*线(?:高点|最高|高位)/u,
        /最近\s*(\d{1,4})\s*根\s*K\s*线(?:高点|最高|高位).*?(?:突破|升破|上破)/u,
      ])
      if (highPeriod !== null) {
        const bufferPct = this.extractPercent(clause, [/突破缓冲\s*(\d+(?:\.\d+)?)\s*%/u])
          ?? this.extractPercent(segment, [/突破缓冲\s*(\d+(?:\.\d+)?)\s*%/u])
        this.pushTrigger(triggers, seen, {
          key: 'price.breakout_up',
          phase: intent.phase,
          sideScope: intent.sideScope,
          params: {
            period: highPeriod,
            reference: 'channel_high',
            ...(bufferPct !== null ? { bufferPct } : {}),
          },
        })
        continue
      }

      const lowPeriod = this.extractNumber(clause, [
        /(?:跌回|跌破|下破|跌穿)\s*最近\s*(\d{1,4})\s*根\s*K\s*线(?:低点|最低|低位)/u,
        /最近\s*(\d{1,4})\s*根\s*K\s*线(?:低点|最低|低位).*?(?:跌回|跌破|下破|跌穿)/u,
      ])
      if (lowPeriod !== null) {
        this.pushTrigger(triggers, seen, {
          key: 'price.breakout_down',
          phase: intent.phase,
          sideScope: intent.sideScope,
          params: {
            period: lowPeriod,
            reference: 'channel_low',
          },
        })
      }
    }
  }

  private pushPartialBreakoutTriggers(segment: string, triggers: SeedTrigger[], seen: Set<string>): void {
    if (!/(突破|升破|上破|跌破|下破|失守).{0,12}(关键位置|支撑|压力|阻力)/u.test(segment)) return

    for (const clause of this.splitLogicClauses(segment)) {
      if (!/(突破|升破|上破|跌破|下破|失守).{0,12}(关键位置|支撑|压力|阻力)/u.test(clause)) continue

      const intent = this.resolveTradeIntent(clause) ?? this.resolveTradeIntent(segment)
      if (!intent) continue

      const isDown = /跌破|下破|失守|支撑/u.test(clause)
      const referenceText = /支撑/u.test(clause)
        ? '支撑'
        : /压力|阻力/u.test(clause)
          ? '压力'
          : '关键位置'

      this.pushTrigger(triggers, seen, {
        key: isDown ? 'price.breakout_down' : 'price.breakout_up',
        phase: intent.phase,
        sideScope: intent.sideScope,
        status: 'open',
        params: { reference: 'unknown', referenceText },
        evidence: { text: clause, source: 'user_explicit' },
        openSlots: [{
          slotKey: 'trigger.reference_definition',
          fieldPath: `triggers[${triggers.length}].params.reference`,
          status: 'open',
          priority: 'core',
          questionHint: `请确认${referenceText}如何定义。`,
          affectsExecution: true,
          evidence: { text: referenceText, source: 'user_explicit' },
        }],
      })
    }
  }

  private pushRangePositionTriggers(
    segment: string,
    triggers: SeedTrigger[],
    seen: Set<string>,
    contextText: string,
  ): void {
    if (!/区间/u.test(segment) || !/%/u.test(segment)) return

    const lookbackBars = this.extractNumber(segment, [/最近\s*(\d{1,4})\s*根\s*K\s*线区间/u])
      ?? this.extractNumber(contextText, [/最近\s*(\d{1,4})\s*根\s*K\s*线区间/u])
      ?? 20
    const intent = this.resolveTradeIntent(segment)
    if (!intent) return

    const lowerThreshold = this.extractPercent(segment, [
      /区间\s*下\s*(\d+(?:\.\d+)?)\s*%/u,
      /区间(?:低位|底部)\s*(\d+(?:\.\d+)?)\s*%/u,
    ])
    if (lowerThreshold !== null) {
      this.pushTrigger(triggers, seen, {
        key: 'price.range_position_lte',
        phase: intent.phase,
        sideScope: intent.sideScope,
        params: {
          lookbackBars,
          thresholdPct: lowerThreshold,
        },
      })
      return
    }

    const upperThreshold = this.extractPercent(segment, [
      /区间\s*上\s*(\d+(?:\.\d+)?)\s*%/u,
      /区间(?:高位|顶部)\s*(\d+(?:\.\d+)?)\s*%/u,
    ])
    if (upperThreshold !== null) {
      this.pushTrigger(triggers, seen, {
        key: 'price.range_position_gte',
        phase: intent.phase,
        sideScope: intent.sideScope,
        params: {
          lookbackBars,
          thresholdPct: upperThreshold,
        },
      })
    }
  }

  private pushExecutionTrigger(segment: string, triggers: SeedTrigger[], seen: Set<string>): void {
    if (!/立即|立刻|马上|开始时|启动时|一开始/u.test(segment)) return
    if (!/市价|当前价/u.test(segment) || !/买入|卖出|开仓|平仓|做多|做空/u.test(segment)) return

    const intent = this.resolveTradeIntent(segment)
    if (!intent) return

    this.pushTrigger(triggers, seen, {
      key: 'execution.on_start',
      phase: intent.phase,
      sideScope: intent.sideScope,
      params: {
        timing: 'on_start',
        orderType: 'market',
        occurrence: 'once',
      },
    })
  }

  private pushPercentChangeTrigger(
    segment: string,
    triggers: SeedTrigger[],
    seen: Set<string>,
    contextText: string = segment,
  ): void {
    const clauses = this.splitPercentChangeClauses(segment)
    if (clauses.length > 0 && (clauses.length > 1 || clauses[0] !== segment)) {
      for (const clause of clauses) {
        this.pushPercentChangeTrigger(clause, triggers, seen, contextText)
      }
      return
    }

    if (!/%|百分/u.test(segment)) return
    if (!this.hasExplicitPriceChangeContext(segment)) return
    const direction = this.resolvePercentDirection(segment)
    if (!direction) return

    const intent = this.resolveTradeIntent(segment)
    if (!intent) return

    const valuePct = this.extractPercent(segment, [/(\d+(?:\.\d+)?)\s*%/u, /百分之?\s*(\d+(?:\.\d+)?)/u])
    if (valuePct === null) return

    const basis = this.resolvePercentBasis(segment)
    const window = this.extractFirstTimeframe(segment) ?? this.extractFirstTimeframe(contextText)

    this.pushTrigger(triggers, seen, {
      key: 'price.percent_change',
      phase: intent.phase,
      sideScope: intent.sideScope,
      params: {
        direction,
        valuePct: direction === 'down' ? -Math.abs(valuePct) : Math.abs(valuePct),
        basis,
        ...(window ? { window } : {}),
      },
    })
  }

  private splitPercentChangeClauses(segment: string): string[] {
    const rawClauses = segment
      .split(/[，,、；;。]|(?:另有|另外|同时|并且|以及)/u)
      .map(clause => clause.trim())

    const clauses = rawClauses
      .filter(Boolean)
      .filter(clause => /%|百分/u.test(clause))
      .filter(clause => /(上涨|下跌|涨|跌|回落|回调|反弹)/u.test(clause))
      .filter(clause => /(买入|卖出|入场|出场|离场|开仓|平仓|平多|平空|做多|做空|开多|开空)/u.test(clause))
      .filter(clause => !/(止损|止盈|亏损|盈利)/u.test(clause))

    if (rawClauses.filter(Boolean).length > 1) {
      return clauses
    }

    const clausePattern = /\d{1,2}\s*(?:m|h|d|分钟|分|小时|时|天|日)[^；;。,，]*?(?:上涨|下跌|涨|跌)[^；;。,，]*?(?:\d+(?:\.\d+)?\s*%|百分之?\s*\d+(?:\.\d+)?)[^；;。,，]*?(?:买入|卖出|入场|出场|离场|开仓|平仓|平多|平空|做多|做空|开多|开空)/giu
    const matches = Array.from(segment.matchAll(clausePattern))
      .map(match => match[0].trim())
      .filter(Boolean)
    return matches.length > 0 ? matches : [segment]
  }

  private pushTrigger(triggers: SeedTrigger[], seen: Set<string>, trigger: SeedTrigger): void {
    const signature = JSON.stringify([trigger.key, trigger.phase, trigger.sideScope ?? null, trigger.params])
    if (seen.has(signature)) return
    seen.add(signature)
    triggers.push(trigger)
  }

  private resolvePositionMode(text: string, triggers: SeedTrigger[]): 'long_only' | 'short_only' | 'long_short' {
    const sideScopes = new Set(triggers.map(trigger => trigger.sideScope).filter(Boolean))

    if (sideScopes.has('long') && sideScopes.has('short')) {
      return 'long_short'
    }
    if (/双向网格/u.test(text) || /bidirectional/u.test(text)) {
      return 'long_short'
    }
    if (/做空|开空|卖空/u.test(text) && !/做多|开多|买入/u.test(text)) {
      return 'short_only'
    }
    return 'long_only'
  }

  private resolveRiskBasis(text: string): SemanticRiskBasis {
    if (/持仓盈亏|持仓.*盈亏|持仓收益率|持仓.*收益率|浮盈|pnl/u.test(text)) {
      return 'position_pnl'
    }
    return 'entry_avg_price'
  }

  private resolveRiskBasisSource(text: string, basis: SemanticRiskBasis): SemanticRiskBasisSource {
    if (basis === 'position_pnl') {
      return 'user_explicit'
    }
    if (/开仓价|入场价|入场均价|持仓均价|成本价|均价|entry_avg_price/u.test(text)) {
      return 'user_explicit'
    }
    return 'system_default'
  }

  private resolveRiskClauseContext(text: string, kind: 'stop_loss' | 'take_profit'): string {
    const matcher = kind === 'stop_loss'
      ? /亏损|止损/u
      : /盈利|止盈/u
    return this.splitRiskClauses(text).find(clause => matcher.test(clause)) ?? text
  }

  private splitRiskClauses(text: string): string[] {
    return text
      .split(/[；;。。，,、]|(?:并且|以及|同时|且)/u)
      .map(clause => clause.trim())
      .filter(Boolean)
  }

  private isHaltOnlyRiskContext(text: string): boolean {
    return /暂停策略|停止策略/u.test(text) && !/止损|平仓|全平/u.test(text)
  }

  private resolveTradeIntent(segment: string): { phase: 'entry' | 'exit'; sideScope: 'long' | 'short' } | null {
    if (/买回平空|平空|买回空单/u.test(segment)) {
      return { phase: 'exit', sideScope: 'short' }
    }
    if (/卖出平多|平多|卖出多单/u.test(segment)) {
      return { phase: 'exit', sideScope: 'long' }
    }
    if (/出场|离场/u.test(segment)) {
      return { phase: 'exit', sideScope: /做空|开空|空单|short/u.test(segment) ? 'short' : 'long' }
    }
    if (/做空|开空|空单|short/u.test(segment)) {
      return { phase: 'entry', sideScope: 'short' }
    }
    if (/卖出/u.test(segment)) {
      return { phase: 'exit', sideScope: /做空|开空|空单|short/u.test(segment) ? 'short' : 'long' }
    }
    if (/做多|开多|买入|入场|开仓|long/u.test(segment)) {
      return { phase: 'entry', sideScope: 'long' }
    }
    if (/平仓/u.test(segment)) {
      return { phase: 'exit', sideScope: /做空|开空|空单|short/u.test(segment) ? 'short' : 'long' }
    }
    return null
  }

  private isTrueMovingAverageCrossClause(clause: string): { isCross: boolean } | null {
    return this.parseMovingAverageCrossClause(clause)
      ? { isCross: true }
      : null
  }

  private parseMovingAverageCrossClause(clause: string): {
    indicator: 'ma' | 'ema'
    direction: 'up' | 'down'
    fastPeriod?: number
    slowPeriod?: number
  } | null {
    const normalized = clause.replace(/\s+/gu, '')
    const indicator: 'ma' | 'ema' = /\bEMA\s*\d+/iu.test(clause) ? 'ema' : 'ma'
    const refs = Array.from(normalized.matchAll(/(?:EMA|MA)(\d{1,4})/giu))
      .map(match => Number(match[1]))
      .filter(value => Number.isFinite(value))
    const barePairMatch = normalized.match(/(\d{1,4})[\/和与、](\d{1,4})均线/)
      ?? normalized.match(/(\d{1,4})均线.*?(\d{1,4})均线/)
    const barePairRefs = barePairMatch
      ? [Number(barePairMatch[1]), Number(barePairMatch[2])].filter(value => Number.isFinite(value))
      : []
    const resolvedRefs = refs.length > 0 ? refs : barePairRefs

    const hasUpWord = /上穿|crossover|金叉/iu.test(normalized)
    const hasDownWord = /下穿|crossunder|死叉/iu.test(normalized)
    if (!hasUpWord && !hasDownWord) {
      return null
    }

    const hasPairMarkers = /[\/和与、]/u.test(normalized) || /均线/iu.test(normalized) || resolvedRefs.length >= 2
    if (!hasPairMarkers) {
      return null
    }

    const isExplicitPairCross = /(?:EMA|MA)\d{1,4}.*?(?:上穿|下穿|crossover|crossunder).*(?:EMA|MA)\d{1,4}/iu.test(normalized)
      || /(\d{1,4})[\/和与、](\d{1,4})均线.*?(?:上穿|下穿|crossover|crossunder)/iu.test(normalized)
    const isGoldenCrossPair = /(?:EMA|MA)\d{1,4}.*?(?:和|\/|与|、)?(?:EMA|MA)\d{1,4}.*?(?:金叉|死叉)/iu.test(normalized)
      || /(?:\d{1,4})\s*[\/和与、]\s*(?:\d{1,4})\s*均线.*?(?:金叉|死叉)/iu.test(normalized)

    if (!isExplicitPairCross && !isGoldenCrossPair) {
      return null
    }

    const direction: 'up' | 'down' = hasUpWord ? 'up' : 'down'
    const fastPeriod = resolvedRefs[0]
    const slowPeriod = resolvedRefs[1]

    return {
      indicator,
      direction,
      ...(fastPeriod !== undefined ? { fastPeriod } : {}),
      ...(slowPeriod !== undefined ? { slowPeriod } : {}),
    }
  }

  private extractRsiThreshold(clause: string, period: number): number | null {
    const compact = clause.replace(/\s+/gu, '')
    const explicitThreshold = this.extractNumber(compact, [
      /(?:高于|大于|超过|上方|低于|小于|下方|上穿|穿回|下穿|跌破)(\d+(?:\.\d+)?)/u,
      /(?:从)?(\d+(?:\.\d+)?)(?:上方|下方)(?:向上|向下)?(?:穿回|上穿|下穿|跌破)/u,
    ])
    if (explicitThreshold !== null) return explicitThreshold

    const numbers = Array.from(compact.matchAll(/\d+(?:\.\d+)?/gu))
      .map(match => Number(match[0]))
      .filter(value => Number.isFinite(value))
    const withoutPeriod = numbers.filter(value => value !== period)
    return withoutPeriod[0] ?? numbers[0] ?? null
  }

  private extractMacdParams(text: string): { fastPeriod: number; slowPeriod: number; signalPeriod: number } | null {
    const match = text.match(/MACD\s*(\d{1,3})\s*\/\s*(\d{1,3})\s*\/\s*(\d{1,3})/iu)
    if (!match?.[1] || !match[2] || !match[3]) return null
    const fastPeriod = Number(match[1])
    const slowPeriod = Number(match[2])
    const signalPeriod = Number(match[3])
    if (!Number.isFinite(fastPeriod) || !Number.isFinite(slowPeriod) || !Number.isFinite(signalPeriod)) {
      return null
    }
    return { fastPeriod, slowPeriod, signalPeriod }
  }

  private splitLogicClauses(segment: string): string[] {
    return segment
      .split(/[，,、]|(?:且|并且|同时|以及)/u)
      .map(clause => clause.trim())
      .filter(Boolean)
  }

  private hasExplicitPriceChangeContext(segment: string): boolean {
    return /(相对|上一根|前一根|前收盘|收盘价|开仓均价|入场价|成本价|持仓盈亏|盈亏|pnl|收益率)/iu.test(segment)
      || /(?:\d{1,2}\s*(?:m|h|d|分钟|分|小时|时|天|日)).*(?:上涨|下跌|涨|跌).*(?:%|百分)/iu.test(segment)
  }

  private hasExplicitPriceChangeDirection(segment: string): boolean {
    return /(上涨|下跌|涨|跌|回落|回调|反弹)/u.test(segment)
  }

  private hasExecutableTradeIntent(segment: string): boolean {
    return /(买入|卖出|入场|出场|离场|开仓|平仓|平多|平空|做多|做空|开多|开空|多单|空单)/u.test(segment)
  }

  private hasBollingerBandAction(segment: string): boolean {
    return /(触及|突破|回到|回归|跌破|上穿|下穿|站上|失守|高于|低于)/u.test(segment)
  }

  private resolvePercentDirection(segment: string): 'up' | 'down' | null {
    if (/(下跌|跌|回落|回调)/u.test(segment)) {
      return 'down'
    }
    if (/(上涨|涨|反弹)/u.test(segment)) {
      return 'up'
    }
    return null
  }

  private extractAliasContext(text: string): SemanticAliasContext {
    const bollingerBandParams = this.extractBollingerBandAliasContext(text)
    const movingAverage = this.extractMovingAverageAliasContext(text)
    const rsi = this.extractRsiAliasContext(text)

    return {
      ...(bollingerBandParams ? { bollingerBandParams } : {}),
      ...(movingAverage ? { movingAverage } : {}),
      ...(rsi ? { rsi } : {}),
    }
  }

  private extractMovingAverageAliasContext(text: string): SemanticAliasContext['movingAverage'] | null {
    const declarations = this.splitSegments(text)
      .flatMap(segment => this.splitLogicClauses(segment))
      .filter(clause => this.isMovingAverageAliasDeclarationClause(clause))
      .map(clause => ({
        declaration: this.extractLastMovingAverageDeclaration(clause),
        isCorrection: this.isCorrectionClause(clause),
      }))
      .filter((item): item is { declaration: { indicator: 'ma' | 'ema'; period: number }; isCorrection: boolean } => item.declaration !== null)
    const lastCorrection = declarations.filter(item => item.isCorrection).at(-1)
    if (lastCorrection) {
      return lastCorrection.declaration
    }

    const uniqueDeclarations = declarations.map(item => item.declaration).filter((declaration, index, all) => (
      all.findIndex(item => item.indicator === declaration.indicator && item.period === declaration.period) === index
    ))
    const declaration = uniqueDeclarations[0]

    return uniqueDeclarations.length === 1 && declaration ? declaration : null
  }

  private extractLastMovingAverageDeclaration(clause: string): { indicator: 'ma' | 'ema'; period: number } | null {
    const matches = Array.from(clause.matchAll(/\b(MA|EMA)\s*(\d{1,4})(?!\s*[\/和与、]\s*\d)/giu))
      .filter(match => match.index !== undefined)
      .sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
    const match = matches.at(-1)
    if (!match?.[1] || !match[2]) return null

    const period = Number(match[2])
    if (!Number.isFinite(period)) return null

    return {
      indicator: match[1].toLowerCase() === 'ema' ? 'ema' : 'ma',
      period,
    }
  }

  private isMovingAverageAliasDeclarationClause(clause: string): boolean {
    if (/布林|bollinger|上轨|下轨|中轨/iu.test(clause)) return false
    if (this.hasExecutableTradeIntent(clause)) return false
    if (/(?:突破|上穿|站上|高于|跌破|下穿|失守|低于)/u.test(clause)) return false
    if (this.isCorrectionClause(clause)) {
      return /\b(?:MA|EMA)\s*\d{1,4}(?!\s*[\/和与、]\s*\d)/iu.test(clause)
    }
    if (!/(使用|采用|基于|指标|参数|设置|用)/u.test(clause)) return false
    return /\b(?:MA|EMA)\s*\d{1,4}(?!\s*[\/和与、]\s*\d)/iu.test(clause)
  }

  private extractRsiAliasContext(text: string): SemanticAliasContext['rsi'] | null {
    const declarations = this.splitSegments(text)
      .flatMap(segment => this.splitLogicClauses(segment))
      .filter(clause => this.isRsiAliasDeclarationClause(clause))
      .map(clause => ({
        period: this.extractLastRsiPeriod(clause),
        isCorrection: this.isCorrectionClause(clause),
      }))
      .filter((item): item is { period: number; isCorrection: boolean } => item.period !== null)
    const lastCorrection = declarations.filter(item => item.isCorrection).at(-1)
    if (lastCorrection) {
      return { period: lastCorrection.period }
    }

    const uniquePeriods = Array.from(new Set(declarations.map(item => item.period)))
    const period = uniquePeriods[0]

    return uniquePeriods.length === 1 && period !== undefined ? { period } : null
  }

  private extractLastRsiPeriod(clause: string): number | null {
    const matches = Array.from(clause.matchAll(/RSI\s*(\d{1,3})/giu))
      .filter(match => match.index !== undefined)
      .sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
    const match = matches.at(-1)
    if (!match?.[1]) return null

    const period = Number(match[1])
    return Number.isFinite(period) ? period : null
  }

  private extractBollingerBandAliasContext(text: string): SemanticAliasContext['bollingerBandParams'] | null {
    const declarations = this.splitSegments(text)
      .flatMap(segment => this.splitCommaClauses(segment))
      .filter(clause => this.isBollingerAliasDeclarationClause(clause))
      .map(clause => ({
        params: this.extractLastBollingerBandParams(clause),
        isCorrection: this.isCorrectionClause(clause),
      }))
      .filter((declaration): declaration is { params: { period?: number; stdDev?: number }; isCorrection: boolean } => declaration.params !== null)
    const lastCorrection = declarations.filter(declaration => declaration.isCorrection).at(-1)
    if (lastCorrection) {
      return lastCorrection.params
    }

    const uniqueDeclarations = declarations.map(declaration => declaration.params).filter((declaration, index, all) => (
      all.findIndex(item => item.period === declaration.period && item.stdDev === declaration.stdDev) === index
    ))
    const declaration = uniqueDeclarations[0]

    return uniqueDeclarations.length === 1 && declaration ? declaration : null
  }

  private isBollingerAliasDeclarationClause(clause: string): boolean {
    if (!/布林带|bollinger/iu.test(clause)) return false
    if (this.hasExecutableTradeIntent(clause)) return false
    if (/(?:上轨|下轨|中轨)/u.test(clause) && this.hasBollingerBandAction(clause)) return false
    if (this.isCorrectionClause(clause)) return true
    return /(使用|采用|基于|指标|参数|设置|用)/u.test(clause)
  }

  private isCorrectionClause(clause: string): boolean {
    return /(更正|修正|改为|调整为|改成|不是|而是)/u.test(clause)
  }

  private isRsiAliasDeclarationClause(clause: string): boolean {
    if (this.hasExecutableTradeIntent(clause)) return false
    if (this.isCorrectionClause(clause)) return /RSI\s*\d{1,3}/iu.test(clause)
    if (!/(使用|采用|基于|指标|参数|设置|用)/u.test(clause)) return false
    return /RSI\s*\d{1,3}/iu.test(clause)
  }

  private extractLastBollingerBandParams(segment: string): { period?: number; stdDev?: number } | null {
    const matches = [
      ...Array.from(segment.matchAll(/布林带\s*[（(]\s*(\d{1,4})\s*[，,]\s*(\d+(?:\.\d+)?)\s*[)）]/gu)),
      ...Array.from(segment.matchAll(/布林带\s*(\d{1,4})\s*[，,]\s*(\d+(?:\.\d+)?)/gu)),
      ...Array.from(segment.matchAll(/布林带\s*(\d{1,4})\s*(?:周期|日|根|period)?\s*(\d+(?:\.\d+)?)\s*(?:倍)?\s*标准差/gu)),
    ]
      .filter(match => match.index !== undefined)
      .sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
    const match = matches.at(-1)
    if (!match?.[1] || !match[2]) return null

    const period = Number(match[1])
    const stdDev = Number(match[2])
    if (!Number.isFinite(period) || !Number.isFinite(stdDev)) return null

    return { period, stdDev }
  }

  private extractBollingerBandParams(segment: string): { period?: number; stdDev?: number } | null {
    const match = segment.match(/布林带\s*[（(]\s*(\d{1,4})\s*[，,]\s*(\d+(?:\.\d+)?)\s*[)）]/u)
      ?? segment.match(/布林带\s*(\d{1,4})\s*[，,]\s*(\d+(?:\.\d+)?)/u)
      ?? segment.match(/布林带\s*(\d{1,4})\s*(?:周期|日|根|period)?\s*(\d+(?:\.\d+)?)\s*(?:倍)?\s*标准差/u)
    if (!match?.[1] || !match[2]) return null

    const period = Number(match[1])
    const stdDev = Number(match[2])
    if (!Number.isFinite(period) || !Number.isFinite(stdDev)) return null

    return { period, stdDev }
  }

  private harmonizeBollingerTriggers(triggers: SeedTrigger[]): SeedTrigger[] {
    const reference = triggers.find(trigger => (
      trigger.key.startsWith('bollinger.touch_')
      && typeof trigger.params?.period === 'number'
      && typeof trigger.params.stdDev === 'number'
    ))

    if (!reference) {
      return triggers
    }

    return triggers.map((trigger) => {
      if (!trigger.key.startsWith('bollinger.touch_')) {
        return trigger
      }
      return {
        ...trigger,
        params: {
          ...trigger.params,
          ...(typeof trigger.params?.period === 'number' ? {} : { period: reference.params.period }),
          ...(typeof trigger.params?.stdDev === 'number' ? {} : { stdDev: reference.params.stdDev }),
        },
      }
    })
  }

  private resolvePercentBasis(segment: string): 'prev_close' | 'entry_avg_price' | 'position_pnl' {
    if (/开仓均价|入场价|成本价/u.test(segment)) {
      return 'entry_avg_price'
    }
    if (/持仓盈亏|持仓.*盈亏|浮盈|pnl/u.test(segment)) {
      return 'position_pnl'
    }
    return 'prev_close'
  }

  private extractConfirmationMode(segment: string): 'close_confirm' | null {
    if (/收盘|确认|close/u.test(segment)) {
      return 'close_confirm'
    }
    return null
  }

  private extractExchange(text: string): string | null {
    const match = text.match(/\b(OKX|BINANCE|HYPERLIQUID)\b/iu)
    if (!match?.[1]) return null

    return match[1].toLowerCase()
  }

  private extractMarketType(text: string): string | null {
    if (/现货|spot/u.test(text)) return 'spot'
    if (/合约|永续|perp|swap|\bcontract\b/iu.test(text)) return 'perp'
    return null
  }

  private extractSymbol(text: string): string | null {
    const match = text.match(/\b([A-Z0-9]{2,20}(?:[-/]?(?:USDT|USDC|USD))(?:-SWAP|:PERP|:SPOT)?)\b/iu)
    return canonicalizeStrategySymbolInput(match?.[1])
  }

  private extractFirstTimeframe(text: string): string | null {
    const compactMatch = text.match(/\b(\d{1,2})(m|h|d)\b/iu)
    if (compactMatch?.[1] && compactMatch[2]) {
      return `${compactMatch[1]}${compactMatch[2].toLowerCase()}`
    }

    const chineseMatch = text.match(/(\d{1,2})\s*(分钟|分|小时|时|天|日)/u)
    if (!chineseMatch?.[1] || !chineseMatch[2]) return null
    const unit = chineseMatch[2]
    const suffix = unit === '分钟' || unit === '分'
      ? 'm'
      : unit === '小时' || unit === '时'
        ? 'h'
        : 'd'
    return `${chineseMatch[1]}${suffix}`
  }

  private extractNumber(text: string, patterns: RegExp[]): number | null {
    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match?.[1] === undefined) continue
      const value = Number(match[1])
      if (Number.isFinite(value)) {
        return value
      }
    }
    return null
  }

  private extractPercent(text: string, patterns: RegExp[]): number | null {
    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match?.[1] === undefined) continue
      const value = Number(match[1])
      if (Number.isFinite(value)) {
        return value
      }
    }
    return null
  }

  private splitSegments(text: string): string[] {
    return text
      .split(/[；;。]/u)
      .map(segment => segment.trim())
      .filter(Boolean)
  }

  private splitCommaClauses(segment: string): string[] {
    const clauses: string[] = []
    let depth = 0
    let start = 0

    for (let index = 0; index < segment.length; index += 1) {
      const char = segment[index]
      if (char === '(' || char === '（') {
        depth += 1
        continue
      }
      if (char === ')' || char === '）') {
        depth = Math.max(0, depth - 1)
        continue
      }
      if (depth === 0 && (char === '，' || char === ',')) {
        if (this.isBollingerParamComma(segment, index)) continue
        const clause = segment.slice(start, index).trim()
        if (clause) clauses.push(clause)
        start = index + 1
      }
    }

    const tail = segment.slice(start).trim()
    if (tail) clauses.push(tail)
    return clauses.length > 0 ? clauses : [segment]
  }

  private isBollingerParamComma(segment: string, commaIndex: number): boolean {
    const before = segment.slice(0, commaIndex)
    const after = segment.slice(commaIndex + 1)
    return /布林带\s*\d{1,4}\s*$/u.test(before) && /^\s*\d+(?:\.\d+)?/u.test(after)
  }

  private normalizeText(message?: string): string {
    return message?.trim().replace(/\s+/gu, ' ') ?? ''
  }
}
