import type { ExprNode, StrategyAstV1 } from '../types/canonical-strategy-ast'
import type { CanonicalStrategyIrV1, OrderProgram, PredicateDef, SeriesDef } from '../types/canonical-strategy-ir'
import type { CanonicalConditionAtom, CanonicalConditionNode, CanonicalExpressionCondition, CanonicalOrderProgramIntent, CanonicalStrategySpec } from '../types/canonical-strategy-spec'
import type { SemanticAtomContract, SemanticCapability, SemanticCapabilityShape, SemanticExpression, SemanticExpressionOperand, SemanticExpressionOperator, SemanticPositionSizingContract, SemanticState, SemanticTriggerState } from '../types/semantic-state'
import type { StrategyConsistencyCheck } from '../types/strategy-consistency-report'
import { Injectable } from '@nestjs/common'
import { SemanticAtomContractService } from './semantic-atom-contract.service'
import { normalizeLegacyPositionSizing, validateSemanticPositionContract } from './strategy-semantic-contracts'

type PriceChangeDirection = 'up' | 'down'
type PositionAction = 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT'
type OrdinaryFallbackAction = PositionAction | 'BUY' | 'SELL'
type PredicateKind = PredicateDef['kind']

interface PriceChangeSnapshot {
  id: string
  predicateKind: PredicateKind
  constValue: number | null
  hasPriceChangeSeries: boolean
  timeframe: string | null
  lookbackBars: number | null
}

interface LayerSnapshot {
  passed: boolean
  expectedBucket: PriceChangeSnapshot[]
  expected: PriceChangeSnapshot[]
  conflicts: PriceChangeSnapshot[]
  candidates: PriceChangeSnapshot[]
}

interface ExpectedSnapshot {
  triggerId: string
  action: PositionAction
  predicateKind: PredicateKind
  constValue: number
  timeframe: string | null
  lookbackBars: number
}

interface GenericExpressionSnapshot {
  id: string
  op: SemanticExpressionOperator | PredicateKind
  left: string | null
  right: string | null
}

interface GenericExpressionLayerSnapshot {
  passed: boolean
  expectedBucket: GenericExpressionSnapshot[]
  expected: GenericExpressionSnapshot[]
  conflicts: GenericExpressionSnapshot[]
  candidates: GenericExpressionSnapshot[]
}

interface ExpectedGenericExpressionSnapshot {
  triggerId: string
  action: PositionAction
  op: SemanticExpressionOperator | PredicateKind
  left: string | null
  right: string | null
}

interface PositionSizingSnapshot {
  mode: string
  value: number
  asset?: string
}

interface CapabilityCandidateResolution {
  status: 'ok' | 'conflict'
  capability?: SemanticCapability | null
}

interface ExpectedOrderProgramContract {
  id: string
  kind: 'contract_order_program'
  mode: CanonicalOrderProgramIntent['mode']
  levelSetMode: NonNullable<CanonicalOrderProgramIntent['levelSet']['mode']>
  lower?: number
  upper?: number
  centerTiming?: 'deployment' | 'runtime'
  centerSource?: string
  halfRangePct?: number
  gridIntervals?: number
  gridCount?: number
  absoluteSpacing?: number
  spacingPct?: number
  spacingMode: CanonicalOrderProgramIntent['levelSet']['spacingMode']
  budgetMode: CanonicalOrderProgramIntent['budget']['mode']
  budgetValue: number
  budgetAsset?: string
  orderType: 'limit'
  timeInForce: 'gtc'
  recycleOnFill: boolean
  cancelOnStop: boolean
  irId: string
  activeWhen: string
  side: OrderProgram['side']
  sidePolicy: OrderProgram['sidePolicy']
  quantity: PositionSizingSnapshot
  maxWorkingOrders: number
}

@Injectable()
export class SemanticAtomInvariantService {
  constructor(
    private readonly contracts: SemanticAtomContractService = new SemanticAtomContractService(),
  ) {}

  validate(input: {
    semanticState: SemanticState
    canonicalSpec: CanonicalStrategySpec
    ir: CanonicalStrategyIrV1
    ast: StrategyAstV1
  }): StrategyConsistencyCheck[] {
    return [
      ...this.validatePricePercentChange(input),
      ...this.validateGenericExpressions(input),
      ...this.validateOrderProgramContract(input),
      ...this.validatePositionSizingContract(input),
    ]
  }

  private validateOrderProgramContract(input: {
    semanticState: SemanticState
    canonicalSpec: CanonicalStrategySpec
    ir: CanonicalStrategyIrV1
    ast: StrategyAstV1
  }): StrategyConsistencyCheck[] {
    return this.expectedOrderProgramContracts(input.semanticState).map((expected) => {
      const canonicalCandidates = input.canonicalSpec.version === 2
        ? input.canonicalSpec.orderPrograms ?? []
        : []
      const irFallbackActions = this.findIrOrderProgramFallbackActions(input.ir, expected)
      const astFallbackActions = this.findAstOrderProgramFallbackActions(input.ast, expected)
      const canonical = {
        passed: canonicalCandidates.some(candidate => this.matchesCanonicalOrderProgram(candidate, expected)),
        expected,
        candidates: canonicalCandidates,
      }
      const ir = {
        passed: input.ir.orderPrograms.some(candidate => this.matchesIrOrderProgram(candidate, expected)),
        expected,
        candidates: input.ir.orderPrograms,
        fallbackActions: irFallbackActions,
      }
      const ast = {
        passed: input.ast.orderPrograms.some(candidate => this.matchesIrOrderProgram(candidate.payload, expected)),
        expected,
        candidates: input.ast.orderPrograms.map(candidate => candidate.payload),
        fallbackActions: astFallbackActions,
      }
      const passed = canonical.passed
        && ir.passed
        && ast.passed
        && irFallbackActions.length === 0
        && astFallbackActions.length === 0

      return {
        key: 'semantic_contract.order_program',
        level: 'critical',
        status: passed ? 'passed' : 'failed',
        expected,
        actual: { canonical, ir, ast },
        message: passed
          ? 'contract order program matches canonicalSpec, IR, and AST without signal-action downgrade.'
          : 'contract order program drift: expected SemanticState contract order program to survive canonicalSpec, IR, and AST without ordinary signal-action downgrade.',
      }
    })
  }

  private expectedOrderProgramContracts(semanticState: SemanticState): ExpectedOrderProgramContract[] {
    const contracts = this.collectContracts(semanticState)
    const resolution = this.contracts.resolve(contracts)
    const expected = resolution.canCompileOrderProgram
      ? this.toExpectedOrderProgramContract(resolution.capabilities, semanticState)
      : null

    return expected ? [expected] : []
  }

  private collectContracts(state: SemanticState): SemanticAtomContract[] {
    return [
      ...state.triggers.filter(atom => atom.status === 'locked').flatMap(atom => atom.contracts ?? []),
      ...state.actions.filter(atom => atom.status === 'locked').flatMap(atom => atom.contracts ?? []),
      ...state.risk.filter(atom => atom.status === 'locked').flatMap(atom => atom.contracts ?? []),
      ...(state.position?.status === 'locked' ? state.position.contracts ?? [] : []),
    ]
  }

