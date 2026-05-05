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
  SemanticSlotState,
} from '../types/semantic-state'
import { canonicalizeStrategySymbolInput } from './market-scope-equivalence'
import { PositionSizingContractService } from './position-sizing-contract.service'
import { SemanticEventFrameParserService } from './semantic-event-frame-parser.service'
import { SemanticEventFrameProjectorService } from './semantic-event-frame-projector.service'

type SeedTrigger = NonNullable<CodegenSemanticPatch['triggers']>[number]
type SeedAction = NonNullable<CodegenSemanticPatch['actions']>[number]
type SeedRisk = NonNullable<CodegenSemanticPatch['risk']>[number]
type FixedGridRange = {
  lower: number
  upper: number
}

const LEVEL_SET_DENSITY_SLOT_KEY = 'contract.shape.price.level_set.density'
const LEVEL_SET_SPACING_CONFLICT_SLOT_KEY = 'contract.shape.price.level_set.spacing_conflict'
const GRID_FIXED_LEVEL_SET_SHAPE_FIELD_PATH = 'triggers[grid.range_rebalance].contracts[contract-grid-fixed-levels].capabilities[price.define.level_set].shape'
const REDUCED_INDICATOR_CROSS_SIGNATURE_INDICATORS = new Set(['ma', 'ema', 'moving_average', 'macd'])

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
  private readonly eventFrameParser = new SemanticEventFrameParserService()
  private readonly eventFrameProjector = new SemanticEventFrameProjectorService()

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
    const eventFramePatch = this.eventFrameProjector.project(this.eventFrameParser.parse(text))
    const triggers = this.atomizeTriggers(this.mergeSeedTriggers(
      eventFramePatch.triggers ?? [],
      this.extractTriggers(text, aliasContext),
    ))
    const actions = this.atomizeActions(this.mergeSeedActions(
      eventFramePatch.actions ?? [],
      this.extractActions(text, triggers),
    ))
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

  private mergeSeedTriggers(
    primaryTriggers: readonly SeedTrigger[],
    secondaryTriggers: readonly SeedTrigger[],
  ): SeedTrigger[] {
    const merged: SeedTrigger[] = []
    const seen = new Set<string>()

    for (const trigger of [...primaryTriggers, ...secondaryTriggers]) {
      const signature = this.buildTriggerMergeSignature(trigger)
      if (seen.has(signature)) continue
      seen.add(signature)
      merged.push(trigger)
    }

    return merged
  }

  private buildTriggerMergeSignature(trigger: SeedTrigger): string {
    if (this.isIndicatorCrossTrigger(trigger)) {
      return JSON.stringify({
        key: trigger.key,
        phase: trigger.phase,
        sideScope: trigger.sideScope ?? null,
        params: this.stableValue({
          indicator: trigger.params?.indicator,
          semantic: this.resolveIndicatorCrossSemantic(trigger),
          fastPeriod: trigger.params?.fastPeriod,
          slowPeriod: trigger.params?.slowPeriod,
          signalPeriod: trigger.params?.signalPeriod,
        }),
      })
    }

    return JSON.stringify({
      key: trigger.key,
      phase: trigger.phase,
      sideScope: trigger.sideScope ?? null,
      params: this.stableValue(trigger.params ?? {}),
    })
  }

  private isIndicatorCrossTrigger(trigger: SeedTrigger): boolean {
    return (trigger.key === 'indicator.cross_over' || trigger.key === 'indicator.cross_under')
      && typeof trigger.params?.indicator === 'string'
      && REDUCED_INDICATOR_CROSS_SIGNATURE_INDICATORS.has(trigger.params.indicator)
  }

  private resolveIndicatorCrossSemantic(trigger: SeedTrigger): string {
    if (trigger.params?.semantic === 'cross_up' || trigger.params?.semantic === 'cross_down') {
      return trigger.params.semantic
    }
    return trigger.key === 'indicator.cross_over' ? 'cross_up' : 'cross_down'
  }

  private mergeSeedActions(
    primaryActions: readonly SeedAction[],
    secondaryActions: readonly SeedAction[],
  ): SeedAction[] {
    const merged: SeedAction[] = []
    const seen = new Set<string>()

    for (const action of [...primaryActions, ...secondaryActions]) {
      const signature = JSON.stringify({
        key: action.key,
        params: this.stableValue(action.params ?? {}),
      })
      if (seen.has(signature)) continue
      seen.add(signature)
      merged.push(action)
    }

    return merged
  }

  private stableValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map(item => this.stableValue(item))
    }
    if (this.isPlainObject(value)) {
      return Object.fromEntries(
        Object.entries(value)
          .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
          .map(([key, item]) => [key, this.stableValue(item)]),
      )
    }
    return value
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

    if (trigger.key === 'price.detect.indicator_boundary') {
      return {
        domain: 'price',
        verb: 'detect',
        object: 'indicator_boundary',
        shape: this.toCapabilityShape({
          key: trigger.key,
          phase: trigger.phase,
          sideScope: trigger.sideScope ?? null,
          ...(trigger.params ?? {}),
        }),
      }
    }

    if (trigger.key === 'volume.spike' || trigger.key === 'volume.threshold') {
      return {
        domain: 'market',
        verb: 'detect',
        object: 'volume_condition',
        shape: this.toCapabilityShape({
          key: trigger.key,
          phase: trigger.phase,
          sideScope: trigger.sideScope ?? null,
          ...(trigger.params ?? {}),
        }),
      }
    }

    if (trigger.key === 'volatility.atr_threshold') {
      return {
        domain: 'market',
        verb: 'detect',
        object: 'volatility_condition',
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

    if (risk.key === 'risk.atr_stop') {
      return {
        domain: 'guard',
        verb: 'enforce',
        object: 'atr_stop',
        shape: this.toCapabilityShape({
          key: risk.key,
          ...risk.params,
        }),
      }
    }

    if (risk.key === 'risk.partial_take_profit') {
      return {
        domain: 'guard',
        verb: 'enforce',
        object: 'partial_take_profit',
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

    const timeframes = this.extractAllTimeframes(text)
    const timeframe = this.hasMultiTimeframeMovingAveragePredicateScope(text)
      ? null
      : (timeframes[0] ?? this.extractFirstTimeframe(text))
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
      this.pushIndicatorBoundaryTriggers(segment, triggers, seen, aliasContext)
      this.pushRsiTriggers(segment, triggers, seen, aliasContext)
      this.pushMacdTriggers(segment, triggers, seen, text)
      this.pushPartialBreakoutTriggers(segment, triggers, seen)
      this.pushBreakoutTriggers(segment, triggers, seen)
      this.pushRangePositionTriggers(segment, triggers, seen, text)
      this.pushGridTrigger(segment, triggers, seen, text)
      this.pushExecutionTrigger(segment, triggers, seen)
      this.pushPercentChangeTrigger(segment, triggers, seen, text)
      this.pushMarketStateTriggers(segment, triggers, seen)
      this.pushRecognizedUnsupportedTriggers(segment, triggers, seen)
      this.pushUnknownUnsupportedTriggers(segment, triggers, seen)
    }

    if (!triggers.some(trigger => trigger.key === 'grid.range_rebalance')) {
      this.pushGridTrigger(text, triggers, seen)
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
          push('open_short', undefined, this.buildGridOrderProgramActionContracts(text, trigger))
          push('close_short')
        } else if (trigger.sideScope === 'both') {
          push('open_long', undefined, this.buildGridOrderProgramActionContracts(text, trigger))
          push('close_long')
          push('open_short')
          push('close_short')
        } else {
          push('open_long', undefined, this.buildGridOrderProgramActionContracts(text, trigger))
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

    this.pushRecognizedUnsupportedActions(text, actions, seen)

    return actions
  }

  private buildGridOrderProgramActionContracts(text: string, trigger: SeedTrigger): Omit<SeedAction, 'key' | 'params'> | undefined {
    if (!this.hasLevelSetContract(trigger) && !this.hasGridSemantics(text)) {
      return undefined
    }

    const perOrderBudget = this.extractPerGridBudget(text)
    const shouldRecycleOnFill = /反向挂单|反向单|相邻网格|成交后|双向网格|真实网格/u.test(text)
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
              recycleOnFill: shouldRecycleOnFill,
              pairingPolicy: shouldRecycleOnFill || /相邻/u.test(text) ? 'adjacent_level' : 'grid_level',
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

  private hasLevelSetContract(trigger: SeedTrigger): boolean {
    return trigger.contracts?.some(contract =>
      contract.capabilities.some(capability =>
        capability.domain === 'price'
        && capability.verb === 'define'
        && capability.object === 'level_set',
      ),
    ) ?? false
  }

  private extractPerGridBudget(text: string): { value: number; asset: 'USDT' | 'USDC' | 'USD' } | null {
    const match = text.match(/每格(?:下单)?(?:资金|金额|预算)?\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(USDT|USDC|USD|U|u|刀)/u)
      ?? text.match(/(?:每一格|单格)(?:下单)?(?:资金|金额|预算)?\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(USDT|USDC|USD|U|u|刀)/u)
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

    const trailingStop = this.extractPercent(text, [
      /移动止损\s*(\d+(?:\.\d+)?)\s*%/u,
      /trailing[_\s-]?stop\D{0,8}(\d+(?:\.\d+)?)\s*%/iu,
    ])
    if (trailingStop !== null && !/(?:ATR|平均真实波幅).{0,12}(?:移动止损|动态止损|止损|trailing)/iu.test(text)) {
      risk.push({
        key: 'risk.trailing_stop_pct',
        params: {
          valuePct: trailingStop,
          direction: 'loss',
          basis: 'entry_avg_price',
          basisSource: 'user_explicit',
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

    this.pushRecognizedUnsupportedRisk(text, risk)

    return risk
  }

  private pushRecognizedUnsupportedRisk(text: string, risk: SeedRisk[]): void {
    for (const clause of this.splitRiskClauses(text)) {
      if (this.hasNegatedUnsupportedContext(clause)) continue

      if (this.hasAtrStopSemantics(clause)) {
        this.pushRisk(risk, {
          key: 'risk.atr_stop',
          params: { sourceText: clause },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        })
      }

      if (/(?:分批止盈|部分止盈|多档止盈|平一半|scale\s*out)/iu.test(clause)) {
        this.pushRisk(risk, {
          key: 'risk.partial_take_profit',
          params: { sourceText: clause },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        })
      }
    }
  }

  private hasAtrStopSemantics(clause: string): boolean {
    return /(?:ATR|平均真实波幅).{0,12}(?:移动止损|动态止损|止损)/iu.test(clause)
      || /\bATR\s+(?:(?:moving|dynamic|trailing)\s+)?stop\b/iu.test(clause)
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
    const unsupportedPosition = this.extractRecognizedUnsupportedPosition(text, triggers)
    if (unsupportedPosition) {
      return unsupportedPosition
    }

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
      const previousExtrema = this.extractPreviousExtremaReference(clause)
      if (previousExtrema) {
        const intent = this.resolveTradeIntent(clause) ?? this.resolveTradeIntent(segment)
        if (intent) {
          this.pushTrigger(triggers, seen, {
            key: 'price.previous_extrema',
            phase: intent.phase,
            sideScope: intent.sideScope,
            params: previousExtrema,
          })
        }
      }

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

  private extractPreviousExtremaReference(clause: string): { indicator: 'previous_extrema'; reference: 'previous_high' | 'previous_low'; event: 'breakout_up' | 'breakout_down' } | null {
    if (/前高/u.test(clause) && /突破|升破|上破|高于|超过/u.test(clause)) {
      return {
        indicator: 'previous_extrema',
        reference: 'previous_high',
        event: 'breakout_up',
      }
    }

    if (/前低/u.test(clause) && /跌破|下破|失守|低于/u.test(clause)) {
      return {
        indicator: 'previous_extrema',
        reference: 'previous_low',
        event: 'breakout_down',
      }
    }

    return null
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
      const subClauses = this.splitConjunctionClauses(clause)

      for (const subClause of subClauses) {
        if (/布林|bollinger|上轨|下轨|中轨/iu.test(subClause)) continue
        if (!/(?:MA|EMA)\s*\d+|均线/iu.test(subClause)) continue
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
        const key = /突破|上穿|站上|高于|上方/u.test(subClause)
          ? 'indicator.above'
          : (/跌破|下穿|失守|低于|下方/u.test(subClause) ? 'indicator.below' : null)
        if (!key) continue

        const timeframes = this.extractAllTimeframes(subClause)

        for (const referencePeriod of referencePeriods) {
          const params = {
            indicator,
            referenceRole: referencePeriod >= 20 ? 'long_term' : 'short_term',
            'reference.period': referencePeriod,
            ...(confirmationMode ? { confirmationMode } : {}),
          }
          const targetTimeframes = timeframes.length > 0
            ? timeframes
            : []

          if (targetTimeframes.length > 0) {
            for (const timeframe of targetTimeframes) {
              this.pushTrigger(triggers, seen, {
                key,
                phase: intent.phase,
                sideScope: intent.sideScope,
                params: { ...params, timeframe },
              })
            }
          } else {
            this.pushTrigger(triggers, seen, {
              key,
              phase: intent.phase,
              sideScope: intent.sideScope,
              params,
            })
          }
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
    if (hasExplicitBollinger && this.hasMultipleBoundaryRolesInOneCommaClause(segment)) return
    if (this.shouldPreferUniversalBoundaryTriggersForBollinger(segment)) return

    const clauses = this.splitCommaClauses(segment)
    const segmentBandParams = this.extractBollingerBandParams(segment) ?? aliasContext.bollingerBandParams
    let previousEntrySideScope: 'long' | 'short' | null = null

    for (const clause of clauses) {
      const isAliasClause = !/布林带/u.test(clause)
      if (isAliasClause && !this.hasBollingerBandAction(clause)) continue
      const bandParams = this.extractBollingerBandParams(clause) ?? segmentBandParams
      const confirmationMode = this.extractConfirmationMode(clause) ?? this.extractConfirmationMode(segment)
      const intent = this.resolveTradeIntent(clause)

      if (/上轨/u.test(clause)) {
        if (!intent) continue
        this.pushTrigger(triggers, seen, {
          key: 'bollinger.touch_upper',
          phase: intent.phase,
          sideScope: intent.sideScope,
          params: {
            band: 'upper',
            ...(bandParams?.period !== undefined ? { period: bandParams.period } : {}),
            ...(bandParams?.stdDev !== undefined ? { stdDev: bandParams.stdDev } : {}),
            ...(confirmationMode ? { confirmationMode } : {}),
          },
        })
        if (intent.phase === 'entry') {
          previousEntrySideScope = intent.sideScope
        }
      }

      if (/下轨/u.test(clause)) {
        if (!intent) continue
        this.pushTrigger(triggers, seen, {
          key: 'bollinger.touch_lower',
          phase: intent.phase,
          sideScope: intent.sideScope,
          params: {
            band: 'lower',
            ...(bandParams?.period !== undefined ? { period: bandParams.period } : {}),
            ...(bandParams?.stdDev !== undefined ? { stdDev: bandParams.stdDev } : {}),
            ...(confirmationMode ? { confirmationMode } : {}),
          },
        })
        if (intent.phase === 'entry') {
          previousEntrySideScope = intent.sideScope
        }
      }

      if (/中轨/u.test(clause)) {
        if (!intent) continue
        this.pushTrigger(triggers, seen, {
          key: 'bollinger.touch_middle',
          phase: 'exit',
          sideScope: this.resolveBollingerMiddleSideScope(clause, previousEntrySideScope),
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

  private hasIndicatorBoundaryLanguage(segment: string): boolean {
    return /布林线|布林带|bollinger|通道|channel|上轨|下轨|中轨|上沿|下沿|中线|上边界|下边界|边界/iu.test(segment)
  }

  private resolveIndicatorName(segment: string, aliasContext?: SemanticAliasContext): 'bollinger' | 'channel' | 'generic_boundary' {
    if (/布林线|布林带|bollinger/iu.test(segment)) return 'bollinger'
    if (/通道|channel/iu.test(segment)) return 'channel'
    if (aliasContext?.bollingerBandParams && /上轨|下轨|中轨/iu.test(segment)) return 'bollinger'
    return 'generic_boundary'
  }

  private resolveBoundaryRole(clause: string): 'upper' | 'lower' | 'middle' | null {
    if (/上轨|上沿|上边界|upper/iu.test(clause)) return 'upper'
    if (/下轨|下沿|下边界|lower/iu.test(clause)) return 'lower'
    if (/中轨|中线|middle|midline/iu.test(clause)) return 'middle'
    return null
  }

  private pushIndicatorBoundaryTriggers(
    segment: string,
    triggers: SeedTrigger[],
    seen: Set<string>,
    aliasContext: SemanticAliasContext,
  ): void {
    if (!this.hasIndicatorBoundaryLanguage(segment)) return
    if (this.isBareBollingerBoundaryAlias(segment, aliasContext) && !this.hasBollingerBandAction(segment)) return

    const indicatorName = this.resolveIndicatorName(segment, aliasContext)
    const bandParams = indicatorName === 'bollinger'
      ? this.extractBollingerBandParams(segment) ?? aliasContext.bollingerBandParams
      : null

    let previousEntrySideScope: 'long' | 'short' | null = null
    for (const clause of this.splitIndicatorBoundaryClauses(segment)) {
      const boundaryRole = this.resolveBoundaryRole(clause)
      if (!boundaryRole) continue

      const intent = this.resolveIndicatorBoundaryTradeIntent(clause, previousEntrySideScope)
      if (!intent) continue

      const confirmationMode = this.extractBoundaryConfirmationMode(clause)
        ?? this.extractConfirmationMode(segment)

      this.pushTrigger(triggers, seen, {
        key: 'price.detect.indicator_boundary',
        phase: intent.phase,
        sideScope: intent.sideScope,
        params: {
          indicator: {
            name: indicatorName,
            sourceText: this.extractIndicatorSourceText(clause),
            ...(bandParams?.period !== undefined ? { period: bandParams.period } : {}),
            ...(bandParams?.stdDev !== undefined ? { stdDev: bandParams.stdDev } : {}),
          },
          boundaryRole,
          ...(confirmationMode ? { confirmationMode } : {}),
          sourceText: clause,
        },
      })
      if (intent.phase === 'entry' && intent.sideScope !== 'both') {
        previousEntrySideScope = intent.sideScope
      }
    }
  }

  private resolveIndicatorBoundaryTradeIntent(
    clause: string,
    previousEntrySideScope: 'long' | 'short' | null,
  ): { phase: 'entry' | 'exit'; sideScope: 'long' | 'short' | 'both' } | null {
    const explicitCloseSideScope = this.resolveExplicitCloseSideScope(clause)
    if (explicitCloseSideScope) return { phase: 'exit', sideScope: explicitCloseSideScope }

    const intent = this.resolveTradeIntent(clause)
    if (intent) {
      if (intent.phase === 'exit' && !this.hasExplicitTradeSide(clause)) {
        return {
          ...intent,
          sideScope: previousEntrySideScope ?? 'both',
        }
      }
      return intent
    }
    if (/(?:买)(?!回)/u.test(clause)) return { phase: 'entry', sideScope: 'long' }
    if (/卖/u.test(clause)) return { phase: 'exit', sideScope: 'long' }
    return null
  }

  private resolveExplicitCloseSideScope(clause: string): 'long' | 'short' | null {
    if (!/平仓|平多|平空|离场|出场/u.test(clause)) return null
    if (/平空|买回空单|买回平空|空单|做空|开空|short/u.test(clause)) return 'short'
    if (/平多|卖出多单|卖出平多|多单|做多|开多|long/u.test(clause)) return 'long'
    return null
  }

  private hasExplicitTradeSide(clause: string): boolean {
    return /做空|开空|空单|short|平空|买回空单|买回平空|做多|开多|多单|long|平多|卖出多单|卖出平多|买入|卖出/u.test(clause)
  }

  private isBareBollingerBoundaryAlias(segment: string, aliasContext: SemanticAliasContext): boolean {
    return Boolean(aliasContext.bollingerBandParams)
      && !/布林线|布林带|bollinger|通道|channel|上边界|下边界|边界/iu.test(segment)
      && /上轨|下轨|中轨/iu.test(segment)
  }

  private shouldPreferUniversalBoundaryTriggersForBollinger(segment: string): boolean {
    const clauses = this.splitCommaClauses(segment)
    if (clauses.length < 2) return false
    const explicitBollingerBoundaryClauses = clauses.filter(clause => (
      /布林带|bollinger/iu.test(clause)
      && this.resolveBoundaryRole(clause) !== null
      && this.resolveTradeIntent(clause) !== null
    ))
    return explicitBollingerBoundaryClauses.length >= 2
  }

  private hasMultipleBoundaryRolesInOneCommaClause(segment: string): boolean {
    return this.splitCommaClauses(segment).some((clause) => {
      const roles = new Set(
        Array.from(clause.matchAll(/上轨|下轨|中轨|上沿|下沿|中线|上边界|下边界|upper|lower|middle|midline/giu))
          .map(match => this.resolveBoundaryRole(match[0]))
          .filter((role): role is 'upper' | 'lower' | 'middle' => role !== null),
      )
      return roles.size > 1
    })
  }

  private splitIndicatorBoundaryClauses(segment: string): string[] {
    return this.splitCommaClauses(segment).flatMap((clause) => {
      const matches = Array.from(clause.matchAll(/(?:上轨|下轨|中轨|上沿|下沿|中线|上边界|下边界|边界|upper|lower|middle|midline)/giu))
      if (matches.length <= 1) return [clause]

      return matches.map((match, index) => {
        const start = match.index ?? 0
        const end = matches[index + 1]?.index ?? clause.length
        return clause.slice(start, end).trim()
      }).filter(Boolean)
    })
  }

  private extractIndicatorSourceText(clause: string): string {
    const match = clause.match(/布林线|布林带|bollinger|通道|channel|上轨|下轨|中轨|上沿|下沿|中线|上边界|下边界|边界/iu)
    return match?.[0] ?? 'boundary'
  }

  private resolveBollingerMiddleSideScope(
    clause: string,
    previousEntrySideScope: 'long' | 'short' | null = null,
  ): 'long' | 'short' | 'both' {
    if (/平空|买回空单|买回平空|做空.*平仓|空单.*平仓/u.test(clause)) return 'short'
    if (/平多|卖出多单|卖出平多|做多.*平仓|多单.*平仓/u.test(clause)) return 'long'
    if (previousEntrySideScope) return previousEntrySideScope
    return 'both'
  }

  private pushMovingAverageCrossTrigger(segment: string, triggers: SeedTrigger[], seen: Set<string>): void {
    const clauses = segment.includes('，') || segment.includes(',')
      ? segment.split(/[，,]/u).map(clause => clause.trim()).filter(Boolean)
      : [segment]

    for (const clause of clauses) {
      const cross = this.parseMovingAverageCrossClause(clause) ?? this.parseGenericMovingAverageCrossClause(clause, segment)
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
            semantic: 'cross_up',
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
            semantic: 'cross_down',
            ...(cross.fastPeriod !== undefined ? { fastPeriod: cross.fastPeriod } : {}),
            ...(cross.slowPeriod !== undefined ? { slowPeriod: cross.slowPeriod } : {}),
          },
        })
      }
    }
  }

  private parseGenericMovingAverageCrossClause(
    clause: string,
    segment: string,
  ): { indicator: 'moving_average'; direction: 'up' | 'down'; fastPeriod?: number; slowPeriod?: number } | null {
    const hasMovingAverageContext = /均线|moving\s*average/iu.test(clause) || /均线|moving\s*average/iu.test(segment)
    if (!hasMovingAverageContext) return null
    if (/金叉/u.test(clause)) return { indicator: 'moving_average', direction: 'up' }
    if (/死叉/u.test(clause)) return { indicator: 'moving_average', direction: 'down' }
    return null
  }

  private pushGridTrigger(segment: string, triggers: SeedTrigger[], seen: Set<string>, context = segment): void {
    if (!this.hasGridSemantics(segment)) return
    const sideScopeContext = `${segment} ${context}`

    const centeredRange = this.extractCenteredGridRange(segment)
    if (centeredRange) {
      const sideScope = this.resolveGridSideScope(sideScopeContext)
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
              ...(centeredRange.gridIntervals !== null ? { gridIntervals: centeredRange.gridIntervals } : {}),
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

    const fixedRange = this.extractFixedGridRange(segment)
    const stepPct = this.extractPercent(segment, [
      /步长\s*(\d+(?:\.\d+)?)\s*%/u,
      /间距\s*(\d+(?:\.\d+)?)\s*%/u,
      /按\s*(\d+(?:\.\d+)?)\s*%\s*网格/u,
      /(\d+(?:\.\d+)?)\s*%\s*网格/u,
      /每一格\s*(?:间距|距离)?\s*(\d+(?:\.\d+)?)\s*%/u,
      /每格\s*(?:间距|距离)?\s*(\d+(?:\.\d+)?)\s*%/u,
      /千分之\s*(\d+(?:\.\d+)?)/u,
    ])
    const absoluteSpacing = this.extractAbsoluteGridSpacing(segment)
    const explicitGridCount = this.extractGridLevelCount(segment)
    const gridIntervals = this.extractGridIntervals(segment)

    if (!fixedRange) return

    const sideScope = this.resolveGridSideScope(sideScopeContext)
    const absoluteSpacingGridCount = explicitGridCount === null && gridIntervals === null && absoluteSpacing !== null
      ? this.deriveGridCountFromAbsoluteSpacing(fixedRange.lower, fixedRange.upper, absoluteSpacing)
      : null
    const hasAbsoluteSpacingConflict = explicitGridCount === null
      && gridIntervals === null
      && absoluteSpacing !== null
      && absoluteSpacingGridCount === null
    const hasMissingDensity = explicitGridCount === null
      && gridIntervals === null
      && absoluteSpacing === null
      && stepPct === null
    const shape: SemanticCapabilityShape = {
      mode: 'fixed_range',
      lower: fixedRange.lower,
      upper: fixedRange.upper,
      spacingMode: 'arithmetic',
      ...(explicitGridCount !== null ? { gridCount: explicitGridCount } : {}),
      ...(explicitGridCount === null && gridIntervals !== null
        ? {
            gridIntervals,
            gridCount: gridIntervals + 1,
          }
        : {}),
      ...(absoluteSpacingGridCount !== null ? { gridCount: absoluteSpacingGridCount } : {}),
      ...(absoluteSpacing !== null ? { absoluteSpacing } : {}),
      ...(stepPct !== null ? { spacingPct: stepPct } : {}),
    }
    if (!('gridCount' in shape) && stepPct !== null) {
      shape.gridCount = this.deriveGridCountFromPercentStep(fixedRange.lower, fixedRange.upper, stepPct)
    }

    this.pushTrigger(triggers, seen, {
      key: 'grid.range_rebalance',
      phase: 'entry',
      sideScope,
      ...(hasAbsoluteSpacingConflict || hasMissingDensity
        ? {
            status: 'open' as const,
            openSlots: [
              hasAbsoluteSpacingConflict
                ? this.buildLevelSetSpacingConflictOpenSlot()
                : this.buildLevelSetDensityOpenSlot(),
            ],
          }
        : {}),
      params: {
        rangeLower: fixedRange.lower,
        rangeUpper: fixedRange.upper,
        ...(stepPct !== null ? { stepPct } : {}),
        ...(absoluteSpacing !== null ? { absoluteSpacing } : {}),
        ...(explicitGridCount !== null ? { gridCount: explicitGridCount } : {}),
        ...(explicitGridCount === null && gridIntervals !== null ? { gridIntervals, gridCount: gridIntervals + 1 } : {}),
        ...(absoluteSpacingGridCount !== null ? { gridCount: absoluteSpacingGridCount } : {}),
        sideMode: sideScope === 'short'
          ? 'short_only'
          : (sideScope === 'both' ? 'bidirectional' : 'long_only'),
        recycle: true,
        breakoutAction: /停|暂停|停止/u.test(segment) ? 'pause' : 'continue',
      },
      contracts: [{
        id: 'contract-grid-fixed-levels',
        kind: 'trigger',
        capabilities: [{
          domain: 'price',
          verb: 'define',
          object: 'level_set',
          shape,
        }],
        requires: [],
        params: {},
      }],
    })
  }

  private buildLevelSetDensityOpenSlot(): SemanticSlotState {
    return {
      slotKey: LEVEL_SET_DENSITY_SLOT_KEY,
      fieldPath: GRID_FIXED_LEVEL_SET_SHAPE_FIELD_PATH,
      status: 'open',
      priority: 'core',
      questionHint: '请确认网格数量或每格间距，例如 20 格 / 每格 100 USDT / 每格 0.5%。',
      affectsExecution: true,
    }
  }

  private buildLevelSetSpacingConflictOpenSlot(): SemanticSlotState {
    return {
      slotKey: LEVEL_SET_SPACING_CONFLICT_SLOT_KEY,
      fieldPath: GRID_FIXED_LEVEL_SET_SHAPE_FIELD_PATH,
      status: 'open',
      priority: 'core',
      questionHint: '价格区间无法按每格间距整除，请调整间距或格数。',
      affectsExecution: true,
    }
  }

  private hasGridSemantics(segment: string): boolean {
    return /网格|每格|每一格|单格|共\s*\d{1,4}\s*格|拆成\s*\d{1,4}\s*份|分成\s*\d{1,4}\s*(?:格|份)/u.test(segment)
  }

  private extractFixedGridRange(segment: string): FixedGridRange | null {
    const match = segment.match(/(?:价格区间|固定区间|区间)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(?:-|~|到|至)\s*(\d+(?:\.\d+)?)/u)
      ?? segment.match(/(\d+(?:\.\d+)?)\s*(?:-|~|到|至)\s*(\d+(?:\.\d+)?)/u)

    if (!match?.[1] || !match[2]) {
      return null
    }

    const lower = Number(match[1])
    const upper = Number(match[2])
    if (!Number.isFinite(lower) || !Number.isFinite(upper) || lower <= 0 || upper <= lower) {
      return null
    }

    return { lower, upper }
  }

  private extractGridLevelCount(segment: string): number | null {
    return this.extractPositiveInteger(segment, [
      /网格(?:数量|数)?\s*[:：]?\s*(\d{1,4})\s*个/u,
      /网格(?:数量|数)?\s*[:：]?\s*(\d{1,4})(?!\s*格)/u,
      /(\d{1,4})\s*个\s*网格/u,
    ])
  }

  private extractGridIntervals(segment: string): number | null {
    return this.extractPositiveInteger(segment, [
      /共\s*(\d{1,4})\s*格/u,
      /网格(?:数量|数)?\s*[:：]?\s*(\d{1,4})\s*格/u,
      /拆成\s*(\d{1,4})\s*份/u,
      /分成\s*(\d{1,4})\s*(?:格|份)/u,
    ])
  }

  private extractAbsoluteGridSpacing(segment: string): number | null {
    return this.extractNumber(segment, [
      /每格(?:价格)?(?:间距|距离)\s*[:：]?\s*(\d+(?:\.\d+)?)(?![\d.])(?!\s*%)\s*(?:USDT|USDC|USD|U|u|刀)?/u,
      /每一格(?:价格)?(?:间距|距离)\s*[:：]?\s*(\d+(?:\.\d+)?)(?![\d.])(?!\s*%)\s*(?:USDT|USDC|USD|U|u|刀)?/u,
      /单格(?:价格)?(?:间距|距离)\s*[:：]?\s*(\d+(?:\.\d+)?)(?![\d.])(?!\s*%)\s*(?:USDT|USDC|USD|U|u|刀)?/u,
    ])
  }

  private extractPositiveInteger(segment: string, patterns: RegExp[]): number | null {
    const value = this.extractNumber(segment, patterns)
    if (value === null || !Number.isInteger(value) || value <= 0) {
      return null
    }

    return value
  }

  private deriveGridCountFromPercentStep(lower: number, upper: number, stepPct: number): number {
    if (!Number.isFinite(lower) || !Number.isFinite(upper) || !Number.isFinite(stepPct) || lower <= 0 || upper <= lower || stepPct <= 0) {
      return 2
    }

    const ratio = 1 + stepPct / 100
    if (ratio <= 1) {
      return 2
    }

    return Math.max(2, Math.floor(Math.log(upper / lower) / Math.log(ratio)) + 1)
  }

  private deriveGridCountFromAbsoluteSpacing(lower: number, upper: number, absoluteSpacing: number): number | null {
    if (!Number.isFinite(lower) || !Number.isFinite(upper) || !Number.isFinite(absoluteSpacing) || lower <= 0 || upper <= lower || absoluteSpacing <= 0) {
      return null
    }

    const intervals = (upper - lower) / absoluteSpacing
    const roundedIntervals = Math.round(intervals)
    if (roundedIntervals < 1 || Math.abs(intervals - roundedIntervals) > 1e-9) {
      return null
    }

    return roundedIntervals + 1
  }

  private extractCenteredGridRange(segment: string): {
    centerTiming: 'deployment' | 'runtime'
    centerSource: 'last_trade' | 'last_price' | 'mark_price'
    halfRangePct: number
    gridIntervals: number | null
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
    const gridIntervals = this.extractGridIntervals(segment)
    const explicitGridCount = this.extractGridLevelCount(segment)
    const gridCount = gridIntervals !== null ? gridIntervals + 1 : explicitGridCount
    if (halfRangePct === null || halfRangePct <= 0 || gridCount === null || gridCount <= 0) {
      return null
    }

    return {
      centerTiming: /部署|下单|启动|创建/u.test(segment) ? 'deployment' : 'runtime',
      centerSource: /最新成交价|last/iu.test(segment)
        ? 'last_trade'
        : (/标记价|mark/iu.test(segment) ? 'mark_price' : 'last_price'),
      halfRangePct,
      gridIntervals,
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

  private pushMarketStateTriggers(segment: string, triggers: SeedTrigger[], seen: Set<string>): void {
    if (/(?:震荡区间|区间震荡|盘整|range[-_\s]?bound)/iu.test(segment)) {
      this.pushTrigger(triggers, seen, {
        key: 'market.regime',
        phase: 'gate',
        params: { value: 'range' },
      })
    }

    if (/(?:市场趋势|大趋势|整体趋势|(?:\d{1,2}\s*(?:h|小时|时))?\s*趋势).{0,8}(?:向上|上涨|多头|up|bull)/iu.test(segment)) {
      this.pushTrigger(triggers, seen, {
        key: 'trend.direction',
        phase: 'gate',
        params: { value: 'up' },
      })
    }

    for (const clause of this.splitLogicClauses(segment)) {
      if (!/(?:趋势|trend)/iu.test(clause)) continue
      const intent = this.resolveTradeIntent(clause)
      if (!intent) continue

      if (/(?:向上|上涨|走强|多头|up|bull)/iu.test(clause)) {
        this.pushTrigger(triggers, seen, {
          key: 'trend.direction',
          phase: intent.phase,
          sideScope: intent.sideScope,
          params: { value: 'up' },
        })
      }

      if (/(?:转弱|向下|下跌|空头|down|bear)/iu.test(clause)) {
        this.pushTrigger(triggers, seen, {
          key: 'trend.direction',
          phase: intent.phase,
          sideScope: intent.sideScope,
          params: { value: 'down' },
        })
      }
    }
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
      if (!/RSI/iu.test(clause) && !/RSI/iu.test(segment)) continue
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
            thresholdRole: 'upper_threshold',
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
            thresholdRole: 'lower_threshold',
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
            thresholdRole: 'upper_threshold',
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
            thresholdRole: 'lower_threshold',
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
        valuePct: direction === 'up' ? Math.abs(valuePct) : -Math.abs(valuePct),
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
      .filter(clause => /(上涨|下跌|涨|跌|回撤|回落|回调|反弹)/u.test(clause))
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

  private pushRecognizedUnsupportedTriggers(
    segment: string,
    triggers: SeedTrigger[],
    seen: Set<string>,
  ): void {
    for (const clause of this.splitLogicClauses(segment)) {
      if (this.hasNegatedUnsupportedContext(clause)) continue

      if (/(?:动态网格|自适应网格|自动重算网格|重算网格|AI\s*网格)/iu.test(clause)) {
        this.pushTrigger(triggers, seen, {
          key: 'grid.dynamic_grid',
          ...this.resolveUnsupportedTriggerIntent(clause, segment),
          params: { sourceText: clause },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        })
      }

      if (/(?:北京时间|UTC|交易时段|时间窗口|只在).{0,24}(?:\d{1,2}\s*(?:点|:)|开盘|收盘)/iu.test(clause)) {
        this.pushTrigger(triggers, seen, {
          key: 'strategy.time_window',
          phase: 'gate',
          params: { sourceText: clause },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        })
      }

      if (/(?:多周期|多时间框架|multi[-_\s]?timeframe|先看\s*\d{1,2}\s*(?:m|h|d|分钟|小时|天)|\d{1,2}\s*h\s*趋势)/iu.test(clause)) {
        this.pushTrigger(triggers, seen, {
          key: 'strategy.multi_timeframe',
          phase: 'gate',
          params: { sourceText: clause },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        })
      }

      if (/(?:背离|divergence|底背离|顶背离)/iu.test(clause)) {
        this.pushTrigger(triggers, seen, {
          key: 'indicator.divergence',
          ...this.resolveUnsupportedTriggerIntent(clause, segment),
          params: { sourceText: clause },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        })
      }

      if (/(?:头肩|双底|双顶|三角形|楔形|旗形|形态|pattern)/iu.test(clause) && !/(?:截图|screenshot|image)/iu.test(clause)) {
        this.pushTrigger(triggers, seen, {
          key: 'price.pattern',
          ...this.resolveUnsupportedTriggerIntent(clause, segment),
          params: { sourceText: clause },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        })
      }

      if (/放量|成交量放大|volume\s*spike|量能放大/iu.test(clause)) {
        this.pushTrigger(triggers, seen, {
          key: 'volume.spike',
          ...this.resolveUnsupportedTriggerIntent(clause, segment),
          params: { sourceText: clause },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        })
      }

      if (/成交量.*(?:大于|超过|高于|阈值)|volume.*(?:gte|threshold)/iu.test(clause)) {
        this.pushTrigger(triggers, seen, {
          key: 'volume.threshold',
          ...this.resolveUnsupportedTriggerIntent(clause, segment),
          params: { sourceText: clause },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        })
      }

      if (/(?:ATR|平均真实波幅).*(?:阈值|过滤|大于|小于|threshold|filter|greater\s+than|less\s+than|gte|lte)/iu.test(clause)) {
        this.pushTrigger(triggers, seen, {
          key: 'volatility.atr_threshold',
          ...this.resolveUnsupportedTriggerIntent(clause, segment),
          params: { sourceText: clause },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        })
      }
    }
  }

  private pushUnknownUnsupportedTriggers(
    segment: string,
    triggers: SeedTrigger[],
    seen: Set<string>,
  ): void {
    for (const clause of this.splitLogicClauses(segment)) {
      const intent = this.resolveUnsupportedTriggerIntent(clause, segment)
      if (/(?:外部喊单|喊单群|KOL|口令|神秘评分|内部\s*AI|external\s+signal)/iu.test(clause)) {
        this.pushTrigger(triggers, seen, {
          key: 'external.signal',
          ...intent,
          params: { sourceText: clause },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        })
      }

      if (/(?:截图|神秘形态|image|screenshot)/iu.test(clause)) {
        this.pushTrigger(triggers, seen, {
          key: 'image.pattern',
          ...intent,
          params: { sourceText: clause },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        })
      }

      if (/(?:新闻情绪|Twitter|社媒|市场情绪|sentiment|news)/iu.test(clause)) {
        this.pushTrigger(triggers, seen, {
          key: 'news.sentiment',
          ...intent,
          params: { sourceText: clause },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        })
      }
    }
  }

  private pushRecognizedUnsupportedActions(text: string, actions: SeedAction[], seen: Set<string>): void {
    const push = (key: string, params: Record<string, unknown>) => {
      const action: SeedAction = {
        key,
        params,
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }
      const signature = JSON.stringify(action)
      if (seen.has(signature)) return
      seen.add(signature)
      actions.push(action)
    }

    for (const clause of this.splitLogicClauses(text)) {
      if (this.hasNegatedUnsupportedActionContext(clause)) continue

      if (/(?:加仓|scale\s*in)/iu.test(clause) && !/(?:DCA|定投|每跌|补仓)/iu.test(clause)) {
        push('action.add_position', { sourceText: clause })
      }
      if (/(?:反手|reverse\s+position|flip\s+position)/iu.test(clause)) {
        push('action.reverse_position', { sourceText: clause })
      }
      if (/(?:暂停交易|停止交易|暂停策略|停止策略|pause\s+trading|halt\s+trading)/iu.test(clause)) {
        push('action.pause_trading', { sourceText: clause })
      }
    }
  }

  private extractRecognizedUnsupportedPosition(
    text: string,
    triggers: SeedTrigger[],
  ): NonNullable<CodegenSemanticPatch['position']> | null {
    if (this.hasPositiveDcaScheduleContext(text)) {
      return {
        mode: 'position.dca_schedule',
        value: 1,
        positionMode: this.resolvePositionMode(text, triggers),
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }
    }

    const leverage = this.extractNumber(text, [
      /(\d+(?:\.\d+)?)\s*(?:倍杠杆|x\s*leverage|X\s*leverage)/u,
    ])
    if ((leverage !== null || /杠杆|leverage/iu.test(text)) && !/(?:不使用|不用|无需|无|no)\s*.{0,8}(?:杠杆|leverage)/iu.test(text)) {
      return {
        mode: 'position.leverage',
        value: leverage ?? 1,
        positionMode: this.resolvePositionMode(text, triggers),
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }
    }

    if (/(?:逐仓|全仓|isolated|cross\s+margin)/iu.test(text)) {
      return {
        mode: 'position.margin_mode',
        value: 1,
        positionMode: this.resolvePositionMode(text, triggers),
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }
    }

    return null
  }

  private resolveUnsupportedTriggerIntent(
    clause: string,
    segment: string,
  ): { phase: SeedTrigger['phase']; sideScope?: SeedTrigger['sideScope'] } {
    const intent = this.resolveTradeIntent(clause) ?? this.resolveTradeIntent(segment)
    if (intent) {
      return {
        phase: intent.phase,
        sideScope: intent.sideScope,
      }
    }

    if (/(?:过滤|条件|阈值|filter|condition|threshold|大于|小于|高于|超过|gte|lte|greater\s+than|less\s+than)/iu.test(clause)) {
      return { phase: 'gate' }
    }

    return { phase: 'entry' }
  }

  private hasNegatedUnsupportedContext(clause: string): boolean {
    return /(?:不要|不用|无需|不|without|no)\s*.{0,12}(?:放量|成交量|量能|volume|ATR|平均真实波幅|分批止盈|部分止盈|多档止盈|平一半|scale\s*out)/iu.test(clause)
  }

  private hasNegatedUnsupportedActionContext(clause: string): boolean {
    return /(?:不要|不用|无需|不可|不能|禁止|避免|不|without|no)\s*.{0,12}(?:加仓|补仓|反手|scale\s*in|reverse\s+position|flip\s+position)/iu.test(clause)
  }

  private hasNegatedUnsupportedPositionContext(text: string): boolean {
    return /(?:不要|不用|无需|不可|不能|禁止|避免|不|without|no)\s*.{0,12}(?:DCA|定投|补仓)/iu.test(text)
  }

  private hasPositiveDcaScheduleContext(text: string): boolean {
    return this.splitSegments(text).some(segment =>
      this.splitLogicClauses(segment).some(clause =>
        /(?:DCA|定投|补仓|每跌\s*\d+(?:\.\d+)?\s*%)/iu.test(clause)
        && !this.hasNegatedUnsupportedPositionContext(clause),
      ),
    )
  }

  private pushTrigger(triggers: SeedTrigger[], seen: Set<string>, trigger: SeedTrigger): void {
    const signature = JSON.stringify([trigger.key, trigger.phase, trigger.sideScope ?? null, trigger.params])
    if (seen.has(signature)) return
    seen.add(signature)
    triggers.push(trigger)
  }

  private pushRisk(risk: SeedRisk[], riskItem: SeedRisk): void {
    const signature = JSON.stringify([riskItem.key, riskItem.params])
    if (risk.some(item => JSON.stringify([item.key, item.params]) === signature)) return
    risk.push(riskItem)
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
      || (/(?:上涨|下跌|涨|跌|回撤|回落|回调|反弹).*(?:%|百分)/u.test(segment) && this.hasExecutableTradeIntent(segment))
  }

  private hasExplicitPriceChangeDirection(segment: string): boolean {
    return /(上涨|下跌|涨|跌|回撤|回落|回调|反弹)/u.test(segment)
  }

  private hasExecutableTradeIntent(segment: string): boolean {
    return /(买入|卖出|入场|出场|离场|开仓|平仓|平多|平空|做多|做空|开多|开空|多单|空单)/u.test(segment)
  }

  private hasBollingerBandAction(segment: string): boolean {
    return /(触及|突破|回到|回归|跌破|上穿|下穿|站上|失守|高于|低于)/u.test(segment)
  }

  private resolvePercentDirection(segment: string): 'up' | 'down' | 'drawdown' | null {
    if (/回撤/u.test(segment)) {
      return 'drawdown'
    }
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
      return this.removeLegacyBollingerTriggersWithUniversalBoundaryEquivalent(triggers)
    }

    const harmonized = triggers.map((trigger) => {
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
    return this.removeLegacyBollingerTriggersWithUniversalBoundaryEquivalent(harmonized)
  }

  private removeLegacyBollingerTriggersWithUniversalBoundaryEquivalent(triggers: SeedTrigger[]): SeedTrigger[] {
    const universalBollingerBoundaries = new Set(
      triggers
        .filter(trigger => (
          trigger.key === 'price.detect.indicator_boundary'
          && this.isPlainObject(trigger.params?.indicator)
          && trigger.params.indicator.name === 'bollinger'
          && typeof trigger.params.boundaryRole === 'string'
        ))
        .map(trigger => JSON.stringify([
          trigger.params?.boundaryRole,
          trigger.phase,
          trigger.sideScope ?? null,
        ])),
    )
    if (universalBollingerBoundaries.size === 0) return triggers

    return triggers.filter((trigger) => {
      const boundaryRole = this.resolveLegacyBollingerBoundaryRole(trigger.key)
      if (!boundaryRole) return true
      if (boundaryRole === 'middle') {
        return !triggers.some(candidate => (
          candidate.key === 'price.detect.indicator_boundary'
          && candidate.phase === trigger.phase
          && candidate.params?.boundaryRole === 'middle'
          && this.isPlainObject(candidate.params.indicator)
          && candidate.params.indicator.name === 'bollinger'
        ))
      }
      return !universalBollingerBoundaries.has(JSON.stringify([
        boundaryRole,
        trigger.phase,
        trigger.sideScope ?? null,
      ]))
    })
  }

  private resolveLegacyBollingerBoundaryRole(key: string): 'upper' | 'lower' | 'middle' | null {
    if (key === 'bollinger.touch_upper') return 'upper'
    if (key === 'bollinger.touch_lower') return 'lower'
    if (key === 'bollinger.touch_middle') return 'middle'
    return null
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

  private extractBoundaryConfirmationMode(segment: string): 'touch' | 'close_confirm' | null {
    const closeConfirm = this.extractConfirmationMode(segment)
    if (closeConfirm) return closeConfirm
    if (/触及|触碰|碰到|回到|达到|到达/u.test(segment)) {
      return 'touch'
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
    const compactMatch = text.match(/\b(\d{1,2})\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)\b/iu)
    if (compactMatch?.[1] && compactMatch[2]) {
      return `${compactMatch[1]}${this.normalizeTimeframeUnit(compactMatch[2])}`
    }

    for (const chineseMatch of text.matchAll(/(\d{1,2})\s*(分钟|分|小时|时|天|日)/gu)) {
      if (!chineseMatch[1] || !chineseMatch[2]) continue
      if (this.isIndicatorPeriodTimeframeCandidate(text, chineseMatch.index ?? -1, chineseMatch[0].length)) continue

      return `${chineseMatch[1]}${this.normalizeTimeframeUnit(chineseMatch[2])}`
    }
    return null
  }

  private hasMultiTimeframeMovingAveragePredicateScope(text: string): boolean {
    return this.splitSegments(text).some(segment =>
      this.splitCommaClauses(segment).some(clause =>
        this.splitConjunctionClauses(clause).some((subClause) => {
          const timeframes = this.extractAllTimeframes(subClause)
          return timeframes.length > 1
            && /(?:MA|EMA)\s*\d+|均线/iu.test(subClause)
            && /突破|上穿|站上|高于|上方|跌破|下穿|失守|低于|下方/u.test(subClause)
            && (this.resolveTradeIntent(subClause) ?? this.resolveTradeIntent(clause)) !== null
        }),
      ),
    )
  }

  private splitConjunctionClauses(clause: string): string[] {
    if (!/(?:并且|同时|且|并)/u.test(clause)) {
      return [clause]
    }

    const subClauses = clause
      .split(/(?:并且|同时|且|并)/u)
      .map(part => part.trim())
      .filter(Boolean)

    return subClauses.length > 0 ? subClauses : [clause]
  }

  private extractAllTimeframes(text: string): string[] {
    const values: string[] = []
    const seen = new Set<string>()
    const push = (value: string) => {
      if (seen.has(value)) return
      seen.add(value)
      values.push(value)
    }

    for (const match of text.matchAll(/\b(\d{1,2})\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)\b/giu)) {
      if (!match[1] || !match[2]) continue
      push(`${match[1]}${this.normalizeTimeframeUnit(match[2])}`)
    }

    for (const match of text.matchAll(/(\d{1,2})\s*(分钟|分|小时|时|天|日)/gu)) {
      if (!match[1] || !match[2]) continue
      if (this.isIndicatorPeriodTimeframeCandidate(text, match.index ?? -1, match[0].length)) continue
      push(`${match[1]}${this.normalizeTimeframeUnit(match[2])}`)
    }

    return values
  }

  private normalizeTimeframeUnit(unit: string): 'm' | 'h' | 'd' {
    const normalizedUnit = unit.toLowerCase()
    if (normalizedUnit.startsWith('m') || normalizedUnit === '分钟' || normalizedUnit === '分') return 'm'
    if (normalizedUnit.startsWith('h') || normalizedUnit === '小时' || normalizedUnit === '时') return 'h'
    return 'd'
  }

  private isIndicatorPeriodTimeframeCandidate(text: string, matchIndex: number, matchLength: number): boolean {
    if (matchIndex < 0) return false

    const prefix = text.slice(Math.max(0, matchIndex - 16), matchIndex)
    if (/(?:EMA|SMA|MA|均线)\s*$/iu.test(prefix)) {
      return true
    }

    const suffix = text.slice(matchIndex + matchLength, matchIndex + matchLength + 16)
    return /^\s*(?:EMA|SMA|MA|均线)/iu.test(suffix)
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