  private toExpectedOrderProgramContract(
    capabilities: readonly SemanticCapability[],
    state: SemanticState,
  ): ExpectedOrderProgramContract | null {
    const levelSet = this.resolveUniqueCapability(
      capabilities,
      'price',
      'define',
      ['level_set'],
      capability => this.projectLevelSetCapabilityKey(capability),
    )
    const orderProgram = this.resolveUniqueCapability(
      capabilities,
      'order_program',
      'maintain',
      ['limit_ladder'],
      capability => this.projectLimitLadderCapabilityKey(capability),
    )
    const budget = this.resolveUniqueCapability(
      capabilities,
      'capital',
      'allocate',
      ['per_order_budget', 'total_budget'],
      capability => this.projectBudgetCapabilityKey(capability),
    )
    const exposure = this.resolveUniqueCapability(
      capabilities,
      'exposure',
      'set',
      ['position_mode'],
      capability => this.projectExposureCapabilityKey(capability),
    )

    if (
      levelSet.status === 'conflict'
      || orderProgram.status === 'conflict'
      || budget.status === 'conflict'
      || exposure.status === 'conflict'
      || !levelSet.capability
      || !orderProgram.capability
    ) {
      return null
    }

    const levelSetMode = this.readShapeString(levelSet.capability.shape, 'mode') === 'centered_percent_range'
      ? 'centered_percent_range'
      : 'static_range'
    const lower = this.readShapeNumber(levelSet.capability.shape, 'lower') ?? undefined
    const upper = this.readShapeNumber(levelSet.capability.shape, 'upper') ?? undefined
    const halfRangePct = this.readShapeNumber(levelSet.capability.shape, 'halfRangePct') ?? undefined
    const projectedBudget = this.projectExpectedOrderProgramBudget(budget.capability ?? null, state)
    if (
      (levelSetMode === 'static_range' && (lower === undefined || upper === undefined || upper <= lower))
      || (levelSetMode === 'centered_percent_range' && (halfRangePct === undefined || halfRangePct <= 0))
      || !projectedBudget
    ) {
      return null
    }

    const id = `contract-order-program-${orderProgram.capability.object}`
    const gridIntervals = this.readShapeNumber(levelSet.capability.shape, 'gridIntervals') ?? undefined
    const gridCount = this.readShapeNumber(levelSet.capability.shape, 'gridCount') ?? undefined
    const absoluteSpacing = this.readShapeNumber(levelSet.capability.shape, 'absoluteSpacing') ?? undefined
    const spacingPct = this.readShapeNumber(levelSet.capability.shape, 'spacingPct') ?? undefined
    const budgetMode = projectedBudget.budgetMode
    const maxWorkingOrders = this.resolveExpectedOrderProgramLevelCount({
      levelSetMode,
      lower,
      upper,
      halfRangePct,
      gridCount,
      absoluteSpacing,
      spacingPct,
    })
    const mode = this.resolveContractOrderProgramMode(exposure.capability ?? null, state)
    const budgetPerOrder = budgetMode === 'total_quote'
      ? Number((projectedBudget.budgetValue / maxWorkingOrders).toFixed(8))
      : projectedBudget.budgetValue

    return {
      id,
      kind: 'contract_order_program',
      mode,
      levelSetMode,
      ...(lower !== undefined ? { lower } : {}),
      ...(upper !== undefined ? { upper } : {}),
      ...(levelSetMode === 'centered_percent_range'
        ? {
            centerTiming: this.readShapeString(levelSet.capability.shape, 'centerTiming') === 'runtime' ? 'runtime' : 'deployment',
            centerSource: this.readShapeString(levelSet.capability.shape, 'centerSource') ?? 'last_price',
          }
        : {}),
      ...(halfRangePct !== undefined ? { halfRangePct } : {}),
      ...(gridIntervals !== undefined ? { gridIntervals } : {}),
      ...(gridCount !== undefined ? { gridCount } : {}),
      ...(absoluteSpacing !== undefined ? { absoluteSpacing } : {}),
      ...(spacingPct !== undefined ? { spacingPct } : {}),
      spacingMode: this.readShapeString(levelSet.capability.shape, 'spacingMode') === 'geometric' ? 'geometric' : 'arithmetic',
      budgetMode,
      budgetValue: projectedBudget.budgetValue,
      ...(projectedBudget.budgetAsset ? { budgetAsset: projectedBudget.budgetAsset } : {}),
      orderType: 'limit',
      timeInForce: 'gtc',
      recycleOnFill: this.readShapeBoolean(orderProgram.capability.shape, 'recycleOnFill') ?? true,
      cancelOnStop: this.readShapeBoolean(orderProgram.capability.shape, 'cancelOnStop') ?? true,
      irId: id.replace(/\W+/g, '_'),
      activeWhen: `${id.replace(/\W+/g, '_')}_${levelSetMode === 'centered_percent_range' ? 'active_level_set' : 'active_range'}`,
      side: mode === 'perp_short' ? 'sell' : 'buy',
      sidePolicy: mode === 'spot' ? 'spot_grid' : mode,
      quantity: budgetMode === 'per_order_pct_equity'
        ? { mode: 'pct_equity', value: budgetPerOrder }
        : {
            mode: 'fixed_quote',
            value: budgetPerOrder,
            asset: projectedBudget.budgetAsset,
          },
      maxWorkingOrders,
    }
  }

  private resolveExpectedOrderProgramLevelCount(input: {
    levelSetMode: ExpectedOrderProgramContract['levelSetMode']
    lower?: number
    upper?: number
    halfRangePct?: number
    gridCount?: number
    absoluteSpacing?: number
    spacingPct?: number
  }): number {
    if (typeof input.gridCount === 'number' && Number.isFinite(input.gridCount) && input.gridCount > 0) {
      return Math.max(2, Math.floor(input.gridCount))
    }

    if (input.levelSetMode === 'centered_percent_range') {
      if (
        typeof input.halfRangePct === 'number'
        && Number.isFinite(input.halfRangePct)
        && input.halfRangePct > 0
        && typeof input.spacingPct === 'number'
        && Number.isFinite(input.spacingPct)
        && input.spacingPct > 0
      ) {
        return Math.max(2, Math.floor((input.halfRangePct * 2) / input.spacingPct))
      }

      return 2
    }

    if (
      typeof input.lower !== 'number'
      || typeof input.upper !== 'number'
      || !Number.isFinite(input.lower)
      || !Number.isFinite(input.upper)
      || input.upper <= input.lower
    ) {
      return 2
    }

    if (
      typeof input.absoluteSpacing === 'number'
      && Number.isFinite(input.absoluteSpacing)
      && input.absoluteSpacing > 0
    ) {
      return Math.max(2, Math.floor((input.upper - input.lower) / input.absoluteSpacing) + 1)
    }

    if (
      typeof input.spacingPct === 'number'
      && Number.isFinite(input.spacingPct)
      && input.spacingPct > 0
      && input.lower > 0
    ) {
      return Math.max(2, Math.floor(Math.log(input.upper / input.lower) / Math.log(1 + input.spacingPct / 100)) + 1)
    }

    return 2
  }

  private projectExpectedOrderProgramBudget(
    capability: SemanticCapability | null,
    state: SemanticState,
  ): Pick<ExpectedOrderProgramContract, 'budgetMode' | 'budgetValue' | 'budgetAsset'> | null {
    if (capability) {
      const value = this.readShapeNumber(capability.shape, 'value')
      const asset = this.readShapeString(capability.shape, 'asset')
      if (value === null || value <= 0 || !asset) {
        return null
      }

      return {
        budgetMode: capability.object === 'total_budget' ? 'total_quote' : 'per_order_quote',
        budgetValue: value,
        budgetAsset: asset,
      }
    }

    const sizing = state.position?.sizing
    if (sizing?.kind === 'ratio' && typeof sizing.value === 'number' && Number.isFinite(sizing.value) && sizing.value > 0) {
      return {
        budgetMode: 'per_order_pct_equity',
        budgetValue: sizing.value <= 1 ? Number((sizing.value * 100).toFixed(8)) : sizing.value,
      }
    }

    if (sizing?.kind === 'quote' && typeof sizing.value === 'number' && Number.isFinite(sizing.value) && sizing.value > 0) {
      return {
        budgetMode: 'per_order_quote',
        budgetValue: sizing.value,
        budgetAsset: sizing.asset ?? 'USDT',
      }
    }

    return null
  }

  private matchesCanonicalOrderProgram(
    candidate: CanonicalOrderProgramIntent,
    expected: ExpectedOrderProgramContract,
  ): boolean {
    return candidate.id === expected.id
      && candidate.kind === expected.kind
      && candidate.mode === expected.mode
      && (candidate.levelSet.mode ?? 'static_range') === expected.levelSetMode
      && candidate.levelSet.lower === expected.lower
      && candidate.levelSet.upper === expected.upper
      && candidate.levelSet.centerTiming === expected.centerTiming
      && candidate.levelSet.centerSource === expected.centerSource
      && candidate.levelSet.halfRangePct === expected.halfRangePct
      && candidate.levelSet.gridIntervals === expected.gridIntervals
      && candidate.levelSet.gridCount === expected.gridCount
      && candidate.levelSet.absoluteSpacing === expected.absoluteSpacing
      && candidate.levelSet.spacingPct === expected.spacingPct
      && candidate.levelSet.spacingMode === expected.spacingMode
      && candidate.budget.mode === expected.budgetMode
      && candidate.budget.value === expected.budgetValue
      && candidate.budget.asset === expected.budgetAsset
      && candidate.orderType === expected.orderType
      && candidate.timeInForce === expected.timeInForce
      && candidate.recycleOnFill === expected.recycleOnFill
      && candidate.cancelOnStop === expected.cancelOnStop
  }

  private matchesIrOrderProgram(
    candidate: OrderProgram,
    expected: ExpectedOrderProgramContract,
  ): boolean {
    return candidate.id === expected.irId
      && candidate.kind === 'LIMIT_LADDER'
      && this.matchesOrderProgramActiveWhen(candidate.activeWhen, expected.activeWhen)
      && candidate.side === expected.side
      && candidate.sidePolicy === expected.sidePolicy
      && candidate.priceSource === 'level_set'
      && candidate.orderType === expected.orderType
      && candidate.timeInForce === expected.timeInForce
      && candidate.recycleOnFill === expected.recycleOnFill
      && candidate.cancelScope === 'program_orders'
      && candidate.maxWorkingOrders === expected.maxWorkingOrders
      && candidate.group === expected.id
      && this.matchesPositionSizingSnapshot(candidate.quantity, expected.quantity)
  }

  private matchesOrderProgramActiveWhen(actual: string, expected: string): boolean {
    return actual === expected || actual.endsWith(`_${expected}`)
  }

  private findIrOrderProgramFallbackActions(
    ir: CanonicalStrategyIrV1,
    expected: ExpectedOrderProgramContract,
  ): Array<{ ruleId: string; action: OrdinaryFallbackAction }> {
    const predicateById = new Map(ir.signalCatalog.predicates.map(predicate => [predicate.id, predicate]))
    return ir.ruleBlocks.flatMap((rule) => {
      if (!this.irPredicateDependsOnSourceRef(rule.when, expected.activeWhen, predicateById, new Set())) {
        return []
      }

      return rule.actions.flatMap((action) => {
        if (!this.isOrdinaryPositionAction(action.kind)) {
          return []
        }

        return [{ ruleId: rule.id, action: action.kind }]
      })
    })
  }

  private irPredicateDependsOnSourceRef(
    predicateId: string,
    sourceRef: string,
    predicateById: Map<string, PredicateDef>,
    seen: Set<string>,
  ): boolean {
    if (predicateId === sourceRef) {
      return true
    }
    if (seen.has(predicateId)) {
      return false
    }
    seen.add(predicateId)

    const predicate = predicateById.get(predicateId)
    if (!predicate) {
      return false
    }

    return predicate.args.some(arg =>
      arg === sourceRef
      || this.irPredicateDependsOnSourceRef(arg, sourceRef, predicateById, seen),
    )
  }

  private findAstOrderProgramFallbackActions(
    ast: StrategyAstV1,
    expected: ExpectedOrderProgramContract,
  ): Array<{ programId: string; action: OrdinaryFallbackAction }> {
    const exprById = new Map(ast.exprPool.map(expr => [expr.id, expr]))
    return ast.decisionPrograms.flatMap((program) => {
      if (!this.astExprDependsOnSourceRef(program.when, expected.activeWhen, exprById, new Set())) {
        return []
      }

      return program.actions.flatMap((action) => {
        if (!this.isOrdinaryPositionAction(action.kind)) {
          return []
        }

        return [{ programId: program.id, action: action.kind }]
      })
    })
  }

  private astExprDependsOnSourceRef(
    exprId: string,
    sourceRef: string,
    exprById: Map<string, ExprNode>,
    seen: Set<string>,
  ): boolean {
    if (seen.has(exprId)) {
      return false
    }
    seen.add(exprId)

    const expr = exprById.get(exprId)
    if (!expr) {
      return false
    }
    if (expr.sourceRef === sourceRef) {
      return true
    }

    return expr.deps.some(dep => this.astExprDependsOnSourceRef(dep, sourceRef, exprById, seen))
  }

  private isOrdinaryPositionAction(action: string): action is OrdinaryFallbackAction {
    return action === 'OPEN_LONG'
      || action === 'OPEN_SHORT'
      || action === 'CLOSE_LONG'
      || action === 'CLOSE_SHORT'
      || action === 'BUY'
      || action === 'SELL'
  }

  private resolveUniqueCapability(
    capabilities: readonly SemanticCapability[],
    domain: SemanticCapability['domain'],
    verb: string,
    objects: readonly string[],
    projectionKey: (capability: SemanticCapability) => string,
  ): CapabilityCandidateResolution {
    const candidates = capabilities.filter(capability =>
      capability.domain === domain
      && capability.verb === verb
      && objects.includes(capability.object),
    )
    if (candidates.length === 0) {
      return { status: 'ok', capability: null }
    }

    const first = candidates[0]
    const firstKey = projectionKey(first)
    const hasConflict = candidates.some(candidate => projectionKey(candidate) !== firstKey)
    if (hasConflict) {
      return { status: 'conflict' }
    }

    return { status: 'ok', capability: first }
  }

  private projectLevelSetCapabilityKey(capability: SemanticCapability): string {
    const mode = this.readShapeString(capability.shape, 'mode')
    if (mode === 'centered_percent_range') {
      return this.stableProjectionKey({
        mode,
        centerTiming: this.readShapeString(capability.shape, 'centerTiming') ?? 'deployment',
        centerSource: this.readShapeString(capability.shape, 'centerSource') ?? 'last_price',
        halfRangePct: this.readShapeNumber(capability.shape, 'halfRangePct'),
        gridIntervals: this.readShapeNumber(capability.shape, 'gridIntervals'),
        gridCount: this.readShapeNumber(capability.shape, 'gridCount'),
        absoluteSpacing: this.readShapeNumber(capability.shape, 'absoluteSpacing'),
        spacingPct: this.readShapeNumber(capability.shape, 'spacingPct'),
        spacingMode: this.readShapeString(capability.shape, 'spacingMode') === 'geometric' ? 'geometric' : 'arithmetic',
      })
    }

    return this.stableProjectionKey({
      mode: 'static_range',
      lower: this.readShapeNumber(capability.shape, 'lower'),
      upper: this.readShapeNumber(capability.shape, 'upper'),
      gridIntervals: this.readShapeNumber(capability.shape, 'gridIntervals'),
      gridCount: this.readShapeNumber(capability.shape, 'gridCount'),
      absoluteSpacing: this.readShapeNumber(capability.shape, 'absoluteSpacing'),
      spacingPct: this.readShapeNumber(capability.shape, 'spacingPct'),
      spacingMode: this.readShapeString(capability.shape, 'spacingMode') === 'geometric' ? 'geometric' : 'arithmetic',
    })
  }

  private projectLimitLadderCapabilityKey(capability: SemanticCapability): string {
    return this.stableProjectionKey({
      orderType: 'limit',
      timeInForce: 'gtc',
      recycleOnFill: this.readShapeBoolean(capability.shape, 'recycleOnFill') ?? true,
      cancelOnStop: this.readShapeBoolean(capability.shape, 'cancelOnStop') ?? true,
    })
  }

  private projectBudgetCapabilityKey(capability: SemanticCapability): string {
    return this.stableProjectionKey({
      object: capability.object,
      value: this.readShapeNumber(capability.shape, 'value'),
      asset: this.readShapeString(capability.shape, 'asset'),
    })
  }

  private projectExposureCapabilityKey(capability: SemanticCapability): string {
    return this.stableProjectionKey({
      mode: this.readShapeString(capability.shape, 'mode'),
    })
  }

  private stableProjectionKey(value: Record<string, unknown>): string {
    return JSON.stringify(this.stableRecord(value))
  }

  private resolveContractOrderProgramMode(
    exposure: SemanticCapability | null,
    state: SemanticState,
  ): CanonicalOrderProgramIntent['mode'] {
    const marketType = this.readLockedContextSlotString(state.contextSlots.marketType)
    if (marketType !== 'perp') {
      return 'spot'
    }

    const exposureMode = exposure ? this.readShapeString(exposure.shape, 'mode') : null
    if (exposureMode === 'long' || state.position?.positionMode === 'long_only') {
      return 'perp_long'
    }
    if (exposureMode === 'short' || state.position?.positionMode === 'short_only') {
      return 'perp_short'
    }
    return 'perp_neutral'
  }

  private validatePositionSizingContract(input: {
    semanticState: SemanticState
    canonicalSpec: CanonicalStrategySpec
    ir: CanonicalStrategyIrV1
    ast: StrategyAstV1
  }): StrategyConsistencyCheck[] {
    const position = input.semanticState.position
    if (!position || position.status !== 'locked' || !validateSemanticPositionContract(position).ok) {
      return []
    }

    const semanticSizing = normalizeLegacyPositionSizing(position)
    if (!semanticSizing) {
      return []
    }

    const expectedCanonical = this.toCanonicalPositionSizingSnapshot(semanticSizing)
    const expectedIr = this.toIrPositionSizingSnapshot(semanticSizing)
    const canonical = {
      passed: this.matchesPositionSizingSnapshot(this.readCanonicalPositionSizing(input.canonicalSpec), expectedCanonical),
      expected: expectedCanonical,
      actual: this.readCanonicalPositionSizing(input.canonicalSpec),
    }
    const ir = {
      passed: this.matchesPositionSizingSnapshot(input.ir.portfolio.sizing, expectedIr),
      expected: expectedIr,
      actual: input.ir.portfolio.sizing,
    }
    const astCandidates = this.readAstOpenActionPositionSizings(input.ast)
    const ast = {
      passed: astCandidates.length > 0
        && astCandidates.every(candidate => this.matchesPositionSizingSnapshot(candidate, expectedIr)),
      expected: expectedIr,
      candidates: astCandidates,
    }
    const passed = canonical.passed && ir.passed && ast.passed

    return [{
      key: 'semantic_contract.position_sizing',
      level: 'critical',
      status: passed ? 'passed' : 'failed',
      expected: expectedCanonical,
      actual: { canonical, ir, ast },
      message: passed
        ? 'position sizing contract matches canonicalSpec, IR, and AST.'
        : 'position sizing contract drift: expected SemanticState position sizing to match canonicalSpec, IR, and AST open action quantities.',
    }]
  }

  private toCanonicalPositionSizingSnapshot(sizing: SemanticPositionSizingContract): PositionSizingSnapshot {
    if (sizing.kind === 'ratio') {
      return { mode: 'RATIO', value: sizing.value }
    }

    if (sizing.kind === 'quote') {
      return { mode: 'QUOTE', value: sizing.value, asset: sizing.asset }
    }

    return { mode: 'QTY', value: sizing.value, asset: sizing.asset }
  }

  private toIrPositionSizingSnapshot(sizing: SemanticPositionSizingContract): PositionSizingSnapshot {
    if (sizing.kind === 'ratio') {
      return {
        mode: 'pct_equity',
        value: sizing.value <= 1 ? Number((sizing.value * 100).toFixed(4)) : sizing.value,
      }
    }

    if (sizing.kind === 'quote') {
      return { mode: 'fixed_quote', value: sizing.value, asset: sizing.asset }
    }

    return { mode: 'fixed_base', value: sizing.value, asset: sizing.asset }
  }

  private readCanonicalPositionSizing(spec: CanonicalStrategySpec): PositionSizingSnapshot | null {
    if (!spec.sizing) {
      return null
    }

    return {
      mode: spec.sizing.mode,
      value: spec.sizing.value,
      ...('asset' in spec.sizing && spec.sizing.asset ? { asset: spec.sizing.asset } : {}),
    }
  }

  private readAstOpenActionPositionSizings(ast: StrategyAstV1): PositionSizingSnapshot[] {
    const openActionSizings = ast.decisionPrograms.flatMap(program =>
      program.actions
        .filter(action => action.kind === 'OPEN_LONG' || action.kind === 'OPEN_SHORT')
        .map(action => action.quantity),
    )
    return [
      ...openActionSizings,
      ...ast.orderPrograms.map(program => program.payload.quantity),
    ]
  }

  private matchesPositionSizingSnapshot(
    actual: PositionSizingSnapshot | null | undefined,
    expected: PositionSizingSnapshot,
  ): boolean {
    if (!actual) return false
    if (actual.mode !== expected.mode) return false
    if (Math.abs(actual.value - expected.value) > 0.000001) return false
    if (expected.asset !== undefined && actual.asset !== expected.asset) return false
    return true
  }

  private validateGenericExpressions(input: {
    semanticState: SemanticState
    canonicalSpec: CanonicalStrategySpec
    ir: CanonicalStrategyIrV1
    ast: StrategyAstV1
  }): StrategyConsistencyCheck[] {
    const triggers = input.semanticState.triggers
      .filter(trigger => this.isBlockingGenericExpressionTrigger(trigger))
    const triggersByBucket = new Map<string, SemanticTriggerState[]>()

    for (const trigger of triggers) {
      for (const action of this.expectedActions(trigger)) {
        const key = this.bucketKey(trigger.phase, action)
        const bucket = triggersByBucket.get(key) ?? []
        bucket.push(trigger)
        triggersByBucket.set(key, bucket)
      }
    }

    return triggers.flatMap(trigger =>
      this.expectedActions(trigger).flatMap((action) => {
        const bucket = triggersByBucket.get(this.bucketKey(trigger.phase, action)) ?? [trigger]
        return this.collectExpectedGenericExpressionSnapshots(trigger, action).map(expected =>
          this.validateGenericExpressionTrigger(trigger, expected, bucket, input),
        )
      }),
    )
  }

  private isBlockingGenericExpressionTrigger(trigger: SemanticTriggerState): boolean {
    return trigger.key === 'condition.expression'
      && trigger.status === 'locked'
      && (trigger.phase === 'entry' || trigger.phase === 'exit')
      && this.isSemanticExpression(trigger.params.expression)
  }

  private validateGenericExpressionTrigger(
    trigger: SemanticTriggerState,
    expected: ExpectedGenericExpressionSnapshot,
    bucketTriggers: SemanticTriggerState[],
    input: {
      canonicalSpec: CanonicalStrategySpec
      ir: CanonicalStrategyIrV1
      ast: StrategyAstV1
    },
  ): StrategyConsistencyCheck {
    const expectedBucket = bucketTriggers.flatMap(bucketTrigger =>
      this.collectExpectedGenericExpressionSnapshots(bucketTrigger, expected.action, true),
    )
    const canonical = this.buildGenericExpressionLayerSnapshot(
      this.findCanonicalExpressionPredicates(input.canonicalSpec, trigger.phase, expected.action),
      expected,
      expectedBucket,
    )
    const ir = this.buildGenericExpressionLayerSnapshot(
      this.findIrExpressionPredicates(input.ir, trigger.phase, expected.action),
      expected,
      expectedBucket,
    )
    const ast = this.buildGenericExpressionLayerSnapshot(
      this.findAstExpressionPredicates(input.ast, trigger.phase, expected.action),
      expected,
      expectedBucket,
    )
    const passed = canonical.passed && ir.passed && ast.passed

    return {
      key: 'semantic_atom.expression',
      level: 'critical',
      status: passed ? 'passed' : 'failed',
      expected: {
        triggerId: trigger.id,
        phase: trigger.phase,
        action: expected.action,
        op: expected.op,
        left: expected.left,
        right: expected.right,
      },
      actual: {
        canonical,
        ir,
        ast,
      },
      message: passed
        ? 'semantic expression matches canonicalSpec, IR, and AST.'
        : `semantic expression drift: expected ${expected.op}(${expected.left},${expected.right}) in canonicalSpec, IR, and AST without undeclared conflicts.`,
    }
  }

  private collectExpectedGenericExpressionSnapshots(
    trigger: SemanticTriggerState,
    action: PositionAction,
    includeLogicalWrappers = false,
  ): ExpectedGenericExpressionSnapshot[] {
    const expression = trigger.params.expression
    if (!this.isSemanticExpression(expression)) {
      return []
    }

    return this.collectExpectedGenericExpressionSnapshotsFromExpression(expression, trigger.id, action, [], includeLogicalWrappers)
  }

  private collectExpectedGenericExpressionSnapshotsFromExpression(
    expression: SemanticExpression,
    triggerId: string,
    action: PositionAction,
    path: string[],
    includeLogicalWrappers: boolean,
  ): ExpectedGenericExpressionSnapshot[] {
    if (expression.kind !== 'predicate') {
      const wrapper = includeLogicalWrappers
        ? [{
            triggerId: path.length > 0 ? `${triggerId}:${path.join('.')}` : triggerId,
            action,
            op: expression.kind,
            left: null,
            right: null,
          } satisfies ExpectedGenericExpressionSnapshot]
        : []
      return [
        ...wrapper,
        ...expression.children.flatMap((child, index) =>
        this.collectExpectedGenericExpressionSnapshotsFromExpression(child, triggerId, action, [
          ...path,
          `${expression.kind.toLowerCase()}-${index + 1}`,
        ], includeLogicalWrappers),
        ),
      ]
    }

    return [{
      triggerId: path.length > 0 ? `${triggerId}:${path.join('.')}` : triggerId,
      action,
      op: expression.op,
      left: this.normalizeSemanticExpressionOperand(expression.left),
      right: this.normalizeSemanticExpressionOperand(expression.right),
    } satisfies ExpectedGenericExpressionSnapshot]
  }

  private buildGenericExpressionLayerSnapshot(
    candidates: GenericExpressionSnapshot[],
    expected: ExpectedGenericExpressionSnapshot,
    expectedBucket: ExpectedGenericExpressionSnapshot[],
  ): GenericExpressionLayerSnapshot {
    const matchedExpected = candidates.filter(candidate => this.matchesGenericExpressionExpected(candidate, expected))
    const conflicts = candidates.filter(candidate =>
      !expectedBucket.some(expectedCandidate => this.matchesGenericExpressionExpected(candidate, expectedCandidate)),
    )

    return {
      passed: matchedExpected.length > 0 && conflicts.length === 0,
      expectedBucket: expectedBucket.map(item => ({
        id: item.triggerId,
        op: item.op,
        left: item.left,
        right: item.right,
      })),
      expected: matchedExpected,
      conflicts,
      candidates,
    }
  }

  private matchesGenericExpressionExpected(
    candidate: GenericExpressionSnapshot,
    expected: Pick<ExpectedGenericExpressionSnapshot, 'op' | 'left' | 'right'>,
  ): boolean {
    return candidate.op === expected.op
      && candidate.left === expected.left
      && candidate.right === expected.right
  }

  private findCanonicalExpressionPredicates(
    canonicalSpec: CanonicalStrategySpec,
    phase: SemanticTriggerState['phase'],
    action: PositionAction,
  ): GenericExpressionSnapshot[] {
    if (canonicalSpec.version !== 2 || (phase !== 'entry' && phase !== 'exit')) {
      return []
    }

    return canonicalSpec.rules.flatMap(rule => {
      if (
        rule.phase === phase
        && rule.actions.some(ruleAction => ruleAction.type === action)
      ) {
        return this.collectCanonicalExpressionPredicates(rule.condition, rule.id)
      }
      return []
    })
  }

  private collectCanonicalExpressionPredicates(
    condition: CanonicalConditionNode,
    ruleId: string,
  ): GenericExpressionSnapshot[] {
    if (condition.kind === 'atom') {
      return []
    }

    if (condition.kind === 'expression') {
      return [this.buildCanonicalExpressionSnapshot(ruleId, condition)]
    }

    const nested = condition.children.flatMap(child =>
      this.collectCanonicalExpressionPredicates(child, ruleId),
    )
    if (condition.kind === 'AND' || nested.length === 0) {
      return nested
    }

    return [{
      id: `${ruleId}:${condition.kind}`,
      op: condition.kind,
      left: null,
      right: null,
    }, ...nested]
  }

  private buildCanonicalExpressionSnapshot(
    id: string,
    condition: CanonicalExpressionCondition,
  ): GenericExpressionSnapshot {
    return {
      id,
      op: condition.op,
      left: this.normalizeSemanticExpressionOperand(condition.left),
      right: this.normalizeSemanticExpressionOperand(condition.right),
    }
  }

  private findIrExpressionPredicates(
    ir: CanonicalStrategyIrV1,
    phase: SemanticTriggerState['phase'],
    action: PositionAction,
  ): GenericExpressionSnapshot[] {
    if (phase !== 'entry' && phase !== 'exit') {
      return []
    }

    const predicateById = new Map(ir.signalCatalog.predicates.map(predicate => [predicate.id, predicate]))
    const seriesById = new Map(ir.signalCatalog.series.map(series => [series.id, series]))
    return ir.ruleBlocks
      .filter(rule =>
        rule.phase === phase
        && rule.actions.some(ruleAction => ruleAction.kind === action),
      )
      .flatMap(rule => this.collectIrExpressionPredicates(rule.when, predicateById, seriesById, new Set()))
  }

  private collectIrExpressionPredicates(
    predicateId: string,
    predicateById: Map<string, PredicateDef>,
    seriesById: Map<string, SeriesDef>,
    seen: Set<string>,
  ): GenericExpressionSnapshot[] {
    if (seen.has(predicateId)) {
      return []
    }
    seen.add(predicateId)

    const predicate = predicateById.get(predicateId)
    if (!predicate) {
      return []
    }

    const seriesArgs = predicate.args
      .map(arg => seriesById.get(arg))
      .filter((series): series is SeriesDef => series !== undefined)
    const nested = predicate.args.flatMap(arg =>
      this.collectIrExpressionPredicates(arg, predicateById, seriesById, seen),
    )

    if (seriesArgs.length >= 2) {
      return [{
        id: predicate.id,
        op: predicate.kind,
        left: this.normalizeIrSeriesExpressionOperand(seriesArgs[0]),
        right: this.normalizeIrSeriesExpressionOperand(seriesArgs[1]),
      }, ...nested]
    }

    if (nested.length > 0 && predicate.kind !== 'AND') {
      return [{
        id: predicate.id,
        op: predicate.kind,
        left: null,
        right: null,
      }, ...nested]
    }

    return nested
  }

  private findAstExpressionPredicates(
    ast: StrategyAstV1,
    phase: SemanticTriggerState['phase'],
    action: PositionAction,
  ): GenericExpressionSnapshot[] {
    if (phase !== 'entry' && phase !== 'exit') {
      return []
    }

    return ast.decisionPrograms
      .filter(program =>
        program.phase === phase
        && program.actions.some(programAction => programAction.kind === action),
      )
      .flatMap(program => this.collectAstExpressionPredicates(program.when, ast, new Set()))
  }

  private collectAstExpressionPredicates(
    predicateExprId: string,
    ast: StrategyAstV1,
    seen: Set<string>,
  ): GenericExpressionSnapshot[] {
    if (seen.has(predicateExprId)) {
      return []
    }
    seen.add(predicateExprId)

    const exprById = new Map(ast.exprPool.map(expr => [expr.id, expr]))
    const predicateExpr = exprById.get(predicateExprId)
    if (!predicateExpr || predicateExpr.nodeType !== 'predicate' || !this.isPredicatePayload(predicateExpr.payload)) {
      return []
    }

    const depExprs = predicateExpr.deps
      .map(dep => exprById.get(dep))
      .filter((expr): expr is ExprNode => expr !== undefined)
    const seriesArgs = depExprs.filter(expr => expr.nodeType === 'series')
    const nested = depExprs
      .filter(expr => expr.nodeType === 'predicate')
      .flatMap(expr => this.collectAstExpressionPredicates(expr.id, ast, seen))

    if (seriesArgs.length >= 2) {
      return [{
        id: predicateExpr.sourceRef,
        op: predicateExpr.payload.kind,
        left: this.normalizeAstSeriesExpressionOperand(seriesArgs[0]),
        right: this.normalizeAstSeriesExpressionOperand(seriesArgs[1]),
      }, ...nested]
    }

    if (nested.length > 0 && predicateExpr.payload.kind !== 'AND') {
      return [{
        id: predicateExpr.sourceRef,
        op: predicateExpr.payload.kind,
        left: null,
        right: null,
      }, ...nested]
    }

    return nested
  }

  private isPredicateSemanticExpression(expression: unknown): expression is Extract<SemanticExpression, { kind: 'predicate' }> {
    return !!expression
      && typeof expression === 'object'
      && (expression as { kind?: unknown }).kind === 'predicate'
      && typeof (expression as { op?: unknown }).op === 'string'
      && this.isSemanticExpressionOperand((expression as { left?: unknown }).left)
      && this.isSemanticExpressionOperand((expression as { right?: unknown }).right)
  }

  private isSemanticExpression(expression: unknown): expression is SemanticExpression {
    if (this.isPredicateSemanticExpression(expression)) {
      return true
    }
    if (!expression || typeof expression !== 'object') {
      return false
    }
    const kind = (expression as { kind?: unknown }).kind
    return (kind === 'AND' || kind === 'OR' || kind === 'NOT')
      && Array.isArray((expression as { children?: unknown }).children)
      && (expression as { children: unknown[] }).children.every(child => this.isSemanticExpression(child))
  }

  private isSemanticExpressionOperand(operand: unknown): operand is SemanticExpressionOperand {
    return !!operand
      && typeof operand === 'object'
      && typeof (operand as { kind?: unknown }).kind === 'string'
  }

  private normalizeSemanticExpressionOperand(operand: SemanticExpressionOperand): string {
    if (operand.kind === 'series') {
      return JSON.stringify({
        kind: operand.kind,
        source: operand.source,
        field: operand.field,
        offsetBars: operand.offsetBars ?? 0,
      })
    }
    if (operand.kind === 'indicator') {
      return JSON.stringify({
        kind: operand.kind,
        name: operand.name,
        params: this.stableRecord(operand.params),
        output: operand.output ?? 'value',
      })
    }
    if (operand.kind === 'position') {
      return JSON.stringify({
        kind: operand.kind,
        field: operand.field,
        side: operand.side ?? null,
      })
    }
    if (operand.kind === 'account') {
      return JSON.stringify({
        kind: operand.kind,
        field: operand.field,
      })
    }
    if (operand.kind === 'memory') {
      return JSON.stringify({
        kind: operand.kind,
        memoryKey: operand.memoryKey,
        path: operand.path ?? [],
      })
    }
    return JSON.stringify({
      kind: operand.kind,
      value: operand.value,
      unit: operand.unit ?? null,
    })
  }

  private normalizeIrSeriesExpressionOperand(series: SeriesDef): string {
    if (series.kind === 'PRICE') {
      return JSON.stringify({
        kind: 'series',
        source: 'bar',
        field: series.field ?? 'close',
        offsetBars: series.offsetBars ?? 0,
      })
    }
    if (series.kind === 'CONST') {
      return JSON.stringify({
        kind: 'constant',
        value: series.value,
        unit: null,
      })
    }
    if (series.kind === 'POSITION_AVG_PRICE' || series.kind === 'POSITION_PNL_PCT' || series.kind === 'POSITION_BARS_HELD') {
      return JSON.stringify({
        kind: 'position',
        field: series.kind === 'POSITION_AVG_PRICE'
          ? 'avg_price'
          : series.kind === 'POSITION_PNL_PCT'
            ? 'pnl_pct'
            : 'bars_held',
        side: null,
      })
    }
    return JSON.stringify({
      kind: 'ir_series',
      seriesKind: series.kind,
      timeframe: series.timeframe ?? null,
      params: this.stableRecord(series.params ?? {}),
    })
  }

  private normalizeAstSeriesExpressionOperand(expr: ExprNode): string | null {
    return this.isSeriesPayload(expr.payload)
      ? this.normalizeIrSeriesExpressionOperand(expr.payload)
      : null
  }

  private stableRecord(record: Record<string, unknown>): Record<string, unknown> {
    return Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = record[key]
        return acc
      }, {})
  }

  private validatePricePercentChange(input: {
    semanticState: SemanticState
    canonicalSpec: CanonicalStrategySpec
    ir: CanonicalStrategyIrV1
    ast: StrategyAstV1
  }): StrategyConsistencyCheck[] {
    // First-stage blocking scope: explicit trigger-level price percent changes.
    // Risk percent rules (stop loss / take profit / trailing stop) remain covered
    // by canonical risk guards and the existing strategy consistency checks.
    const triggers = input.semanticState.triggers
      .filter(trigger => this.isBlockingPricePercentChangeTrigger(trigger))
    const triggersByBucket = new Map<string, SemanticTriggerState[]>()

    for (const trigger of triggers) {
      for (const action of this.expectedActions(trigger)) {
        const key = this.bucketKey(trigger.phase, action)
        const bucket = triggersByBucket.get(key) ?? []
        bucket.push(trigger)
        triggersByBucket.set(key, bucket)
      }
    }

    return triggers.flatMap((trigger) => {
      return this.expectedActions(trigger).map((action) => {
        const bucket = triggersByBucket.get(this.bucketKey(trigger.phase, action)) ?? [trigger]
        return this.validatePricePercentChangeTrigger(trigger, action, bucket, input, this.readLockedContextTimeframe(input.semanticState))
      })
    })
  }

  private isBlockingPricePercentChangeTrigger(trigger: SemanticTriggerState): boolean {
    const basis = typeof trigger.params.basis === 'string' ? trigger.params.basis : 'prev_close'
    return trigger.key === 'price.percent_change'
      && trigger.status === 'locked'
      && trigger.source === 'user_explicit'
      && basis === 'prev_close'
      && (trigger.phase === 'entry' || trigger.phase === 'exit')
  }

  private validatePricePercentChangeTrigger(
    trigger: SemanticTriggerState,
    expectedAction: PositionAction,
    bucketTriggers: SemanticTriggerState[],
    input: {
      canonicalSpec: CanonicalStrategySpec
      ir: CanonicalStrategyIrV1
      ast: StrategyAstV1
    },
    contextTimeframe: string | null,
  ): StrategyConsistencyCheck {
    const expected = this.buildExpectedSnapshot(trigger, expectedAction, contextTimeframe)
    const expectedBucket = bucketTriggers.map(bucketTrigger => this.buildExpectedSnapshot(bucketTrigger, expectedAction, contextTimeframe))
    const canonical = this.buildLayerSnapshot(
      this.findCanonicalPredicates(input.canonicalSpec, trigger.phase, expectedAction),
      expected,
      expectedBucket,
    )
    const ir = this.buildLayerSnapshot(
      this.findIrPredicates(input.ir, trigger.phase, expectedAction),
      expected,
      expectedBucket,
    )
    const ast = this.buildLayerSnapshot(
      this.findAstPredicates(input.ast, trigger.phase, expectedAction),
      expected,
      expectedBucket,
    )
    const passed = canonical.passed && ir.passed && ast.passed

    return {
      key: 'semantic_atom.price_percent_change',
      level: 'critical',
      status: passed ? 'passed' : 'failed',
      expected: {
        triggerId: trigger.id,
        phase: trigger.phase,
        action: expectedAction,
        predicateKind: expected.predicateKind,
        constValue: expected.constValue,
        timeframe: expected.timeframe,
        lookbackBars: expected.lookbackBars,
        basis: trigger.params.basis ?? 'prev_close',
      },
      actual: {
        canonical,
        ir,
        ast,
      },
      message: passed
        ? 'price.percent_change semantic atom matches canonicalSpec, IR, and AST.'
        : `price.percent_change semantic atom drift: expected ${expected.predicateKind} ${expected.constValue} in canonicalSpec, IR, and AST without undeclared conflicts.`,
    }
  }

  private buildExpectedSnapshot(
    trigger: SemanticTriggerState,
    action: PositionAction,
    contextTimeframe: string | null,
  ): ExpectedSnapshot {
    const direction = this.resolveDirection(trigger)
    const valuePct = this.readPositiveNumber(trigger.params.valuePct)
    const constValue = direction === 'down'
      ? -Number((valuePct / 100).toFixed(4))
      : Number((valuePct / 100).toFixed(4))

    return {
      triggerId: trigger.id,
      action,
      predicateKind: direction === 'down' ? 'LTE' : 'GTE',
      constValue,
      timeframe: this.readString(trigger.params.window) ?? contextTimeframe,
      lookbackBars: this.readPositiveInteger(trigger.params.lookbackBars) ?? 1,
    }
  }

  private buildLayerSnapshot(
    candidates: PriceChangeSnapshot[],
    expected: ExpectedSnapshot,
    expectedBucket: ExpectedSnapshot[],
  ): LayerSnapshot {
    const matchedExpected = candidates.filter(candidate => this.matchesExpected(
      candidate,
      expected,
    ))
    const conflicts = candidates.filter(candidate =>
      !expectedBucket.some(expectedCandidate => this.matchesExpected(candidate, expectedCandidate)),
    )

    return {
      passed: matchedExpected.length > 0 && conflicts.length === 0,
      expectedBucket: expectedBucket.map(item => ({
        id: item.triggerId,
        predicateKind: item.predicateKind,
        constValue: item.constValue,
        hasPriceChangeSeries: true,
        timeframe: item.timeframe,
        lookbackBars: item.lookbackBars,
      })),
      expected: matchedExpected,
      conflicts,
      candidates,
    }
  }

  private matchesExpected(
    candidate: PriceChangeSnapshot,
    expected: Pick<ExpectedSnapshot, 'predicateKind' | 'constValue' | 'timeframe' | 'lookbackBars'>,
  ): boolean {
    return candidate.predicateKind === expected.predicateKind
      && candidate.constValue === expected.constValue
      && candidate.hasPriceChangeSeries
      && (expected.timeframe === null || candidate.timeframe === expected.timeframe)
      && candidate.lookbackBars === expected.lookbackBars
  }

  private findCanonicalPredicates(
    canonicalSpec: CanonicalStrategySpec,
    phase: SemanticTriggerState['phase'],
    action: PositionAction,
  ): PriceChangeSnapshot[] {
    if (canonicalSpec.version !== 2 || (phase !== 'entry' && phase !== 'exit')) {
      return []
    }

    return canonicalSpec.rules.flatMap(rule => {
      if (
        rule.phase === phase
        && rule.actions.some(ruleAction => ruleAction.type === action)
      ) {
        return this.collectCanonicalPriceChangePredicates(rule.condition, rule.id)
      }
      return []
    })
  }

  private collectCanonicalPriceChangePredicates(
    condition: CanonicalConditionNode,
    ruleId: string,
  ): PriceChangeSnapshot[] {
    if (condition.kind === 'atom') {
      if (condition.key !== 'price.change_pct') return []
      return [{
        id: ruleId,
        predicateKind: this.canonicalPredicateKind(condition.op),
        constValue: this.readNumber(condition.value),
        hasPriceChangeSeries: true,
        timeframe: this.readString(condition.params?.timeframe),
        lookbackBars: this.readPositiveInteger(condition.params?.lookbackBars) ?? 1,
      }]
    }
    if (condition.kind === 'expression') {
      return []
    }

    const nested = condition.children.flatMap(child =>
      this.collectCanonicalPriceChangePredicates(child, ruleId),
    )
    if (condition.kind === 'AND' || nested.length === 0) {
      return nested
    }

    return [{
      id: `${ruleId}:${condition.kind}`,
      predicateKind: condition.kind,
      constValue: null,
      hasPriceChangeSeries: true,
      timeframe: null,
      lookbackBars: null,
    }, ...nested]
  }

  private findIrPredicates(
    ir: CanonicalStrategyIrV1,
    phase: SemanticTriggerState['phase'],
    action: PositionAction,
  ): PriceChangeSnapshot[] {
    if (phase !== 'entry' && phase !== 'exit') {
      return []
    }

    const predicateById = new Map(ir.signalCatalog.predicates.map(predicate => [predicate.id, predicate]))
    const seriesById = new Map(ir.signalCatalog.series.map(series => [series.id, series]))
    return ir.ruleBlocks
      .filter(rule =>
        rule.phase === phase
        && rule.actions.some(ruleAction => ruleAction.kind === action),
      )
      .flatMap(rule => this.collectIrPriceChangePredicates(rule.when, predicateById, seriesById, new Set()))
  }

  private collectIrPriceChangePredicates(
    predicateId: string,
    predicateById: Map<string, PredicateDef>,
    seriesById: Map<string, SeriesDef>,
    seen: Set<string>,
  ): PriceChangeSnapshot[] {
    if (seen.has(predicateId)) {
      return []
    }
    seen.add(predicateId)

    const predicate = predicateById.get(predicateId)
    if (!predicate) {
      return []
    }

    const seriesArgs = predicate.args
      .map(arg => seriesById.get(arg))
      .filter((series): series is SeriesDef => series !== undefined)
    const hasPriceChangeSeries = seriesArgs.some(series => series.kind === 'PRICE_CHANGE_PCT')
    const nested = predicate.args.flatMap(arg =>
      this.collectIrPriceChangePredicates(arg, predicateById, seriesById, seen),
    )

    if (!hasPriceChangeSeries) {
      if (nested.length > 0 && predicate.kind !== 'AND') {
        return [{
          id: predicate.id,
          predicateKind: predicate.kind,
          constValue: null,
          hasPriceChangeSeries: true,
          timeframe: null,
          lookbackBars: null,
        }, ...nested]
      }
      return nested
    }

    const constSeries = seriesArgs.find(series => series.kind === 'CONST')
    const priceChangeSeries = seriesArgs.find(series => series.kind === 'PRICE_CHANGE_PCT')
    return [{
      id: predicate.id,
      predicateKind: predicate.kind,
      constValue: typeof constSeries?.value === 'number' ? constSeries.value : null,
      hasPriceChangeSeries,
      timeframe: priceChangeSeries?.timeframe ?? null,
      lookbackBars: this.readPositiveInteger(priceChangeSeries?.params?.lookbackBars) ?? 1,
    }, ...nested]
  }

  private findAstPredicates(
    ast: StrategyAstV1,
    phase: SemanticTriggerState['phase'],
    action: PositionAction,
  ): PriceChangeSnapshot[] {
    if (phase !== 'entry' && phase !== 'exit') {
      return []
    }

    return ast.decisionPrograms
      .filter(program =>
        program.phase === phase
        && program.actions.some(programAction => programAction.kind === action),
      )
      .flatMap(program => this.collectAstPriceChangePredicates(program.when, ast, new Set()))
  }

  private collectAstPriceChangePredicates(
    predicateExprId: string,
    ast: StrategyAstV1,
    seen: Set<string>,
  ): PriceChangeSnapshot[] {
    if (seen.has(predicateExprId)) {
      return []
    }
    seen.add(predicateExprId)

    const exprById = new Map(ast.exprPool.map(expr => [expr.id, expr]))
    const predicateExpr = exprById.get(predicateExprId)
    if (!predicateExpr || predicateExpr.nodeType !== 'predicate' || !this.isPredicatePayload(predicateExpr.payload)) {
      return []
    }

    const depExprs = predicateExpr.deps
      .map(dep => exprById.get(dep))
      .filter((expr): expr is ExprNode => expr !== undefined)
    const constExpr = depExprs.find(expr => this.isSeriesKind(expr, 'CONST'))
    const priceChangeExpr = depExprs.find(expr => this.isSeriesKind(expr, 'PRICE_CHANGE_PCT'))
    const nested = depExprs
      .filter(expr => expr.nodeType === 'predicate')
      .flatMap(expr => this.collectAstPriceChangePredicates(expr.id, ast, seen))

    if (!priceChangeExpr) {
      if (nested.length > 0 && predicateExpr.payload.kind !== 'AND') {
        return [{
          id: predicateExpr.sourceRef,
          predicateKind: predicateExpr.payload.kind,
          constValue: null,
          hasPriceChangeSeries: true,
          timeframe: null,
          lookbackBars: null,
        }, ...nested]
      }
      return nested
    }
    const constValue = constExpr && this.isSeriesPayload(constExpr.payload) && typeof constExpr.payload.value === 'number'
      ? constExpr.payload.value
      : null

    return [{
      id: predicateExpr.sourceRef,
      predicateKind: predicateExpr.payload.kind,
      constValue,
      hasPriceChangeSeries: true,
      timeframe: this.isSeriesPayload(priceChangeExpr.payload) ? priceChangeExpr.payload.timeframe ?? null : null,
      lookbackBars: this.isSeriesPayload(priceChangeExpr.payload)
        ? this.readPositiveInteger(priceChangeExpr.payload.params?.lookbackBars) ?? 1
        : 1,
    }, ...nested]
  }

  private canonicalPredicateKind(op: CanonicalConditionAtom['op']): PredicateKind {
    switch (op) {
      case 'EQ':
      case 'LTE':
      case 'GTE':
      case 'CROSS_OVER':
      case 'CROSS_UNDER':
        return op
      default:
        return 'EQ'
    }
  }

  private resolveDirection(trigger: SemanticTriggerState): PriceChangeDirection {
    const direction = trigger.params.direction
    if (direction === 'up' || direction === '上涨' || direction === '涨') return 'up'
    if (direction === 'down' || direction === '下跌' || direction === '跌') return 'down'

    return this.readNumber(trigger.params.valuePct) < 0 ? 'down' : 'up'
  }

  private expectedActions(trigger: SemanticTriggerState): PositionAction[] {
    if (trigger.phase === 'entry') {
      if (trigger.sideScope === 'short') return ['OPEN_SHORT']
      if (trigger.sideScope === 'both') return ['OPEN_LONG', 'OPEN_SHORT']
      return ['OPEN_LONG']
    }
    if (trigger.sideScope === 'short') return ['CLOSE_SHORT']
    if (trigger.sideScope === 'both') return ['CLOSE_LONG', 'CLOSE_SHORT']
    return ['CLOSE_LONG']
  }

  private bucketKey(phase: SemanticTriggerState['phase'], action: PositionAction): string {
    return `${phase}:${action}`
  }

  private isSeriesKind(expr: ExprNode, kind: SeriesDef['kind']): boolean {
    return expr.nodeType === 'series'
      && this.isSeriesPayload(expr.payload)
      && expr.payload.kind === kind
  }

  private isPredicatePayload(payload: ExprNode['payload']): payload is PredicateDef {
    return typeof payload === 'object'
      && payload !== null
      && 'args' in payload
      && Array.isArray(payload.args)
  }

  private isSeriesPayload(payload: ExprNode['payload']): payload is SeriesDef {
    return typeof payload === 'object'
      && payload !== null
      && 'kind' in payload
      && !('args' in payload)
      && !('anchorRef' in payload)
  }

  private readPositiveNumber(value: unknown): number {
    const numeric = Math.abs(this.readNumber(value))
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 0
  }

  private readNumber(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0
  }

  private readPositiveInteger(value: unknown): number | null {
    return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null
  }

  private readString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
  }

  private readShapeNumber(shape: SemanticCapabilityShape, key: string): number | null {
    const value = shape[key]
    return typeof value === 'number' && Number.isFinite(value) ? value : null
  }

  private readShapeString(shape: SemanticCapabilityShape, key: string): string | null {
    const value = shape[key]
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
  }

  private readShapeBoolean(shape: SemanticCapabilityShape, key: string): boolean | null {
    const value = shape[key]
    return typeof value === 'boolean' ? value : null
  }

  private readLockedContextSlotString(slot: SemanticState['contextSlots']['marketType']): string | null {
    if (!slot || slot.status !== 'locked') return null
    return this.readString(slot.value)
  }

  private readLockedContextTimeframe(semanticState: SemanticState): string | null {
    const timeframe = semanticState.contextSlots.timeframe
    if (!timeframe || timeframe.status !== 'locked') return null
    return this.readString(timeframe.value)
  }
}
